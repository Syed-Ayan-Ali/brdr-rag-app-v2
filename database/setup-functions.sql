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




-- Function for full text search with date filtering
CREATE OR REPLACE FUNCTION full_text_search(
    query_text TEXT,
    match_count INT DEFAULT 10,
    search_table TEXT DEFAULT 'brdr_documents_data',
    start_year INT DEFAULT 1989,
    start_month INT DEFAULT 1,
    start_day INT DEFAULT 1,
    end_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
    end_month INT DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INT,
    end_day INT DEFAULT EXTRACT(DAY FROM CURRENT_DATE)::INT
)
RETURNS TABLE(
    id UUID,
    doc_id VARCHAR,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bdd.id,
        bdd.doc_id,
        bdd.content,
        0.0::FLOAT AS similarity,
        bdd.metadata
    FROM brdr_documents_data bdd
    WHERE bdd.content ILIKE '%' || query_text || '%'
    
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for vector similarity search with date range filtering
CREATE OR REPLACE FUNCTION vector_search(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 10,
    search_table TEXT DEFAULT 'brdr_documents_data',
    start_year INT DEFAULT 1989,
    start_month INT DEFAULT 1,
    start_day INT DEFAULT 1,
    end_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
    end_month INT DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INT,
    end_day INT DEFAULT EXTRACT(DAY FROM CURRENT_DATE)::INT
)
RETURNS TABLE(
    id UUID,
    doc_id VARCHAR,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
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
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for keyword search in the keywords array column with date filtering
CREATE OR REPLACE FUNCTION keyword_search(
    query_text TEXT,
    match_count INT DEFAULT 10,
    search_table TEXT DEFAULT 'brdr_documents_data',
    start_year INT DEFAULT 1989,
    start_month INT DEFAULT 1,
    start_day INT DEFAULT 1,
    end_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
    end_month INT DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INT,
    end_day INT DEFAULT EXTRACT(DAY FROM CURRENT_DATE)::INT
)
RETURNS TABLE(
    id UUID,
    doc_id VARCHAR,
    content TEXT,
    keywords TEXT[],
    matched_keywords TEXT[],
    match_score FLOAT8,
    metadata JSONB
) AS $$
DECLARE
    search_keywords TEXT[];
    search_word TEXT;
BEGIN
    -- Extract keywords from the query
    -- Split the query into words
    search_keywords := ARRAY(
        SELECT DISTINCT lower(word)
        FROM regexp_split_to_table(query_text, '\s+') AS word
        WHERE length(word) > 3 -- Only consider words longer than 3 characters
    );
    
    -- For documents table with date filtering
    RETURN QUERY
    WITH keyword_matches AS (
        SELECT 
            bdd.id,
            bdd.doc_id,
            bdd.content,
            bdd.keywords,
            ARRAY(
                SELECT k
                FROM unnest(bdd.keywords) k
                WHERE EXISTS (
                    SELECT 1 
                    FROM unnest(search_keywords) q
                    WHERE k ILIKE '%' || q || '%' OR q ILIKE '%' || k || '%'
                )
            ) AS matched_keywords,
            (
                SELECT COALESCE(SUM(
                    CASE
                        WHEN EXISTS (
                            SELECT 1 
                            FROM unnest(search_keywords) q
                            WHERE k = q
                        ) THEN 1.0::FLOAT8
                        ELSE 0.5::FLOAT8
                    END
                ), 0.0::FLOAT8)::FLOAT8
                FROM unnest(bdd.keywords) k
                WHERE EXISTS (
                    SELECT 1 
                    FROM unnest(search_keywords) q
                    WHERE k ILIKE '%' || q || '%' OR q ILIKE '%' || k || '%'
                )
            ) AS match_score,
            bdd.metadata
        FROM brdr_documents_data bdd
        WHERE bdd.keywords IS NOT NULL
       
    )
    SELECT 
        km.id,
        km.doc_id,
        km.content,
        km.keywords,
        km.matched_keywords,
        km.match_score,
        km.metadata
    FROM keyword_matches km
    WHERE array_length(km.matched_keywords, 1) > 0
    ORDER BY km.match_score DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to combine keyword search with vector search for hybrid results
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding VECTOR(1536),
    keyword_weight FLOAT8 DEFAULT 0.4,
    vector_weight FLOAT8 DEFAULT 0.6,
    match_count INT DEFAULT 10,
    start_year INT DEFAULT 1989,
    start_month INT DEFAULT 1,
    start_day INT DEFAULT 1,
    end_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
    end_month INT DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INT,
    end_day INT DEFAULT EXTRACT(DAY FROM CURRENT_DATE)::INT
)
RETURNS TABLE(
    id UUID,
    doc_id VARCHAR,
    content TEXT,
    keywords TEXT[],
    matched_keywords TEXT[],
    keyword_score FLOAT8,
    vector_score FLOAT8,
    combined_score FLOAT8,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH 
    keyword_results AS (
        SELECT 
            id,
            doc_id,
            content,
            keywords,
            matched_keywords,
            match_score AS keyword_score,
            metadata
        FROM keyword_search(
            query_text, 
            match_count * 2,
            'brdr_documents_data',
            start_year,
            start_month,
            start_day,
            end_year,
            end_month,
            end_day
        )
    ),
    vector_results AS (
        SELECT 
            id,
            doc_id,
            content,
            similarity AS vector_score,
            metadata
        FROM vector_search(
            query_embedding, 
            0.3, 
            match_count * 2, 
            'brdr_documents_data',
            start_year,
            start_month,
            start_day,
            end_year,
            end_month,
            end_day
        )
    ),
    combined_results AS (
        -- Results from keyword search
        SELECT
            kr.id,
            kr.doc_id,
            kr.content,
            kr.keywords,
            kr.matched_keywords,
            kr.keyword_score::FLOAT8,
            COALESCE(vr.vector_score, 0.0::FLOAT8)::FLOAT8 AS vector_score,
            (kr.keyword_score::FLOAT8 * keyword_weight::FLOAT8 + COALESCE(vr.vector_score, 0.0::FLOAT8)::FLOAT8 * vector_weight::FLOAT8)::FLOAT8 AS combined_score,
            kr.metadata
        FROM keyword_results kr
        LEFT JOIN vector_results vr ON kr.id = vr.id
        
        UNION
        
        -- Results from vector search that weren't in keyword results
        SELECT
            vr.id,
            vr.doc_id,
            vr.content,
            ARRAY[]::TEXT[] AS keywords,
            ARRAY[]::TEXT[] AS matched_keywords,
            0.0::FLOAT8 AS keyword_score,
            vr.vector_score::FLOAT8,
            (vr.vector_score::FLOAT8 * vector_weight::FLOAT8)::FLOAT8 AS combined_score,
            vr.metadata
        FROM vector_results vr
        WHERE NOT EXISTS (
            SELECT 1 FROM keyword_results kr WHERE kr.id = vr.id
        )
    )
    SELECT * FROM combined_results
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION keyword_search TO anon, authenticated;
GRANT EXECUTE ON FUNCTION hybrid_search TO anon, authenticated;
GRANT EXECUTE ON FUNCTION vector_search TO anon, authenticated;
GRANT EXECUTE ON FUNCTION full_text_search TO anon, authenticated;

-- Create vector indexes (only after you have data)
-- Uncomment these lines after running ETL pipeline:
CREATE INDEX IF NOT EXISTS idx_brdr_documents_embedding ON brdr_documents USING hnsw (embedding vector_l2_ops);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_embedding ON brdr_documents_data USING hnsw (embedding vector_l2_ops);

-- Create GIN index on the keywords array for faster keyword searches
CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_keywords ON brdr_documents_data USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_keywords ON brdr_documents USING GIN (keywords);
