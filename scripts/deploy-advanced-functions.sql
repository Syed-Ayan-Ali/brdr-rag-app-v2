-- Deploy Advanced RAG Functions to Supabase
-- Copy and paste this into your Supabase SQL Editor

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
            0.0::DOUBLE PRECISION AS vec_similarity,
            CASE 
                WHEN query_text = ANY(bdd.keywords) THEN 1.0::DOUBLE PRECISION
                WHEN EXISTS (
                    SELECT 1 FROM unnest(bdd.keywords) AS kw 
                    WHERE kw ILIKE '%' || query_text || '%'
                ) THEN 0.8::DOUBLE PRECISION
                ELSE 0.0::DOUBLE PRECISION
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
            (1 - (bdd.embedding <-> query_embedding))::DOUBLE PRECISION AS vec_similarity,
            0.0::DOUBLE PRECISION AS keyword_score,
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
            COALESCE(vm.vec_similarity, 0.0::DOUBLE PRECISION) AS similarity,
            COALESCE(km.keyword_score, 0.0::DOUBLE PRECISION) AS keyword_match_score,
            (COALESCE(vm.vec_similarity, 0.0::DOUBLE PRECISION) * 0.6 + COALESCE(km.keyword_score, 0.0::DOUBLE PRECISION) * 0.4)::DOUBLE PRECISION AS combined_score,
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

-- Update hybrid search to use websearch_to_tsquery
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

-- Grant permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
