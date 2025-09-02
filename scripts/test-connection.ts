#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

async function testConnection() {
  console.log('🔌 Testing Supabase connection...');

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing environment variables:');
      console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
      console.error('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
      console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓' : '✗');
      process.exit(1);
    }

    const client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('📡 Testing basic connection...');
    // Test connection by trying to access our tables directly
    // This will fail gracefully if tables don't exist but confirms connection works
    const { error: connectionError } = await client
      .from('brdr_documents')
      .select('id')
      .limit(1);

    // Connection is good if we get a "table doesn't exist" error or no error
    if (connectionError && !connectionError.message.includes('does not exist') && 
        !connectionError.message.includes('relation') && !connectionError.message.includes('schema cache')) {
      console.error('❌ Connection failed:', connectionError.message);
      console.error('Please check your Supabase URL and API keys');
      process.exit(1);
    }

    console.log('✅ Basic connection successful!');

    // Test if our tables exist
    console.log('🔍 Checking for BRDR tables...');
    
    try {
      const { error: brdrError } = await client
        .from('brdr_documents')
        .select('id')
        .limit(1);

      const { error: dataError } = await client
        .from('brdr_documents_data')
        .select('id')
        .limit(1);

      if (!brdrError && !dataError) {
        console.log('✅ BRDR tables exist!');
        
        // Get counts
        const { count: docCount } = await client
          .from('brdr_documents')
          .select('*', { count: 'exact', head: true });
          
        const { count: chunkCount } = await client
          .from('brdr_documents_data')
          .select('*', { count: 'exact', head: true });

        console.log('📊 Database status:');
        console.log(`  Documents: ${docCount || 0}`);
        console.log(`  Chunks: ${chunkCount || 0}`);
        
        if ((docCount || 0) > 0) {
          console.log('🎉 Database is ready for RAG queries!');
        } else {
          console.log('📝 Tables exist but are empty. Run ETL pipeline:');
          console.log('   npm run etl:full');
        }
      } else {
        console.log('📝 BRDR tables do not exist. Run database setup:');
        console.log('   npm run db:setup');
      }
    } catch (tableError) {
      console.log('📝 BRDR tables do not exist. Run database setup:');
      console.log('   npm run db:setup');
    }

    // Check extensions
    console.log('🔧 Checking extensions...');
    try {
      const { data: extensions } = await client
        .from('pg_extension')
        .select('extname')
        .in('extname', ['vector', 'uuid-ossp']);

      if (extensions && extensions.length > 0) {
        console.log('✅ Extensions found:', extensions.map(e => e.extname).join(', '));
      } else {
        console.log('⚠️ Extensions may need to be enabled manually in Supabase dashboard');
      }
    } catch (extError) {
      console.log('ℹ️ Extension check skipped (requires elevated permissions)');
    }

    console.log('');
    console.log('🎉 Connection test completed successfully!');

  } catch (error) {
    console.error('❌ Connection test failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  testConnection().catch(console.error);
}

export { testConnection };
