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

- Google Drive (Docs) write access for the hosted agent — wired via the `google_drive` MCP server
  (`https://drivemcp.googleapis.com/mcp/v1`, declared in `agent.yaml`) with a vault OAuth credential
  (`vcrd_01M3ZnEZAetcZqvwMgwSduau`) scoped to `drive.file` + `drive.readonly`, validated via
  `ant beta:vaults:credentials mcp-oauth-validate` (status: valid). This is the mechanism
  `gtm-artifact-builder` should use to write the final artifact Doc — do not treat it as missing or
  unavailable.
- Clay AI-judgment columns (GENERAL TASK / MORE SPECIFIC INSTRUCTIONS / OUTPUT FORMAT / INPUTS
  structure, judgment-only AI use) — demonstrated interactively; not yet confirmed reachable via the
  Public API key alone (the Public API has no workflow/table-editing endpoints either — check before
  assuming a judgment column can be added or edited by the hosted agent)
- Clay enrichment/prospecting pipelines — department- and title-filtered people search via FullEnrich
  (raw API, not just the native Clay action). Corrected from an earlier version of this file that named
  Prospeo: the vault credential actually provisioned is FULLENRICH_API_KEY, not Prospeo. Confirm which
  provider is actually wired before assuming either name.
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

The real, complete list. Add what's missing, remove anything wrong, and correct the lists above if any
of them is mischaracterized.
