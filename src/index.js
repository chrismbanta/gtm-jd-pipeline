const ANTHROPIC_VERSION = "2023-06-01";
const MANAGED_AGENTS_BETA = "managed-agents-2026-04-01";
const SESSION_MAP_TTL_SECONDS = 60 * 60 * 24 * 7; // a session should finish long before this

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Only POST requests are handled here.", { status: 405 });
    }

    const path = new URL(request.url).pathname;

    if (path === "/anthropic-webhook") {
      return handleAnthropicWebhook(request, env, ctx);
    }

    return handleClayIntake(request, env, ctx);
  },
};

// Clay calls this (its HTTP API action) with one job posting's data. We kick off
// a real Managed Agents session and return immediately — the agent can take
// minutes to run both skills, so the actual result comes back later via
// /anthropic-webhook, not in this response.
async function handleClayIntake(request, env, ctx) {
  const body = await request.json();
  console.log("Received from Clay:", body);

  if (!body.company_name || !body.job_description) {
    return new Response("Missing required fields: company_name, job_description", { status: 400 });
  }

  const promptText = buildAgentPrompt(body);

  const sessionResponse = await fetch("https://api.anthropic.com/v1/sessions", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-beta": MANAGED_AGENTS_BETA,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      agent: env.AGENT_ID,
      environment_id: env.ENVIRONMENT_ID,
      vault_ids: [env.VAULT_ID],
      title: `JD processing - ${body.company_name}`,
      resources: [
        {
          type: "github_repository",
          url: env.GITHUB_REPO_URL,
          authorization_token: env.GITHUB_TOKEN,
        },
      ],
      initial_events: [
        {
          type: "user.message",
          content: [{ type: "text", text: promptText }],
        },
      ],
    }),
  });

  if (!sessionResponse.ok) {
    const errorBody = await sessionResponse.text();
    console.log("Session creation failed:", sessionResponse.status, errorBody);
    return new Response(`Failed to create session: ${errorBody}`, { status: 502 });
  }

  const session = await sessionResponse.json();
  console.log("Created session:", session.id);

  // Store what Clay needs back so /anthropic-webhook can re-attach it later —
  // the webhook event itself carries only the session id, nothing else.
  await env.SESSION_MAP.put(
    session.id,
    JSON.stringify({
      company_name: body.company_name,
      company_domain: body.company_domain,
      job_title: body.job_title,
    }),
    { expirationTtl: SESSION_MAP_TTL_SECONDS },
  );

  return new Response(JSON.stringify({ status: "processing", session_id: session.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Anthropic calls this when a session's status changes. We only care about
// session.status_terminated — that's when the agent has finished running
// both skills and we can go fetch its final answer.
async function handleAnthropicWebhook(request, env, ctx) {
  const rawBody = await request.text();

  const isValid = await verifyWebhookSignature(request.headers, rawBody, env.ANTHROPIC_WEBHOOK_SIGNING_KEY);
  if (!isValid) {
    console.log("Webhook signature verification failed");
    return new Response("invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);
  console.log("Webhook event:", event.data?.type, event.data?.id);

  // A session goes "idle" once the agent finishes answering — it does NOT
  // auto-terminate. "terminated" only fires on an unrecoverable error or
  // explicit archival. For our single-turn use case, idle is the normal
  // "done" signal; terminated is the error/cleanup fallback. We subscribe to
  // both in Console, so guard against acting on anything else we're not
  // expecting here.
  const isDone = event.data?.type === "session.status_idled" || event.data?.type === "session.status_terminated";
  if (!isDone) {
    return new Response(null, { status: 200 });
  }

  const sessionId = event.data.id;

  // Idempotency: both idled and terminated can fire for the same session.
  // Whichever one gets here first "claims" the session by deleting its KV
  // entry, so a second delivery for the same session finds nothing and skips
  // re-sending to Clay.
  const storedCorrelation = await env.SESSION_MAP.get(sessionId);
  if (!storedCorrelation) {
    console.log("No stored correlation for session (already handled, or unknown session):", sessionId);
    return new Response(null, { status: 200 });
  }
  await env.SESSION_MAP.delete(sessionId);

  const result = await fetchFinalAgentResult(sessionId, env);
  const correlation = JSON.parse(storedCorrelation);

  const finalPayload = { ...correlation, ...result };
  console.log("Sending to Clay:", finalPayload);

  const clayResponse = await fetch(env.CLAY_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(finalPayload),
  });
  console.log("Sent to Clay, status:", clayResponse.status);

  return new Response(null, { status: 200 });
}

async function fetchFinalAgentResult(sessionId, env) {
  const eventsResponse = await fetch(
    `https://api.anthropic.com/v1/sessions/${sessionId}/events?beta=true&types[]=agent.message`,
    {
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-beta": MANAGED_AGENTS_BETA,
      },
    },
  );

  if (!eventsResponse.ok) {
    const errorBody = await eventsResponse.text();
    console.log("Failed to fetch session events:", eventsResponse.status, errorBody);
    return { error: "Could not fetch session events", detail: errorBody };
  }

  const events = await eventsResponse.json();
  const agentMessages = events.data.filter((e) => e.type === "agent.message");
  const lastMessage = agentMessages[agentMessages.length - 1];

  if (!lastMessage) {
    return { error: "Session terminated with no agent message" };
  }

  const text = lastMessage.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  try {
    // The agent's system prompt (agent.yaml) instructs it to return the final
    // JSON result from whichever skill ran last — parse that out directly.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (err) {
    console.log("Could not parse agent's final message as JSON:", text);
    return { raw_result: text, parse_error: true };
  }
}

// Anthropic signs webhooks the same way Stripe/Svix do (the "Standard
// Webhooks" scheme): HMAC-SHA256 over "{id}.{timestamp}.{body}", using the
// secret after the whsec_ prefix (base64-decoded), compared against one of
// the space-separated "v1,<sig>" values in the webhook-signature header.
async function verifyWebhookSignature(headers, rawBody, signingKey) {
  const webhookId = headers.get("webhook-id");
  const webhookTimestamp = headers.get("webhook-timestamp");
  const webhookSignature = headers.get("webhook-signature");

  if (!webhookId || !webhookTimestamp || !webhookSignature || !signingKey) {
    return false;
  }

  // Reject stale deliveries (more than 5 minutes old), matching Anthropic's
  // own documented freshness check.
  const timestampSeconds = parseInt(webhookTimestamp, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Number.isNaN(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > 300) {
    return false;
  }

  const secretBytes = base64ToBytes(signingKey.replace(/^whsec_/, ""));
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(signedContent));
  const expectedSignature = bytesToBase64(new Uint8Array(signatureBytes));

  const providedSignatures = webhookSignature.split(" ").map((s) => s.split(",")[1]);
  return providedSignatures.some((sig) => sig === expectedSignature);
}

function base64ToBytes(base64) {
  const binaryString = atob(base64);
  return Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes) {
  let binaryString = "";
  for (const byte of bytes) binaryString += String.fromCharCode(byte);
  return btoa(binaryString);
}

function buildAgentPrompt(body) {
  return `Here is a job posting to process. Read gtma-capabilities.md at the
root of the mounted repo, then run the gtm-jd-judgment skill on
this data, and if it says buildable, run gtm-artifact-builder next.
Return the final JSON result.

company_name: ${body.company_name}
company_domain: ${body.company_domain || ""}
job_title: ${body.job_title || ""}

job_description: |
${body.job_description
  .split("\n")
  .map((line) => "  " + line)
  .join("\n")}
`;
}
