-- Simple Vector Search Function for RAG
-- This function performs a basic vector similarity search without any hybrid components

-- Create a simple vector search function that takes a query embedding and returns the most similar chunks
CREATE OR REPLACE FUNCTION simple_vector_search(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  doc_id text,
  content text,
  document_title text,
  document_type text,
  issue_date text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.doc_id,
    c.content,
    d.doc_long_title as document_title,
    d.doc_type_desc as document_type,
    d.issue_date,
    1 - (c.embedding <=> query_embedding) as similarity
  FROM
    brdr_documents_data c
  JOIN
    brdr_documents d ON c.doc_id = d.doc_id
  WHERE
    c.embedding IS NOT NULL
  ORDER BY
    c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create a function to search by document ID and vector similarity
CREATE OR REPLACE FUNCTION simple_document_vector_search(
  document_id text,
  query_embedding vector(384),
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  doc_id text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.doc_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  FROM
    brdr_documents_data c
  WHERE
    c.doc_id = document_id AND
    c.embedding IS NOT NULL
  ORDER BY
    c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Test the function:
-- SELECT * FROM simple_vector_search('[0.1, 0.2, ...]'::vector, 0.5, 5);

COMMENT ON FUNCTION simple_vector_search IS 'Simple vector similarity search for RAG application';
COMMENT ON FUNCTION simple_document_vector_search IS 'Search within a specific document using vector similarity';
