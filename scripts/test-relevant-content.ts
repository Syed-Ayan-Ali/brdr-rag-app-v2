#!/usr/bin/env tsx

import { findRelevantContent } from '../lib/actions/findRelevantContent';

async function testFindRelevantContent() {
  try {
    console.log('🔍 Testing findRelevantContent function');
    console.log('======================================');
    
    // Example query
    const query = "What are the requirements for banking returns?";
    console.log(`Query: "${query}"`);
    
    // Find relevant content
    console.log('\nSearching for relevant content...');
    const results = await findRelevantContent(query, {
      similarityThreshold: 0.5,
      limit: 3
    });
    
    // Display results
    console.log(`\n✅ Found ${results.length} relevant documents:`);
    
    results.forEach((result, index) => {
      console.log(`\n📄 Result ${index + 1} (Similarity: ${result.similarity.toFixed(4)})`);
      console.log(`ID: ${result.id}`);
      console.log(`Document ID: ${result.doc_id}`);
      console.log(`Content (snippet): ${result.content.substring(0, 150)}...`);
      
      if (result.metadata) {
        console.log('Metadata:');
        Object.entries(result.metadata).forEach(([key, value]) => {
          if (value && typeof value === 'string') {
            console.log(`  - ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
          }
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing findRelevantContent:', error);
  }
}

// Run the test
testFindRelevantContent().catch(console.error);
