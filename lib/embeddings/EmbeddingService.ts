import { pipeline, Pipeline } from '@xenova/transformers';

export interface EmbeddingResult {
  embedding: number[];
  dimension: number;
  model: string;
  timestamp: string;
}

export class EmbeddingService {
  private static instance: EmbeddingService;
  private embedder: Pipeline | null = null;
  private readonly model: string;
  private readonly dimension: number;
  private isInitialized: boolean = false;

  constructor(model: string = 'Xenova/all-MiniLM-L6-v2', dimension: number = 384) {
    this.model = model;
    this.dimension = dimension;
  }

  static getInstance(model?: string, dimension?: number): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService(model, dimension);
    }
    return EmbeddingService.instance;
  }

  private async initializeEmbedder(): Promise<void> {
    if (this.isInitialized && this.embedder) {
      return;
    }

    try {
      console.log(`Initializing embedding model: ${this.model}`);
      this.embedder = await pipeline('feature-extraction', this.model, {
        quantized: false,
      });
      this.isInitialized = true;
      console.log(`Embedding model ${this.model} initialized successfully`);
    } catch (error) {
      console.error('Failed to initialize embedding model:', error);
      throw new Error(`Failed to initialize embedding model: ${error}`);
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.isInitialized || !this.embedder) {
      await this.initializeEmbedder();
    }

    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    try {
      // Clean and prepare text
      const cleanText = this.preprocessText(text);
      
      // Generate embedding
      const output = await this.embedder(cleanText, {
        pooling: 'mean',
        normalize: true,
      });

      // Extract the embedding array
      let embedding: number[];
      if (output?.data) {
        embedding = Array.from(output.data);
      } else {
        embedding = Array.from(output);
      }

      // Validate embedding dimension
      if (embedding.length !== this.dimension) {
        console.warn(`Expected dimension ${this.dimension}, got ${embedding.length}`);
      }

      return {
        embedding,
        dimension: embedding.length,
        model: this.model,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (const text of texts) {
      try {
        const result = await this.generateEmbedding(text);
        results.push(result);
      } catch (error) {
        console.error(`Failed to generate embedding for text: ${text.substring(0, 100)}...`, error);
        // Continue with other texts even if one fails
        results.push({
          embedding: new Array(this.dimension).fill(0),
          dimension: this.dimension,
          model: this.model,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  private preprocessText(text: string): string {
    // Remove excessive whitespace and normalize
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8192); // Limit to reasonable length
  }

  getDimension(): number {
    return this.dimension;
  }

  getModel(): string {
    return this.model;
  }

  isReady(): boolean {
    return this.isInitialized && this.embedder !== null;
  }

  async warmup(): Promise<void> {
    console.log('Warming up embedding service...');
    await this.generateEmbedding('This is a test sentence for warming up the embedding model.');
    console.log('Embedding service warmup completed');
  }
}

// Export singleton instance
export const embeddingService = EmbeddingService.getInstance();

// Utility function for backwards compatibility
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingService.generateEmbedding(text);
  return result.embedding;
}
