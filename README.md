# GTM JD Pipeline

Clay sends a job posting over, this Worker kicks off a Claude Managed Agents session that judges
whether it's worth building a free proof-of-work sample for, builds it if so, writes the result to
Notion, and relays a short summary + link back to Clay. Unattended end to end.

## How it works

```
Clay (webhook)  ──POST──>  Cloudflare Worker (src/index.js)  ──creates──>  Managed Agents session
                                                                                     │
                                                                          runs gtm-jd-judgment,
                                                                          then gtm-artifact-builder
                                                                                     │
                                                                          writes artifact to Notion
                                                                                     │
Clay  <──POST (summary + Notion link)──  Worker  <──webhook (session idle)──────────┘
```

- `src/index.js` handles two routes: the root path takes Clay's intake POST and creates the session;
  `/anthropic-webhook` receives Anthropic's completion callback and relays the final result to Clay.
- `agent.yaml` defines the agent (model, system prompt, tools). It no longer declares any MCP server —
  the agent only needs `agent_toolset_20260401` (bash, read, write, web_search, web_fetch).
- `.claude/skills/gtm-jd-judgment` and `.claude/skills/gtm-artifact-builder` are the two-skill chain the
  agent runs, in that order, each time.
- `gtma-capabilities.md` (repo root) is the single source of truth the skills read for what's actually
  wired up and usable by the hosted agent — keep it current, don't let the skills guess.

## Setup

### Cloudflare Worker secrets

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ANTHROPIC_WEBHOOK_SIGNING_KEY
npx wrangler secret put CLAY_WEBHOOK_URL
npx wrangler secret put GITHUB_TOKEN
```

Check what's set (doesn't show values, write-only):

```bash
npx wrangler secret list
```

### Vault credentials

Vault id: `vlt_011Cf9q2aMijZHiXuHSqDFKB` (matches `VAULT_ID` in `wrangler.toml`, passed to every session).

| Credential | Type | Scoped to | Notes |
|---|---|---|---|
| Clay Public API Key | `environment_variable` | `api.clay.com` | `clay-vault-credential.yaml` (gitignored) |
| FullEnrich API Key | `environment_variable` | `app.fullenrich.com` | `fullenrich-vault-credential.yaml` (gitignored) |
| Notion Integration Token | `environment_variable` | `api.notion.com` | `notion-vault-credential.yaml` (gitignored). Internal Notion integration token, doesn't expire |

Create/update a credential:

```bash
export ANTHROPIC_API_KEY="..."   # needed for the ant CLI itself, separate from the Worker secret of the same name
ant beta:vaults:credentials create --vault-id vlt_011Cf9q2aMijZHiXuHSqDFKB < some-credential.yaml
ant beta:vaults:credentials update --vault-id vlt_011Cf9q2aMijZHiXuHSqDFKB --credential-id vcrd_... < some-credential.yaml
```

List what's in the vault:

```bash
ant beta:vaults:credentials list --vault-id vlt_011Cf9q2aMijZHiXuHSqDFKB
```

## Deploy

```bash
npx wrangler deploy
```

**`git push` alone does not deploy the Worker.** Pushing only updates what the Managed Agent reads from
the mounted GitHub repo (skills, `agent.yaml`, `gtma-capabilities.md`). The Worker itself
(`src/index.js`) only goes live when you run `wrangler deploy`, or incidentally via `wrangler secret
put` (which bundles whatever code is on disk at that moment along with the secret change). If you change
`src/index.js`, deploy it explicitly; don't assume a `git push` was enough.

## Test

```bash
curl -X POST https://gtm-jd-pipeline.chris-81e.workers.dev/ \
  -H "Content-Type: application/json" \
  --data @test-jd-payload.json
```

Returns immediately with `{"status":"processing","session_id":"..."}` — the real result comes later via
the webhook, not in this response.

## Watch it live

Two terminal panes:

- **Left pane** — `npx wrangler tail`, left running. Purely passive; shows a log line the instant the
  Worker handles any request. Start this *before* firing the test curl, not after — tail has no memory,
  it only shows things that happen after it connects.
- **Right pane** — everything else: the curl test, `wrangler secret put`, `ant` commands.

To check a specific session's outcome without relying on tail's timing (e.g. if it already finished
before tail connected):

```bash
ant beta:sessions retrieve --session-id sesn_...
```

`status: idle` means it's done. To see exactly what it did step by step (useful when the final result
looks wrong or incomplete):

```bash
ant beta:sessions:events list --session-id sesn_... --max-items -1 > /tmp/events.json
```

The `ant` CLI's TUI output can render blank in some terminal setups — redirecting to a file and `cat`-ing
it, or piping through `cat`, reliably works around that.

## Why Notion, not Google Drive

The artifact used to get written to a Google Doc via a `google_drive` MCP server + OAuth vault
credential. Dropped entirely on 2026-10-14 after it ate multiple full debugging days across several real
problems, in order encountered:

1. **Three separate Google Cloud APIs had to be enabled one at a time** — Drive API, then (discovered
   only after a failure) Docs API, then (checked separately) a distinct "Drive MCP API" — each one a
   silent prerequisite with no single error pointing at what was actually missing.
2. **The OAuth consent screen defaulted to "Internal" user type**, meaning only accounts inside the
   `thegtma.co` Workspace could ever authenticate — not a scope or test-user issue, a hard platform
   restriction with no bypass. Had to explicitly flip it to "External" + "Testing."
3. **Testing-mode refresh tokens expire after exactly 7 days** (confirmed directly:
   `refresh_token_expires_in: 604799` in the OAuth token response), regardless of use. This meant the
   credential needed manual re-authorization through Google's OAuth Playground roughly every week,
   indefinitely, for as long as this integration existed.
4. **Even with a technically-valid token and correct scope**, the Drive MCP server returned a bare
   `"The caller does not have permission"` with zero further detail — no error code, no reason — on
   every call (create, list, search alike), which took a full day to even localize to the right layer.
5. **Google Workspace's domain-level "App Access Control"** can independently block an otherwise
   correctly-consented OAuth app, a restriction invisible from inside the OAuth flow and fixable only by
   a Workspace admin — this is what the "caller does not have permission" errors ultimately traced back
   to, confirmed by switching the authorizing account to a personal (non-Workspace) Gmail and having it
   work immediately with identical scopes.

Replacement: a plain Notion **internal integration** token — not OAuth, no consent screen, no expiry,
created once at notion.so/my-integrations. Stored as a vault `environment_variable` credential scoped to
`api.notion.com`. No MCP server at all — the agent calls Notion's REST API directly via `curl` in bash,
per the instructions in `gtm-artifact-builder/SKILL.md`. Target parent page:
`3f974b75-d5f0-807b-9113-dc5c73797cf2` ("GTMA Artifacts").

## Known open item

The first live run on the new Notion integration (`sesn_016yYCyB2iTy5aNPWgKhDz5T`, 2026-10-14) hit
`stop_reason: retries_exhausted` mid-task — right after a local file write, shortly before the actual
Notion API call — but the session still recovered enough to complete the build and write the page
successfully. Root cause unconfirmed: possibly a transient Anthropic-side rate limit or overload,
unrelated to Notion specifically. One occurrence isn't enough to call it a pattern; worth watching on
future runs rather than assuming it's fixed or assuming it'll recur.
