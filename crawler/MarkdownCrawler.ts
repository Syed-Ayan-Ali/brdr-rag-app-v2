import { markdownPageChunker, ProcessedDocument } from '../lib/chunking/MarkdownPageChunker';
import { logger, LogCategory } from '../lib/logging/Logger';

export interface MarkdownCrawledDocument {
  doc_id: string;
  content: string;
  source: string;
  metadata: {
    docId: string;
    title: string;
    author?: string;
    subject?: string;
    creator?: string;
    creationDate?: string;
    filename: string;
    totalPages: number;
    originalData: ProcessedDocument;
  };
  
  // Enhanced fields for database storage
  doc_long_title?: string;
  doc_desc?: string;
  issue_date?: string;
  document_type?: string;
  language?: string;
  topics?: string[];
  concepts?: string[];
  keywords?: string[];
}

export class MarkdownCrawler {
  constructor() {
    // logger.info(LogCategory.CRAWLER, 'Markdown Crawler initialized for BRDR documents');
  }

  /**
   * Crawl all markdown documents
   */
  async crawlDocuments(options: {
    maxDocuments?: number;
    skipExisting?: boolean;
  } = {}): Promise<MarkdownCrawledDocument[]> {
    const { maxDocuments = Infinity, skipExisting = true } = options;
    
    // logger.info(LogCategory.CRAWLER, 'Starting markdown document crawling', {
    //   maxDocuments,
    //   skipExisting
    // });

    try {
      // Get all processed documents
      const processedDocs = markdownPageChunker.processAllDocuments();
      
      // logger.info(LogCategory.CRAWLER, `Found ${processedDocs.length} processed documents`);
      
      // Limit documents if specified
      const docsToProcess = maxDocuments < processedDocs.length 
        ? processedDocs.slice(0, maxDocuments)
        : processedDocs;
      
      // Convert to crawled documents
      const crawledDocuments: MarkdownCrawledDocument[] = [];
      
      for (const doc of docsToProcess) {
        try {
          const crawledDoc = this.convertToCrawledDocument(doc);
          crawledDocuments.push(crawledDoc);
          
          // Log crawl result
          // logger.logCrawl({
          //   timestamp: new Date().toISOString(),
          //   level: 'AUDIT' as any,
          //   category: LogCategory.CRAWLER,
          //   message: `Crawled markdown document: ${doc.docId}`,
          //   docId: doc.docId,
          //   source: "BRDR_MARKDOWN",
          //   status: 'success',
          //   contentLength: doc.fullContent.length,
          //   metadata: crawledDoc.metadata
          // });
          
        } catch (error) {
          // logger.error(LogCategory.CRAWLER, `Failed to convert document: ${doc.docId}`, error);
        }
      }
      
      // logger.info(LogCategory.CRAWLER, `Successfully crawled ${crawledDocuments.length} markdown documents`);
      return crawledDocuments;
      
    } catch (error) {
      // logger.error(LogCategory.CRAWLER, 'Error during markdown crawling', error);
      throw error;
    }
  }

  /**
   * Crawl a single document by ID
   */
  async crawlSingleDocument(docId: string): Promise<MarkdownCrawledDocument | null> {
    try {
      // logger.info(LogCategory.CRAWLER, `Crawling single document: ${docId}`);
      
      // Find the document file
      const filename = `${docId}.md`;
      const document = markdownPageChunker.parseMarkdownFile(filename);
      
      if (!document) {
        // logger.warn(LogCategory.CRAWLER, `Document not found: ${docId}`);
        return null;
      }
      
      const processedDoc = markdownPageChunker.processDocument(document);
      const crawledDoc = this.convertToCrawledDocument(processedDoc);
      
      // logger.info(LogCategory.CRAWLER, `Successfully crawled single document: ${docId}`);
      return crawledDoc;
      
    } catch (error) {
      // logger.error(LogCategory.CRAWLER, `Error crawling single document: ${docId}`, error);
      return null;
    }
  }

  /**
   * Get crawling statistics
   */
  getStats(): {
    totalFiles: number;
    totalDocuments: number;
    totalPages: number;
    avgPagesPerDocument: number;
  } {
    return markdownPageChunker.getCollectionStats();
  }

