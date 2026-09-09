CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS documents (
 id uuid PRIMARY KEY,
 title text NOT NULL,
 content text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chunks (
 id bigserial PRIMARY KEY,
 document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 content text NOT NULL,
 embedding vector(768) NOT NULL,
 embedding_model text NOT NULL
);
CREATE INDEX IF NOT EXISTS chunks_document_idx ON chunks(document_id);
