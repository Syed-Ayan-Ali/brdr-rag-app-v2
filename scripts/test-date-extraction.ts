import { getDateTimeFromQuery } from '../lib/actions/getDateAndTimeFromQuery';

/**
 * Test script for date extraction functionality
 * Tests various natural language date formats and their conversion to document ID patterns
 */
async function testDateExtraction() {
  console.log('🧪 Testing Date Extraction Functionality');
  console.log('=========================================\n');

  const testQueries = [
    // Specific dates
    "What were the banking requirements on 2023-08-15?",
    "Tell me about regulations from August 15, 2023",
    "Show me documents from 15 August 2023",
    "What happened on 08/15/2023?",
    
    // Month and year
    "What were the changes in August 2023?",
    "Show me documents from December 2022",
    "What regulations were issued in 2023 August?",
    "Tell me about 08/2023 requirements",
    
    // Year only
    "What changed in 2023?",
    "Show me all documents from 2022",
    "Banking requirements in 2024",
    "Regulations during 2021",
    
    // Month only (current year assumed)
    "What happened in August?",
    "Show me December documents",
    "Requirements from January",
    
    // Relative dates
    "What were last month's requirements?",
    "Show me this year's regulations",
    "Documents from last year",
    "Requirements from this month",
    
    // Date ranges
    "Show me documents from January to March 2023",
    "Requirements between Feb-Apr 2022",
    "Changes from January to December 2023",
    
    // No date information
    "What are banking requirements?",
    "Tell me about compliance policies",
    "How do I open an account?",
    
    // Edge cases
    "Banking requirements for 2025 August specifically",
    "What changed on January 1st, 2023?",
    "Show me the latest from Sept 2022",
  ];

  console.log(`Testing ${testQueries.length} different query formats...\n`);

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n--- Test ${i + 1} ---`);
    console.log(`Query: "${query}"`);
    
    try {
      const result = await getDateTimeFromQuery(query);
      
      console.log(`Has Date Info: ${result.hasDateTimeInfo}`);
      
      if (result.hasDateTimeInfo) {
        console.log(`Date Type: ${result.dateType}`);
        console.log(`Doc ID Pattern: ${result.docIdPattern}`);
        console.log(`Confidence: ${result.confidence}`);
        
        if (result.extractedDate) {
          console.log(`Extracted Date: ${result.extractedDate.toDateString()}`);
        }
        
        if (result.startDate && result.endDate) {
          console.log(`Date Range: ${result.startDate.toDateString()} to ${result.endDate.toDateString()}`);
        }
        
        if (result.year) {
          console.log(`Year: ${result.year}`);
        }
        
        if (result.month) {
          console.log(`Month: ${result.month} (${result.monthName || 'N/A'})`);
        }
        
        if (result.day) {
          console.log(`Day: ${result.day}`);
        }
      } else {
        console.log('❌ No date information detected');
      }
    } catch (error) {
      console.error(`❌ Error processing query: ${error}`);
    }
    
    console.log('---');
  }

  console.log('\n🎯 Date Extraction Test Summary');
  console.log('===============================');
  console.log('✅ Test completed successfully');
  console.log('📋 Check the results above to validate date pattern extraction');
  console.log('\n💡 Expected outcomes:');
  console.log('  • Specific dates should produce patterns like "20230815*"');
  console.log('  • Months should produce patterns like "202308**"');
  console.log('  • Years should produce patterns like "2023****"');
  console.log('  • Queries without dates should return hasDateTimeInfo: false');
}

// Run the test
testDateExtraction().catch(console.error);
