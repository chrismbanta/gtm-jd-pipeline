---
name: gtm-jd-judgment
description: Reads one GTM-engineer(-adjacent) job description and decides the single smallest, easiest thing GTMA could build as a free proof-of-work sample for that company. Every JD reaching this skill already passed Clay's GTM-title filter, so this skill never re-decides whether the company is worth pursuing, only what, if anything, to build. First half of a two-skill chain; hands its output to gtm-artifact-builder. Use when a Clay-sourced JD needs a build decision. Triggers on "judge this JD", "what should we build for [company]", "pick the easiest thing to build".
---

# GTM JD Judgment

Reads a job description and decides what GTMA should build as free, unsolicited proof-of-work for
that company: the Eric Nowoslawski move ("here's what your GTM engineer would ship in week one, we
already built it"), applied at GTMA's own scale.

## Scope: read this before anything else

**This skill does not decide whether the company is worth pursuing.** That question is already
answered by the time a row gets here: Clay's Find Jobs source only admits postings that matched the
GTM-engineer title taxonomy, so every JD this skill sees is already a real, qualified lead. Re-litigating
fit here would duplicate a decision Clay already made for free, before any credit or reasoning cost was
spent. The only question this skill answers is **what, if anything, is small enough and close enough
to GTMA's own wheelhouse to build as a sample**, and "nothing" is a completely valid, expected answer
for a real fraction of rows, not a failure.

**No tool restriction.** GTMA is a GTM-systems and RevOps shop, not a Clay-only shop. Clay is one
surface among several GTMA actually builds on, not the boundary of what counts as buildable. RevOps
process work, CRM data cleaning, revenue-system architecture, and AI-agent building are all real GTMA
capabilities, and they are often exactly the roles GTMA most wants to win, not a fallback category.
Narrowing `build_target` to "whatever's buildable in Clay" would silently exclude the highest-value
matches. Judge every JD against the full capability set below, regardless of which tool the ask happens
to live in.

## Input contract

| Field | What it is |
|---|---|
| `company_name` | from the source row |
| `company_domain` | from the source row |
| `job_title` | the posting's title, as found |
| `job_description` | the full JD text (HTML tags stripped) |
| `gtma_capability_set` | what GTMA can actually build fast, across every tool GTMA works in. **Read this from `capabilities.md` at the root of this repository at run time. Do not use a remembered or copied version.** That file is the maintained source of truth precisely because a list written into this skill would go stale the moment GTMA picks up a new tool; this file must never re-describe GTMA's capabilities itself, only say where to find them. |

## The decision process

A real GTM-engineer JD almost never asks for one thing. It's a list: "architect outbound systems,"
"own Clay workflows," "build automation with n8n," "instrument community signals into CRM enrichment,"
"design a campaign builder," whatever the specific posting names. Read the whole JD and pull out every
distinct concrete ask it makes: not the generic parts (culture, comp, benefits) but the actual
responsibilities and requirements sections.

For each concrete ask, first check whether it's real: does it genuinely resemble something GTMA could
produce a real, working, specific sample of, not just an impression of one (a mention of "CRM" in a
role that's mostly Salesforce Apex engineering doesn't count just because one word overlaps).

**Among every ask that passes that check, pick the cheapest and fastest to actually build, not the
most prominent, not the one closest to the job title, not the one that best represents the role as a
whole.** Prominence and simplicity are unrelated, and when they point at different asks, simplicity
wins every time. A JD can spend four paragraphs on deep systems architecture and one short line on ABM,
and if the ABM line is the one GTMA can turn into a real sample in twenty minutes while the systems
architecture would take a week, ABM is the pick. Full stop, regardless of which one the company
clearly cares about most or would be more impressed by. The goal is a fast, credible, real sample to
open a conversation with, not a demonstration of depth across the whole role.

Pick exactly one. Do not propose two things: one playbook, one field, same discipline the Clay
playbooks use, and for the same reason: a scoped, single build is finishable; a list of possibilities
is not.

**A JD's dominant or most prominent ask does not decide the verdict. Every distinct ask does,
independently.** A JD can be mostly deep Salesforce Apex work, or mostly people management, and still
contain one line that's genuinely buildable on its own (a Clay/iPaaS mention, a signal-based outreach
line, whatever). Never let a JD's overall flavor, or its loudest, most disqualifying-sounding ask, cause
the other asks in the same posting to go unchecked. Pull out every distinct ask first, check each one,
and when more than one clears the bar, apply the simplicity rule above: cheapest and fastest wins, not
whichever was noticed first or sits closest to the job title.

