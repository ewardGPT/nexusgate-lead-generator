# NexusGate Outbound Pipeline — Build Status

> Generated: 2025-04-10
> Repos: `nexusgate-lead-generator/` + `nexusgate.tech/`
> n8n: `https://n8n.ervinward.com`

---

## Phase 1: Lead Scraping with Apify ✅ DONE

**What was done:**
- Built `workflows/outbound-lead-pipeline.json` with 3 Apify nodes:
  - **Google Maps Scraper** (`apify/google-maps-scraper`) — primary source, scrapes business name, phone, website, email, rating, reviews
  - **Yelp Scraper** (`apify/yelp-scraper`) — secondary source for businesses not on Google Maps
  - **Website Contact Scraper** (`apify/website-contact-scraper`) — crawls each business website to extract contact emails and owner names
- Code node generates 280 search queries (14 business types × 20 DMV locations)
- Normalize & Merge node standardizes output schema, discards leads missing email
- Deduplicate node removes duplicates by email, keeps richest record

**Files changed:**
- `nexusgate-lead-generator/workflows/outbound-lead-pipeline.json` (new)
- `nexusgate-lead-generator/scripts/n8n-import.py` (new)

---

## Phase 2: AI Lead Scoring with OpenClaw ✅ DONE

**What was done:**
- OpenClaw scoring node uses exact ICP prompt for local service businesses
- Scores 0–10, returns JSON with `score`, `reasoning`, `pain_point`, `personalization_hook`
- Parse Score JSON node strips markdown code blocks and validates score range
- Switch Router node routes: ≥7 → email pipeline, <7 → disqualified_leads Supabase table

**n8n nodes in workflow:**
- `OpenClaw — Score Outbound Lead` (n8n-nodes-base.openai)
- `Parse Score JSON` (n8n-nodes-base.code)
- `Switch — Score Router` (n8n-nodes-base.switch)

---

## Phase 3: Personalized Cold Email via OpenClaw ✅ DONE

**What was done:**
- OpenClaw email generation node uses exact prompt from spec (Ervin, Founder of NexusGate)
- Email rules enforced: under 120 words, personalization hook, free 60-second audit CTA, links to `nexusgate.tech/#lead-capture`, no buzzwords
- Parse Email Content node extracts subject line and body from LLM output

**n8n nodes in workflow:**
- `OpenClaw — Generate Cold Email` (n8n-nodes-base.openai)
- `Parse Email Content` (n8n-nodes-base.code)

---

## Phase 4: Send the Email — ⚠️ PARTIALLY DONE

**What was done:**
- Workflow built with **Gmail** node (original spec said Gmail/SMTP)
- You mentioned using **SMTP** instead — the node in n8n is still the Gmail type
- Needs to be changed to an SMTP node in the n8n UI (or the JSON updated and re-imported)

**What still needs to be done:**
- [ ] **Replace Gmail node with SMTP node** in n8n UI (or update workflow JSON and re-import)
  - Current node: `Gmail — Send Cold Email` (type: `n8n-nodes-base.gmail`)
  - Should be: `SMTP — Send Cold Email` (type: `n8n-nodes-base.smtp`)
  - SMTP credential already exists in n8n: `SMTP account`
  - Map: To → `{{email}}`, Subject → `{{email_subject}}`, Body → `{{email_body}}`, From → `ervin@nexusgate.tech`
- [ ] **Add 24-hour delay / rate limiting** between send batches (max 50 emails/day)
  - The `Initialize Batch Limits` node sets `maxEmailsPerDay: 50` but no enforcement logic yet
  - Need to add a Code node that checks today's sent count in Supabase before sending
  - Optionally add a Wait node between batches

---

## Phase 5: Log Everything to Supabase ✅ DONE

**What was done:**
- **Supabase migration created:** `supabase/001_outbound_leads.sql`
- **Tables:**
  - `outbound_leads` — all qualified leads with full tracking (email_sent, audit_completed, call_booked, converted)
  - `disqualified_leads` — leads scored < 7
