-- Basic Database Setup for BRDR RAG Application
-- Run this in Supabase SQL Editor first

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Table: brdr_documents
CREATE TABLE IF NOT EXISTS brdr_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id VARCHAR UNIQUE,
    content TEXT NOT NULL,
    source VARCHAR NOT NULL,
    embedding VECTOR(384),
    metadata JSONB,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    doc_uuid VARCHAR,
    doc_type_code VARCHAR,
    doc_type_desc VARCHAR,
    version_code VARCHAR,
    doc_long_title VARCHAR,
    doc_desc VARCHAR,
    issue_date TIMESTAMPTZ(6),
    guideline_no VARCHAR,
    supersession_date TIMESTAMPTZ(6),
    keywords TEXT[] DEFAULT '{}',
    topics TEXT[] DEFAULT '{}',
    concepts TEXT[] DEFAULT '{}',
    summary TEXT,
    document_type VARCHAR,
    language VARCHAR DEFAULT 'en',
    doc_topic_subtopic_list JSONB,
    doc_keyword_list JSONB,
    doc_ai_type_list JSONB,
    doc_view_list JSONB,
    directly_related_doc_list JSONB,
    version_history_doc_list JSONB,
    reference_doc_list JSONB,
    superseded_doc_list JSONB
);

-- Table: brdr_documents_data
CREATE TABLE IF NOT EXISTS brdr_documents_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id VARCHAR NOT NULL,
    document_id UUID NOT NULL,
    chunk_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(384),
    metadata JSONB,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    chunk_type VARCHAR,
    keywords TEXT[] DEFAULT '{}',
    related_chunks TEXT[] DEFAULT '{}',
    CONSTRAINT document_data_doc_id_chunk_id_key UNIQUE (doc_id, chunk_id),
    CONSTRAINT document_data_document_id_fkey FOREIGN KEY (document_id) 
        REFERENCES brdr_documents (id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Basic Indexes for brdr_documents
CREATE INDEX IF NOT EXISTS idx_brdr_documents_doc_id ON brdr_documents (doc_id);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_document_type ON brdr_documents (document_type);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_language ON brdr_documents (language);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_doc_type_code ON brdr_documents (doc_type_code);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_issue_date ON brdr_documents (issue_date);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_version_code ON brdr_documents (version_code);

-- Basic Indexes for brdr_documents_data
CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_chunk_type ON brdr_documents_data (chunk_type);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_doc_id ON brdr_documents_data (doc_id);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_document_id ON brdr_documents_data (document_id);

-- Vector indexes (will be created after data is inserted)
-- CREATE INDEX IF NOT EXISTS idx_brdr_documents_embedding ON brdr_documents USING hnsw (embedding vector_l2_ops);
-- CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_embedding ON brdr_documents_data USING hnsw (embedding vector_l2_ops);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
