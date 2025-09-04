import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface MarkdownDocument {
  docId: string;
  title: string;
  author?: string;
  subject?: string;
  creator?: string;
  creationDate?: string;
  creationYear?: string;
  creationMonth?: string;
  creationDay?: string;
  pages: PageChunk[];
  fullContent: string;
  filename: string;
}

export interface PageChunk {
  id: string;
  pageNumber: number;
  content: string;
  cleanContent: string;
  metadata: {
    chunkId: string;
    level: number;
    chunkType: 'page';
    pageNumber: number;
    tokens: number;
    keywords: string[];
    startIndex: number;
    endIndex: number;
  };
  embedding?: number[];
}

export interface ProcessedDocument {
  docId: string;
  title: string;
  fullContent: string;
  chunks: PageChunk[];
  metadata: {
    author?: string;
    subject?: string;
    creator?: string;
    creationDate?: string;
    creationYear?: string;
    creationMonth?: string;
    creationDay?: string;
    filename: string;
    totalPages: number;
    source: string;
  };
}

export interface FileMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  creationDate?: string;
}

export class MarkdownPageChunker {
  private brdrMdPath: string;

  constructor(brdrMdPath: string = 'public/brdr-md') {
    this.brdrMdPath = brdrMdPath;
  }

  /**
   * Get all markdown files in the BRDR directory
   */
  getAllMarkdownFiles(): string[] {
    try {
      const files = readdirSync(this.brdrMdPath)
        .filter(file => file.endsWith('.md'))
        .sort(); // Sort to ensure consistent processing order
      
      // console.info(`Found ${files.length} markdown files in ${this.brdrMdPath}`);
      return files;
    } catch (error) {
      // console.error(`Error reading markdown directory: ${this.brdrMdPath}`, error);
      return [];
    }
  }

  /**
   * Parse a single markdown file and extract document information
   */
  parseMarkdownFile(filename: string): MarkdownDocument | null {
    try {
      const filePath = join(this.brdrMdPath, filename);
      const content = readFileSync(filePath, 'utf-8');
      
      // console.debug(`Parsing markdown file: ${filename}`);
      
      const docId = this.extractDocIdFromFilename(filename);
      const {year: creationYear, month: creationMonth, day: creationDay} = this.extractCreationDateFromFilename(filename);
      const metadata = this.extractMetadata(content);
      const pages = this.extractPages(content, docId);
      
      return {  
        docId,
        title: metadata.title || metadata.subject || `Document ${docId}`,
        author: metadata.author,
        subject: metadata.subject,
        creator: metadata.creator,
        creationDate: metadata.creationDate,
        creationYear: creationYear,
        creationMonth: creationMonth,
        creationDay: creationDay,
        pages,
        fullContent: content,
        filename
      };
    } catch (error) {
      // console.error(`Error parsing markdown file: ${filename}`, error);
      return null;
    }
  }

  /**
   * Process a single document into chunks
   */
  processDocument(document: MarkdownDocument): ProcessedDocument {
    // console.debug(`Processing document: ${document.docId}`);
    
    const chunks = document.pages.map((page, index) => ({
      ...page,
      id: `${document.docId}_page_${page.pageNumber}`,
      metadata: {
        ...page.metadata,
        chunkId: `${document.docId}_page_${page.pageNumber}`,
      }
    }));

    return {
      docId: document.docId,
      title: document.title,
      fullContent: document.fullContent,
      chunks,
      metadata: {
        author: document.author,
        subject: document.subject,
        creator: document.creator,
        creationDate: document.creationDate,
        creationYear: document.creationYear,
        creationMonth: document.creationMonth,
        creationDay: document.creationDay,
        filename: document.filename,
        totalPages: document.pages.length,
        source: 'BRDR'
      }
    };
  }

  /**
   * Process all documents in the BRDR markdown directory
   */
  processAllDocuments(): ProcessedDocument[] {
    const files = this.getAllMarkdownFiles();
    const processedDocuments: ProcessedDocument[] = [];
    
    // console.info(`Processing ${files.length} markdown documents`);
    
    for (const filename of files) {
      try {
        const document = this.parseMarkdownFile(filename);
        if (document) {
          const processed = this.processDocument(document);
          processedDocuments.push(processed);
          
          // console.debug(`Processed ${filename}: ${processed.chunks.length} pages`);
        }
      } catch (error) {
        // console.error(`Failed to process ${filename}`, error);
      }
    }
    
    // console.info(`Successfully processed ${processedDocuments.length} documents`);
    return processedDocuments;
  }

  /**
   * Extract document ID from filename (e.g., "19890308-1-EN.md" -> "19890308-1-EN")
   */
  private extractDocIdFromFilename(filename: string): string {
    return filename.replace('.md', '');
  }

  private extractCreationDateFromFilename(filename: string): { year: string, month: string, day: string } {
    const year = filename.substring(0, 4);
    const month = filename.substring(4, 6);
    const day = filename.substring(6, 8);
    return { year, month, day };
  }

  /**
   * Extract metadata from the document header
   * and parse creation date components
   */
  private extractMetadata(content: string): FileMetadata
  {
    const lines = content.split('\n');
    const metadata: FileMetadata = {};
    
    // Extract title (first # heading)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }
    
    // Extract metadata fields
    for (const line of lines) {
      const authorMatch = line.match(/\*\*Author:\*\*\s*(.+)/);
      if (authorMatch) {
        metadata.author = authorMatch[1].trim();
      }
      
      const subjectMatch = line.match(/\*\*Subject:\*\*\s*(.+)/);
      if (subjectMatch) {
        metadata.subject = subjectMatch[1].trim();
      }
      
      const creatorMatch = line.match(/\*\*Creator:\*\*\s*(.+)/);
      if (creatorMatch) {
        metadata.creator = creatorMatch[1].trim();
      }
      
     
    }
    
    return metadata;
  }