- **Indexes** on email, score, email_sent, business_type, city, created_at
- **RLS policies** for service role (full access) and anon (insert only)
- **Schema updated in nexusgate.tech:** `supabase/schema.sql` now includes both tables
- **n8n workflow has 5 Supabase nodes:**
  - `Supabase — Insert Qualified Lead` (after scoring ≥7)
  - `Supabase — Log Disqualified Lead` (after scoring <7)
  - `Supabase — Mark Email Sent` (after SMTP send)
  - `Supabase — Mark Audit Complete` (triggered by webhook from frontend)
  - `Supabase — Mark Call Booked` (triggered by webhook from frontend)

**⚠️ You still need to run the migration:**
```sql
-- Run in Supabase SQL Editor at https://app.supabase.com
-- File: nexusgate-lead-generator/supabase/001_outbound_leads.sql
```

---

## Phase 6: Connect the Frontend (nexusgate.tech) ✅ DONE

### 6.1 — Audit Completion Webhook ✅
- Created `lib/audit-webhook.ts` with `notifyAuditComplete()` function
- `components/audit-flow.tsx` fires webhook after audit completes:
  ```js
  await notifyAuditComplete(email, { score: result.score, url })
  ```
- `NEXT_PUBLIC_N8N_AUDIT_WEBHOOK` set in `.env.local` and `.env.example`
- Webhook URL: `https://n8n.ervinward.com/webhook/nexusgate-audit-complete`

### 6.2 — Book a Call CTA After Audit ✅
- `components/audit-results.tsx` updated with:
  - Primary CTA: "Book Your Free Strategy Call" → Calendly link with `utm_source=audit&utm_medium=nexusgate`
  - Secondary CTA: "Or book directly through this page" (in-app booking form)
  - Calendly URL is configurable via `NEXT_PUBLIC_CALENDLY_URL` env var (defaults to placeholder)

### 6.3 — Call Booked Webhook ✅
- Created `notifyCallBooked()` in `lib/audit-webhook.ts`
- Fires when lead books via Calendly or in-app booking form
- Webhook URL: `https://n8n.ervinward.com/webhook/nexusgate-call-booked`
- n8n updates `call_booked = true` + sends Slack alert

### Additional frontend changes:
- `components/audit-input.tsx` — added optional email capture field
- `lib/env.ts` — added `NEXT_PUBLIC_N8N_AUDIT_WEBHOOK` and `N8N_CALL_BOOKED_WEBHOOK_URL` exports
- `.env.local` — populated with actual n8n webhook URLs
- `.env.example` — documented all outbound pipeline env vars
- `components/site-footer.tsx` — changed `contact@nexusgate.tech` → `ervin@nexusgate.tech`

---

## Phase 7: GitHub Actions CI/CD ✅ DONE

### nexusgate-lead-generator/
- `.github/workflows/outbound-pipeline.yml` — triggers n8n workflow via curl (cron: weekdays 9am ET, also `workflow_dispatch`)
- `.github/workflows/validate-workflow.yml` — validates n8n JSON on push/PR
- `.github/workflows/playwright.yml` — runs E2E tests on push/PR

### nexusgate.tech/
- `.github/workflows/playwright-audit.yml` — tests audit flow end-to-end
- `tests/playwright/audit-flow.spec.js` — 4 tests (audit completion, CTA tracking, section accessibility, footer email)

### GitHub Secrets Set:
| Repo | Secret | Value |
|------|--------|-------|
| `nexusgate-lead-generator` | `N8N_WEBHOOK_URL` | `https://n8n.ervinward.com/webhook/trigger-outbound-pipeline` |
| `nexusgate-lead-generator` | `WEBHOOK_URL` | `https://n8n.ervinward.com/webhook/incoming-lead` |
| `nexusgate.tech` | `N8N_AUDIT_WEBHOOK_URL` | `https://n8n.ervinward.com/webhook/nexusgate-audit-complete` |
| `nexusgate.tech` | `WEBHOOK_URL` | `https://n8n.ervinward.com/webhook/incoming-lead` |

