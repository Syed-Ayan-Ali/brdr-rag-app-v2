import { embeddingService } from '../embeddings/EmbeddingService';
import { supabaseService } from '../database/SupabaseService';
import { getDateAndTimeFromQuery } from './getDateAndTimeFromQuery';
// import { logger, LogCategory } from '../logging/Logger';

/**
 * Enhanced function that performs vector search with optional date filtering
 * 
 * @param userQuery The user's query text
 * @param limit Maximum number of results to return
 * @returns Array of relevant content with similarity scores or error object
 */
export const findRelevantContent = async (userQuery: string, limit: number, searchTable: string, similarityThreshold: number) => {
  try {
    // logger.info(LogCategory.SEARCH, `Finding relevant content for query: "${userQuery}"`);
   
    // Step 1: Generate embedding for the user query
    const embeddingResult = await embeddingService.generateEmbedding(userQuery);
    const userQueryEmbedding = embeddingResult.embedding;
    
    console.log("Query Embedding done");


    // Step 2: Get date values from the user query
    const result = await getDateAndTimeFromQuery(userQuery);
    
    // Extract date values from the result
    console.log("date result is", result.content);
    
    let start_year = 1989;
    let start_month = 1;
    let start_day = 1;

    // the date today (dynamic)
    let end_year = (new Date()).getFullYear();
    let end_month = (new Date()).getMonth() + 1;
    let end_day = (new Date()).getDate();

    if (result.content[0]?.type === 'text') {
      const text = result.content[0].text;
      
      
        // Fallback to regex extraction if JSON parsing fails
        try {
          const startYearMatch = text.match(/Start Year:\s*(\d+)/i);
          const startMonthMatch = text.match(/Start Month:\s*(\d+)/i);
          const startDayMatch = text.match(/Start Day:\s*(\d+)/i);
          const endYearMatch = text.match(/End Year:\s*(\d+)/i);
          const endMonthMatch = text.match(/End Month:\s*(\d+)/i);
          const endDayMatch = text.match(/End Day:\s*(\d+)/i);
          
          start_year = startYearMatch ? parseInt(startYearMatch[1]) : 1989;
          start_month = startMonthMatch ? parseInt(startMonthMatch[1]) : 1;
          start_day = startDayMatch ? parseInt(startDayMatch[1]) : 1;
          end_year = endYearMatch ? parseInt(endYearMatch[1]) : (new Date()).getFullYear();
          end_month = endMonthMatch ? parseInt(endMonthMatch[1]) : (new Date()).getMonth() + 1;
          end_day = endDayMatch ? parseInt(endDayMatch[1]) : (new Date()).getDate();
          
          console.log("Extracted date values using regex:", { 
            start_year, start_month, start_day, 
            end_year, end_month, end_day 
          });
        } catch (error) {
          console.error("Error extracting dates with regex:", error);
        }
      
    }
    // step 3: do vector search with date filtering

    
    const vectorResults = await supabaseService.vectorSearch(
      userQueryEmbedding, {
        search_table: searchTable,
        similarity_threshold: similarityThreshold,
        match_count: limit,
        start_year,
        start_month,
        start_day,
        end_year,
        end_month,
        end_day
      }
    );

    // step 3: do keyword search
    const keywordResults = await supabaseService.keywordSearch(
      userQuery, {
        match_count: limit
      }
    );

    // Step 4: Combine and process results
    if (vectorResults === null && keywordResults === null
    ) {
      // logger.warn(LogCategory.SEARCH, 'No results found from any search method');
      return null;
    }

    // Combine the results 
    const allResults = [...(vectorResults || []), ...(keywordResults || [])];
    
    // Remove duplicates based on id
    const uniqueResults = allResults.reduce((acc, current) => {
      const exists = acc.find(item => item.id === current.id);
      if (!exists) {
        acc.push(current);
      } else if (current.similarity > exists.similarity) {
        // Keep the one with higher similarity
        const index = acc.findIndex(item => item.id === current.id);
        acc[index] = current;
      }
      return acc;
    }, [] as typeof allResults);

    // Sort by similarity and limit results
    const finalResults = uniqueResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // logger.info(LogCategory.SEARCH, `Found ${finalResults.length} relevant content items`);

    return finalResults.map(item => ({
      content: item.content,
      similarity: item.similarity,
      doc_id: item.doc_id,
      metadata: item.metadata
    }));
    
  } catch (error) {
    // logger.error(LogCategory.SEARCH, 'Error in findRelevantContent:', error);
    console.error('Error in vector search:', error);
    return null;
  }
};

/**
 * Example usage:
 * 
 * const relevantContent = await findRelevantContent("What are banking requirements?");
 * console.log(relevantContent);
 */
