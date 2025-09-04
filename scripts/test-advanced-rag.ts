#!/usr/bin/env tsx

import { config } from 'dotenv';
import { RAGOrchestratorFactory } from '../lib/RAGOrchestrator';
import { supabaseService } from '../lib/database/SupabaseService';

// Load environment variables
config();

async function testAdvancedRAGSearch() {
  console.log('🔍 Testing Advanced RAG Search Pipeline...\n');

  try {
    // Test database connection
    console.log('1. Testing database connection...');
    const isConnected = await supabaseService.testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connection successful\n');

    // Initialize RAG orchestrator
    console.log('2. Initializing RAG orchestrator...');
    const orchestrator = await RAGOrchestratorFactory.createDefaultOrchestrator();
    console.log('✅ RAG orchestrator initialized\n');

    // Test the advanced RAG search
    console.log('3. Testing advanced RAG search...');
    const testQuery = 'banking regulation';
    
    const response = await orchestrator.processQuery({
      query: testQuery,
      searchType: 'advanced_rag',
      limit: 3,
      contextWindow: 2,
      similarityThreshold: 0.7,
      useCache: false,
      trackPerformance: true
    });

    console.log(`✅ Advanced RAG search completed for query: "${testQuery}"`);
    console.log(`   - Search strategy: ${response.searchStrategy}`);
    console.log(`   - Documents found: ${response.documents.length}`);
    console.log(`   - Advanced results: ${response.advancedResults?.length || 0}`);
    console.log(`   - Processing time: ${response.processingTime}ms`);
    console.log(`   - Tools used: ${response.toolsUsed.join(', ')}`);
    console.log(`   - Cache hit: ${response.cacheHit}\n`);

    // Test other search types for comparison
    console.log('4. Testing comparison with other search types...');
    
    const vectorResponse = await orchestrator.processQuery({
      query: testQuery,
      searchType: 'vector',
      limit: 5,
      useCache: false
    });

    const hybridResponse = await orchestrator.processQuery({
      query: testQuery,
      searchType: 'hybrid',
      limit: 5,
      useCache: false
    });

    console.log(`   Vector search: ${vectorResponse.documents.length} docs, ${vectorResponse.processingTime}ms`);
    console.log(`   Hybrid search: ${hybridResponse.documents.length} docs, ${hybridResponse.processingTime}ms`);
    console.log(`   Advanced RAG: ${response.documents.length} docs, ${response.processingTime}ms\n`);

    // Show context preview
    console.log('5. Context preview (first 500 chars):');
    console.log('---');
    console.log(response.context.substring(0, 500) + '...');
    console.log('---\n');

    // Performance metrics
    console.log('6. Performance breakdown:');
    console.log(`   - Query analysis: ${response.performanceMetrics.queryAnalysisTime}ms`);
    console.log(`   - Embedding generation: ${response.performanceMetrics.embeddingGenerationTime}ms`);
    console.log(`   - Search execution: ${response.performanceMetrics.vectorSearchTime}ms`);
    console.log(`   - Context formatting: ${response.performanceMetrics.contextFormattingTime}ms`);
    console.log(`   - Total: ${response.performanceMetrics.totalTime}ms\n`);

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAdvancedRAGSearch().catch(console.error);
}

export { testAdvancedRAGSearch };
