-- Advanced Functions for BRDR RAG Application
-- Run this AFTER the basic setup and AFTER you have some data

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
            ts_rank(to_tsvector('english', bdd.content), plainto_tsquery('english', query_text)) AS text_score,
            bdd.metadata
        FROM brdr_documents_data bdd
        WHERE to_tsvector('english', bdd.content) @@ plainto_tsquery('english', query_text)
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

-- Grant execute permissions on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Create vector indexes (only after you have data)
-- Uncomment these lines after running ETL pipeline:
-- CREATE INDEX IF NOT EXISTS idx_brdr_documents_embedding ON brdr_documents USING hnsw (embedding vector_l2_ops);
-- CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_embedding ON brdr_documents_data USING hnsw (embedding vector_l2_ops);
