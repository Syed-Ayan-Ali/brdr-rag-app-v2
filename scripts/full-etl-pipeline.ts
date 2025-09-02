#!/usr/bin/env tsx

import { config } from 'dotenv';
import { etlPipeline } from '../lib/etl/ETLPipeline';
import { embeddingService } from '../lib/embeddings/EmbeddingService';
import { supabaseService } from '../lib/database/SupabaseService';
import { logger, LogCategory } from '../lib/logging/Logger';

// Load environment variables
config();

async function runFullETLPipeline() {
  console.log('🚀 Starting Full ETL Pipeline...');
  console.log('This will crawl, chunk, embed, and store BRDR documents.');

  try {
    // Step 1: Verify prerequisites
    console.log('\n📋 Step 1: Verifying prerequisites...');
    
    // Test database connection
    console.log('  📡 Testing database connection...');
    const isConnected = await supabaseService.testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    console.log('  ✅ Database connection successful');

    // Warm up embedding service
    console.log('  🔥 Warming up embedding service...');
    await embeddingService.warmup();
    console.log('  ✅ Embedding service ready');

    // Step 2: Configure ETL options
    console.log('\n⚙️ Step 2: Configuring ETL pipeline...');
    const etlOptions = {
      // maxDocuments: undefined, // Process ALL documents from ALL pages
      batchSize: 10,
      databaseBatchSize: 50, // Upload to database every 50 documents to manage memory
      skipExisting: true,
      generateEmbeddings: true
    };
    
    console.log('🌍 Processing Strategy: ALL available documents from BRDR API');

    console.log('  📝 ETL Configuration:', etlOptions);

    // Step 3: Run hybrid ETL pipeline
    console.log('\n🔄 Step 3: Running hybrid ETL pipeline...');
    console.log('🔗 Hybrid Approach:');
    console.log('  📡 API: Rich metadata from BRDR API');
    console.log('  📄 Markdown: Page-based content chunking');
    console.log('  🎯 Result: Best of both worlds!');
    console.log('  ⏱️ This may take a few minutes...');
    
    const startTime = Date.now();
    const result = await etlPipeline.runFullPipeline(etlOptions);
    const totalDuration = Date.now() - startTime;

    // Step 4: Display results
    console.log('\n📊 Step 4: ETL Pipeline Results');
    console.log(`  ✅ Success: ${result.success}`);
    console.log(`  📄 Documents processed: ${result.documentsProcessed}`);
    console.log(`  🧩 Chunks created: ${result.chunksCreated}`);
    console.log(`  🔢 Embeddings generated: ${result.embeddingsGenerated}`);
    console.log(`  ⏱️ Processing time: ${result.processingTime}ms`);
    console.log(`  🕐 Total duration: ${totalDuration}ms`);

    if (result.errors.length > 0) {
      console.log(`  ⚠️ Errors encountered: ${result.errors.length}`);
      result.errors.slice(0, 3).forEach((error, index) => {
        console.log(`    ${index + 1}. ${error}`);
      });
    }

    // Step 5: Verify data in database
    console.log('\n🔍 Step 5: Verifying stored data...');
    const stats = await etlPipeline.getStats();
    console.log('  📈 Database Statistics:');
    console.log(`    - Documents: ${stats.databaseStats.documentCount}`);
    console.log(`    - Chunks: ${stats.databaseStats.chunkCount}`);
    console.log(`    - Connection: ${stats.databaseStats.isConnected ? 'Active' : 'Inactive'}`);
    
    console.log('  🤖 Embedding Service:');
    console.log(`    - Model: ${stats.embeddingService.model}`);
    console.log(`    - Dimension: ${stats.embeddingService.dimension}`);
    console.log(`    - Status: ${stats.embeddingService.isReady ? 'Ready' : 'Not Ready'}`);

    console.log('  📝 Logging Statistics:');
    console.log(`    - Total logs: ${stats.logCounts.total}`);
    console.log(`    - Crawl logs: ${stats.logCounts.crawl}`);
    console.log(`    - API logs: ${stats.logCounts.api}`);

    if (result.success) {
      console.log('\n🎉 ETL Pipeline completed successfully!');
      console.log('📌 Your BRDR documents are now ready for RAG queries.');
      console.log('💡 You can now test the chatbot interface.');
    } else {
      console.log('\n❌ ETL Pipeline completed with errors.');
      console.log('🔧 Please check the logs and fix any issues before proceeding.');
    }

  } catch (error) {
    console.error('\n❌ ETL Pipeline failed:', error);
    logger.error(LogCategory.ETL, 'ETL Pipeline script failed', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runFullETLPipeline().catch(console.error);
}

export { runFullETLPipeline };
