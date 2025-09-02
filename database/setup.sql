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

-- Indexes for brdr_documents
CREATE INDEX IF NOT EXISTS idx_brdr_documents_doc_id ON brdr_documents (doc_id);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_document_type ON brdr_documents (document_type);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_language ON brdr_documents (language);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_doc_type_code ON brdr_documents (doc_type_code);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_issue_date ON brdr_documents (issue_date);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_version_code ON brdr_documents (version_code);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_embedding ON brdr_documents USING hnsw (embedding vector_l2_ops);

-- Indexes for brdr_documents_data
CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_embedding ON brdr_documents_data USING hnsw (embedding vector_l2_ops);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_chunk_type ON brdr_documents_data (chunk_type);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_doc_id ON brdr_documents_data (doc_id);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_document_id ON brdr_documents_data (document_id);

-- Function to test database connection and get table information
CREATE OR REPLACE FUNCTION test_connection()
RETURNS JSON AS $$
BEGIN
    RETURN json_build_object(
        'tables', (
            SELECT json_agg(table_name)
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        ),
        'extensions', (
            SELECT json_agg(extname)
            FROM pg_extension
            WHERE extname IN ('vector', 'uuid-ossp')
        ),
        'connection_status', 'success'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get table columns (useful for debugging)
CREATE OR REPLACE FUNCTION get_table_columns(table_name_param TEXT)
RETURNS JSON AS $$
BEGIN
    RETURN json_build_object(
        'table_name', table_name_param,
        'columns', (
            SELECT json_agg(
                json_build_object(
                    'column_name', column_name,
                    'data_type', data_type,
                    'is_nullable', is_nullable
                )
            )
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = table_name_param
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION vector_search(
    query_embedding VECTOR(384),
    similarity_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    search_table TEXT DEFAULT 'brdr_documents_data'
)
RETURNS TABLE(
    id UUID,
    doc_id VARCHAR,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    IF search_table = 'brdr_documents_data' THEN
        RETURN QUERY
        SELECT 
            bdd.id,
            bdd.doc_id,
            bdd.content,
            1 - (bdd.embedding <-> query_embedding) AS similarity,
            bdd.metadata
        FROM brdr_documents_data bdd
        WHERE bdd.embedding IS NOT NULL
        AND 1 - (bdd.embedding <-> query_embedding) > similarity_threshold
        ORDER BY bdd.embedding <-> query_embedding
        LIMIT match_count;
    ELSE
        RETURN QUERY
        SELECT 
            bd.id,
            bd.doc_id,
            bd.content,
            1 - (bd.embedding <-> query_embedding) AS similarity,
            bd.metadata
        FROM brdr_documents bd
        WHERE bd.embedding IS NOT NULL
        AND 1 - (bd.embedding <-> query_embedding) > similarity_threshold
        ORDER BY bd.embedding <-> query_embedding
        LIMIT match_count;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for hybrid search (vector + text)
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding VECTOR(384),
    similarity_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    doc_id VARCHAR,
    content TEXT,
    similarity FLOAT,
    text_match_score FLOAT,
    combined_score FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        SELECT 
            bdd.id,
            bdd.doc_id,
            bdd.content,
            1 - (bdd.embedding <-> query_embedding) AS vec_similarity,
            bdd.metadata
        FROM brdr_documents_data bdd
        WHERE bdd.embedding IS NOT NULL
        AND 1 - (bdd.embedding <-> query_embedding) > similarity_threshold
    ),
    text_search AS (
        SELECT 
            bdd.id,
            bdd.doc_id,
            bdd.content,
            ts_rank(to_tsvector('english', bdd.content), websearch_to_tsquery('english', query_text)) AS text_score,
            bdd.metadata
        FROM brdr_documents_data bdd
        WHERE to_tsvector('english', bdd.content) @@ websearch_to_tsquery('english', query_text)
    )
    SELECT 
        COALESCE(vs.id, ts.id) AS id,
        COALESCE(vs.doc_id, ts.doc_id) AS doc_id,
        COALESCE(vs.content, ts.content) AS content,
        COALESCE(vs.vec_similarity, 0.0) AS similarity,
        COALESCE(ts.text_score, 0.0) AS text_match_score,
        (COALESCE(vs.vec_similarity, 0.0) * 0.7 + COALESCE(ts.text_score, 0.0) * 0.3) AS combined_score,
        COALESCE(vs.metadata, ts.metadata) AS metadata
    FROM vector_search vs
    FULL OUTER JOIN text_search ts ON vs.id = ts.id
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Advanced RAG search function that combines keyword and vector search with context expansion
CREATE OR REPLACE FUNCTION advanced_rag_search(
    query_text TEXT,
    query_embedding VECTOR(384),
    similarity_threshold DOUBLE PRECISION DEFAULT 0.7,
    match_count INT DEFAULT 3,
    context_window INT DEFAULT 2
)
RETURNS TABLE(
    id UUID,
    doc_id VARCHAR,
    document_id UUID,
    chunk_id INTEGER,
    content TEXT,
    similarity DOUBLE PRECISION,
    keyword_match_score DOUBLE PRECISION,
    combined_score DOUBLE PRECISION,
    metadata JSONB,
    chunk_type VARCHAR,
    keywords TEXT[],
    is_original_match BOOLEAN,
    original_chunk_id INTEGER,
    position_offset INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH keyword_matches AS (
        -- Search in keywords array for exact matches
        SELECT 
            bdd.id,
            bdd.doc_id,
            bdd.document_id,
            bdd.chunk_id,
            bdd.content,
            0.0 AS vec_similarity,
            CASE 
                WHEN query_text = ANY(bdd.keywords) THEN 1.0
                WHEN EXISTS (
                    SELECT 1 FROM unnest(bdd.keywords) AS kw 
                    WHERE kw ILIKE '%' || query_text || '%'
                ) THEN 0.8
                ELSE 0.0
            END AS keyword_score,
            bdd.metadata,
            bdd.chunk_type,
            bdd.keywords
        FROM brdr_documents_data bdd
        WHERE bdd.keywords IS NOT NULL 
        AND (
            query_text = ANY(bdd.keywords) 
            OR EXISTS (
                SELECT 1 FROM unnest(bdd.keywords) AS kw 
                WHERE kw ILIKE '%' || query_text || '%'
            )
        )
    ),
    vector_matches AS (
        -- Vector similarity search
        SELECT 
            bdd.id,
            bdd.doc_id,
            bdd.document_id,
            bdd.chunk_id,
            bdd.content,
            1 - (bdd.embedding <-> query_embedding) AS vec_similarity,
            0.0 AS keyword_score,
            bdd.metadata,
            bdd.chunk_type,
            bdd.keywords
        FROM brdr_documents_data bdd
        WHERE bdd.embedding IS NOT NULL
        AND 1 - (bdd.embedding <-> query_embedding) > similarity_threshold
    ),
    combined_matches AS (
        -- Combine keyword and vector matches
        SELECT 
            COALESCE(km.id, vm.id) AS id,
            COALESCE(km.doc_id, vm.doc_id) AS doc_id,
            COALESCE(km.document_id, vm.document_id) AS document_id,
            COALESCE(km.chunk_id, vm.chunk_id) AS chunk_id,
            COALESCE(km.content, vm.content) AS content,
            COALESCE(vm.vec_similarity, 0.0) AS similarity,
            COALESCE(km.keyword_score, 0.0) AS keyword_match_score,
            (COALESCE(vm.vec_similarity, 0.0) * 0.6 + COALESCE(km.keyword_score, 0.0) * 0.4) AS combined_score,
            COALESCE(km.metadata, vm.metadata) AS metadata,
            COALESCE(km.chunk_type, vm.chunk_type) AS chunk_type,
            COALESCE(km.keywords, vm.keywords) AS keywords
        FROM keyword_matches km
        FULL OUTER JOIN vector_matches vm ON km.id = vm.id
    ),
    top_matches AS (
        -- Get top matches based on combined score
        SELECT *
        FROM combined_matches
        ORDER BY combined_score DESC
        LIMIT match_count
    ),
    expanded_context AS (
        -- Get surrounding chunks for each top match
        SELECT 
            bdd.id,
            bdd.doc_id,
            bdd.document_id,
            bdd.chunk_id,
            bdd.content,
            tm.similarity,
            tm.keyword_match_score,
            tm.combined_score,
            bdd.metadata,
            bdd.chunk_type,
            bdd.keywords,
            CASE 
                WHEN bdd.chunk_id = tm.chunk_id THEN true 
                ELSE false 
            END AS is_original_match,
            tm.chunk_id AS original_chunk_id,
            (bdd.chunk_id - tm.chunk_id) AS position_offset
        FROM top_matches tm
        JOIN brdr_documents_data bdd ON (
            bdd.doc_id = tm.doc_id 
            AND bdd.chunk_id BETWEEN (tm.chunk_id - context_window) AND (tm.chunk_id + context_window)
        )
    )
    SELECT 
        ec.id,
        ec.doc_id,
        ec.document_id,
        ec.chunk_id,
        ec.content,
        ec.similarity,
        ec.keyword_match_score,
        ec.combined_score,
        ec.metadata,
        ec.chunk_type,
        ec.keywords,
        ec.is_original_match,
        ec.original_chunk_id,
        ec.position_offset
    FROM expanded_context ec
    ORDER BY 
        ec.original_chunk_id,
        ec.position_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for simple text search
CREATE OR REPLACE FUNCTION text_search(
    query_text TEXT,
    match_count INT DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    doc_id VARCHAR,
    content TEXT,
    text_score DOUBLE PRECISION,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bdd.id,
        bdd.doc_id,
        bdd.content,
        ts_rank(to_tsvector('english', bdd.content), websearch_to_tsquery('english', query_text)) AS text_score,
        bdd.metadata
    FROM brdr_documents_data bdd
    WHERE to_tsvector('english', bdd.content) @@ websearch_to_tsquery('english', query_text)
    ORDER BY text_score DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Enable Row Level Security (optional, uncomment if needed)
-- ALTER TABLE brdr_documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE brdr_documents_data ENABLE ROW LEVEL SECURITY;

-- Create policies (optional, uncomment if needed)
-- CREATE POLICY "Public access" ON brdr_documents FOR ALL TO anon, authenticated USING (true);
-- CREATE POLICY "Public access" ON brdr_documents_data FOR ALL TO anon, authenticated USING (true);
