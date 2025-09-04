-- Add creation date component columns to brdr_documents_data
ALTER TABLE IF EXISTS brdr_documents_data 
ADD COLUMN IF NOT EXISTS creation_year VARCHAR,
ADD COLUMN IF NOT EXISTS creation_month VARCHAR,
ADD COLUMN IF NOT EXISTS creation_date VARCHAR;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_creation_year ON brdr_documents_data (creation_year);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_creation_month ON brdr_documents_data (creation_month);
CREATE INDEX IF NOT EXISTS idx_brdr_documents_data_creation_date ON brdr_documents_data (creation_date);

-- Update function to allow searching by date components
CREATE OR REPLACE FUNCTION search_by_date(
    year_param VARCHAR DEFAULT NULL,
    month_param VARCHAR DEFAULT NULL,
    date_param VARCHAR DEFAULT NULL,
    match_count INT DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    doc_id VARCHAR,
    content TEXT,
    metadata JSONB,
    creation_year VARCHAR,
    creation_month VARCHAR,
    creation_date VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bdd.id,
        bdd.doc_id,
        bdd.content,
        bdd.metadata,
        bdd.creation_year,
        bdd.creation_month,
        bdd.creation_date
    FROM brdr_documents_data bdd
    WHERE 
        (year_param IS NULL OR bdd.creation_year = year_param) AND
        (month_param IS NULL OR bdd.creation_month = month_param) AND
        (date_param IS NULL OR bdd.creation_date = date_param)
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION search_by_date TO anon, authenticated;