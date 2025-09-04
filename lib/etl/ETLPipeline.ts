import { BRDRCrawler, CrawledDocument } from '../../crawler/BRDRCrawler';
import { markdownPageChunker, ProcessedDocument, PageChunk } from '../chunking/MarkdownPageChunker';
import { embeddingService, EmbeddingService } from '../embeddings/EmbeddingService';
import { supabaseService, DatabaseDocument, DatabaseChunk, SupabaseService } from '../database/SupabaseService';
import { v4 as uuidv4 } from 'uuid';

export interface ETLOptions {
  maxDocuments?: number;
  batchSize?: number;
  databaseBatchSize?: number; // Upload to database every N documents
  skipExisting?: boolean;
  generateEmbeddings?: boolean;
  chunkingOptions?: {
    maxTokens?: number;
    overlap?: number;
    hierarchyLevels?: number;
  };
}

export interface ETLProgress {
  phase: 'crawling' | 'chunking' | 'embedding' | 'storing' | 'complete' | 'error';
  documentsProcessed: number;
  documentsSkipped: number;
  totalDocuments: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  currentDocument?: string;
  error?: string;
  errors: string[];
  startTime: Date;
  endTime?: Date;
}

export interface ETLResult {
  success: boolean;
  documentsProcessed: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  errors: string[];
  processingTime: number;
  progress: ETLProgress;
}

export class ETLPipeline {
  private brdrCrawler: BRDRCrawler;
  private progress: ETLProgress;
  private errors: string[] = [];
  private supabaseServiceInstance: SupabaseService;
  private embeddingServiceInstance: EmbeddingService;

  constructor(
    supabaseServiceInstance: SupabaseService = supabaseService,
    embeddingServiceInstance: EmbeddingService = embeddingService
  ) {
    this.brdrCrawler = new BRDRCrawler();
    this.supabaseServiceInstance = supabaseServiceInstance;
    this.embeddingServiceInstance = embeddingServiceInstance;
    
    this.progress = {
      phase: 'crawling',
      documentsProcessed: 0,
      documentsSkipped: 0,
      totalDocuments: 0,
      chunksCreated: 0,
      embeddingsGenerated: 0,
      errors: [],
      startTime: new Date()
    };
  }

  async runFullPipeline(options: ETLOptions = {}): Promise<ETLResult> {
    const startTime = Date.now();
    this.progress.startTime = new Date();
    this.errors = [];

    try {
      // Test database connection first
      const isConnected = await this.supabaseServiceInstance.testConnection();
      if (!isConnected) {
        throw new Error('Database connection failed');
      }

      // Phase 1: Crawl metadata from BRDR API
      this.progress.phase = 'crawling';
      
      const apiDocuments = await this.crawlApiDocuments(options);
      this.progress.totalDocuments = apiDocuments.length;
      
      if (apiDocuments.length === 0) {
        console.warn('No documents found in BRDR API');
        return this.createResult(true, startTime);
      }

      // Phase 2: Match with markdown files and process
      await this.processHybridBatch(apiDocuments, options);

      this.progress.phase = 'complete';
      this.progress.endTime = new Date();
      
      console.info('ETL pipeline completed successfully', {
        documentsProcessed: this.progress.documentsProcessed,
        chunksCreated: this.progress.chunksCreated,
        embeddingsGenerated: this.progress.embeddingsGenerated,
        processingTime: Date.now() - startTime
      });

      return this.createResult(true, startTime);

    } catch (error: unknown) {
      this.progress.phase = 'error';
      this.progress.error = error instanceof Error ? error.message : 'Unknown error';
      this.progress.endTime = new Date();
      
      console.error('ETL pipeline failed', error);
      this.errors.push(this.progress.error);
      
      return this.createResult(false, startTime);
    }
  }

