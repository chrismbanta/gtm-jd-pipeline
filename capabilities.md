# Capabilities

What the hosted build agent can actually produce, read by `gtm-jd-judgment` and `gtm-artifact-builder`
at run time. This file is the source of truth for both skills; neither skill re-describes capabilities
inline, only points here, so one update stays correct everywhere instead of drifting out of sync.

**A hosted agent's capabilities are not the same as a human's.** The agent has only whatever vault
credentials, MCP servers, and repo-mounted skills a session was given: no browser, no interactive login,
no human clicking through a UI. Before marking anything below as agent-buildable, it must be reachable
through a real API endpoint or a wired integration, not just "a person could do this with the tool open."
Confirmed case in point: Clay's own OpenAPI spec (developers.clay.com/openapi.json) has zero endpoints
for creating workflows, creating tables, or authoring workflow steps, so every Clay workflow build below
is UI/browser-OAuth-only regardless of which API key the agent holds.

## Agent-buildable (proven)

- **Notion page writes.** Wired as a vault credential scoped to the Notion API, no OAuth, no expiry.
  There is no MCP server for this: the agent calls Notion's REST API directly over HTTPS, with the vault
  injecting the bearer token at the network layer. This is the mechanism `gtm-artifact-builder` uses to
  write the final artifact page.
- **Clay AI-judgment columns** (general task / specific instructions / output format / inputs
  structure, judgment-only AI use). Demonstrated interactively; not yet confirmed reachable via the
  Public API alone, since the Public API has no workflow or table-editing endpoints either.
- **Clay enrichment and prospecting pipelines** — department- and title-filtered people search via a
  dedicated enrichment API (not just the native Clay action).
- **Signal-to-copy pipelines** — a hiring, funding, or tech signal turned into one cold-email clause.

## Not agent-buildable (and why)

- **Clay workflow or table creation, or authoring and publishing workflow steps.** Confirmed via Clay's
  own OpenAPI spec: the Public API is read/query/execute-only (account info, credits, routines,
  searches, table queries, workflow-run queries), with no creation endpoints of any kind. This requires
  either the Clay UI or the CLI's browser-OAuth login, a human present. Never mark this buildable by the
  hosted agent, regardless of which Clay credential it has.

## Planned, not yet demonstrated

- RevOps (process design and cleanup)
- CRM data cleaning (dedup, standardization, field mapping)
- Revenue systems
- Building AI agents
- Automation tooling (n8n or similar) for workflow automation
