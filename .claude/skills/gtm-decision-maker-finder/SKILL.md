---
name: gtm-decision-maker-finder
description: Finds the right person (or people) at the hiring company to send the finished proof-of-work artifact to, using FullEnrich's REST API, and returns their name, title, LinkedIn and verified work email. Third step of the chain — runs only after gtm-artifact-builder returns a built or spec_only artifact. Use when a built artifact needs a named recipient. Triggers on "find the decision maker", "who do we send this to at [company]", "find the founders".
---

# GTM Decision-Maker Finder

The artifact is worthless until it lands in front of the person who can say yes. This skill finds that
person at the company that posted the job — not at the accounts inside the artifact — and gets a work
email for them, so the row in Clay is ready for the Sequencer.

## Scope — read this before anything else

**Only runs after `gtm-artifact-builder` returns `build_status` of `"built"` or
`"spec_only_needs_manual_step"`.** If the builder returned `"blocked"`, or judgment returned
`buildable: false`, there is nothing to send — skip this skill entirely and pass the earlier result
through unchanged.

**Never invent a person or an email.** Every name, title, LinkedIn URL and email in the output must come
from a FullEnrich response in this session. If FullEnrich finds nobody, return an empty list and say so
— an empty, honest result is the correct output, a plausible-looking guess is not.

**Keep it cheap.** At most 3 people, work email only. Never request phones (10 credits each) or personal
emails (3 credits each). A typical run costs about 1–2 credits for search and up to 3 for emails.

## Access

FullEnrich's REST API, called with `curl` in bash. The vault injects the key as `$FULLENRICH_API_KEY`
at the network layer — always send it as `Authorization: Bearer $FULLENRICH_API_KEY`, never print it.
Base URL: `https://app.fullenrich.com/api/v2`. Every call below is a JSON POST/GET with
`Content-Type: application/json`.

If any call returns `401` / `"Unknown api key"`, stop and return `contact_status: "blocked"` with that
error in `contact_notes`. Do not route around it.

## Process

### 1. Classify the company

```bash
curl -s -X POST https://app.fullenrich.com/api/v2/company/lookup \
  -H "Authorization: Bearer $FULLENRICH_API_KEY" -H "Content-Type: application/json" \
  -d '{"domain":"<company_domain>"}'
```

The response is `{"companies":[{ name, headcount, headcount_range, industry.main_industry,
description, company_type, ... }]}`. Use `headcount`, `industry.main_industry` and `description`
(plus the JD itself) to put the company in exactly one bucket:

