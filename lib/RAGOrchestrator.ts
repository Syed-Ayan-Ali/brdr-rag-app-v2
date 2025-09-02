import { embeddingService } from './embeddings/EmbeddingService';
import { supabaseService, SearchResult, AdvancedSearchResult } from './database/SupabaseService';
import { logger, LogCategory } from './logging/Logger';

export interface QueryRequest {
  query: string;
  searchType?: 'vector' | 'keyword' | 'hybrid' | 'advanced_rag';
  limit?: number;
  useCache?: boolean;
  trackPerformance?: boolean;
  similarityThreshold?: number;
  contextWindow?: number;
}

export interface QueryResponse {
  documents: SearchResult[];
  advancedResults?: AdvancedSearchResult[];
  context: string;
  analysis: QueryAnalysis;
  searchStrategy: string;
  metrics: QueryMetrics;
  documentLinks: DocumentLink[];
  metricsText: string;
  documentLinksText: string;
  processingTime: number;
  toolsUsed: string[];
  cacheHit: boolean;
  performanceMetrics: PerformanceMetrics;
  auditSessionId: string;
}

export interface QueryAnalysis {
  intent: string;
  entities: string[];
  keywords: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  expandedQueries: string[];
}

export interface QueryMetrics {
  totalDocuments: number;
  averageSimilarity: number;
  processingTimeMs: number;
  searchStrategy: string;
  embeddingTimeMs: number;
  retrievalTimeMs: number;
}

export interface DocumentLink {
  docId: string;
  title: string;
  url: string;
  similarity: number;
}

export interface PerformanceMetrics {
  queryAnalysisTime: number;
  embeddingGenerationTime: number;
  vectorSearchTime: number;
  contextFormattingTime: number;
  totalTime: number;
}

export class RAGOrchestrator {
  private cache: Map<string, QueryResponse> = new Map();
  private cacheMaxSize: number = 100;
  private performanceStats: Map<string, number[]> = new Map();

  constructor() {
    // Initialize performance tracking
    this.performanceStats.set('queryAnalysis', []);
    this.performanceStats.set('embedding', []);
    this.performanceStats.set('search', []);
    this.performanceStats.set('formatting', []);
  }

  async processQuery(request: QueryRequest): Promise<QueryResponse> {
    const startTime = Date.now();
    const auditSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Force keyword search only
    request.searchType = 'keyword';
    
    logger.info(LogCategory.RAG, `Processing query: "${request.query}"`, {
      searchType: request.searchType,
      limit: request.limit,
      auditSessionId
    });

    // Check cache if enabled
    if (request.useCache) {
      const cacheKey = this.getCacheKey(request);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.info(LogCategory.RAG, 'Cache hit for query', { cacheKey });
        return { ...cached, cacheHit: true, auditSessionId };
      }
    }

    const performanceMetrics: PerformanceMetrics = {
      queryAnalysisTime: 0,
      embeddingGenerationTime: 0,
      vectorSearchTime: 0,
      contextFormattingTime: 0,
      totalTime: 0
    };