  /**
   * Extract pages from the markdown content
   */
  private extractPages(content: string, docId: string): PageChunk[] {
    const pages: PageChunk[] = [];
    
    // Split content by page markers (## Page X) - using original content to preserve markers
    const pagePattern = /^## Page (\d+)$/gm;
    const pageSplits = content.split(pagePattern);
    
    // First element is the header content before first page
    const headerContent = pageSplits[0];
    
    // Process each page
    let validChunkCount = 0;
    
    for (let i = 1; i < pageSplits.length; i += 2) {
      const pageNumber = parseInt(pageSplits[i]);
      const pageContent = pageSplits[i + 1] || '';
      
      // Skip empty chunks
      if (!pageContent.trim() || pageContent.trim() === "") {
        console.debug(`Skipping empty chunk for page ${pageNumber} in document ${docId}`);
        continue;
      }
      
      // First clean the page content to remove unnecessary elements
      const initialCleanContent = this.cleanPageContent(pageContent);
      
      // Then apply the more thorough text cleaning
      const cleanContent = this.cleanText(initialCleanContent);
      
      // Skip chunks that would result in empty content after cleaning
      if (!cleanContent.trim()) {
        console.debug(`Skipping chunk with empty clean content for page ${pageNumber} in document ${docId}`);
        continue;
      }
      
      const startIndex = content.indexOf(`## Page ${pageNumber}`);
      const endIndex = i + 2 < pageSplits.length 
        ? content.indexOf(`## Page ${parseInt(pageSplits[i + 2])}`)
        : content.length;
      
      validChunkCount++;
      
      pages.push({
        id: `${docId}_page_${validChunkCount}`,
        pageNumber: validChunkCount, // Use the valid chunk count instead of original page number
        content: pageContent.trim(),
        cleanContent,
        metadata: {
          chunkId: `${docId}_page_${validChunkCount}`,
          level: 1,
          chunkType: 'page',
          pageNumber: validChunkCount,
          tokens: this.estimateTokens(cleanContent),
          keywords: this.extractKeywords(cleanContent),
          startIndex,
          endIndex
        }
      });
    }
    
    // console.debug(`Extracted ${pages.length} valid pages from document ${docId}`);
    return pages;
  }

  /**
   * Clean page content by removing unnecessary elements
   */
  private cleanPageContent(content: string): string {
    return content
      // Remove horizontal rules
      .replace(/^---+$/gm, '')
      // Remove image placeholders
      .replace(/!\[Image\]\(image_placeholder\)/g, '')
      // Remove excessive page numbers and formatting
      .replace(/^-\s*\d+\s*-$/gm, '')
      // Remove multiple empty lines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Trim whitespace
      .trim();
  }

  /**
   * List of common English stop words to filter out
   */
  private stopWords: Set<string> = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'can', 'can\'t', 'cannot', 'could', 'couldn\'t',
    'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
    'each',
    'few', 'for', 'from', 'further',
    'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
    'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
    'let\'s',
    'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
    'no', 'nor', 'not',
    'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
    'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
    'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
    'under', 'until', 'up',
    'very',
    'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
    'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves',
    // Common domain-specific words that might appear frequently but aren't meaningful keywords
    'page', 'document', 'section', 'chapter', 'paragraph', 'table', 'figure', 'appendix',
    'shall', 'must', 'may', 'should', 'would', 'could', 'will', 'also', 'however', 'therefore'
  ]);

  /**
   * Cleans a string by removing all characters that are not
   * alphanumeric, common punctuation, or whitespace.
   *
   * @param {string} text The input string to clean.
   * @returns {string} The cleaned string.
   */
  private cleanText(text: string): string {
    // Regex to match any character that is NOT a letter (a-z, A-Z),
    // a digit (0-9), whitespace (\s), or a common punctuation mark.
    // The ^ at the start of the character class [^...] negates the set.
    const cleanedText = text.replace(/[^a-zA-Z0-9\s.,!?'"-]/g, "");
    return cleanedText;
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction based on frequency and relevance
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        word.length < 20 && 
        !this.stopWords.has(word) && 
        // Exclude words that are just numbers
        !/^\d+$/.test(word)
      );
    
    // Count word frequency
    const wordCounts: Map<string, number> = new Map();
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
    
    // Return top 10 most frequent words
    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Get statistics about the markdown collection
   */
  getCollectionStats(): {
    totalFiles: number;
    totalDocuments: number;
    totalPages: number;
    avgPagesPerDocument: number;
  } {
    const files = this.getAllMarkdownFiles();
    const processedDocs = this.processAllDocuments();
    
    const totalPages = processedDocs.reduce((sum, doc) => sum + doc.chunks.length, 0);
    const avgPagesPerDocument = processedDocs.length > 0 ? totalPages / processedDocs.length : 0;
    
    return {
      totalFiles: files.length,
      totalDocuments: processedDocs.length,
      totalPages,
      avgPagesPerDocument: Math.round(avgPagesPerDocument * 100) / 100
    };
  }
}

// Export singleton instance
export const markdownPageChunker = new MarkdownPageChunker();
