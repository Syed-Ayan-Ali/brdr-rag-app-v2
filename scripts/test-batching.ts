#!/usr/bin/env tsx

import { config } from 'dotenv';
import { ETLPipeline } from '../lib/etl/ETLPipeline';
import { embeddingService } from '../lib/embeddings/EmbeddingService';
import { supabaseService } from '../lib/database/SupabaseService';
import { logger, LogCategory } from '../lib/logging/Logger';

// Load environment variables
config();

async function testBatching() {
  console.log('🧪 Testing ETL Pipeline Batching');
  console.log('=================================');
  
  try {
    // Step 1: Verify environment
    console.log('\n🔍 Step 1: Environment verification...');
    
    const isConnected = await supabaseService.testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed.');
    }
    console.log('  ✅ Database connected');

    await embeddingService.warmup();
    console.log('  ✅ Embedding service ready');

    // Step 2: Test with small batch and database batching
    console.log('\n⚙️ Step 2: Testing batching configuration...');
    const etlOptions = {
      maxDocuments: 20, // Small test batch
      batchSize: 5, // Process 5 documents at a time
      databaseBatchSize: 10, // Upload to database every 10 documents
      skipExisting: true,
      generateEmbeddings: true
    };
    
    console.log('  📝 Test Configuration:', etlOptions);
    console.log('  💾 Expected behavior:');
    console.log('    - Process 5 documents in parallel');
    console.log('    - Upload to database after 10 documents');
    console.log('    - Upload to database after remaining 10 documents');
    console.log('    - Memory should be freed after each database upload');

    // Step 3: Run test
    console.log('\n🔄 Step 3: Running test ETL pipeline...');
    const startTime = Date.now();
    const memoryStart = process.memoryUsage();
    
    const etlPipeline = new ETLPipeline();
    const result = await etlPipeline.runFullPipeline(etlOptions);
    
    const totalDuration = Date.now() - startTime;
    const memoryEnd = process.memoryUsage();

    // Step 4: Display results
    console.log('\n📊 Step 4: Test Results');
    console.log(`  ✅ Success: ${result.success}`);
    console.log(`  📄 Documents processed: ${result.documentsProcessed}`);
    console.log(`  🧩 Chunks created: ${result.chunksCreated}`);
    console.log(`  🔢 Embeddings generated: ${result.embeddingsGenerated}`);
    console.log(`  ⏱️ Processing time: ${Math.round(result.processingTime / 1000)}s`);
    console.log(`  🕐 Total duration: ${Math.round(totalDuration / 1000)}s`);
    
    console.log('\n💾 Memory Usage:');
    console.log(`  📊 Start: ${Math.round(memoryStart.heapUsed / 1024 / 1024)}MB`);
    console.log(`  📊 End: ${Math.round(memoryEnd.heapUsed / 1024 / 1024)}MB`);
    console.log(`  📊 Difference: ${Math.round((memoryEnd.heapUsed - memoryStart.heapUsed) / 1024 / 1024)}MB`);

    if (result.errors.length > 0) {
      console.log(`  ⚠️ Errors: ${result.errors.length}`);
      result.errors.slice(0, 3).forEach((error, index) => {
        console.log(`    ${index + 1}. ${error}`);
      });
    }

    console.log('\n🎉 Batching test completed!');
    console.log('💡 If memory usage stayed reasonable, batching is working correctly.');

  } catch (error) {
    console.error('\n❌ Batching test failed:', error);
    logger.error(LogCategory.ETL, 'Batching test failed', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  testBatching().catch(console.error);
}

export { testBatching };