**If nothing in the JD survives contact with `gtma_capability_set`, the correct output is null, not a
strained match.** But null is earned only after every distinct ask was actually checked and none of them
cleared the bar, not because the dominant ask (deep Salesforce Apex development, a management role, an
enterprise-scale AI infra role miles past what a small team can sample in an afternoon) was obviously
too deep. A company with no buildable ask still exists in the pipeline; it just skips straight to the
placement/recruiting pitch instead of the "we already built this" pitch, no artifact required.

## Output contract

Return JSON only:

```json
{
  "buildable": true,
  "build_type": "workflow",
  "build_target": "A short, concrete spec of exactly what to build, specific enough that a second
    agent with no other context could build it. Not 'an outbound system', but 'a Clay workflow that
    takes 5 sample prospects, checks whether their company posted a hiring-signal job in the last 30
    days, and writes one cold-email clause per prospect using the job-posting-language pattern.'",
  "source_jd_excerpt": "the exact line(s) from the JD that justified this pick, verbatim",
  "reasoning": "one or two sentences on why this was the easiest/closest match among everything the
    JD asked for, and what else was considered and passed over"
}
```

When nothing is buildable:

```json
{
  "buildable": false,
  "build_type": null,
  "build_target": null,
  "source_jd_excerpt": null,
  "reasoning": "one or two sentences on why nothing in the JD matched gtma_capability_set closely
    enough, name the asks that were considered, so this is auditable later, not a bare 'no'"
}
```

## Worked examples (real data, from GTMA's own Find Jobs table)

**SalesCaptain: buildable.** JD line: *"Build and optimize advanced Clay workflows, including
enrichment waterfalls, Claygent, AI columns... Design intent and signal-based outbound systems using
signals such as job changes, funding, hiring activity."* This is close to verbatim what GTMA already
built this session. `build_target`: a small signal-based enrichment sample: take a handful of real
prospects, run a hiring-signal check, output one clause each.

**Hostaway: buildable.** JD gives its own example: *"building a campaign builder that allows a
marketer to input a brief... connects to platforms like Meta/LinkedIn/Google"* and *"an email
automation workflow that connects to our platform to identify signals that would trigger an email
cadence."* `build_target`: a small signal-triggered email-draft sample, same underlying pattern as
SalesCaptain, different framing.

**Ramp: not buildable, and this one needs every ask checked, not just the loudest one.** The JD's
dominant ask is deep Salesforce Apex, Lightning Web Components, and CPQ/quote-to-cash engineering, 7+
years on that specific platform, clearly too deep to sample. But the JD also has one line that could
look like an opening: *"Design, develop, and maintain solutions on iPaaS (Homegrown, Workato, Clay,
etc)."* Checked on its own merits, this still doesn't clear the bar, it's a passing mention of Clay
among several other iPaaS tools, with no described responsibility specific enough to build a sample
from (contrast with SalesCaptain's or Hostaway's Clay lines, which each name concrete, detailed work).
So this is still a null, but because both asks were actually checked and neither held up, not because
"Salesforce Apex" was the first thing noticed.

**Clay (the company): not buildable.** JD is *"lead and scale a team of... GTMEs... build the
processes, playbooks, and culture."* This is a management role. There is no artifact to demo for a
management job, regardless of how well GTMA's own Clay skills would otherwise fit the company.

## What to do next

If `buildable: true`, hand this exact JSON output, plus `company_name` and `company_domain`, to
`gtm-artifact-builder`. If `buildable: false`, this JD is done. It routes to the placement/recruiting
pitch, no artifact step runs.

## Related skills

- `gtm-artifact-builder`: the second half of the chain, consumes this skill's output
- `lead-magnet-brainstorm` (from the pulled Eric skill set): the scoring instinct this skill's rubric
  is adapted from
- `playbooks/playbook-job-posting-language`: the concrete pattern most `build_target`s will end up
  resembling, since it's the closest thing GTMA has already proven end to end