---

## n8n Workflow Import Status ✅ IMPORTED (inactive)

| Field | Value |
|-------|-------|
| **Name** | NexusGate Outbound Lead Pipeline |
| **ID** | `VlKMRbsARzgfi2aK` |
| **Nodes** | 26 |
| **Status** | ⚪ **INACTIVE** (needs manual toggle) |
| **URL** | https://n8n.ervinward.com/workflow/VlKMRbsARzgfi2aK |

**n8n credentials used (all pre-existing):**
- ✅ Apify account (`apifyapi`)
- ✅ SMTP account (`smtp`)
- ✅ Supabase account (`supabaseapi`)
- ✅ OpenClaw account (`openclawapi`)

---

## ✅ What's Fully Done

| Component | Status | Notes |
|-----------|--------|-------|
| Apify scraping (Google Maps + Yelp + Website) | ✅ | 280 queries, 14 business types, 20 DMV cities |
| Lead normalization & deduplication | ✅ | Schema standardization, email-only dedup |
| OpenClaw AI scoring (0-10) | ✅ | ICP rubric with pain_point + personalization_hook |
| Lead routing (score ≥7 vs <7) | ✅ | Switch node routes to email or disqualified |
| OpenClaw cold email generation | ✅ | Ervin signature, under 120 words, audit CTA |
| Supabase schema (2 tables + indexes + RLS) | ✅ | Run migration in Supabase UI |
| Supabase logging nodes (5 nodes) | ✅ | Insert qualified, log disqualified, update email/audit/booking |
| Frontend audit webhook | ✅ | Fires on audit completion |
| Frontend call-booked webhook | ✅ | Fires on booking |
| Book-a-call CTA with tracking | ✅ | Calendly link with utm_source=audit |
| Email capture in audit form | ✅ | Optional field on Step 1 |
| Footer email → ervin@nexusgate.tech | ✅ | Updated in both repos |
| GitHub Actions (4 workflows) | ✅ | outbound-pipeline, validate-workflow, playwright, playwright-audit |
| GitHub Secrets (4 secrets) | ✅ | Set on both repos |
| .env.local configured | ✅ | Webhook URLs set |
| .env.example documented | ✅ | All outbound pipeline vars documented |

---

## ⚠️ What Still Needs to Be Completed

### 1. [ ] Activate the n8n Workflow
**Priority: HIGH** — nothing runs without this

- Open: https://n8n.ervinward.com/workflow/VlKMRbsARzgfi2aK
- Toggle the **Active** switch ON
- The schedule trigger will then run at 9am ET on weekdays

### 2. [ ] Run Supabase Migration
**Priority: HIGH** — Supabase nodes will fail without tables

- Open: https://app.supabase.com → your project → SQL Editor
- Run the contents of: `nexusgate-lead-generator/supabase/001_outbound_leads.sql`
- This creates `outbound_leads` and `disqualified_leads` tables with RLS policies and indexes

### 3. [ ] Replace Gmail Node with SMTP Node
**Priority: HIGH** — emails won't send without this

In the n8n UI:
1. Open the workflow: https://n8n.ervinward.com/workflow/VlKMRbsARzgfi2aK
2. Find the `Gmail — Send Cold Email` node (position x=3560, y=280)
3. Delete it
4. Add a new **SMTP** node
5. Configure:
   - Credential: `SMTP account` (already exists in n8n)
   - From Email: `ervin@nexusgate.tech`
   - To Email: `{{ $json.email }}`
   - Subject: `{{ $json.email_subject }}`
   - Body: `{{ $json.email_body }}`
   - Email type: Plain text
6. Rename to: `SMTP — Send Cold Email`

Or I can update the workflow JSON to use SMTP type and re-import it — just tell me which you prefer.

### 4. [ ] Add Email Rate Limiting (50/day enforcement)
**Priority: MEDIUM** — protects sender reputation

- The `Initialize Batch Limits` node sets the variable but no enforcement exists yet
- Add a Code node before the email send that:
  1. Queries Supabase for today's `email_sent_at` count
  2. If count >= 50, stops the pipeline
  3. If count < 50, passes the lead through
