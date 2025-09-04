export interface ChunkMetadata {
  chunkId: string;
  level: number;
  parentChunkId?: string;
  childChunkIds: string[];
  chunkType: 'document' | 'section' | 'paragraph' | 'sentence';
  startIndex: number;
  endIndex: number;
  tokens: number;
  keywords: string[];
  summary?: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
  embedding?: number[];
}

export interface ChunkingOptions {
  maxTokens: number;
  overlap: number;
  preserveSentences: boolean;
  hierarchyLevels: number;
  keywordExtraction: boolean;
  generateSummaries: boolean;
}

export class HierarchicalChunker {
  private readonly defaultOptions: ChunkingOptions = {
    maxTokens: 512,
    overlap: 50,
    preserveSentences: true,
    hierarchyLevels: 3,
    keywordExtraction: true,
    generateSummaries: false,
  };

  constructor(private options: Partial<ChunkingOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  async chunkDocument(
    content: string,
    docId: string,
    metadata: Record<string, string> = {}
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    let chunkIdCounter = 0;

    // Level 0: Document level
    const documentChunk = this.createDocumentChunk(content, docId, chunkIdCounter++, metadata);
    chunks.push(documentChunk);

    // Level 1: Section level (split by double newlines or headers)
    const sections = this.splitIntoSections(content);
    const sectionChunks: DocumentChunk[] = [];

    for (const section of sections) {
      if (section.content.trim().length === 0) continue;

      const sectionChunk = this.createSectionChunk(
        section.content,
        docId,
        chunkIdCounter++,
        documentChunk.id,
        section.startIndex,
        section.endIndex,
        metadata
      );
      
      sectionChunks.push(sectionChunk);
      chunks.push(sectionChunk);

      // Level 2: Paragraph level
      const paragraphs = this.splitIntoParagraphs(section.content, section.startIndex);
      const paragraphChunks: DocumentChunk[] = [];

      for (const paragraph of paragraphs) {
        if (paragraph.content.trim().length === 0) continue;

        const paragraphChunk = this.createParagraphChunk(
          paragraph.content,
          docId,
          chunkIdCounter++,
          sectionChunk.id,
          paragraph.startIndex,
          paragraph.endIndex,
          metadata
        );

        paragraphChunks.push(paragraphChunk);
        chunks.push(paragraphChunk);

        // Level 3: Sentence level (if tokens exceed limit)
        if (this.estimateTokens(paragraph.content) > this.options.maxTokens!) {
          const sentences = this.splitIntoSentences(paragraph.content, paragraph.startIndex);

          for (const sentence of sentences) {
            if (sentence.content.trim().length === 0) continue;

            const sentenceChunk = this.createSentenceChunk(
              sentence.content,
              docId,
              chunkIdCounter++,
              paragraphChunk.id,
              sentence.startIndex,
              sentence.endIndex,
              metadata
            );

            chunks.push(sentenceChunk);
            paragraphChunk.metadata.childChunkIds.push(sentenceChunk.id);
          }
        }

        sectionChunk.metadata.childChunkIds.push(paragraphChunk.id);
      }

      documentChunk.metadata.childChunkIds.push(sectionChunk.id);
    }

    // Apply overlapping if specified
    if (this.options.overlap! > 0) {
      this.applyOverlapping(chunks);
    }

    // Extract keywords if enabled
    if (this.options.keywordExtraction) {
      this.extractKeywords(chunks);
    }

    return chunks;
  }

  private createDocumentChunk(
    content: string,
    docId: string,
    chunkId: number,
    metadata: Record<string, string>
  ): DocumentChunk {
    const id = `${docId}_chunk_${chunkId}`;
    
    return {
      id,
      content,
      metadata: {
        chunkId: id,
        level: 0,
        childChunkIds: [],
        chunkType: 'document',
        startIndex: 0,
        endIndex: content.length,
        tokens: this.estimateTokens(content),
        keywords: [],
        ...metadata,
      },
    };
  }

  private createSectionChunk(
    content: string,
    docId: string,
    chunkId: number,
    parentId: string,
    startIndex: number,
    endIndex: number,
    metadata: Record<string, string>
  ): DocumentChunk {
    const id = `${docId}_chunk_${chunkId}`;
    
    return {
      id,
      content,
      metadata: {
        chunkId: id,
        level: 1,
        parentChunkId: parentId,
        childChunkIds: [],
        chunkType: 'section',
        startIndex,
        endIndex,
        tokens: this.estimateTokens(content),
        keywords: [],
        ...metadata,
      },
    };
  }

  private createParagraphChunk(
    content: string,
    docId: string,
    chunkId: number,
    parentId: string,
    startIndex: number,
    endIndex: number,
    metadata: Record<string, string>
  ): DocumentChunk {
    const id = `${docId}_chunk_${chunkId}`;
    
    return {
      id,
      content,
      metadata: {
        chunkId: id,
        level: 2,
        parentChunkId: parentId,
        childChunkIds: [],
        chunkType: 'paragraph',
        startIndex,
        endIndex,
        tokens: this.estimateTokens(content),
        keywords: [],
        ...metadata,
      },
    };
  }

  private createSentenceChunk(
    content: string,
    docId: string,
    chunkId: number,
    parentId: string,
    startIndex: number,
    endIndex: number,
    metadata: Record<string, string>
  ): DocumentChunk {
    const id = `${docId}_chunk_${chunkId}`;
    
    return {
      id,
      content,
      metadata: {
        chunkId: id,
        level: 3,
        parentChunkId: parentId,
        childChunkIds: [],
        chunkType: 'sentence',
        startIndex,
        endIndex,
        tokens: this.estimateTokens(content),
        keywords: [],
        ...metadata,
      },
    };
  }

  private splitIntoSections(content: string): Array<{ content: string; startIndex: number; endIndex: number }> {
    const sections: Array<{ content: string; startIndex: number; endIndex: number }> = [];
    
    // Split by double newlines or headers (lines starting with #, ##, etc.)
    const sectionRegex = /(?:\n\s*\n|\n#+\s)/g;
    let lastIndex = 0;
    let match;

    while ((match = sectionRegex.exec(content)) !== null) {
      if (lastIndex < match.index) {
        sections.push({
          content: content.slice(lastIndex, match.index).trim(),
          startIndex: lastIndex,
          endIndex: match.index,
        });
      }
      lastIndex = match.index + match[0].length;
    }

    // Add the last section
    if (lastIndex < content.length) {
      sections.push({
        content: content.slice(lastIndex).trim(),
        startIndex: lastIndex,
        endIndex: content.length,
      });
    }

    return sections.filter(section => section.content.length > 0);
  }

  private splitIntoParagraphs(content: string, baseIndex: number = 0): Array<{ content: string; startIndex: number; endIndex: number }> {
    const paragraphs: Array<{ content: string; startIndex: number; endIndex: number }> = [];
    const paragraphRegex = /\n\s*\n/g;
    let lastIndex = 0;
    let match;

    while ((match = paragraphRegex.exec(content)) !== null) {
      if (lastIndex < match.index) {
        paragraphs.push({
          content: content.slice(lastIndex, match.index).trim(),
          startIndex: baseIndex + lastIndex,
          endIndex: baseIndex + match.index,
        });
      }
      lastIndex = match.index + match[0].length;
    }

    // Add the last paragraph
    if (lastIndex < content.length) {
      paragraphs.push({
        content: content.slice(lastIndex).trim(),
        startIndex: baseIndex + lastIndex,
        endIndex: baseIndex + content.length,
      });
    }

    return paragraphs.filter(paragraph => paragraph.content.length > 0);
  }

  private splitIntoSentences(content: string, baseIndex: number = 0): Array<{ content: string; startIndex: number; endIndex: number }> {
    const sentences: Array<{ content: string; startIndex: number; endIndex: number }> = [];
    
    // Enhanced sentence splitting regex that handles abbreviations and edge cases
    const sentenceRegex = /[.!?]+(?=\s+[A-Z]|\s*$)/g;
    let lastIndex = 0;
    let match;

    while ((match = sentenceRegex.exec(content)) !== null) {
      const endIndex = match.index + match[0].length;
      if (lastIndex < endIndex) {
        sentences.push({
          content: content.slice(lastIndex, endIndex).trim(),
          startIndex: baseIndex + lastIndex,
          endIndex: baseIndex + endIndex,
        });
      }
      lastIndex = endIndex;
    }

    // Add the last sentence if there's remaining content
    if (lastIndex < content.length) {
      sentences.push({
        content: content.slice(lastIndex).trim(),
        startIndex: baseIndex + lastIndex,
        endIndex: baseIndex + content.length,
      });
    }

    return sentences.filter(sentence => sentence.content.length > 0);
  }

  private estimateTokens(text: string): number {
    // Simple token estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  private applyOverlapping(chunks: DocumentChunk[]): void {
    const overlapTokens = this.options.overlap!;
    
    // Apply overlapping to chunks at the same level
    const chunksByLevel: Map<number, DocumentChunk[]> = new Map();
    
    chunks.forEach(chunk => {
      const level = chunk.metadata.level;
      if (!chunksByLevel.has(level)) {
        chunksByLevel.set(level, []);
      }
      chunksByLevel.get(level)!.push(chunk);
    });

    chunksByLevel.forEach((levelChunks, level) => {
      if (level === 0) return; // Skip document level
      
      for (let i = 1; i < levelChunks.length; i++) {
        const currentChunk = levelChunks[i];
        const previousChunk = levelChunks[i - 1];
        
        // Add overlap from previous chunk to current chunk
        const overlapText = this.getLastTokens(previousChunk.content, overlapTokens);
        if (overlapText.length > 0) {
          currentChunk.content = overlapText + ' ' + currentChunk.content;
        }
      }
    });
  }

  private getLastTokens(text: string, tokenCount: number): string {
    const words = text.split(/\s+/);
    const lastWords = words.slice(-tokenCount);
    return lastWords.join(' ');
  }

  private extractKeywords(chunks: DocumentChunk[]): void {
    chunks.forEach(chunk => {
      chunk.metadata.keywords = this.extractKeywordsFromText(chunk.content);
    });
  }

  private extractKeywordsFromText(text: string): string[] {
    // Simple keyword extraction based on word frequency and length
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3); // Filter out short words

    const wordCounts: Map<string, number> = new Map();
    
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    // Sort by frequency and return top keywords
    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  getChunkingOptions(): ChunkingOptions {
    return this.options as ChunkingOptions;
  }

  static createChunker(options: Partial<ChunkingOptions> = {}): HierarchicalChunker {
    return new HierarchicalChunker(options);
  }
}