  private async crawlApiDocuments(options: ETLOptions): Promise<CrawledDocument[]> {
    console.info('Starting BRDR API document crawling for metadata');
    
    // Calculate pages needed to get all documents or respect maxDocuments limit
    const maxPages = options.maxDocuments ? Math.ceil(options.maxDocuments / 20) : 999; // Use 999 to get all available pages
    
    const documents = await this.brdrCrawler.crawlDocuments({
      maxPages: maxPages,
      includePDFContent: false, // We'll use markdown for content
      filterExisting: options.skipExisting || true
    });

    console.info(`Successfully crawled ${documents.length} documents from BRDR API`);

    if (options.maxDocuments && documents.length > options.maxDocuments) {
      console.info(`Limiting to ${options.maxDocuments} documents as requested`);
      return documents.slice(0, options.maxDocuments);
    }

    return documents;
  }

  private async processHybridBatch(apiDocuments: CrawledDocument[], options: ETLOptions): Promise<void> {
    const processingBatchSize = options.batchSize || 10;
    const databaseBatchSize = options.databaseBatchSize || 50; // Upload to database every N documents
    const processedDocuments: { apiDoc: CrawledDocument; markdownDoc?: ProcessedDocument; chunks?: PageChunk[] }[] = [];
    
    console.info(`Starting hybrid batch processing with database batching every ${databaseBatchSize} documents`);
    
    for (let i = 0; i < apiDocuments.length; i += processingBatchSize) {
      const batch = apiDocuments.slice(i, Math.min(i + processingBatchSize, apiDocuments.length));
      
      console.info(`Processing hybrid batch ${Math.floor(i / processingBatchSize) + 1}`, {
        batchSize: batch.length,
        startIndex: i,
        endIndex: Math.min(i + processingBatchSize, apiDocuments.length)
      });

      // Process documents in parallel but don't store to database yet
      const batchResults = await Promise.all(batch.map(async (doc) => {
        const result = await this.processHybridDocumentInMemory(doc, options);
        return { apiDoc: doc, ...result };
      }));
      
      // Add to processed documents array
      processedDocuments.push(...batchResults);
      
      // Check if we should upload to database
      if (processedDocuments.length >= databaseBatchSize || i + processingBatchSize >= apiDocuments.length) {
        const memoryBefore = process.memoryUsage();
        console.info(`Uploading batch of ${processedDocuments.length} documents to database...`, {
          memoryUsage: `${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB`
        });
        
        await this.uploadBatchToDatabase(processedDocuments, options);
        
        // Clear the processed documents array to free memory
        processedDocuments.length = 0;
        
        // Force garbage collection hint
        if (global.gc) {
          global.gc();
        }
        
        const memoryAfter = process.memoryUsage();
        console.info(`Batch upload completed. Memory freed: ${Math.round((memoryBefore.heapUsed - memoryAfter.heapUsed) / 1024 / 1024)}MB`);
      }
    }
  }

