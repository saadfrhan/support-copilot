# Vercel + Neon deployment

The code is prepared for these services. No cloud project has been created or deployed.

## 1. Create the database and replace the key

Rotate the Gemini key previously present in `.env.example` in Google AI Studio.
The template has been cleaned. Keep the replacement in ignored environment files
and the Vercel dashboard, never in Git.

Create a Neon project in a region near your Vercel Function region. Copy both
connection strings from Neon's Connect dialog:

- Pooled URL (`-pooler` in the hostname): runtime application traffic.
- Direct URL (without `-pooler`): schema setup.

Preserve Neon's TLS query parameters, including `sslmode=require` and
`channel_binding=require` when supplied. Do not disable certificate verification.
Use a separate Neon branch for Preview deployments.

## 2. Configure and seed Neon

Create `.env.production.local` locally. This file is ignored by Git and excluded
from Vercel uploads. Enter the real URLs copied from Neon:

```dotenv
GOOGLE_API_KEY=<rotated-key>
DATABASE_URL=<pooled-neon-url>
DATABASE_URL_UNPOOLED=<direct-neon-url>
GEMINI_MODEL=<model-you-verified-locally>
EMBEDDING_MODEL=gemini-embedding-2
MIN_RETRIEVAL_SCORE=0.5
ALLOW_DOCUMENT_WRITES=false
```

```sh
pnpm db:setup:production
pnpm db:seed:production
pnpm deploy:check
```

Schema setup creates pgvector and missing tables via the direct URL. Seeding
sends the three fictional sample FAQs to Gemini for embeddings and stores them
in Neon; it skips existing samples for that embedding model. It does not copy
the local database or delete existing documents. To use your own documents,
point your local app at Neon and upload them before sharing the read-only demo.

Preflight validates configuration, pooled connectivity, pgvector, schema, and
compatible document count without printing secrets or calling Gemini. It cannot
verify your Vercel dashboard settings or model access. Reindex documents when
changing the embedding model.

## 3. Configure Vercel

Import the repository into Vercel:

| Setting          | Value                             |
| ---------------- | --------------------------------- |
| Framework        | Next.js                           |
| Root directory   | Directory containing package.json |
| Node.js          | 24.x                              |
| Package manager  | pnpm 11.22.0                      |
| Install command  | `pnpm install --frozen-lockfile`  |
| Build command    | `pnpm build`                      |
| Output directory | Default Next.js output            |
| Function region  | Near your Neon database           |
| Fluid compute    | Enabled                           |

`vercel.json` supplies framework and command settings. The build uses webpack
because Turbopack/PostCSS worker startup failed in the development sandbox.
Builds never migrate or seed databases.

Add the following server-side variables in **Settings → Environment Variables**
for Production: `GOOGLE_API_KEY`, `DATABASE_URL`, `GEMINI_MODEL`,
`EMBEDDING_MODEL`, `MIN_RETRIEVAL_SCORE`, `ALLOW_DOCUMENT_WRITES=false`.
Do not use `NEXT_PUBLIC_` prefixes. The direct URL is only needed by your local
schema-setup command; Vercel Functions do not need it.

Configure Preview separately with its own Neon branch and credentials.
Environment changes require a new deployment. Podman remains local only.

## 4. Access and spend controls

The default Vercel behavior is **public chat with preloaded documents**. Upload
and delete routes reject writes with HTTP 403; the UI hides editing controls.
All loaded documents can be read in full by visitors, so only load public demo data.

Before sharing a public URL, configure a Vercel Firewall rate-limit rule for
`POST /api/chat` (start with 10 requests per minute per client), plus Gemini
project quotas and budget alerts. Verify feature availability for your plan.
These provider controls are not automatically configured by this repository.
There is no app-level rate limiter; without these controls, visitors can consume
your Gemini quota.

For a **private interactive demo**, enable Deployment Protection for all shared
URLs, including the production domain, before setting `ALLOW_DOCUMENT_WRITES=true`.
Standard Protection does not protect every production domain. Verify access from
an unauthenticated browser. The app itself intentionally has no login or password.

Chat has a 90-second function limit. Uploads have a 90-second embedding deadline
and a 120-second function limit. Split large files if ingestion times out; there
is no background ingestion queue. Database and embedding requests have timeouts.

## 5. Verify before sharing

```sh
pnpm check
pnpm test:e2e
pnpm deploy:check
```

On the deployed Preview:

1. `/api/health` must return HTTP 200 with `ok: true` and `database: ready`.
2. Verify preloaded documents appear, then ask about returns and inspect citations.
3. Ask an unrelated question and check the low-score fallback.
4. Confirm response timing and token usage appear.
5. Verify document POST/DELETE return 403 in public mode.
6. Verify provider rate limits, quotas, and any access protection.
7. Deploy Production with its separate environment, then repeat health/chat checks.

Health checks spend no Gemini tokens. Missing deployed credentials return 503
rather than silently switching chat to local preview.

For code rollback, promote a previous Vercel deployment. Database changes are
separate; this setup only creates missing objects. Use Neon branches/restores
for data recovery after inspecting the impact on live data.

## References

- [Connect Vercel and Neon](https://neon.com/docs/guides/vercel-manual)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Vercel pool lifecycle management](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)
