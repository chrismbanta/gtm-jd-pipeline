---
name: gtm-artifact-builder
description: Takes a build decision from gtm-jd-judgment and actually constructs the small proof-of-work sample, then writes it to a Google Doc and returns a short summary plus the doc link. Second half of a two-skill chain — never runs on its own, only after gtm-jd-judgment returns buildable:true. Use when a judged, scoped build_target needs to become a real artifact. Triggers on "build this", "make the sample for [company]", "execute the build_target".
---

# GTM Artifact Builder

Builds the actual thing `gtm-jd-judgment` decided on, and hands back something small enough to drop
into a Clay cell: a one-line summary and a link. Never the full artifact itself — Clay's basic and
formula fields have a hard character cap, already hit once this session on job descriptions alone; a
built artifact (a workflow spec, a sample list, an ABM writeup) will be bigger, not smaller.

## Scope — read this before anything else

**Only runs after `gtm-jd-judgment` returns `buildable: true`.** This skill trusts that decision
completely — it does not re-evaluate whether the `build_target` is worth building, only how to build
it. If the input is missing `build_target` or carries `buildable: false`, stop and say so; don't
improvise a build from a null decision.

**Build small, on purpose.** The whole point of this move is speed — Eric's own version was built in
one sitting, not a real client engagement. A `build_target` should take on the order of minutes to an
hour to produce, not a real project. If executing it is turning into a large effort, that's a signal
the judgment step under-scoped it, not a reason to keep going, stop and flag it rather than quietly
turning a sample into a real build.

## Input contract

Exactly `gtm-jd-judgment`'s output when `buildable: true`, plus `company_name` and `company_domain`
carried over from the source row.

## Build process

**Build in whatever tool the `build_target` actually lives in — Clay is one option, not the default.**
`gtm-jd-judgment` picks the closest real GTMA capability regardless of tool, so this step needs to
follow it there: a CRM-cleaning ask gets built in Clay, connected to the CRM, not built directly inside
the CRM tool itself, a revenue-systems ask gets built wherever that system lives, an agent-building ask
gets built as a real working agent. A written deliverable (a
RevOps process doc, a cleanup plan) is a complete, real artifact in its own right when that's what the
ask calls for, not a fallback for when a "real" build isn't possible.

**Within Clay specifically, prefer a Clay workflow over a Clay table, whenever the `build_target`
allows it.** This is a real
technical constraint, not a style preference: Clay's CLI can create and publish workflows
(`clay workflows create`, `nodes create`, `publish`, `runs start`) but it cannot create a table or add
a column to one — that's browser-only. A `build_target` shaped as a workflow (a signal check, an
enrichment pass, a small pipeline with a few nodes) can be fully built and even run via CLI, end to end,
unattended. A `build_target` shaped as a table cannot be built this way at all right now.

If the `build_target` is genuinely table-shaped and a workflow can't stand in for it, don't pretend to
build it. Produce a written table spec instead — same shape as the `clay-table.md` files in the pulled
playbooks (columns, types, formulas, run conditions, credit gates) — and say plainly in the output that
this needs a few minutes of manual column creation in the Clay UI before it's live. A spec that's honest
about needing a manual step is worth more than a claimed build that silently doesn't exist.

For a workflow build: use `clay workflows actions list` and `clay workflows actions schema` to find
real actions for whatever the target needs (don't guess action names or input field names), build the
graph, publish it, and — if the `build_target` calls for a demonstrable output, not just a live
pipeline — run it once on a small real sample (5-10 rows is plenty) so the artifact includes actual
output, not just a description of what it would do.

## Access

**Read `gtma-capabilities.md` at the root of this repository to know what's actually wired up before
assuming anything.** Do not assume Clay + Prospeo is the whole picture — `gtm-jd-judgment` no longer
restricts `build_target` to Clay-shaped work, so a build routinely needs something else: CRM access for
a data-cleaning sample, whatever platform a revenue-systems ask lives in, an agent framework for an
agent-building ask. Needing a credential beyond Clay/Prospeo is now the expected case, not the rare
exception.

If `build_target` needs something not listed as available in `gtma-capabilities.md`, stop and name
exactly what's missing in the output rather than routing around it or faking a result. Once a new
credential actually gets wired up, that's the moment to add it to `gtma-capabilities.md`, so the list
stays real instead of drifting the same way the old hardcoded version did.

## Writing the artifact

Write the full artifact (the built workflow's output, the table spec, whatever was produced) to a
Google Doc — GTMA's agreed storage for this, chosen over Cloudflare R2/D1 specifically because it needs
no new infrastructure and stays human-readable. Title the doc something identifiable
(`<company_name> — GTM proof of work — <date>`), and write the summary as the doc's first line so it's
legible without opening anything else.

## Output contract

Return JSON only:

```json
{
  "build_status": "built",
  "artifact_doc_url": "https://docs.google.com/...",
  "summary": "One or two sentences, written the way it would read in a cold email — 'we noticed you're
    hiring for X, so we already built Y' — not a technical changelog.",
  "build_type": "workflow"
}
```

`build_status` is `"built"` for a real, working artifact; `"spec_only_needs_manual_step"` for a table
spec that still needs UI work; `"blocked"` if genuinely missing access, with the missing thing named in
`summary` instead of a fabricated result.

## What to do next

This output is what gets relayed back through Cloudflare to Clay — `summary` and `artifact_doc_url`
land in the row as short fields, never the full artifact content. From there the pipeline moves to
finding the hiring manager (Prospeo) and, eventually, sending from Clay's Sequencer.

## Related skills

- `gtm-jd-judgment` — always runs first, this skill's only valid input source
- `playbooks/playbook-job-posting-language` (pulled Eric skill) — the closest existing reference for
  what a signal-to-copy workflow build actually looks like end to end, node by node
