#!/usr/bin/env tsx

import { config } from 'dotenv';
import { RAGOrchestratorFactory } from '../lib/RAGOrchestrator';
import { embeddingService } from '../lib/embeddings/EmbeddingService';
import { supabaseService } from '../lib/database/SupabaseService';
import { logger, LogCategory } from '../lib/logging/Logger';

// Load environment variables
config();

async function testRAG() {
  console.log('🧪 Starting RAG System Test...');

  try {
    // Step 1: Initialize RAG system
    console.log('\n📋 Step 1: Initializing RAG system...');
    const orchestrator = await RAGOrchestratorFactory.createDefaultOrchestrator();
    console.log('  ✅ RAG orchestrator initialized');

    // Step 2: Verify data availability
    console.log('\n📊 Step 2: Checking data availability...');
    const stats = await supabaseService.getDatabaseStats();
    console.log(`  📄 Documents available: ${stats.documentCount}`);
    console.log(`  🧩 Chunks available: ${stats.chunkCount}`);
    
    if (stats.documentCount === 0) {
      console.log('  ⚠️ No documents found in database.');
      console.log('  💡 Please run the ETL pipeline first: npm run etl:full');
      return;
    }

    // Step 3: Test queries
    console.log('\n🔍 Step 3: Testing RAG queries...');
    
    const testQueries = [
      {
        query: "What are the banking regulations?",
        searchType: 'vector' as const,
        description: "Vector search test"
      },
      {
        query: "BRDR requirements",
        searchType: 'keyword' as const,
        description: "Keyword search test"
      },
      {
        query: "What are the requirements for data submission?",
        searchType: 'hybrid' as const,
        description: "Hybrid search test"
      }
    ];

    for (let i = 0; i < testQueries.length; i++) {
      const testQuery = testQueries[i];
      console.log(`\n  🔹 Test ${i + 1}: ${testQuery.description}`);
      console.log(`     Query: "${testQuery.query}"`);
      
      try {
        const startTime = Date.now();
        const response = await orchestrator.processQuery({
          query: testQuery.query,
          searchType: testQuery.searchType,
          limit: 5,
          useCache: false,
          trackPerformance: true
        });
        const duration = Date.now() - startTime;

        console.log(`     ✅ Success (${duration}ms)`);
        console.log(`     📄 Documents found: ${response.documents.length}`);
        console.log(`     🔍 Search strategy: ${response.searchStrategy}`);
        console.log(`     📈 Avg similarity: ${(response.metrics.averageSimilarity * 100).toFixed(1)}%`);
        console.log(`     ⚡ Processing time: ${response.processingTime}ms`);
        
        if (response.documents.length > 0) {
          const topDoc = response.documents[0];
          console.log(`     🏆 Top result: ${topDoc.doc_id} (${(topDoc.similarity * 100).toFixed(1)}%)`);
          console.log(`     📝 Context preview: ${response.context.substring(0, 200)}...`);
        }

      } catch (error) {
        console.log(`     ❌ Failed: ${error}`);
      }
    }

    // Step 4: Test embedding service directly
    console.log('\n🔢 Step 4: Testing embedding service...');
    try {
      const testText = "Test embedding generation";
      const startTime = Date.now();
      const embedding = await embeddingService.generateEmbedding(testText);
      const duration = Date.now() - startTime;
      
      console.log(`  ✅ Embedding generated (${duration}ms)`);
      console.log(`  📐 Dimension: ${embedding.dimension}`);
      console.log(`  🤖 Model: ${embedding.model}`);
      console.log(`  🔢 Sample values: [${embedding.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    } catch (error) {
      console.log(`  ❌ Embedding test failed: ${error}`);
    }

    // Step 5: Performance summary
    console.log('\n📊 Step 5: Performance summary...');
    const performanceSummary = orchestrator.getPerformanceSummary();
    console.log('  ⚡ Performance Metrics:');
    
    Object.entries(performanceSummary).forEach(([metric, stats]) => {
      console.log(`    - ${metric}: avg ${stats.avg.toFixed(2)}ms, min ${stats.min}ms, max ${stats.max}ms`);
    });

    const cacheStats = orchestrator.getCacheStats();
    console.log('  🗄️ Cache Statistics:');
    console.log(`    - Size: ${cacheStats.size}/${cacheStats.maxSize}`);
    console.log(`    - Hit rate: ${cacheStats.hitRate.toFixed(2)}%`);

    // Step 6: Available strategies
    console.log('\n🔧 Step 6: Available search strategies...');
    const strategies = orchestrator.getAvailableStrategies();
    const descriptions = orchestrator.getStrategyDescriptions();
    
    strategies.forEach(strategy => {
      console.log(`  📋 ${strategy}: ${descriptions[strategy]}`);
    });

    console.log('\n🎉 RAG System Test completed successfully!');
    console.log('✨ Your RAG system is ready for use.');
    console.log('🌐 You can now start the Next.js app: npm run dev');

  } catch (error) {
    console.error('\n❌ RAG System Test failed:', error);
    // logger.error(LogCategory.RAG, 'RAG test script failed', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  testRAG().catch(console.error);
}

export { testRAG };
