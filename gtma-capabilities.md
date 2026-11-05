# GTMA Capabilities

What GTMA can actually build fast, for use by `gtm-jd-judgment` and `gtm-artifact-builder` (and
anything else that needs to know what's real vs. aspirational). Referenced by path, not copied inline
into any skill file — keep this current here, not duplicated elsewhere.

**This is a draft.** It only has what's been directly demonstrated this session, plus a short list
Chris named once in passing. It is almost certainly incomplete. Correct and expand it directly, this
file is the fix for the mistake of guessing this list from memory instead of asking.

**Critical distinction — read before judging buildability.** "GTMA can do X" and "the unattended hosted
build agent can do X" are NOT the same claim, and this file has conflated them before. GTMA (a human,
in an interactive session, possibly with a browser) can do things the hosted agent categorically
cannot: the hosted agent has only whatever vault credentials, MCP servers, and github-mounted skills a
session was given — no browser, no interactive login, no human clicking through a UI. Before marking
anything below as agent-buildable, confirm it's reachable through a real API endpoint or a wired MCP
server, not just "GTMA has done this with a person driving." Confirmed case in point: Clay's own
OpenAPI spec (developers.clay.com/openapi.json) has zero endpoints for creating workflows, creating
tables, or authoring workflow steps — every Clay workflow build claim below is UI/browser-OAuth-only,
regardless of which API key the agent is given. No Clay key will ever unlock this for the hosted agent.

## Demonstrated this session (proven, not guessed)

- Notion page-write access for the hosted agent — wired as a vault `environment_variable` credential
  (`vcrd_01GHoHLhPLeVVSsbjq9nouxm`, secret name `NOTION_API_KEY`) scoped to `api.notion.com` only, no
  OAuth, no expiry. There is no MCP server for this; the agent calls Notion's REST API directly via
  `curl` in bash, with the vault injecting the bearer token at the network layer. Target parent page is
  `3f974b75-d5f0-807b-9113-dc5c73797cf2` ("GTMA Artifacts"). This replaces the earlier Google Drive/Docs
  MCP integration (dropped 2026-10-14 — Google's OAuth consent token expired every 7 days in Testing
  mode and needed re-authorization each time, on top of the multi-API-enablement setup; not worth the
  maintenance for a build-time artifact store). This is the mechanism `gtm-artifact-builder` should use
  to write the final artifact page — do not treat it as missing or unavailable.
- Clay AI-judgment columns (GENERAL TASK / MORE SPECIFIC INSTRUCTIONS / OUTPUT FORMAT / INPUTS
  structure, judgment-only AI use) — demonstrated interactively; not yet confirmed reachable via the
  Public API key alone (the Public API has no workflow/table-editing endpoints either — check before
  assuming a judgment column can be added or edited by the hosted agent)
- Clay enrichment/prospecting pipelines — department- and title-filtered people search via FullEnrich
  (raw API, not just the native Clay action). Corrected from an earlier version of this file that named
  Prospeo: the vault credential actually provisioned is FULLENRICH_API_KEY, not Prospeo. Confirm which
  provider is actually wired before assuming either name.
- FullEnrich REST API for the hosted agent — vault `environment_variable` credential
  (`vcrd_013esnkFLa8opuKp8c95A2vP`, secret name `FULLENRICH_API_KEY`) scoped to `app.fullenrich.com`.
  Confirmed working 2026-11-05 with v2 `company/lookup`, `people/search` (0.25 credit per person
  returned) and `contact/enrich/bulk` (1 credit per work email found). `gtm-decision-maker-finder` uses
  it to find the recipient at the hiring company.
- Signal-to-copy pipelines — a hiring/funding/tech signal turned into one cold-email clause

## NOT agent-buildable (confirmed, not just unwired)

- **Clay workflow or table creation, or authoring/publishing workflow steps.** Confirmed via Clay's own
  OpenAPI spec: the Public API is read/query/execute-only (account info, credits, routines, searches,
  table queries, workflow-run queries) with no creation endpoints of any kind. This requires either the
  Clay UI or the `clay` CLI's browser-OAuth login (a human present) — never mark this buildable by the
  hosted agent, no matter what Clay credential it has.

## Named by Chris, not yet demonstrated in a build here

- RevOps (process design and cleanup)
- CRM data cleaning (dedup, standardization, field mapping)
- Revenue systems
- Building AI agents
- Automation tooling (n8n, or similar automation platforms) for workflow automation

## Still needed

The real, add what's missing, remove anything wrong, and correct the lists above if any
of them is mischaracterized.
