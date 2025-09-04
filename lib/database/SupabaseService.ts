import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DocumentChunk } from '../chunking/HierarchicalChunker';

import dotenv from 'dotenv';
dotenv.config();

export interface DocumentMetadata {
  chunkId: string;
  pageNumber: number;
  chunkType: string;
}

export interface DatabaseDocument {
  id: string;
  doc_id: string;
  content: string;
  source: string;
  embedding?: number[];
  metadata?: DocumentMetadata;
  created_at?: string;
  doc_uuid?: string;
  doc_type_code?: string;
  doc_type_desc?: string;
  version_code?: string;
  doc_long_title?: string;
  doc_desc?: string;
  issue_date?: string;
  guideline_no?: string;
  supersession_date?: string;
  keywords?: string[];
  topics?: string[];
  concepts?: string[];
  summary?: string;
  document_type?: string;
  language?: string;
  doc_topic_subtopic_list?: string[];
  doc_keyword_list?: string[];
  doc_ai_type_list?: string[];
  doc_view_list?: string[];
  directly_related_doc_list?: string[];
  version_history_doc_list?: string[];
  reference_doc_list?: string[];
  superseded_doc_list?: string[];
}

export interface DatabaseChunk {
  id: string;
  doc_id: string;
  document_id: string;
  chunk_id: number;
  content: string;
  embedding?: number[];
  metadata?: DocumentMetadata;
  created_at?: string;
  chunk_type?: string;
  keywords?: string[];
  related_chunks?: string[];
}

export interface SearchResult {
  id: string;
  doc_id: string;
  content: string;
  similarity: number;
  metadata?: DocumentMetadata;
  text_match_score?: number;
  combined_score?: number;
}

export interface AdvancedSearchResult {
  id: string;
  doc_id: string;
  document_id: string;
  chunk_id: number;
  content: string;
  similarity: number;
  keyword_match_score: number;
  combined_score: number;
  metadata?: DocumentMetadata;
  chunk_type?: string;
  keywords?: string[];
  is_original_match: boolean;
  original_chunk_id: number;
  position_offset: number;
}

export interface SearchOptions {
  similarity_threshold?: number;
  match_count?: number;
  search_table?: 'brdr_documents' | 'brdr_documents_data';
}

export interface AdvancedSearchOptions {
  similarity_threshold?: number;
  match_count?: number;
  context_window?: number;
}

export class SupabaseService {
  private static instance: SupabaseService;
  private supabase: SupabaseClient;
  private isConnected: boolean = false;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration. Please check your environment variables.');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test connection by trying to access our tables
      // This will fail gracefully if tables don't exist but confirms connection works
      const { error } = await this.supabase
        .from('brdr_documents')
        .select('id')
        .limit(1);
      
      // Connection is good if we get a "table doesn't exist" error or no error
      if (error && !error.message.includes('does not exist') && 
          !error.message.includes('relation') && !error.message.includes('schema cache')) {
        console.error('Database connection test failed:', error);
        return false;
      }