- Optionally add a Wait node between each email (e.g., 60-120 seconds)

### 5. [ ] Set Calendly URL
**Priority: MEDIUM** — the CTA currently links to a placeholder

- Update `components/audit-results.tsx`:
  ```tsx
  const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/yourlink";
  ```
- Either set `NEXT_PUBLIC_CALENDLY_URL` in `.env.local` or update the hardcoded default

### 6. [ ] Verify n8n Node Credential Assignments
**Priority: HIGH** — nodes won't work if credentials aren't attached

In the n8n UI, open the workflow and verify these nodes have their credentials assigned:
| Node | Credential to assign |
|------|---------------------|
| `Apify — Google Maps Scraper` | Apify account |
| `Apify — Yelp Scraper` | Apify account |
| `Apify — Website Contact Scraper` | Apify account |
| `OpenClaw — Score Outbound Lead` | OpenClaw account |
| `OpenClaw — Generate Cold Email` | OpenClaw account |
| `Supabase — Insert Qualified Lead` | Supabase account |
| `Supabase — Log Disqualified Lead` | Supabase account |
| `Supabase — Mark Email Sent` | Supabase account |
| `Supabase — Mark Audit Complete` | Supabase account |
| `Supabase — Mark Call Booked` | Supabase account |
| `SMTP — Send Cold Email` (after replacing Gmail) | SMTP account |

> n8n usually preserves credential assignments on import if the credential name matches. Double-check each node to be sure.

### 7. [ ] Test the Pipeline End-to-End
**Priority: MEDIUM** — verify everything works before going live

1. Manually trigger the workflow in n8n (click "Execute Workflow" or the play button)
2. Check execution log for errors
3. Verify leads appear in Supabase `outbound_leads` table
4. Check that emails send (or mock-send)
5. Test frontend webhook: complete an audit on nexusgate.tech and verify `audit_completed` updates in Supabase

---

## Full Pipeline Flow

```
[Schedule: Weekdays 9am ET]
  └─► Initialize Batch Limits (max 50/day)
      └─► Generate DMV Search Queries (280 queries)
          └─► Split Into Batches (10 at a time)
              ├─► Apify Google Maps Scraper
              └─► Apify Yelp Scraper
                  └─► Normalize & Merge Leads
                      └─► Deduplicate by Email
                          └─► Apify Website Contact Scraper
                              └─► Enrich Website Contact Data
                                  └─► OpenClaw Score Outbound Lead (0-10)
                                      └─► Parse Score JSON
                                          └─► Switch Router
                                              │
                                              ├── Score ≥7 ──► Supabase Insert Qualified
                                              │                    └─► OpenClaw Generate Cold Email
                                              │                        └─► Parse Email Content
                                              │                            └─► [SMTP] Send Cold Email  ⚠️ needs SMTP swap
                                              │                                └─► Supabase Mark Email Sent
                                              │
                                              └── Score <7 ──► Supabase Log Disqualified Lead

[Webhook: Audit Complete] ──► Supabase Mark Audit Complete ──► Respond 200 OK
[Webhook: Call Booked] ──► Supabase Mark Call Booked ──► Slack Alert ──► Respond 200 OK
```

---

## Git Commits Summary

### nexusgate-lead-generator/
```
chore: initialize nexusgate lead generator project structure
chore: add .nvmrc for Node.js 20 version pinning
feat: build full outbound lead gen pipeline with apify, openclaw, email, and supabase
chore: add n8n import helper script for CI/CD
```

### nexusgate.tech/
```
feat: connect audit completion and call booking to n8n supabase pipeline
  - .github/workflows/playwright-audit.yml
  - components/audit-flow.tsx
  - components/audit-input.tsx
  - components/audit-results.tsx
  - components/site-footer.tsx
  - lib/audit-webhook.ts
  - lib/env.ts
  - supabase/schema.sql
  - tests/playwright/audit-flow.spec.js
```