  private async processHybridDocumentInMemory(apiDocument: CrawledDocument, options: ETLOptions): Promise<{ markdownDoc?: ProcessedDocument; chunks?: PageChunk[] }> {
    try {
      this.progress.currentDocument = apiDocument.doc_id;
      console.info(`Processing hybrid document in memory: ${apiDocument.doc_id}`);

      // Check if document already exists
      if (options.skipExisting) {
        const existing = await this.supabaseServiceInstance.getDocumentByDocId(apiDocument.doc_id);
        if (existing) {
          console.info(`Skipping existing document: ${apiDocument.doc_id}`);
          this.progress.documentsSkipped++;
          return {};
        }
      }

      // Phase 2: Find matching markdown file and chunk it
      const markdownDoc = await this.findAndProcessMarkdownFile(apiDocument.doc_id);

      if (!markdownDoc) {
        console.info(`No markdown file found for document: ${apiDocument.doc_id}`);
        return { markdownDoc: undefined, chunks: undefined }; // Return empty result for metadata-only
      }

      const chunks = markdownDoc.chunks;

      // Phase 3: Generate embeddings
      const chunksWithEmbeddings = await this.generateEmbeddings(chunks, options);

      return { markdownDoc, chunks: chunksWithEmbeddings };

    } catch (error: unknown) {
      console.error(`Error processing hybrid document in memory: ${apiDocument.doc_id}`, error);
      this.progress.errors.push(`Document ${apiDocument.doc_id}: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  }

  private async uploadBatchToDatabase(processedDocuments: { apiDoc: CrawledDocument; markdownDoc?: ProcessedDocument; chunks?: PageChunk[] }[], options: ETLOptions): Promise<void> {
    console.info(`Uploading batch of ${processedDocuments.length} documents to database`);
    
    for (const { apiDoc, markdownDoc, chunks } of processedDocuments) {
      try {
        if (markdownDoc && chunks) {
          // Store hybrid document (API metadata + markdown content)
          await this.storeHybridDocument(apiDoc, markdownDoc, chunks);
        } else {
          // Store metadata-only document
          await this.storeMetadataOnly(apiDoc);
        }
        
        this.progress.documentsProcessed++;
        
      } catch (error: unknown) {
        console.error(`Error uploading document to database: ${apiDoc.doc_id}`, error);
        this.progress.errors.push(`Database upload ${apiDoc.doc_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.info(`Batch upload completed. Processed ${processedDocuments.length} documents`);
  }

  private async processHybridDocument(apiDocument: CrawledDocument, options: ETLOptions): Promise<void> {
    try {
      this.progress.currentDocument = apiDocument.doc_id;
      console.info(`Processing hybrid document: ${apiDocument.doc_id}`);

      // Check if document already exists
      if (options.skipExisting) {
        const existing = await this.supabaseServiceInstance.getDocumentByDocId(apiDocument.doc_id);
        if (existing) {
          console.info(`Skipping existing document: ${apiDocument.doc_id}`);
          this.progress.documentsProcessed++;
          return;
        }
      }

      // Phase 2: Find matching markdown file and chunk it
      this.progress.phase = 'chunking';
      const markdownDoc = await this.findAndProcessMarkdownFile(apiDocument.doc_id);
      
      if (!markdownDoc) {
        console.warn(`No markdown file found for document: ${apiDocument.doc_id}`);
        // Store only metadata without chunks
        await this.storeMetadataOnly(apiDocument);
        this.progress.documentsProcessed++;
        return;
      }
      
      const chunks = markdownDoc.chunks;
      
      // Phase 3: Generate embeddings
      this.progress.phase = 'embedding';
      const chunksWithEmbeddings = await this.generateEmbeddings(chunks, options);
      
      // Phase 4: Store in database (metadata from API + chunks from markdown)
      this.progress.phase = 'storing';
      await this.storeHybridDocument(apiDocument, markdownDoc, chunksWithEmbeddings);
      
      this.progress.documentsProcessed++;
      
      console.info(`Successfully processed hybrid document: ${apiDocument.doc_id}`, {
        chunksCreated: chunks.length,
        embeddingsGenerated: chunksWithEmbeddings.filter(c => c.embedding).length
      });

    } catch (error) {
      const errorMsg = `Failed to process hybrid document ${apiDocument.doc_id}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg, error);
      this.errors.push(errorMsg);
    }
  }

  private async findAndProcessMarkdownFile(docId: string): Promise<ProcessedDocument | null> {
    try {
      // Try to find markdown file with matching docId
      const filename = `${docId}.md`;
      const markdownDocument = markdownPageChunker.parseMarkdownFile(filename);
      
      if (!markdownDocument) {
        return null;
      }
      
      const processedDoc = markdownPageChunker.processDocument(markdownDocument);
      this.progress.chunksCreated += processedDoc.chunks.length;
      
      console.debug(`Found and processed markdown file: ${filename} with ${processedDoc.chunks.length} pages`);
      
      return processedDoc;
    } catch (error) {
      console.debug(`No markdown file found for doc_id: ${docId}`);
      return null;
    }
  }

  private async generateEmbeddings(
    chunks: PageChunk[],
    options: ETLOptions
  ): Promise<PageChunk[]> {
    if (options.generateEmbeddings === false) {
      return chunks;
    }

    console.debug(`Generating embeddings for ${chunks.length} page chunks`);
    
    for (const chunk of chunks) {
      try {
        console.log("chunk is", chunk.cleanContent)
        const embeddingResult = await this.embeddingServiceInstance.generateEmbedding(chunk.cleanContent);
        chunk.embedding = embeddingResult.embedding;
        this.progress.embeddingsGenerated++;
      } catch (error) {
        console.error(`Failed to generate embedding for chunk: ${chunk.id}`, error);
        // Continue processing other chunks
      }
    }

    return chunks;
  }

  private async storeHybridDocument(
    apiDocument: CrawledDocument,
    markdownDoc: ProcessedDocument,
    chunks: PageChunk[]
  ): Promise<void> {
    console.debug(`Storing hybrid document: ${apiDocument.doc_id}`);

    // Create database document using API metadata + markdown content
    const dbDocument: DatabaseDocument = {
      id: uuidv4(),
      doc_id: apiDocument.doc_id,
      content: markdownDoc.fullContent, // Use markdown content instead of API content
      source: apiDocument.source,
      embedding: (chunks[0])?.embedding, // Use first page embedding for document

      // Rich metadata from API
      doc_uuid: apiDocument.doc_uuid,
      doc_type_code: apiDocument.doc_type_code,
      doc_type_desc: apiDocument.doc_type_desc,
      version_code: apiDocument.version_code,
      doc_long_title: apiDocument.doc_long_title,
      doc_desc: apiDocument.doc_desc,
      issue_date: apiDocument.issue_date,
      guideline_no: apiDocument.guideline_no,
      supersession_date: apiDocument.supersession_date,
      topics: apiDocument.topics || [],
      concepts: apiDocument.concepts || [],
      document_type: apiDocument.document_type,
      language: apiDocument.language || 'en',
      doc_topic_subtopic_list: apiDocument.doc_topic_subtopic_list ? JSON.stringify(apiDocument.doc_topic_subtopic_list).split(',') : [],
      doc_keyword_list: apiDocument.doc_keyword_list ? JSON.stringify(apiDocument.doc_keyword_list).split(',') : [],
      doc_ai_type_list: apiDocument.doc_ai_type_list ? JSON.stringify(apiDocument.doc_ai_type_list).split(',') : [],
      doc_view_list: apiDocument.doc_view_list ? JSON.stringify(apiDocument.doc_view_list).split(',') : [],
      directly_related_doc_list: apiDocument.directly_related_doc_list ? JSON.stringify(apiDocument.directly_related_doc_list).split(',') : [],
      version_history_doc_list: apiDocument.version_history_doc_list ? JSON.stringify(apiDocument.version_history_doc_list).split(',') : [],
      reference_doc_list: apiDocument.reference_doc_list ? JSON.stringify(apiDocument.reference_doc_list).split(',') : [],
      superseded_doc_list: apiDocument.superseded_doc_list ? JSON.stringify(apiDocument.superseded_doc_list).split(',') : []
    };

    // Store main document
    const documentId = await this.supabaseServiceInstance.upsertDocument(dbDocument);
    if (!documentId) {
      throw new Error(`Failed to store hybrid document: ${apiDocument.doc_id}`);
    }

    // Create database chunks from page chunks
    const dbChunks = chunks.map((chunk) => {
      // Extract creation date components if available
      const creationYear = markdownDoc.metadata.creationYear || undefined;
      const creationMonth = markdownDoc.metadata.creationMonth || undefined;
      const creationDay = markdownDoc.metadata.creationDay || undefined;

      return {
        id: uuidv4(),
        doc_id: apiDocument.doc_id,
        document_id: documentId,
        chunk_id: chunk.pageNumber,
        content: chunk.cleanContent,
        embedding: chunk.embedding,
        chunk_type: chunk.metadata.chunkType,
        keywords: chunk.metadata.keywords,
        related_chunks: [],
        creation_year: creationYear,
        creation_month: creationMonth,
        creation_day: creationDay // Note: column name is creation_date in database
      };
    });

    // Store chunks in batches
    const chunkBatchSize = 50;
    for (let i = 0; i < dbChunks.length; i += chunkBatchSize) {
      const chunkBatch = dbChunks.slice(i, i + chunkBatchSize);
      const success = await this.supabaseServiceInstance.insertDocumentChunks(chunkBatch);
      if (!success) {
        throw new Error(`Failed to store chunk batch for hybrid document: ${apiDocument.doc_id}`);
      }
    }

    console.debug(`Successfully stored hybrid document and ${dbChunks.length} page chunks: ${apiDocument.doc_id}`);
  }

  private async storeMetadataOnly(apiDocument: CrawledDocument): Promise<void> {
    console.debug(`Storing metadata-only document: ${apiDocument.doc_id}`);

    // Check if document already exists
    const existing = await this.supabaseServiceInstance.getDocumentByDocId(apiDocument.doc_id);
    if (existing) {
      console.debug(`Document already exists, skipping metadata-only storage: ${apiDocument.doc_id}`);
      return;
    }

    // Create database document with API metadata but no chunks
    const dbDocument: DatabaseDocument = {
      id: uuidv4(),
      doc_id: apiDocument.doc_id,
      content: apiDocument.content || '',
      source: apiDocument.source,
      embedding: undefined,
      // Rich metadata from API
      doc_uuid: apiDocument.doc_uuid,
      doc_type_code: apiDocument.doc_type_code,
      doc_type_desc: apiDocument.doc_type_desc,
      version_code: apiDocument.version_code,
      doc_long_title: apiDocument.doc_long_title,
      doc_desc: apiDocument.doc_desc,
      issue_date: apiDocument.issue_date,
      guideline_no: apiDocument.guideline_no,
      supersession_date: apiDocument.supersession_date,
      topics: apiDocument.topics || [],
      concepts: apiDocument.concepts || [],
      document_type: apiDocument.document_type,
      language: apiDocument.language || 'en',
      doc_topic_subtopic_list: apiDocument.doc_topic_subtopic_list ? JSON.stringify(apiDocument.doc_topic_subtopic_list).split(',') : [],
      doc_keyword_list: apiDocument.doc_keyword_list ? JSON.stringify(apiDocument.doc_keyword_list).split(',') : [],
      doc_ai_type_list: apiDocument.doc_ai_type_list ? JSON.stringify(apiDocument.doc_ai_type_list).split(',') : [],
      doc_view_list: apiDocument.doc_view_list ? JSON.stringify(apiDocument.doc_view_list).split(',') : [],
      directly_related_doc_list: apiDocument.directly_related_doc_list ? JSON.stringify(apiDocument.directly_related_doc_list).split(',') : [],
      version_history_doc_list: apiDocument.version_history_doc_list ? JSON.stringify(apiDocument.version_history_doc_list).split(',') : [],
      reference_doc_list: apiDocument.reference_doc_list ? JSON.stringify(apiDocument.reference_doc_list).split(',') : [],
      superseded_doc_list: apiDocument.superseded_doc_list ? JSON.stringify(apiDocument.superseded_doc_list).split(',') : []
    };

    // Store main document only
    const documentId = await this.supabaseServiceInstance.upsertDocument(dbDocument);
    if (!documentId) {
      throw new Error(`Failed to store metadata-only document: ${apiDocument.doc_id}`);
    }

    console.debug(`Successfully stored metadata-only document: ${apiDocument.doc_id}`);
  }

  private createResult(success: boolean, startTime: number): ETLResult {
    return {
      success,
      documentsProcessed: this.progress.documentsProcessed,
      chunksCreated: this.progress.chunksCreated,
      embeddingsGenerated: this.progress.embeddingsGenerated,
      errors: this.errors,
      processingTime: Date.now() - startTime,
      progress: this.progress
    };
  }

  async getStats(): Promise<{
    databaseStats: unknown;
    embeddingService: {
      model: string;
      dimension: number;
      isReady: boolean;
    };
  }> {
    return {
      databaseStats: await this.supabaseServiceInstance.getDatabaseStats(),
      embeddingService: {
        model: this.embeddingServiceInstance.getModel(),
        dimension: this.embeddingServiceInstance.getDimension(),
        isReady: this.embeddingServiceInstance.isReady()
      }
    };
  }
  
  /**
   * Process a single document directly from a markdown file
   * Used for the upload-first-20-documents script
   */
  async processDocument(processedDoc: ProcessedDocument): Promise<boolean> {
    try {
      console.info(`Processing document: ${processedDoc.docId}`);
      
      // Check if document already exists
      const existing = await this.supabaseServiceInstance.getDocumentByDocId(processedDoc.docId);
      if (existing) {
        console.info(`Document ${processedDoc.docId} already exists, skipping`);
        return false;
      }
      
      // Create database document
      const dbDocument: DatabaseDocument = {
        id: uuidv4(),
        doc_id: processedDoc.docId,
        content: processedDoc.fullContent,
        source: processedDoc.metadata.source,
        embedding: undefined, // Will be updated later
        
        // Metadata
        doc_uuid: processedDoc.docId,
        doc_type_code: 'MD',
        doc_type_desc: 'Markdown Document',
        version_code: '1.0',
        doc_long_title: processedDoc.title,
        doc_desc: processedDoc.title,
        issue_date: undefined,
        guideline_no: undefined,
        supersession_date: undefined,
        topics: [],
        concepts: [],
        document_type: 'markdown',
        language: 'en',
        doc_topic_subtopic_list: [],
        doc_keyword_list: [],
        doc_ai_type_list: [],
        doc_view_list: [],
        directly_related_doc_list: [],
        version_history_doc_list: [],
        reference_doc_list: [],
        superseded_doc_list: []
      };
      
      // Generate embeddings for chunks
      const chunksWithEmbeddings = await this.generateEmbeddings(processedDoc.chunks, { generateEmbeddings: true });
      
      // Use first chunk embedding for document
      if (chunksWithEmbeddings.length > 0 && chunksWithEmbeddings[0].embedding) {
        dbDocument.embedding = chunksWithEmbeddings[0].embedding;
      }
      
      // Store main document
      const documentId = await this.supabaseServiceInstance.upsertDocument(dbDocument);
      if (!documentId) {
        throw new Error(`Failed to store document: ${processedDoc.docId}`);
      }
      
      // Create database chunks
      const dbChunks = chunksWithEmbeddings.map((chunk) => {
        // Extract creation date components if available
        const creationYear = processedDoc.metadata.creationYear || undefined;
        const creationMonth = processedDoc.metadata.creationMonth || undefined;
        const creationDay = processedDoc.metadata.creationDay || undefined;
        
        return {
          id: uuidv4(),
          doc_id: processedDoc.docId,
          document_id: documentId,
          chunk_id: chunk.pageNumber,
          content: chunk.cleanContent,
          embedding: chunk.embedding,
          chunk_type: chunk.metadata.chunkType,
          keywords: chunk.metadata.keywords,
          related_chunks: [],
          creation_year: creationYear,
          creation_month: creationMonth,
          creation_day: creationDay // Note: column name is creation_date in database
        };
      });
      
      // Store chunks in batches
      const chunkBatchSize = 50;
      for (let i = 0; i < dbChunks.length; i += chunkBatchSize) {
        const chunkBatch = dbChunks.slice(i, i + chunkBatchSize);
        const success = await this.supabaseServiceInstance.insertDocumentChunks(chunkBatch);
        if (!success) {
          throw new Error(`Failed to store chunk batch for document: ${processedDoc.docId}`);
        }
      }
      
      console.info(`Successfully processed document: ${processedDoc.docId} with ${dbChunks.length} chunks`);
      return true;
    } catch (error) {
      console.error(`Error processing document: ${processedDoc.docId}`, error);
      return false;
    }
  }

  async deleteDocument(docId: string): Promise<boolean> {
    try {
      console.info(`Deleting document: ${docId}`);
      
      // Delete chunks first (foreign key constraint)
      await this.supabaseServiceInstance.deleteDocumentChunks(docId);
      
      // Delete main document
      const success = await this.supabaseServiceInstance.deleteDocument(docId);
      
      if (success) {
        console.info(`Successfully deleted document: ${docId}`);
      } else {
        console.warn(`Failed to delete document: ${docId}`);
      }
      
      return success;
    } catch (error) {
      console.error(`Error deleting document: ${docId}`, error);
      return false;
    }
  }
}

// Export singleton instance
export const etlPipeline = new ETLPipeline();