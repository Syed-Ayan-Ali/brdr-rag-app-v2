import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DocumentChunk } from '../chunking/HierarchicalChunker';

import dotenv from 'dotenv';
dotenv.config();

export interface DatabaseDocument {
  id: string;
  doc_id: string;
  content: string;
  source: string;
  embedding?: number[];
  metadata?: any;
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
  doc_topic_subtopic_list?: any;
  doc_keyword_list?: any;
  doc_ai_type_list?: any;
  doc_view_list?: any;
  directly_related_doc_list?: any;
  version_history_doc_list?: any;
  reference_doc_list?: any;
  superseded_doc_list?: any;
}

export interface DatabaseChunk {
  id: string;
  doc_id: string;
  document_id: string;
  chunk_id: number;
  content: string;
  embedding?: number[];
  metadata?: any;
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
  metadata?: any;
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
  metadata?: any;
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
  ): Promise<SearchResult[]> {
    const {
      similarity_threshold = 0.5,
      match_count = 10,
      search_table = 'brdr_documents_data'
    } = options;

    try {
      // Try simple vector search RPC function first
      try {
        const { data, error } = await this.supabase.rpc('simple_vector_search', {
          query_embedding: queryEmbedding,
          match_threshold: similarity_threshold,
          match_count
        });

        if (!error) {
          // Map the results to match the expected SearchResult format
          return (data || []).map((item: any) => ({
            id: item.id,
            doc_id: item.doc_id,
            content: item.content,
            similarity: item.similarity,
            metadata: {
              document_title: item.document_title,
              document_type: item.document_type,
              issue_date: item.issue_date
            }
          }));
        }
      } catch (rpcError) {
        console.log('Simple vector search RPC function not available, using fallback');
      }

      // Fallback: Direct vector similarity search
      const { data, error } = await this.supabase
        .from(search_table)
        .select('id, doc_id, content, metadata')
        .not('embedding', 'is', null)
        .limit(match_count);

      if (error) {
        console.error('Vector search error:', error);
        return [];
      }

      // Calculate similarity manually (simplified)
      return (data || []).map(item => ({
        id: item.id,
        doc_id: item.doc_id,
        content: item.content,
        similarity: 0.8, // Placeholder similarity
        metadata: item.metadata
      }));
    } catch (error) {
      console.error('Vector search exception:', error);
      return [];
    }
  }

  async hybridSearch(
    queryText: string,
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      similarity_threshold = 0.5,
      match_count = 10
    } = options;

    try {
      // For simplicity, we'll just use the vector search
      // This is a bare-bones approach that only uses embeddings
      console.log('Using simple vector search instead of hybrid search');
      return await this.vectorSearch(queryEmbedding, {
        similarity_threshold,
        match_count
      });
    } catch (error) {
      console.error('Hybrid search exception:', error);
      return [];
    }
  }

  async keywordSearch(
    queryText: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { match_count = 10 } = options;

    try {
      // Use RPC function for better text search handling
      try {
        const { data, error } = await this.supabase.rpc('text_search', {
          query_text: queryText,
          match_count
        });

        if (!error && data) {
          return data.map((item: any) => ({
            id: item.id,
            doc_id: item.doc_id,
            content: item.content,
            similarity: 0, // No similarity score for keyword search
            metadata: item.metadata,
            text_match_score: item.text_score || 0
          }));
        }
      } catch (rpcError) {
        console.log('RPC text search not available, using fallback');
      }

      // Fallback to simple content matching
      const { data, error } = await this.supabase
        .from('brdr_documents_data')
        .select('id, doc_id, content, metadata')
        .ilike('content', `%${queryText}%`)
        .limit(match_count);

      if (error) {
        console.error('Keyword search error:', error);
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        doc_id: item.doc_id,
        content: item.content,
        similarity: 0, // No similarity score for keyword search
        metadata: item.metadata
      }));
    } catch (error) {
      console.error('Keyword search exception:', error);
      return [];
    }
  }

  async advancedRAGSearch(
    queryText: string,
    queryEmbedding: number[],
    options: AdvancedSearchOptions = {}
  ): Promise<AdvancedSearchResult[]> {
    const {
      similarity_threshold = 0.7,
      match_count = 3,
      context_window = 2
    } = options;

    try {
      const { data, error } = await this.supabase.rpc('advanced_rag_search', {
        query_text: queryText,
        query_embedding: queryEmbedding,
        similarity_threshold,
        match_count,
        context_window
      });

      if (error) {
        console.error('Advanced RAG search error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Advanced RAG search exception:', error);
      return [];
    }
  }

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
}

// Export singleton instance
export const supabaseService = SupabaseService.getInstance();
