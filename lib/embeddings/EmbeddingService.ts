import { embed, embedMany } from 'ai';
import { azure } from '@ai-sdk/azure';

export interface EmbeddingResult {
  embedding: number[];
  dimension: number;
  model: string;
  timestamp: string;
}

export class EmbeddingService {
  private static instance: EmbeddingService;
  private readonly model: string;
  private readonly dimension: number;
  private embeddingModel;
  private isInitialized: boolean = false;

  constructor(modelName: string = 'text-embedding-3-small', dimension: number = 1536) {
    this.model = modelName;
    this.dimension = dimension;
    this.embeddingModel = azure.textEmbedding(modelName);
    this.isInitialized = true;
  }

  static getInstance(model?: string, dimension?: number): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService(model, dimension);
    }
    return EmbeddingService.instance;
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      // Clean and prepare text
      const cleanText = this.preprocessText(text);
      
      // Generate embedding using AI SDK
      const { embedding, usage } = await embed({
        model: this.embeddingModel,
        value: cleanText,
      });

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
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      // Clean and prepare texts
      const cleanTexts = texts.map(text => this.preprocessText(text));
      
      // Generate embeddings using AI SDK
      const { embeddings, usage } = await embedMany({
        model: this.embeddingModel,
        values: cleanTexts,
      });

      // Create result objects
      return embeddings.map(embedding => ({
        embedding,
        dimension: embedding.length,
        model: this.model,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      
      // Return fallback embeddings in case of error
      return texts.map(() => ({
        embedding: new Array(this.dimension).fill(0),
        dimension: this.dimension,
        model: this.model,
        timestamp: new Date().toISOString(),
      }));
    }
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

  getModelInfo(): { modelName: string; dimension: number } {
    return { modelName: this.model, dimension: this.dimension };
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async warmup(): Promise<void> {
    console.log('Warming up embedding service...');
    await this.generateEmbedding('This is a test sentence for warming up the embedding model.');
    console.log('Embedding service warmup completed');
  }
}

// Export singleton instance
export const embeddingService = EmbeddingService.getInstance();

// Utility functions for direct use
export async function generateEmbedding(message: string): Promise<number[]> {
  const result = await embeddingService.generateEmbedding(message);
  return result.embedding;
}

export async function generateMultipleEmbeddings(messages: string[]): Promise<number[][]> {
  const results = await embeddingService.generateBatchEmbeddings(messages);
  return results.map(result => result.embedding);
}