  /**
   * Convert processed document to crawled document format
   */
  private convertToCrawledDocument(doc: ProcessedDocument): MarkdownCrawledDocument {
    // Extract issue date from docId (format: YYYYMMDD-X-EN)
    const issueDate = this.extractIssueDateFromDocId(doc.docId);
    
    // Extract concepts and topics from content
    const { topics, concepts } = this.extractTopicsAndConcepts(doc);
    
    // Get keywords from all chunks
    const allKeywords = doc.chunks.flatMap(chunk => chunk.metadata.keywords);
    const uniqueKeywords = [...new Set(allKeywords)];
    
    return {
      doc_id: doc.docId,
      content: doc.fullContent,
      source: 'BRDR_MARKDOWN',
      metadata: {
        docId: doc.docId,
        title: doc.title,
        author: doc.metadata.author,
        subject: doc.metadata.subject,
        creator: doc.metadata.creator,
        creationDate: doc.metadata.creationDate,
        filename: doc.metadata.filename,
        totalPages: doc.metadata.totalPages,
        originalData: doc
      },
      
      // Enhanced fields
      doc_long_title: doc.title,
      doc_desc: doc.metadata.subject,
      issue_date: issueDate,
      document_type: this.inferDocumentType(doc),
      language: 'en',
      topics,
      concepts,
      keywords: uniqueKeywords
    };
  }

  /**
   * Extract issue date from document ID
   */
  private extractIssueDateFromDocId(docId: string): string | undefined {
    // Format: YYYYMMDD-X-EN -> YYYY-MM-DD
    const match = docId.match(/^(\d{4})(\d{2})(\d{2})-/);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month}-${day}`;
    }
    return undefined;
  }

  /**
   * Infer document type from content and metadata
   */
  private inferDocumentType(doc: ProcessedDocument): string {
    const content = doc.fullContent.toLowerCase();
    const title = doc.title.toLowerCase();
    
    if (content.includes('guideline') || title.includes('guideline')) {
      return 'Guideline';
    } else if (content.includes('circular') || title.includes('circular')) {
      return 'Circular';
    } else if (content.includes('consultation') || title.includes('consultation')) {
      return 'Consultation';
    } else if (content.includes('notice') || title.includes('notice')) {
      return 'Notice';
    } else if (content.includes('amendment') || title.includes('amendment')) {
      return 'Amendment';
    } else if (content.includes('supervisory') || title.includes('supervisory')) {
      return 'Supervisory Manual';
    } else {
      return 'Document';
    }
  }

  /**
   * Extract topics and concepts from document content
   */
  private extractTopicsAndConcepts(doc: ProcessedDocument): {
    topics: string[];
    concepts: string[];
  } {
    const content = doc.fullContent.toLowerCase();
    const title = doc.title.toLowerCase();
    
    // Common banking and regulatory topics
    const topicKeywords = [
      'banking', 'deposit', 'capital', 'liquidity', 'risk management',
      'compliance', 'authorization', 'supervision', 'regulatory',
      'basel', 'credit risk', 'operational risk', 'market risk',
      'anti-money laundering', 'aml', 'kyc', 'customer due diligence',
      'reporting', 'disclosure', 'audit', 'governance',
      'stress testing', 'capital adequacy', 'leverage ratio'
    ];
    
    const conceptKeywords = [
      'licensed bank', 'restricted licence bank', 'deposit-taking company',
      'authorized institution', 'financial institution', 'subsidiary',
      'branch', 'representative office', 'minimum capital',
      'tier 1 capital', 'tier 2 capital', 'common equity',
      'loan classification', 'provision', 'impairment',
      'derivatives', 'securities', 'investment', 'treasury'
    ];
    
    // Find matching topics
    const foundTopics = topicKeywords.filter(topic => 
      content.includes(topic) || title.includes(topic)
    );
    
    // Find matching concepts
    const foundConcepts = conceptKeywords.filter(concept => 
      content.includes(concept) || title.includes(concept)
    );
    
    // Add document-specific topics from title and subject
    if (doc.metadata.subject) {
      foundTopics.push(doc.metadata.subject);
    }
    
    // Remove duplicates and return
    return {
      topics: [...new Set(foundTopics)],
      concepts: [...new Set(foundConcepts)]
    };
  }

  /**
   * Validate document before processing
   */
  private validateDocument(doc: ProcessedDocument): boolean {
    if (!doc.docId || !doc.title || !doc.fullContent) {
      // logger.warn(LogCategory.CRAWLER, `Invalid document: missing required fields`, {
      //   docId: doc.docId,
      //   hasTitle: !!doc.title,
      //   hasContent: !!doc.fullContent
      // });
      return false;
    }
    
    if (doc.chunks.length === 0) {
      // logger.warn(LogCategory.CRAWLER, `Invalid document: no chunks found`, {
      //   docId: doc.docId
      // });
      return false;
    }
    
    return true;
  }
}
