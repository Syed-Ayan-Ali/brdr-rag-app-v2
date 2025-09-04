#!/usr/bin/env tsx

import { config } from 'dotenv';
import { BRDRCrawler } from '../crawler/BRDRCrawler';
import { logger, LogCategory } from '../lib/logging/Logger';

// Load environment variables
config();

async function crawlDocuments() {
  console.log('🕷️ Starting BRDR document crawling...');

  try {
    const crawler = new BRDRCrawler();
    
    // Configure crawling options
    const options = {
      maxPages: 2, // Start with 2 pages for testing
      includePDFContent: false, // PDF parsing disabled
      filterExisting: true
    };

    console.log('⚙️ Crawling configuration:', options);

    // Start crawling
    const startTime = Date.now();
    const documents = await crawler.crawlDocuments(options);
    const duration = Date.now() - startTime;

    console.log('✅ Crawling completed!');
    console.log(`📄 Documents found: ${documents.length}`);
    console.log(`⏱️ Duration: ${duration}ms`);

    // Display sample documents
    if (documents.length > 0) {
      console.log('\n📋 Sample documents:');
      documents.slice(0, 3).forEach((doc, index) => {
        console.log(`\n${index + 1}. ${doc.doc_id}`);
        console.log(`   Title: ${doc.doc_long_title}`);
        console.log(`   Type: ${doc.doc_type_desc}`);
        console.log(`   Date: ${doc.issue_date}`);
        console.log(`   Topics: ${doc.topics?.slice(0, 2).join(', ') || 'N/A'}`);
        console.log(`   Content length: ${doc.content.length} characters`);
      });
    }

    // Show log statistics
    // const logCounts = logger.getLogCounts();
    console.log('\n📊 Crawling Statistics:');
    console.log(`  - Total logs: ${logCounts.total}`);
    console.log(`  - Crawl logs: ${logCounts.crawl}`);
    console.log(`  - API logs: ${logCounts.api}`);

    console.log('\n🎉 Document crawling completed successfully!');
    return documents;

  } catch (error) {
    console.error('❌ Document crawling failed:', error);
    // logger.error(LogCategory.CRAWLER, 'Crawling script failed', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  crawlDocuments().catch(console.error);
}

export { crawlDocuments };
