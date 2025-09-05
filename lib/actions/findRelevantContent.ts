import { embeddingService } from '../embeddings/EmbeddingService';
import { supabaseService } from '../database/SupabaseService';
// import { logger, LogCategory } from '../logging/Logger';

/**
 * Enhanced function that performs vector search with optional date filtering
 * 
 * @param userQuery The user's query text
 * @param limit Maximum number of results to return
 * @returns Array of relevant content with similarity scores or error object
 */
export const findRelevantContent = async (userQuery: string, limit: number) => {
  try {
    // logger.info(LogCategory.SEARCH, `Finding relevant content for query: "${userQuery}"`);
   
    // Step 1: Generate embedding for the user query
    const embeddingResult = await embeddingService.generateEmbedding(userQuery);
    const userQueryEmbedding = embeddingResult.embedding;
    
    console.log("Query Embedding done");

    const similarityThreshold = 0.3;

    // step 2: do vector search
    const vectorResults = await supabaseService.vectorSearch(
      userQueryEmbedding, {
        similarity_threshold: similarityThreshold,
        match_count: limit
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
