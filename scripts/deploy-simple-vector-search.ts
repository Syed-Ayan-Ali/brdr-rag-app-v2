#!/usr/bin/env tsx

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

async function deploySimpleVectorSearch() {
  console.log('🚀 Deploying Simple Vector Search Function');
  console.log('==========================================');

  // Get Supabase credentials from environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  // Initialize Supabase client with service role key for admin access
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Read the SQL file
    const sqlFilePath = join(__dirname, '..', 'database', 'simple-vector-search.sql');
    const sqlContent = readFileSync(sqlFilePath, 'utf8');

    console.log('📄 SQL file loaded successfully');
    console.log('📦 Deploying functions to Supabase...');

    // Execute the SQL script
    const { error } = await supabase.rpc('exec_sql', { sql_query: sqlContent });

    if (error) {
      if (error.message.includes('function "exec_sql" does not exist')) {
        console.error('❌ The exec_sql function does not exist in your Supabase instance');
        console.error('You need to run this SQL in the Supabase SQL Editor manually:');
        console.log('\n' + sqlContent + '\n');
        process.exit(1);
      } else {
        console.error('❌ Error deploying functions:', error);
        process.exit(1);
      }
    }

    console.log('✅ Simple Vector Search functions deployed successfully!');
    console.log('');
    console.log('🔍 Available Functions:');
    console.log('  • simple_vector_search - Basic vector similarity search');
    console.log('  • simple_document_vector_search - Search within a specific document');
    console.log('');
    console.log('🧪 Test with:');
    console.log('  SELECT * FROM simple_vector_search(\'[0.1, 0.2, ...]\'::vector, 0.5, 5);');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.log('');
    console.log('📋 Manual Deployment Instructions:');
    console.log('1. Open the Supabase SQL Editor');
    console.log('2. Copy and paste the contents of database/simple-vector-search.sql');
    console.log('3. Run the SQL script');
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  deploySimpleVectorSearch().catch(console.error);
}

export { deploySimpleVectorSearch };
