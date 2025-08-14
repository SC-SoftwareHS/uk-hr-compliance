-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'UK',
    topic TEXT,
    section TEXT,
    content TEXT NOT NULL,
    last_crawled_at TIMESTAMPTZ DEFAULT NOW(),
    embedding vector(1536),
    UNIQUE(url, section)
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create index for filtering
CREATE INDEX IF NOT EXISTS documents_country_topic_idx ON documents(country, topic);
CREATE INDEX IF NOT EXISTS documents_url_section_idx ON documents(url, section);

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 12,
  filter_country text DEFAULT 'UK',
  filter_topic text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  url text,
  country text,
  topic text,
  section text,
  content text,
  last_crawled_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.url,
    d.country,
    d.topic,
    d.section,
    d.content,
    d.last_crawled_at,
    1 - (d.embedding <=> query_embedding) as similarity
  FROM documents d
  WHERE d.country = filter_country
    AND (filter_topic IS NULL OR d.topic = filter_topic)
    AND d.embedding IS NOT NULL
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;