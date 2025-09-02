#!/usr/bin/env tsx

import { config } from 'dotenv';
import { BRDRCrawler } from '../crawler/BRDRCrawler';
import { logger, LogCategory } from '../lib/logging/Logger';

// Load environment variables
config();

async function checkTotalDocuments() {
  console.log('🔍 Checking total available documents in BRDR API...');

  try {
    const crawler = new BRDRCrawler();
    
    // Just fetch the first page to get total count
    console.log('📡 Fetching first page to get total count...');
    const firstPageResult = await (crawler as any).fetchBRDRPage(1);
    
    const totalDocuments = firstPageResult.totalRecords;
    const documentsPerPage = firstPageResult.documents.length;
    const totalPages = Math.ceil(totalDocuments / 20); // 20 docs per page
    
    console.log('\n📊 BRDR API Statistics:');
    console.log(`  📄 Total documents: ${totalDocuments.toLocaleString()}`);
    console.log(`  📑 Documents per page: ${documentsPerPage}`);
    console.log(`  📚 Total pages: ${totalPages.toLocaleString()}`);
    console.log(`  ⏱️ Estimated processing time: ${Math.round((totalDocuments * 0.5) / 60)} minutes`);
    console.log(`  💾 Estimated storage: ~${Math.round(totalDocuments * 2)} MB`);
    
    console.log('\n🔗 Hybrid Processing:');
    console.log(`  📡 API documents: ${totalDocuments.toLocaleString()}`);
    console.log(`  📄 Markdown files available: ${getMarkdownCount()}`);
    
    console.log('\n💡 Recommendations:');
    if (totalDocuments > 1000) {
      console.log('  ⚠️  Large dataset detected!');
      console.log('  🎯 Consider processing in batches for first run');
      console.log('  🔄 Use skipExisting=true for incremental updates');
    } else {
      console.log('  ✅ Dataset size is manageable for full processing');
    }
    
  } catch (error) {
    console.error('❌ Error checking document count:', error);
    logger.error(LogCategory.CRAWLER, 'Failed to check document count', error);
    process.exit(1);
  }
}

function getMarkdownCount(): number {
  try {
    const fs = require('fs');
    const files = fs.readdirSync('public/brdr-md');
    return files.filter((file: string) => file.endsWith('.md')).length;
  } catch {
    return 0;
  }
}

// Execute if run directly
if (require.main === module) {
  checkTotalDocuments().catch(console.error);
}

export { checkTotalDocuments };