| Bucket | How to tell | Who to target |
|---|---|---|
| **Agency** | Sells services, not a product: outbound/GTM/marketing/RevOps/lead-gen agency, consultancy, studio. `description` or the JD says "agency", "we help clients", "client accounts", "done-for-you". Size doesn't matter. | Founder and co-founder(s) |
| **Small SaaS** | Sells a software product, headcount **≤ 50** (or unknown and the JD reads early-stage: "founding", "first hire", seed/Series A) | Founder and co-founder(s) |
| **Larger SaaS** | Sells a software product, headcount **> 50** | The leader who owns the hired role's function (see step 2) |
| **Other** (services co. that isn't an agency, marketplace, etc.) | Anything else | Treat as Small SaaS if ≤ 50 people, Larger SaaS if > 50 |

Judgment call, not keyword matching: a company that calls itself "AI-powered" but sells outbound as a
service is an agency. Write one sentence on why you picked the bucket — it goes in `contact_notes`.

### 2. Decide who owns the role (Larger SaaS only)

First, read the JD for a stated reporting line ("reports to the VP of Revenue", "work directly with our
Head of Growth"). If one is named, that title is the target — it beats everything below.

Otherwise target the leader of the function the role sits in. For GTM-engineer-type roles that's, in
priority order:

1. Growth / RevOps / GTM leadership — Head of Growth, VP Growth, Head of RevOps, VP Revenue Operations,
   Head of GTM, Director of GTM Engineering
2. Marketing leadership — CMO, VP Marketing, Head of Marketing, Head of Demand Gen
3. Sales leadership — CRO, VP Sales, Head of Sales

If the role is clearly in one function (e.g. "Marketing Ops Engineer" → marketing), go to that
function's leaders first.

### 3. Search for people

```bash
curl -s -X POST https://app.fullenrich.com/api/v2/people/search \
  -H "Authorization: Bearer $FULLENRICH_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "limit": 10,
    "current_company_domains": [{"value":"<company_domain>","exact_match":true}],
    "current_position_seniority_level": [{"value":"Founder"},{"value":"Owner"}]
  }'
```

Filters inside one field are OR; different fields are AND. Each person returned costs 0.25 credit, so
keep `limit` at 10.

- **Agency / Small SaaS:** seniority `Founder`, `Owner`. If that returns nobody, retry with
  `current_position_titles` of `Founder`, `Co-Founder`, `CEO`, `Managing Director`.
- **Larger SaaS:** `current_position_titles` with the step-2 titles (`exact_match` false), plus
  seniority `C-level`, `VP`, `Head`, `Director`. If nobody matches, widen to the next function in the
  priority list, then fall back to founders/CEO.

Response: `{"people":[{ full_name, first_name, last_name, employment.current.{title, seniority,
company.name}, social_profiles.professional_network.url }], "metadata":{ total, credits }}`.

### 4. Pick and dedupe

- Drop anyone whose `employment.current.company` isn't this company (wrong-company matches happen).
- The same person can appear twice under two LinkedIn profiles (seen on a real run: one person as
  "CEO" and again as "Co-Founder"). Dedupe on full name; keep the record with the more senior / more
  role-relevant title.
- Keep at most 3, best first. Founder buckets: all co-founders up to 3. Larger SaaS: the one leader who
  most directly owns the role first, then up to 2 next-closest.

### 5. Get work emails

```bash
curl -s -X POST https://app.fullenrich.com/api/v2/contact/enrich/bulk \
  -H "Authorization: Bearer $FULLENRICH_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "name": "<company_name> decision makers",
    "data": [
      {"first_name":"...","last_name":"...","domain":"<company_domain>",
       "company_name":"<company_name>","linkedin_url":"<url>",
       "enrich_fields":["contact.work_emails"]}
    ]
  }'
```

Returns `{"enrichment_id":"..."}`. Poll every 15 seconds, up to 5 minutes:

```bash
curl -s https://app.fullenrich.com/api/v2/contact/enrich/bulk/<enrichment_id> \
  -H "Authorization: Bearer $FULLENRICH_API_KEY"
```

Stop when `status` is `FINISHED` (or `CANCELED` / `CREDITS_INSUFFICIENT` / `RATE_LIMIT` — record which).
Each `data[i].contact_info.most_probable_work_email` is `{email, status}`. Keep the email when status is
`DELIVERABLE` or `HIGH_PROBABILITY`; keep `CATCH_ALL` but mark it; otherwise set `email` to null. If it
times out, return the people without emails and say so — don't wait forever.

## Output contract

Take the JSON `gtm-artifact-builder` returned and add these fields to it. The combined object is the
final result — return it as the only content of your final message, nothing before or after it.

```json
{
  "build_status": "built",
  "artifact_doc_url": "https://www.notion.so/...",
  "summary": "...",
  "build_type": "...",

  "company_bucket": "agency",
  "contact_status": "found",
  "primary_contact_name": "Jane Doe",
  "primary_contact_title": "Co-Founder",
  "primary_contact_email": "jane@example.com",
  "primary_contact_linkedin": "https://www.linkedin.com/in/...",
  "decision_makers": [
    {"name": "Jane Doe", "title": "Co-Founder", "email": "jane@example.com",
     "email_status": "DELIVERABLE", "linkedin_url": "https://www.linkedin.com/in/..."}
  ],
  "contact_notes": "Agency (sells outbound as a service, 26 people) → founders. 2 found, 2 emails."
}
```

- `company_bucket`: `"agency"`, `"small_saas"`, `"larger_saas"`.
- `contact_status`: `"found"` (at least one person with an email), `"found_no_email"` (people but no
  usable email), `"none_found"`, or `"blocked"` (FullEnrich error — named in `contact_notes`).
- `primary_contact_*` mirrors `decision_makers[0]` as flat fields so Clay can map them straight to
  columns; all null when the list is empty.
- `contact_notes`: one line — bucket and why, how many found, anything that went wrong, credits used.

## Related skills

- `gtm-jd-judgment` — runs first, decides what to build
- `gtm-artifact-builder` — runs second, builds it; its output is this skill's input
