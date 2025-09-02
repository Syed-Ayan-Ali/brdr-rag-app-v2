#!/usr/bin/env tsx

import { config } from 'dotenv';
import { markdownPageChunker } from '../lib/chunking/MarkdownPageChunker';
import { logger, LogCategory } from '../lib/logging/Logger';

// Load environment variables
config();

async function testMarkdownChunking() {
  console.log('🧪 Testing Markdown Page Chunking...');

  try {
    // Step 1: Get collection statistics
    console.log('\n📊 Step 1: Getting collection statistics...');
    const stats = markdownPageChunker.getCollectionStats();
    console.log('📈 Collection Statistics:');
    console.log(`  📁 Total markdown files: ${stats.totalFiles}`);
    console.log(`  📄 Total documents: ${stats.totalDocuments}`);
    console.log(`  📝 Total pages: ${stats.totalPages}`);
    console.log(`  📊 Average pages per document: ${stats.avgPagesPerDocument}`);

    if (stats.totalFiles === 0) {
      console.log('❌ No markdown files found in public/brdr-md');
      console.log('💡 Please ensure your markdown files are in the correct directory');
      return;
    }

    // Step 2: Test parsing a few sample documents
    console.log('\n🔍 Step 2: Testing document parsing...');
    const files = markdownPageChunker.getAllMarkdownFiles();
    const sampleFiles = files.slice(0, 3); // Test first 3 files

    for (const filename of sampleFiles) {
      console.log(`\n📄 Processing: ${filename}`);
      try {
        const document = markdownPageChunker.parseMarkdownFile(filename);
        if (document) {
          console.log(`  ✅ Successfully parsed`);
          console.log(`  📝 Title: ${document.title}`);
          console.log(`  👤 Author: ${document.author || 'N/A'}`);
          console.log(`  📅 Creation Date: ${document.creationDate || 'N/A'}`);
          console.log(`  📊 Pages: ${document.pages.length}`);
          
          // Show sample page
          if (document.pages.length > 0) {
            const firstPage = document.pages[0];
            console.log(`  📋 Sample Page ${firstPage.pageNumber}:`);
            console.log(`    📏 Length: ${firstPage.cleanContent.length} chars`);
            console.log(`    🔤 Tokens: ${firstPage.metadata.tokens}`);
            console.log(`    🏷️ Keywords: ${firstPage.metadata.keywords.slice(0, 3).join(', ')}...`);
            console.log(`    📝 Preview: ${firstPage.cleanContent.substring(0, 100)}...`);
          }
        } else {
          console.log(`  ❌ Failed to parse`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error}`);
      }
    }

    // Step 3: Test full processing
    console.log('\n⚙️ Step 3: Testing full document processing...');
    const processedDocs = markdownPageChunker.processAllDocuments();
    
    console.log(`✅ Successfully processed ${processedDocs.length} documents`);
    
    if (processedDocs.length > 0) {
      const totalChunks = processedDocs.reduce((sum, doc) => sum + doc.chunks.length, 0);
      const avgChunksPerDoc = totalChunks / processedDocs.length;
      
      console.log(`📊 Processing Summary:`);
      console.log(`  📄 Documents: ${processedDocs.length}`);
      console.log(`  🧩 Total chunks: ${totalChunks}`);
      console.log(`  📈 Average chunks per document: ${avgChunksPerDoc.toFixed(1)}`);
      
      // Show sample processed document
      const sampleDoc = processedDocs[0];
      console.log(`\n📄 Sample Processed Document: ${sampleDoc.docId}`);
      console.log(`  📝 Title: ${sampleDoc.title}`);
      console.log(`  📊 Chunks: ${sampleDoc.chunks.length}`);
      console.log(`  🏷️ Topics: ${sampleDoc.metadata.source}`);
      console.log(`  📏 Content length: ${sampleDoc.fullContent.length} chars`);
      
      // Show chunk details
      if (sampleDoc.chunks.length > 0) {
        console.log(`\n🧩 Sample Chunks:`);
        sampleDoc.chunks.slice(0, 2).forEach((chunk, index) => {
          console.log(`  📋 Chunk ${index + 1} (Page ${chunk.pageNumber}):`);
          console.log(`    📏 Length: ${chunk.cleanContent.length} chars`);
          console.log(`    🔤 Tokens: ${chunk.metadata.tokens}`);
          console.log(`    🏷️ Keywords: ${chunk.metadata.keywords.slice(0, 3).join(', ')}`);
          console.log(`    📝 Preview: ${chunk.cleanContent.substring(0, 80)}...`);
        });
      }
    }

    // Step 4: Performance test
    console.log('\n⚡ Step 4: Performance test...');
    const startTime = Date.now();
    markdownPageChunker.processAllDocuments();
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`⏱️ Processing time: ${processingTime}ms`);
    console.log(`📊 Performance: ${(stats.totalDocuments / (processingTime / 1000)).toFixed(1)} documents/second`);

    console.log('\n🎉 Markdown chunking test completed successfully!');
    console.log('✨ The chunking system is ready for the ETL pipeline.');

  } catch (error) {
    console.error('\n❌ Markdown chunking test failed:', error);
    logger.error(LogCategory.CHUNKING, 'Chunking test failed', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  testMarkdownChunking().catch(console.error);
}

export { testMarkdownChunking };
