# ExampleCo — GTM proof of work — fictional example

This is a fictional example of the content `gtm-artifact-builder` writes to the Notion page referenced
in `docs/sample-result.json`. Company, signals, and contacts below are invented for illustration, not
real output.

---

**Summary:** You're hiring a Senior GTM Engineer to build signal-based outbound, so we built a working
slice of it: 5 real companies matched on a hiring signal, with one cold-email opening clause written per
account.

## What this is

One pass of a signal-to-copy pipeline, end to end. Input: five companies pulled from ExampleCo's stated
ICP. Signal check: is this company currently hiring a revenue role, and what does the specific role
imply? Output: one cold-email opening clause per account, derived from the signal itself, not from the
company's boilerplate.

## The five accounts (fictional)

1. **Acme Robotics** — hiring "Founding BDR." No outbound infrastructure exists yet.
   *Clause:* "Noticed you're hiring a founding BDR, which usually means the first rep inherits a blank
   page: no list, no enrichment, no sequencing."

2. **Northwind Analytics** — hiring "SDR Manager, Enterprise Outbound." The motion already works at
   small scale; the constraint moved to repeatability.
   *Clause:* "Hiring an SDR Manager instead of another rep usually means booking meetings is solved and
   the real question became whether the list can keep up with the team."

3. **Fictional Health** — $40M Series B plus a new-territory enterprise AE req in the same stretch.
   *Clause:* "Fresh Series B and an enterprise AE req in the same quarter is the setup where the rep
   lands a full quarter before the territory pipeline does."

(Two more rows follow the same pattern in a real run.)

## How this scales

This pass was run by hand to keep it fast and verifiable. Productionized, it's the same three steps the
posting describes: a signal source feeding an enrichment step, a judgment step that classifies which
role is open and what it implies, and a generation step constrained to one clause so it stays usable as
an opening line.

## Scope note

This is one deliberately small sample, built to be checked, not a system. Nothing here was run through
Clay's workflow UI, since Clay's own API has no workflow-creation endpoints, so an unattended build of
this exact pipeline inside Clay needs a person logged into the UI. The logic and the judgment criteria
are what transfer.
