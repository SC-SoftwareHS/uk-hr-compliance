You are a senior full-stack engineer. Build a minimal RAG web app that answers UK HR compliance questions (TUPE, statutory sick pay, maternity/paternity, holiday, pensions, visas) in plain English with citations to official sources. This is a proof-of-concept MVP—opt for simplicity over features.

Scope & Constraints
	•	Countries: UK only (phase 1).
	•	Sources (seed list only; no full crawler):
	•	GOV.UK pages for: Employment contracts, Statutory Sick Pay (SSP), Maternity/Paternity leave, Holiday entitlement, Redundancy, TUPE, Right to work/visas overview.
	•	ACAS pages for: TUPE, Sickness, Maternity/Paternity, Disciplinaries, Templates.
	•	Stack:
	•	Next.js (App Router) + TypeScript + Tailwind
	•	API routes for backend
	•	Supabase with pgvector for embeddings
	•	OpenAI text-embedding-3-small for embeddings
	•	OpenAI GPT-4o mini for answers (cheap); answers must be grounded in retrieved context
	•	No external reranker; if needed, do a light LLM rerank step inline.
	•	Refusal policy: If context is weak or missing, respond with a short “can’t verify from sources” and list likely official pages.

Deliverables (generate full files)
	1.	File tree and complete code:
	•	/app/page.tsx — single-page chat UI with:
	•	prompt textarea
	•	country chip preset to UK (disabled for now)
	•	topic dropdown (TUPE, Sick, Maternity/Paternity, Holiday, Pensions, Visas)
	•	“Copy answer” button
	•	sources list
	•	/app/api/ask/route.ts — RAG pipeline endpoint
	•	/lib/embeddings.ts — wrapper for OpenAI embeddings
	•	/lib/retrieval.ts — vector search (+ optional LLM rerank)
	•	/lib/prompt.ts — system + user prompt builders
	•	/lib/types.ts — shared types
	•	/scripts/ingest.ts — ingests a static array of URLs, fetches HTML, extracts main content (Readability), chunks by H2/H3 (~1000 tokens, ~10% overlap), adds metadata {country:"UK", topic, title, url, section, last_crawled_at}, embeds, upserts to Supabase.
	•	/eval/questions_uk.json — 40 test questions covering the topics
	•	/eval/run.ts — runs questions against /api/ask, saves eval.csv with columns: q, has_answer, num_sources, refused, latency_ms
	•	/db/init.sql — SQL to enable pgvector and create tables
	•	/env.example — all required vars
	•	setup.md — exact setup & run steps (local + Vercel deploy)
	•	Minimal Tailwind config
	2.	Data model (Supabase)
	•	Table documents(id uuid pk, title text, url text, country text, topic text, section text, content text, last_crawled_at timestamptz, embedding vector)
	•	GIN/IVFFlat index for vector search as appropriate for pgvector version
	•	Simple upsert on url+section
	3.	RAG behavior
	•	Retrieval: vector similarity k=12 → filter country='UK' and optional topic → choose top 6; optional LLM rerank to 4–6.
	•	System prompt (put in /lib/prompt.ts):You are an HR compliance advisor for UK employment. Answer ONLY using the provided context chunks. 
        If context is insufficient or outdated, explicitly say so and list likely official sources to check next.
        Style: plain English, short bullets, include a concise “Key steps” checklist for procedural topics.
        Every factual bullet must include a bracketed citation like [1] that maps to the Sources list (title + URL). 
        Never invent law, dates, thresholds, or numbers.
    •	User prompt structure:
            Question: {user_query}
            Topic filter (optional): {topic}
            Context Chunks (each has title, url, section, excerpt):
            1) ...
            N) ...
            Return JSON:
            {
            "answer": "<markdown with bracketed [n] citations>",
            "sources": [{"title": "...", "url": "..."}, ...],
            "confidence": "high" | "medium" | "low",
            "refused": boolean
            }       
•	If top score < threshold or chunks irrelevant → set refused: true, provide short guidance + sources list.

	4.	UI requirements
	•	Clean, single page; Tailwind; mobile friendly.
	•	Show Answer, Key steps (if present), and Sources beneath.
	•	Buttons: “Copy answer”, “New question”.
	•	Show a clear disclaimer: “Not legal advice. Always verify with official sources or counsel.”
	5.	Testing / acceptance criteria
	•	npm run ingest populates Supabase with ~20–30 sections across seed URLs.
	•	npm run dev starts app; queries like:
	•	“What is TUPE and what are the key employer steps?” → bullets + [ACAS/GOV.UK] citations.
	•	“How does Statutory Sick Pay work?” → eligibility + amounts + sources.
	•	“UK maternity leave overview” → leave/ pay basics + sources.
	•	npm run eval produces eval.csv with >70% has_answer and num_sources ≥ 2 for common questions; appropriate refusals when off-topic.
	•	No answers without at least one source; if none retrieved, must refuse.

Implementation details & guardrails
	•	Chunking: split by H2/H3; if page lacks headings, fallback to ~1000-token windows with 10% overlap.
	•	Sanitization: strip nav/footers; keep lists/tables as text.
	•	Metadata topic tagging: infer from URL path or page headings; allow manual overrides in the seed array.
	•	Costs: use text-embedding-3-small; GPT-4o mini for answers; keep tokens tight.
	•	Logging: in /app/api/ask/route.ts, log ts, question, topic, doc_ids, latency_ms, refused.
	•	Errors: return structured JSON errors; surface a friendly UI message.

Provide now
	•	Full code files with correct imports/paths.
	•	setup.md with exact commands:
	•	create Supabase project
	•	run db/init.sql to enable pgvector & create tables
	•	set .env.local with OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
	•	run npm run ingest, npm run dev
	•	deploy to Vercel (include build envs), and Supabase stays as DB
	•	A small seed URL array prefilled for: TUPE (ACAS+GOV.UK), SSP, Maternity/Paternity, Holiday entitlement, Employment contracts, Right to work/visas overview.
	•	Example .env.example values (placeholders only).
