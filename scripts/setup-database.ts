#!/usr/bin/env tsx

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

async function setupDatabase() {
  console.log('🚀 Starting database setup...');

  try {
    // Initialize Supabase client directly
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase configuration:');
      console.error('  - NEXT_PUBLIC_SUPABASE_URL');
      console.error('  - SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
      console.error('Please check your .env.local file');
      process.exit(1);
    }

    const client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Test basic connection
    console.log('📡 Testing database connection...');
    
    const { error: connectionError } = await client
      .from('brdr_documents')
      .select('id')
      .limit(1);
    
    // Connection is good if we get a "table doesn't exist" error or no error
    if (connectionError && !connectionError.message.includes('does not exist') && 
        !connectionError.message.includes('relation') && !connectionError.message.includes('schema cache')) {
      console.error('❌ Database connection failed:', connectionError.message);
      console.error('Please check your Supabase URL and key');
      process.exit(1);
    }

    console.log('✅ Database connection successful!');

    // Read setup SQL
    console.log('📄 Reading database setup script...');
    const basicSetupPath = join(__dirname, '..', 'database', 'setup-basic.sql');
    const functionsSetupPath = join(__dirname, '..', 'database', 'setup-functions.sql');
    const basicSetupSQL = readFileSync(basicSetupPath, 'utf-8');
    const functionsSetupSQL = readFileSync(functionsSetupPath, 'utf-8');

    console.log('⚙️ Creating database tables and functions...');
    console.log('📝 You need to run the following SQL in your Supabase SQL Editor:');
    console.log('🔗 Go to: https://supabase.com/dashboard → Your Project → SQL Editor');
    console.log('');
    console.log('📋 STEP 1: Basic Tables Setup');
    console.log('='.repeat(80));
    console.log(basicSetupSQL);
    console.log('='.repeat(80));
    console.log('');
    console.log('📋 STEP 2: Advanced Functions (run this AFTER step 1 and AFTER ETL)');
    console.log('='.repeat(80));
    console.log(functionsSetupSQL);
    console.log('='.repeat(80));
    console.log('');

    // Test if tables exist (basic verification)
    console.log('🔍 Testing if tables exist...');
    
    let tablesExist = false;
    try {
      const { data: brdrDocsTest, error: brdrDocsError } = await client
        .from('brdr_documents')
        .select('id')
        .limit(1);
      
      const { data: brdrDataTest, error: brdrDataError } = await client
        .from('brdr_documents_data')
        .select('id')
        .limit(1);

      if (!brdrDocsError && !brdrDataError) {
        tablesExist = true;
        console.log('✅ Tables already exist!');
      }
    } catch (error) {
      console.log('📝 Tables do not exist yet - please run the SQL script above');
    }

    // Get basic stats if tables exist
    if (tablesExist) {
      try {
        const { count: docCount } = await client
          .from('brdr_documents')
          .select('*', { count: 'exact', head: true });
          
        const { count: chunkCount } = await client
          .from('brdr_documents_data')
          .select('*', { count: 'exact', head: true });

        console.log('📈 Database Statistics:');
        console.log(`  - Documents: ${docCount || 0}`);
        console.log(`  - Chunks: ${chunkCount || 0}`);
        console.log(`  - Connection Status: Connected`);
        
        console.log('🎉 Database setup completed successfully!');
      } catch (error) {
        console.log('📊 Tables exist but may need the complete SQL script for all functions');
      }
    } else {
      console.log('');
      console.log('⚠️ Setup Instructions:');
      console.log('1. ✅ Database connection verified');
      console.log('2. 📝 Run STEP 1 SQL (Basic Tables) in Supabase SQL Editor');
      console.log('3. 🔄 Run this script again to verify tables exist');
      console.log('4. 🚀 Run the ETL pipeline: npm run etl:full');
      console.log('5. 📝 Run STEP 2 SQL (Advanced Functions) for better search');
      console.log('6. 🧪 Test the system: npm run test:rag');
      console.log('');
      console.log('🔗 Supabase SQL Editor: https://supabase.com/dashboard');
      console.log('➡️ Go to Your Project → SQL Editor → New query → Paste & Run');
    }

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    console.error('');
    console.error('💡 Troubleshooting steps:');
    console.error('1. Check your environment variables in .env.local');
    console.error('2. Ensure your Supabase project is active');
    console.error('3. Verify you have the correct service role key');
    console.error('4. Make sure pgvector extension is enabled in Supabase');
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  setupDatabase().catch(console.error);
}

export { setupDatabase };
