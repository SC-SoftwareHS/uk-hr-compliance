# UK HR Compliance RAG App - Setup Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (free tier works)
- OpenAI API key

## Local Setup

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a new project
2. Note your project URL and service role key from Settings > API

### 2. Set up Database

1. In Supabase SQL editor, run the contents of `db/init.sql`:
   - This enables pgvector extension
   - Creates the documents table with vector embeddings
   - Sets up appropriate indexes

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your credentials:
   ```
   OPENAI_API_KEY=your-openai-api-key
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```

### 4. Install Dependencies

```bash
npm install
```

### 5. Ingest Initial Data

```bash
npm run ingest
```

This will:
- Fetch content from GOV.UK and ACAS pages
- Extract and chunk the content
- Generate embeddings using OpenAI
- Store in Supabase with vector embeddings

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [https://vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Configure environment variables:
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy

### 3. Run Ingestion

After deployment, run the ingestion script locally with production env vars:

```bash
npm run ingest
```

## Testing

### Run Evaluation

```bash
npm run eval
```

This will:
- Run 40 test questions against the API
- Generate `eval/eval.csv` with results
- Show summary statistics

## Maintenance

### Adding New Sources

1. Edit `scripts/ingest.ts` to add new URLs to `SEED_URLS`
2. Run `npm run ingest` to fetch and index new content

### Updating Content

Re-run `npm run ingest` periodically to refresh content from sources.

## Troubleshooting

### Common Issues

1. **Vector search not working**: Ensure pgvector is enabled in Supabase
2. **Embeddings failing**: Check OpenAI API key and rate limits
3. **No results returned**: Verify data was ingested successfully

### Logs

Check console output in:
- Browser developer tools (frontend errors)
- Terminal running `npm run dev` (API errors)
- Vercel function logs (production errors)