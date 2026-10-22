# Sento

**Apply on autopilot.** Sento watches company ATS boards, matches roles to your
profile, tailors your résumé and cover letter for each one, and submits the
application — pausing for you only when a human is genuinely required.

It is a full-stack Next.js app plus a background worker. Inspired by the Tsenta
product category; this is an independent implementation.

---

## What it does (the engine)

The core is a state machine over each `Application`:

```
DISCOVERED → MATCHED → TAILORING → READY → QUEUED → SUBMITTING → SUBMITTED
                                                         ↘ NEEDS_YOU (human)
                                                         ↘ FAILED
```

1. **Discover** — polls public ATS job-board APIs (Greenhouse, Lever, Ashby) for
   every company you monitor. New postings are stored as `Job`s.
2. **Match** — scores each job against your profile (title, skills, location,
   work-authorization) with a transparent, explainable 0–100 score. Every
   contribution is recorded in `matchReasons`.
3. **Tailor** — uses Claude to rewrite your résumé and draft a cover letter per
   role, grounded strictly in your real base résumé (no invented facts).
4. **Apply** — drives a real browser (Playwright) to fill the application form,
   then captures a receipt screenshot.
5. **Track** — status + an append-only `ApplicationEvent` audit log per app.

### The one hard boundary: CAPTCHAs & anti-bot walls

Sento **does not solve or bypass CAPTCHAs or bot-detection.** When the
submission step hits a CAPTCHA / human-verification wall, or an application asks
a question Sento doesn't recognize, that application moves to **`NEEDS_YOU`** —
pre-filled, with a receipt screenshot — for you to finish in one tap. This is by
design and mirrors how these products actually operate.

By default `SENTO_REQUIRE_APPROVAL=1`, so Sento fills every form and **stops
before the final submit** for your approval. Set it to `0` to let it submit
automatically (CAPTCHA/anti-bot handoff still applies). You are billed a credit
only on a confirmed submission.

---

## Architecture

```
src/
  lib/
    ats/        Greenhouse / Lever / Ashby connectors + registry (real public APIs)
    match/      explainable job↔profile scoring
    tailor/     Claude-powered résumé + cover-letter tailoring
    submit/     Playwright form-fill, CAPTCHA detection, receipts
    engine.ts   orchestration: discover → match → tailor → submit
    auth.ts     NextAuth (credentials, JWT)
    billing.ts  Stripe checkout + plan→credits
    db.ts env.ts log.ts
  app/          Next.js App Router: dashboard, sign-in, API routes
  worker/       standalone polling worker (npm run worker)
prisma/         schema + seed
```

Dependencies flow inward; provider wire-protocols stay inside `lib/ats` and
`lib/submit` and never leak into the UI.

---

## Setup

Prerequisites: **Node 20+** and a **Postgres** database.

```bash
npm install
npm run playwright:install        # downloads the Chromium Playwright uses
cp .env.example .env              # then fill in DATABASE_URL etc.
npm run db:push                   # create tables
npm run db:seed                   # optional: a few example boards
```

Fill in `.env`:

| Variable | Purpose | Needed for |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection | everything |
| `NEXTAUTH_SECRET` | session signing | auth |
| `ANTHROPIC_API_KEY` | résumé/cover tailoring | tailoring (degrades without it) |
| `STRIPE_SECRET_KEY` + `STRIPE_PRICE_*` | paid plans | billing (optional) |

Nothing except `DATABASE_URL` is required to boot; unconfigured features report
themselves as unavailable rather than crashing.

## Run

```bash
npm run dev       # dashboard at http://localhost:3000
npm run worker    # background discovery/match/apply loop
```

Create an account, add companies to monitor (dashboard or `POST /api/companies`),
set your profile/base résumé, then **Run now** or let the worker poll.

## Deploy

- **App** (`npm run build && npm run start`) → Vercel / any Node host.
- **Worker** (`npm run worker`) → a long-running process (Railway / Render /
  Fly / a container). It needs the same `.env` and Playwright's Chromium.
- Use a hosted Postgres (Neon, Supabase, Railway).
- Point your Stripe webhook at `/api/billing/webhook`.

---

## Responsible use

Sento applies to jobs **on your own behalf**. Respect each site's Terms of
Service and rate limits, keep the approval gate on until you trust a board, and
never use it to mass-spam employers. Discovery uses official public job-board
APIs and identifies itself honestly in its User-Agent.
