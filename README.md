# RAG demo

Deploying to Vercel + Neon? Follow [the deployment guide](docs/DEPLOYMENT.md)
for environment variables, schema setup, sample seeding, and release checks.
Document editing is disabled by default on Vercel; local editing still works.

Add documents, ask questions, and inspect the sources behind the answers.
Built with Next.js, shadcn/ui, Gemini, LangChain, and PostgreSQL/pgvector.

## Try it

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000.

1. Click **Load sample FAQ**, or upload a .txt/.md file or paste text.
2. Ask a question about the documents.
3. Click a source under the answer to read the matching excerpt.

No login or admin token is needed. **Clear chat** starts a fresh conversation.
The trash button removes a document.

Without a Gemini key and database URL, the app uses a **local preview**: keyword
search returns matching passages from the documents you loaded. This is not
AI generation. Upload and paste work in this mode too. Preview documents and
chat messages last until the page is refreshed.

## Enable Gemini answers

Set these values in `.env.local` (use `.env.example` as a starting point):

```dotenv
GOOGLE_API_KEY=your-google-ai-studio-key
DATABASE_URL=postgresql://support:support@localhost:5432/support
GEMINI_MODEL=gemini-3.7-flash
EMBEDDING_MODEL=gemini-embedding-2
```

Start the database, initialize its tables, and start the app:

```sh
podman compose up -d db
pnpm db:setup
pnpm dev
```

When both credentials are present, the app automatically uses Gemini and
PostgreSQL. Click the connection indicator for setup instructions and a database
check. Click **Load sample FAQ** to index example documents, or add your own.
Live documents persist in PostgreSQL; chat history is kept in the page session.
The sample FAQ describes a fictional store.

## How it works

- LangChain splits documents into 1,200-character chunks with 180-character overlap.
- Gemini creates 768-dimensional embeddings, stored in pgvector.
- Questions retrieve up to four relevant excerpts using cosine similarity.
- Gemini answers from those excerpts and supplies numbered source references.
- Greetings get simple conversational responses without retrieval.
- Questions with no matching information receive an explicit fallback.

Model names are configurable. Changing the embedding model requires re-uploading
documents; retrieval excludes vectors created by other models. The configurable similarity
threshold is a starting point to tune with your own question set.

Text/Markdown files are limited to 100 KB; pasted text to 100,000 characters.
The local preview supports six documents. PDF extraction is not included.

## Development

```sh
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
npx playwright install chromium
pnpm test:e2e
```

Browser tests run a separate local-preview server on port 3100 and make no Gemini
calls. Prettier excludes environment files, lockfiles, and generated files.

This is a local demonstration, with no authentication. The app and database bind
to localhost by default. API keys stay on the server. Add access controls before
hosting it publicly.

References: [LangChain ChatGoogle](https://docs.langchain.com/oss/javascript/integrations/chat/google),
[Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings),
[pgvector](https://github.com/pgvector/pgvector).

## UI components

The UI uses shadcn/ui's New York components with Tailwind CSS v4 and Radix primitives.
Component source lives in `components/ui`; `components.json` defines the registry
configuration and aliases. Theme tokens are in `app/globals.css`.

Buttons, inputs, textareas, labels, cards, alerts, and collapsible sections use these
shared components. The local `quiet` button variant intentionally has no hover
background for utility controls. Text fields use 16px text and muted colors retain
the demo's higher contrast.

Add more components with `pnpm dlx shadcn@latest add <component>`.

## No-answer guard and usage

`MIN_RETRIEVAL_SCORE` controls the cosine-similarity floor (default **0.5**).
If no excerpt reaches it, the app skips Gemini answer generation and shows
**No answer found** with an invitation to rephrase or add relevant documents.
The query embedding still runs. Invalid scores fail closed.

Even above the cutoff, Gemini is instructed to return `NO_ANSWER` when the text
does not support an answer. Empty answers and answers with missing or out-of-range
numbered citations also fall back. These checks reduce unsupported answers; a
valid citation or high similarity does not prove factual correctness. Tune the
threshold against a representative support-question evaluation set.

Each reply shows browser-measured response time and provider-reported input/output
generation tokens. Details show server time, the total token count, retrieval score
and threshold, and the fallback reason. Scores are **not confidence percentages**.
The local preview uses text matching and does not display a vector score.

Average response time covers successful replies in the current chat, including
greetings and no-answer responses, and resets with Clear chat. Failed requests
are excluded. Missing provider usage is marked unavailable, never estimated.
Generation tokens do not include query embeddings, indexing, retries, or monetary
charges. No dollar estimate is shown because pricing varies by model and plan.
