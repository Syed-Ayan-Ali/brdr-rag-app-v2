import { embeddingService } from './EmbeddingService';
import { supabaseService } from '../database/SupabaseService';

/**
 * A simple function that performs vector search on the Supabase database
 * 
 * @param userQuery The user's query text
 * @returns Array of relevant content with similarity scores
 */
export const findRelevantContent = async (userQuery: string, limit: number) => {
//      console.log("findRelevantContent is called with the question", userQuery);
//      return ["Hello from simple vector search with the quesion " + userQuery];

  try {
    // Generate embedding for the user query
    const embeddingResult = await embeddingService.generateEmbedding(userQuery);
    const userQueryEmbedding = embeddingResult.embedding;
    
    console.log("Query Embedding done")

    const similarityThreshold = 0.1;
    // Perform vector search
    const results = await supabaseService.vectorSearch(
    userQueryEmbedding, {
      similarity_threshold: similarityThreshold,
      match_count: limit
    }); 
    
    // Return the results in a simplified format
    return results.map(item => ({
      content: item.content,
      similarity: item.similarity,
      docId: item.doc_id,
      metadata: item.metadata
    }));
    
  } catch (error) {
    console.error('Error in vector search:', error);
    return [];
  }
};

/**
 * Example usage:
 * 
 * const relevantContent = await findRelevantContent("What are banking requirements?");
 * console.log(relevantContent);
 */