      console.log('Database connection successful');
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('Database connection error:', error);
      this.isConnected = false;
      return false;
    }
  }

  async insertDocument(document: DatabaseDocument): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('brdr_documents')
        .insert([document])
        .select('id')
        .single();

      if (error) {
        console.error('Error inserting document:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Database insert error:', error);
      return null;
    }
  }

  async insertDocumentChunk(chunk: DatabaseChunk): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('brdr_documents_data')
        .insert([chunk])
        .select('id')
        .single();

      if (error) {
        console.error('Error inserting document chunk:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Database insert chunk error:', error);
      return null;
    }
  }

  async insertDocumentChunks(chunks: DatabaseChunk[]): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('brdr_documents_data')
        .insert(chunks);

      if (error) {
        console.error('Error inserting document chunks:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database batch insert error:', error);
      return false;
    }
  }

  async upsertDocument(document: DatabaseDocument): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('brdr_documents')
        .upsert([document], { onConflict: 'doc_id' })
        .select('id')
        .single();

      if (error) {
        console.error('Error upserting document:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Database upsert error:', error);
      return null;
    }
  }

  async getDocumentByDocId(docId: string): Promise<DatabaseDocument | null> {
    try {
      const { data, error } = await this.supabase
        .from('brdr_documents')
        .select('*')
        .eq('doc_id', docId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('Error fetching document:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Database fetch error:', error);
      return null;
    }
  }

  async vectorSearch(
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[] | null | undefined> {
    const {
      similarity_threshold = 0.3,
      match_count = 10,
      search_table = 'brdr_documents_data'
    } = options;

    try {
        console.log("query embedding is", queryEmbedding.slice(0, 10));
        console.log("vector search options are", options);
        const { data, error } = await this.supabase.rpc('vector_search', {
          search_table: search_table,
          query_embedding: queryEmbedding,
          similarity_threshold: similarity_threshold,
          match_count
        });

        // const data = null;
        // const error = "error";

        console.log("vector search data is", data);

        if (data === null) {
            return null;
        } else{
                // Map the results to match the expected SearchResult format
                return data.map((item: Record<string, string>) => ({
                        id: item.id,
                        doc_id: item.doc_id,
                        content: item.content,
                        similarity: item.similarity,
                        metadata: item.metadata
                }));
        }
        
    } catch (rpcError) {
        console.log('Simple vector search RPC function not available.');
        
    }
  }

  async keyWordSearch(
    queryText: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[] | null | undefined> {
    const { match_count = 10 } = options;

    try {
      const { data, error } = await this.supabase.rpc('text_search', {
        query_text: queryText,
        match_count
      });

      console.log("keyword search data is", data);

      if (data === null) {
        return null;
        
      } else {
        return data.map((item: Record<string, string>) => ({
          id: item.id,
          doc_id: item.doc_id,
          content: item.content,
          similarity: item.similarity,
          metadata: item.metadata
        }));
      }


     }
     catch (rpcError) {
        console.log('Keyword search RPC function not available.');
     }
  }

  // async hybridSearch(
  //   queryText: string,
  //   queryEmbedding: number[],
  //   options: SearchOptions = {}
  // ): Promise<SearchResult[]> {
  //   const {
  //     similarity_threshold = 0.5,
  //     match_count = 10
  //   } = options;

  //   try {
  //     // For simplicity, we'll just use the vector search
  //     // This is a bare-bones approach that only uses embeddings
  //     console.log('Using simple vector search instead of hybrid search');
  //     const result = await this.vectorSearch(queryEmbedding, {
  //       similarity_threshold,
  //       match_count
  //     });
      
  //     // Check if the result is an error object
  //     if (result && typeof result === 'object' && 'error' in result && 'type' in result) {
  //       console.error('Hybrid search vector search error:', result.error);
  //       return [];
  //     }
      
  //     return result as SearchResult[];
  //   } catch (error) {
  //     console.error('Hybrid search exception:', error);
  //     return [];
  //   }
  // }

  // async keywordSearch(
  //   queryText: string,
  //   options: SearchOptions = {}
  // ): Promise<SearchResult[]> {
  //   const { match_count = 10 } = options;

  //   try {
  //     // Use RPC function for better text search handling
  //     try {
  //       const { data, error } = await this.supabase.rpc('text_search', {
  //         query_text: queryText,
  //         match_count
  //       });

  //       if (!error && data) {
  //         return data.map((item: any) => ({
  //           id: item.id,
  //           doc_id: item.doc_id,
  //           content: item.content,
  //           similarity: 0, // No similarity score for keyword search
  //           metadata: item.metadata,
  //           text_match_score: item.text_score || 0
  //         }));
  //       }
  //     } catch (rpcError) {
  //       console.log('RPC text search not available, using fallback');
  //     }

  //     // Fallback to simple content matching
  //     const { data, error } = await this.supabase
  //       .from('brdr_documents_data')
  //       .select('id, doc_id, content, metadata')
  //       .ilike('content', `%${queryText}%`)
  //       .limit(match_count);

  //     if (error) {
  //       console.error('Keyword search error:', error);
  //       return [];
  //     }

  //     return (data || []).map(item => ({
  //       id: item.id,
  //       doc_id: item.doc_id,
  //       content: item.content,
  //       similarity: 0, // No similarity score for keyword search
  //       metadata: item.metadata
  //     }));
  //   } catch (error) {
  //     console.error('Keyword search exception:', error);
  //     return [];
  //   }
  // }

  // async advancedRAGSearch(
  //   queryText: string,
  //   queryEmbedding: number[],
  //   options: AdvancedSearchOptions = {}
  // ): Promise<AdvancedSearchResult[]> {
  //   const {
  //     similarity_threshold = 0.7,
  //     match_count = 3,
  //     context_window = 2
  //   } = options;

  //   try {
  //     const { data, error } = await this.supabase.rpc('advanced_rag_search', {
  //       query_text: queryText,
  //       query_embedding: queryEmbedding,
  //       similarity_threshold,
  //       match_count,
  //       context_window
  //     });

  //     if (error) {
  //       console.error('Advanced RAG search error:', error);
  //       return [];
  //     }

  //     return data || [];
  //   } catch (error) {
  //     console.error('Advanced RAG search exception:', error);
  //     return [];
  //   }
  // }

  async getDocumentChunks(docId: string): Promise<DatabaseChunk[]> {
    try {
      const { data, error } = await this.supabase
        .from('brdr_documents_data')
        .select('*')
        .eq('doc_id', docId)
        .order('chunk_id');

      if (error) {
        console.error('Error fetching document chunks:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Database fetch chunks error:', error);
      return [];
    }
  }

  async deleteDocument(docId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('brdr_documents')
        .delete()
        .eq('doc_id', docId);

      if (error) {
        console.error('Error deleting document:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database delete error:', error);
      return false;
    }
  }

  async deleteDocumentChunks(docId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('brdr_documents_data')
        .delete()
        .eq('doc_id', docId);

      if (error) {
        console.error('Error deleting document chunks:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database delete chunks error:', error);
      return false;
    }
  }

  async getDocumentCount(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('brdr_documents')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Error getting document count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Database count error:', error);
      return 0;
    }
  }

  async getChunkCount(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('brdr_documents_data')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Error getting chunk count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Database count error:', error);
      return 0;
    }
  }

  async getDatabaseStats(): Promise<{
    documentCount: number;
    chunkCount: number;
    isConnected: boolean;
  }> {
    const documentCount = await this.getDocumentCount();
    const chunkCount = await this.getChunkCount();
    
    return {
      documentCount,
      chunkCount,
      isConnected: this.isConnected
    };
  }

  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Search documents by document ID pattern with optional vector similarity
   * Supports date-based filtering using patterns like "202508**" or "20250815*"
   */
  // async searchByDocIdPattern(
  //   docIdPattern: string,
  //   options: {
  //     limit?: number;
  //   } = {}
  // ): Promise<SearchResult[]> {
  //   const {
  //     limit = 10,
  //   } = options;

  //   try {
  //     let query = this.supabase
  //       .from('brdr_documents_data')
  //       .select(`
  //         id,
  //         doc_id,
  //         content,
  //         metadata,
  //         embedding,
  //         brdr_documents!inner(
  //           doc_long_title,
  //           doc_type_desc,
  //           issue_date,
  //           doc_desc
  //         )
  //       `);

  //     // Convert wildcard pattern to PostgreSQL LIKE pattern
  //     const likePattern = docIdPattern.replace(/\*/g, '%');
  //     query = query.like('doc_id', likePattern);

      
  //       // Simple pattern-based search without vector similarity
  //       const { data, error } = await query.limit(limit);

  //       console.log("doc id pattern search data is", data);
        
  //       if (error) {
  //         console.error('Error in date-filtered search:', error);
  //         return [];
  //       }

  //       return (data || []).map(item => ({
  //         id: item.id,
  //         doc_id: item.doc_id,
  //         content: item.content,
  //         similarity: 0, // No similarity score for pattern-only search
  //         metadata: {
  //           ...item.metadata,
  //           // document_title: item.brdr_documents?.doc_long_title,
  //           // document_type: item.brdr_documents?.doc_type_desc,
  //           // issue_date: item.brdr_documents?.issue_date,
  //           // doc_desc: item.brdr_documents?.doc_desc
  //         }
  //       }));
  //     }
  //     catch (error) {
  //     console.error('Error in searchByDocIdPattern:', error);
  //     return [];
  //   }
  // }

  /**
   * Get documents within a date range using issue_date
   */
  // async searchByDateRange(
  //   startDate: Date,
  //   endDate: Date,
  //   options: {
  //     limit?: number;
  //   } = {}
  // ): Promise<SearchResult[]> {
  //   const {
  //     limit = 10,
  //   } = options;

  //   try {
  //     let query = this.supabase
  //       .from('brdr_documents_data')
  //       .select(`
  //         id,
  //         doc_id,
  //         content,
  //         metadata,
  //         embedding,
  //         brdr_documents!inner(
  //           doc_long_title,
  //           doc_type_desc,
  //           issue_date,
  //           doc_desc
  //         )
  //       `);

  //     // Filter by date range
  //     query = query
  //       .gte('brdr_documents.issue_date', startDate.toISOString())
  //       .lte('brdr_documents.issue_date', endDate.toISOString());

  //       // Simple date range search without vector similarity
  //       const { data, error } = await query.limit(limit);

  //       console.log("date range search data is", data);
        
  //       if (error) {
  //         console.error('Error in date range search:', error);
  //         return [];
  //       }

  //       return (data || []).map(item => ({
  //         id: item.id,
  //         doc_id: item.doc_id,
  //         content: item.content,
  //         similarity: 0,
  //         metadata: {
  //           ...item.metadata,
  //           document_title: item.brdr_documents?.doc_long_title,
  //           document_type: item.brdr_documents?.doc_type_desc,
  //           issue_date: item.brdr_documents?.issue_date,
  //           doc_desc: item.brdr_documents?.doc_desc
  //         }
  //       }));
  //     }
  //    catch (error) {
  //     console.error('Error in searchByDateRange:', error);
  //     return [];
  //   }
  // }
}

// Export singleton instance
export const supabaseService = SupabaseService.getInstance();
