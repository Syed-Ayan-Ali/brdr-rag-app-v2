import { embeddingService } from './EmbeddingService';
import { supabaseService } from '../database/SupabaseService';

export interface RelevantContent {
  id: string;
  doc_id: string;
  content: string;
  similarity: number;
  metadata?: any;
}

/**
 * Find relevant content from Supabase based on a user query
 * 
 * @param userQuery The user's query text
 * @param options Optional parameters for the search
 * @returns Array of relevant content with similarity scores
 */
export const findRelevantContent = async (
  userQuery: string,
  options: {
    similarityThreshold?: number;
    limit?: number;
  } = {}
): Promise<RelevantContent[]> => {
  try {
    // Generate embedding for the user query
    const embeddingResult = await embeddingService.generateEmbedding(userQuery);
    const queryEmbedding = embeddingResult.embedding;
    
    // Set default options
    const similarityThreshold = options.similarityThreshold || 0.5;
    const limit = options.limit || 4;
    
    console.log(`Finding content similar to query: "${userQuery}"`);
    console.log(`Using similarity threshold: ${similarityThreshold}, limit: ${limit}`);
    
    // Use the vectorSearch method from supabaseService
    const results = await supabaseService.vectorSearch(queryEmbedding, {
      similarity_threshold: similarityThreshold,
      match_count: limit
    });
    
    if (results && results.length > 0) {
      console.log(`Found ${results.length} relevant documents using vector search`);
      return results.map(item => ({
        id: item.id,
        doc_id: item.doc_id,
        content: item.content,
        similarity: item.similarity || 0,
        metadata: item.metadata
      }));
    }
    
    // Fallback: If vector search returned no results, try keyword search
    console.log('Vector search returned no results, trying keyword search');
    const keywordResults = await supabaseService.keywordSearch(userQuery, {
      match_count: limit
    });
    
    // Map keyword results to the same format
    return keywordResults.map(item => ({
      id: item.id,
      doc_id: item.doc_id,
      content: item.content,
      similarity: item.similarity || 0.5, // Default similarity for keyword results
      metadata: item.metadata
    }));
    
  } catch (error) {
    console.error('Error finding relevant content:', error);
    return [];
  }
};

/**
 * Simple usage example:
 * 
 * const results = await findRelevantContent("What are the requirements for banking returns?");
 * console.log(results);
 */