    try {
      // Phase 1: Analyze query
      const analysisStartTime = Date.now();
      const analysis = await this.analyzeQuery(request.query);
      performanceMetrics.queryAnalysisTime = Date.now() - analysisStartTime;

      // Phase 2: Skip embedding generation since we only use keyword search
      const embeddingStartTime = Date.now();
      let queryEmbedding: number[] | null = null;
      // No embedding generation needed for keyword search
      performanceMetrics.embeddingGenerationTime = Date.now() - embeddingStartTime;

      // Phase 3: Search documents
      const searchStartTime = Date.now();
      let documents: SearchResult[] = [];
      let advancedResults: AdvancedSearchResult[] | undefined;

      // Always use simple keyword search
      documents = await this.searchDocuments(
        request.query,
        null,
        'keyword',
        request.limit || 10,
        0
      );
      performanceMetrics.vectorSearchTime = Date.now() - searchStartTime;

      // Phase 4: Format context and generate response
      const formattingStartTime = Date.now();
      let context: string;
      // Always use simple context formatting
      context = this.formatContext(documents);
      
      const metrics = this.calculateMetrics(documents, performanceMetrics);
      const documentLinks = this.generateDocumentLinks(documents);
      const metricsText = this.formatMetricsText(metrics);
      const documentLinksText = this.formatDocumentLinksText(documentLinks);
      performanceMetrics.contextFormattingTime = Date.now() - formattingStartTime;

      performanceMetrics.totalTime = Date.now() - startTime;

      const response: QueryResponse = {
        documents,
        advancedResults,
        context,
        analysis,
        searchStrategy: request.searchType || 'vector',
        metrics,
        documentLinks,
        metricsText,
        documentLinksText,
        processingTime: performanceMetrics.totalTime,
        toolsUsed: this.getToolsUsed(request.searchType || 'vector'),
        cacheHit: false,
        performanceMetrics,
        auditSessionId
      };

      // Cache the response if enabled
      if (request.useCache) {
        const cacheKey = this.getCacheKey(request);
        this.cache.set(cacheKey, response);
        this.trimCache();
      }

      // Track performance metrics
      if (request.trackPerformance) {
        this.trackPerformanceMetrics(performanceMetrics);
      }

      logger.info(LogCategory.RAG, 'Query processed successfully', {
        documentsFound: documents.length,
        processingTime: performanceMetrics.totalTime,
        searchStrategy: request.searchType,
        auditSessionId
      });

      return response;

    } catch (error) {
      logger.error(LogCategory.RAG, 'Error processing query', error, {
        query: request.query,
        auditSessionId
      });
      throw error;
    }
  }

  private async analyzeQuery(query: string): Promise<QueryAnalysis> {
    // Simple query analysis - in production, you might use NLP libraries
    const words = query.toLowerCase().split(/\s+/);
    const keywords = words.filter(word => word.length > 3);
    
    // Determine intent based on keywords
    let intent = 'general_inquiry';
    if (words.some(w => ['what', 'define', 'definition'].includes(w))) {
      intent = 'definition';
    } else if (words.some(w => ['how', 'procedure', 'process'].includes(w))) {
      intent = 'procedure';
    } else if (words.some(w => ['when', 'date', 'time'].includes(w))) {
      intent = 'temporal';
    } else if (words.some(w => ['requirement', 'rule', 'regulation'].includes(w))) {
      intent = 'regulatory';
    }

    // Determine complexity
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (words.length > 15 || keywords.length > 8) {
      complexity = 'complex';
    } else if (words.length > 8 || keywords.length > 4) {
      complexity = 'moderate';
    }

    // Generate expanded queries
    const expandedQueries = this.generateExpandedQueries(query, keywords);

    return {
      intent,
      entities: keywords.slice(0, 5), // Top 5 entities
      keywords,
      complexity,
      expandedQueries
    };
  }

  private generateExpandedQueries(originalQuery: string, keywords: string[]): string[] {
    const expansions: string[] = [originalQuery];
    
    // Add synonym-based expansions
    const synonymMap: Record<string, string[]> = {
      'bank': ['banking', 'financial institution'],
      'regulation': ['rule', 'requirement', 'guideline'],
      'return': ['reporting', 'submission', 'filing'],
      'data': ['information', 'details', 'records']
    };

    keywords.forEach(keyword => {
      if (synonymMap[keyword]) {
        synonymMap[keyword].forEach(synonym => {
          expansions.push(originalQuery.replace(keyword, synonym));
        });
      }
    });

    return expansions.slice(0, 3); // Return top 3 expansions
  }

  private async searchDocuments(
    query: string,
    queryEmbedding: number[] | null,
    searchType: string,
    limit: number,
    similarityThreshold: number
  ): Promise<SearchResult[]> {
    // Only use keyword search regardless of the search type parameter
    return await supabaseService.keywordSearch(query, {
      match_count: limit
    });
  }

  private async searchAdvancedRAG(
    query: string,
    queryEmbedding: number[],
    limit: number,
    similarityThreshold: number,
    contextWindow: number
  ): Promise<AdvancedSearchResult[]> {
    return await supabaseService.advancedRAGSearch(query, queryEmbedding, {
      similarity_threshold: similarityThreshold,
      match_count: limit,
      context_window: contextWindow
    });
  }

  private convertAdvancedToBasicResults(advancedResults: AdvancedSearchResult[]): SearchResult[] {
    return advancedResults.map(result => ({
      id: result.id,
      doc_id: result.doc_id,
      content: result.content,
      similarity: result.similarity,
      metadata: result.metadata,
      combined_score: result.combined_score
    }));
  }

  private formatAdvancedContext(advancedResults: AdvancedSearchResult[]): string {
    if (advancedResults.length === 0) {
      return 'No relevant documents found for your query.';
    }

    // Group chunks by original match
    const groupedResults = new Map<number, AdvancedSearchResult[]>();
    
    advancedResults.forEach(result => {
      const originalChunkId = result.original_chunk_id;
      if (!groupedResults.has(originalChunkId)) {
        groupedResults.set(originalChunkId, []);
      }
      groupedResults.get(originalChunkId)!.push(result);
    });

    const contextParts: string[] = [];
    let originalMatchIndex = 1;

    // Process each group (original match + surrounding chunks)
    groupedResults.forEach((chunks, originalChunkId) => {
      // Sort chunks by position
      chunks.sort((a, b) => a.position_offset - b.position_offset);
      
      const originalMatch = chunks.find(chunk => chunk.is_original_match);
      if (!originalMatch) return;

      contextParts.push(`=== MATCH ${originalMatchIndex} [Document: ${originalMatch.doc_id}] ===`);
      
      if (originalMatch.keywords && originalMatch.keywords.length > 0) {
        contextParts.push(`Keywords: ${originalMatch.keywords.join(', ')}`);
      }
      
      contextParts.push(
        `Similarity: ${(originalMatch.similarity * 100).toFixed(1)}% | ` +
        `Keyword Score: ${(originalMatch.keyword_match_score * 100).toFixed(1)}% | ` +
        `Combined Score: ${(originalMatch.combined_score * 100).toFixed(1)}%`
      );
      contextParts.push('');

      // Add context with position indicators
      chunks.forEach(chunk => {
        let positionIndicator = '';
        if (chunk.is_original_match) {
          positionIndicator = '>>> MATCHED CHUNK <<<';
        } else if (chunk.position_offset < 0) {
          positionIndicator = `[Context: ${Math.abs(chunk.position_offset)} chunks before]`;
        } else if (chunk.position_offset > 0) {
          positionIndicator = `[Context: ${chunk.position_offset} chunks after]`;
        }

        contextParts.push(
          `${positionIndicator}\n` +
          `Chunk ${chunk.chunk_id}: ${chunk.content}\n`
        );
      });

      contextParts.push('\n---\n');
      originalMatchIndex++;
    });

    return contextParts.join('\n');
  }

  private formatContext(documents: SearchResult[]): string {
    if (documents.length === 0) {
      return 'No relevant documents found for your query.';
    }

    const contextParts = documents.map((doc, index) => {
      const similarity = doc.similarity ? ` (similarity: ${(doc.similarity * 100).toFixed(1)}%)` : '';
      return `Document ${index + 1} [${doc.doc_id}]${similarity}:\n${doc.content}\n`;
    });

    return contextParts.join('\n---\n\n');
  }

  private calculateMetrics(documents: SearchResult[], performanceMetrics: PerformanceMetrics): QueryMetrics {
    const similarities = documents
      .map(doc => doc.similarity || 0)
      .filter(sim => sim > 0);

    return {
      totalDocuments: documents.length,
      averageSimilarity: similarities.length > 0 
        ? similarities.reduce((a, b) => a + b, 0) / similarities.length 
        : 0,
      processingTimeMs: performanceMetrics.totalTime,
      searchStrategy: 'vector', // This should be passed from the actual strategy used
      embeddingTimeMs: performanceMetrics.embeddingGenerationTime,
      retrievalTimeMs: performanceMetrics.vectorSearchTime
    };
  }

  private generateDocumentLinks(documents: SearchResult[]): DocumentLink[] {
    return documents.map(doc => ({
      docId: doc.doc_id,
      title: doc.metadata?.doc_long_title || doc.doc_id,
      url: `https://brdr.hkma.gov.hk/eng/doc-ldg/docId/getPdf/${doc.doc_id}/${doc.doc_id}.pdf`,
      similarity: doc.similarity || 0
    }));
  }

  private formatMetricsText(metrics: QueryMetrics): string {
    return `📊 Query Performance:
• Documents retrieved: ${metrics.totalDocuments}
• Average similarity: ${(metrics.averageSimilarity * 100).toFixed(1)}%
• Processing time: ${metrics.processingTimeMs}ms
• Embedding generation: ${metrics.embeddingTimeMs}ms
• Document retrieval: ${metrics.retrievalTimeMs}ms
• Search strategy: ${metrics.searchStrategy}`;
  }

  private formatDocumentLinksText(links: DocumentLink[]): string {
    if (links.length === 0) {
      return 'No source documents available.';
    }

    return `📄 Source Documents:\n${links.map(link => 
      `• ${link.title} (${(link.similarity * 100).toFixed(1)}% relevance)`
    ).join('\n')}`;
  }

  private getToolsUsed(searchType: string): string[] {
    const tools = ['embedding_service', 'database_search'];
    
    switch (searchType) {
      case 'vector':
        tools.push('vector_search');
        break;
      case 'keyword':
        tools.push('text_search');
        break;
      case 'hybrid':
        tools.push('vector_search', 'text_search', 'hybrid_ranking');
        break;
      case 'advanced_rag':
        tools.push('advanced_rag_search', 'keyword_search', 'vector_search', 'context_expansion');
        break;
    }
    
    return tools;
  }

  private getCacheKey(request: QueryRequest): string {
    return `${request.query}_${request.searchType}_${request.limit}_${request.similarityThreshold}_${request.contextWindow || 2}`;
  }

  private trimCache(): void {
    if (this.cache.size > this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  private trackPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.performanceStats.get('queryAnalysis')!.push(metrics.queryAnalysisTime);
    this.performanceStats.get('embedding')!.push(metrics.embeddingGenerationTime);
    this.performanceStats.get('search')!.push(metrics.vectorSearchTime);
    this.performanceStats.get('formatting')!.push(metrics.contextFormattingTime);

    // Keep only last 100 measurements
    Object.values(this.performanceStats).forEach(stats => {
      if (stats.length > 100) {
        stats.splice(0, stats.length - 100);
      }
    });
  }

  getPerformanceSummary(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const summary: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    this.performanceStats.forEach((stats, key) => {
      if (stats.length > 0) {
        summary[key] = {
          avg: stats.reduce((a, b) => a + b, 0) / stats.length,
          min: Math.min(...stats),
          max: Math.max(...stats),
          count: stats.length
        };
      }
    });

    return summary;
  }

  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      hitRate: 0 // Would need to track hits/misses to calculate this
    };
  }

  getAvailableStrategies(): string[] {
    return ['vector', 'keyword', 'hybrid', 'advanced_rag'];
  }

  getStrategyDescriptions(): Record<string, string> {
    return {
      vector: 'Semantic similarity search using embeddings',
      keyword: 'Traditional text-based search',
      hybrid: 'Combined semantic and keyword search with ranking',
      advanced_rag: 'Advanced RAG with keyword+vector search and context expansion (±2 chunks)'
    };
  }

  exportPerformanceMetrics(): any {
    return {
      performanceStats: Object.fromEntries(this.performanceStats),
      summary: this.getPerformanceSummary(),
      timestamp: new Date().toISOString()
    };
  }

  exportCacheData(): any {
    return {
      cacheSize: this.cache.size,
      cacheKeys: Array.from(this.cache.keys()),
      timestamp: new Date().toISOString()
    };
  }

  clearCache(): void {
    this.cache.clear();
    logger.info(LogCategory.RAG, 'Cache cleared');
  }
}

export class RAGOrchestratorFactory {
  static async createDefaultOrchestrator(): Promise<RAGOrchestrator> {
    const orchestrator = new RAGOrchestrator();
    
    // Warm up the embedding service
    await embeddingService.warmup();
    
    // Test database connection
    await supabaseService.testConnection();
    
    logger.info(LogCategory.RAG, 'RAG Orchestrator initialized successfully');
    
    return orchestrator;
  }
}
