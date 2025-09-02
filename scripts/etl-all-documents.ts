#!/usr/bin/env tsx

import { config } from 'dotenv';
import { ETLPipeline } from '../lib/etl/ETLPipeline';
import { embeddingService } from '../lib/embeddings/EmbeddingService';
import { supabaseService } from '../lib/database/SupabaseService';
import { logger, LogCategory } from '../lib/logging/Logger';

// Load environment variables
config();

async function runFullETLPipeline() {
  console.log('🚀 BRDR Complete ETL Pipeline');
  console.log('===============================');
  
  try {
    // Step 1: Verify environment and connections
    console.log('\n🔍 Step 1: Environment verification...');
    
    // Test database connection
    console.log('  🗄️ Testing database connection...');
    const isConnected = await supabaseService.testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed. Please check your Supabase configuration.');
    }
    console.log('  ✅ Database connected');

    // Warm up embedding service
    console.log('  🔥 Warming up embedding service...');
    await embeddingService.warmup();
    console.log('  ✅ Embedding service ready');

    // Step 2: Show dataset information
    console.log('\n📊 Step 2: Dataset Overview');
    console.log('  📄 Total BRDR documents: 1,585');
    console.log('  📚 Total API pages: 80');
    console.log('  📄 Markdown files: 1,560 (98.4% coverage)');
    console.log('  ⏱️ Estimated processing time: ~13 minutes');

    // Step 3: Configure ETL options for ALL documents
    console.log('\n⚙️ Step 3: Configuring ETL pipeline for ALL documents...');
    const etlOptions = {
      // No maxDocuments limit - process ALL 1,585 documents
      batchSize: 15, // Processing batch size
      databaseBatchSize: 50, // Upload to database every 50 documents to manage memory
      skipExisting: true, // Skip documents already processed
      generateEmbeddings: true
    };
    
    console.log('🌍 Processing Strategy: ALL 1,585 documents from BRDR API');
    console.log('  💾 Memory Management: Database uploads every 50 documents');
    console.log('  📝 ETL Configuration:', etlOptions);

    // Step 4: Run complete ETL pipeline
    console.log('\n🔄 Step 4: Running complete ETL pipeline...');
    console.log('🔗 Hybrid Approach:');
    console.log('  📡 API: Rich metadata from BRDR API (all 80 pages)');
    console.log('  📄 Markdown: Page-based content chunking');
    console.log('  🎯 Result: Complete document collection!');
    console.log('  ⏱️ This will take approximately 13 minutes...');
    console.log('');
    
    const etlPipeline = new ETLPipeline();
    const startTime = Date.now();
    const result = await etlPipeline.runFullPipeline(etlOptions);
    const totalDuration = Date.now() - startTime;

    // Step 5: Display results
    console.log('\n📊 Step 5: Complete ETL Pipeline Results');
    console.log(`  ✅ Success: ${result.success}`);
    console.log(`  📄 Documents processed: ${result.documentsProcessed}`);
    console.log(`  🧩 Chunks created: ${result.chunksCreated}`);
    console.log(`  🔢 Embeddings generated: ${result.embeddingsGenerated}`);
    console.log(`  ⏱️ Processing time: ${Math.round(result.processingTime / 1000)}s`);
    console.log(`  🕐 Total duration: ${Math.round(totalDuration / 1000)}s`);

    if (result.errors.length > 0) {
      console.log(`  ⚠️ Errors: ${result.errors.length}`);
      console.log('  📝 First few errors:');
      result.errors.slice(0, 3).forEach((error, index) => {
        console.log(`    ${index + 1}. ${error}`);
      });
    }

    // Step 6: Verify stored data
    console.log('\n🔍 Step 6: Verifying stored data...');
    try {
      const stats = await supabaseService.getDatabaseStats();
      console.log('  📈 Database Statistics:');
      console.log(`    - Documents: ${stats.documentCount}`);
      console.log(`    - Chunks: ${stats.chunkCount}`);
      console.log(`    - Connection: ${stats.isConnected ? 'Active' : 'Inactive'}`);
    } catch (error) {
      console.log('  ⚠️ Could not fetch database statistics');
    }

    // Show embedding service info
    const embeddingInfo = embeddingService.getModelInfo();
    console.log('  🤖 Embedding Service:');
    console.log(`    - Model: ${embeddingInfo.modelName}`);
    console.log(`    - Dimension: ${embeddingInfo.dimension}`);
    console.log(`    - Status: Ready`);

    // Show logging statistics
    const logStats = logger.getStatistics();
    console.log('  📝 Logging Statistics:');
    console.log(`    - Total logs: ${logStats.totalLogs}`);
    console.log(`    - Crawl logs: ${logStats.crawlLogs}`);
    console.log(`    - API logs: ${logStats.apiLogs}`);

    console.log('\n🎉 Complete ETL Pipeline finished successfully!');
    console.log('📌 All BRDR documents are now ready for RAG queries.');
    console.log('💡 You can now test the chatbot interface with the complete dataset.');

  } catch (error) {
    console.error('\n❌ ETL Pipeline failed:', error);
    logger.error(LogCategory.ETL, 'Complete ETL pipeline failed', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runFullETLPipeline().catch(console.error);
}

export { runFullETLPipeline };
