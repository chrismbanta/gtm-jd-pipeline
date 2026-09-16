export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Only POST requests are handled here.", { status: 405 });
    }

    const body = await request.json();
    console.log("Received:", body);

    // Fake result for now, standing in for what the real agent will produce later
    const fakeResult = {
      company_name: body.company_name,
      summary: "We noticed you're hiring for this role, here's a sample of what we'd build for you.",
      artifact_doc_url: "https://docs.google.com/document/d/fake-placeholder-for-now",
    };

    const clayResponse = await fetch(env.CLAY_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fakeResult),
    });

    console.log("Sent to Clay, status:", clayResponse.status);

    return new Response("Received it, sent a fake result to Clay, check both logs.", { status: 200 });
  },
};

