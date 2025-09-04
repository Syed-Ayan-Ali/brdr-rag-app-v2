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
  private readonly modelDimension: number = 1536; // Azure text-embedding-3-small dimension
  private readonly targetDimension: number;       // Target dimension for database compatibility
  private embeddingModel;
  private isInitialized: boolean = false;

  constructor(modelName: string = 'text-embedding-3-small', targetDimension: number = 384) {
    this.model = modelName;
    this.targetDimension = targetDimension;
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

      // Reduce dimensionality to match database requirements
      const reducedEmbedding = this.reduceDimension(embedding);

      return {
        embedding: reducedEmbedding,
        dimension: reducedEmbedding.length,
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

      // Reduce dimensionality of all embeddings
      const reducedEmbeddings = embeddings.map(embedding => this.reduceDimension(embedding));

      // Create result objects
      return reducedEmbeddings.map(embedding => ({
        embedding,
        dimension: embedding.length,
        model: this.model,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      
      // Return fallback embeddings in case of error
      return texts.map(() => ({
        embedding: new Array(this.targetDimension).fill(0),
        dimension: this.targetDimension,
        model: this.model,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  /**
   * Reduces the dimensionality of an embedding vector from modelDimension to targetDimension
   * This implementation uses a combination of techniques:
   * 1. Uniform sampling across the vector to preserve overall distribution
   * 2. Averaging of adjacent dimensions to retain local relationships
   * 3. Preservation of important dimensions at the beginning of the vector
   */
  private reduceDimension(embedding: number[]): number[] {
    if (embedding.length <= this.targetDimension) {
      return embedding; // No reduction needed
    }

    // Method 1: Preserve the most important dimensions (typically at the beginning)
    const importantCount = Math.floor(this.targetDimension * 0.3); // 30% of target dimensions
    const importantDimensions = embedding.slice(0, importantCount);

    // Method 2: Sample uniformly from the remaining dimensions
    const remainingCount = this.targetDimension - importantCount;
    const sampledDimensions: number[] = [];
    
    const step = (embedding.length - importantCount) / remainingCount;
    for (let i = 0; i < remainingCount; i++) {
      const index = Math.floor(importantCount + i * step);
      
      // Average a small window around the sampled point to retain more information
      const windowSize = 3;
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, index - Math.floor(windowSize/2)); 
           j <= Math.min(embedding.length - 1, index + Math.floor(windowSize/2)); 
           j++) {
        sum += embedding[j];
        count++;
      }
      
      sampledDimensions.push(sum / count);
    }

    // Combine the important dimensions with the sampled ones
    const reducedEmbedding = [...importantDimensions, ...sampledDimensions];
    
    // Normalize the reduced embedding to maintain the same magnitude
    const originalMagnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const reducedMagnitude = Math.sqrt(reducedEmbedding.reduce((sum, val) => sum + val * val, 0));
    const scaleFactor = originalMagnitude / reducedMagnitude;
    
    return reducedEmbedding.map(val => val * scaleFactor);
  }

  private preprocessText(text: string): string {
    // Remove excessive whitespace and normalize
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8192); // Limit to reasonable length
  }

  getDimension(): number {
    return this.targetDimension; // Return the target dimension that matches the database
  }

  getModel(): string {
    return this.model;
  }

  getModelInfo(): { modelName: string; dimension: number } {
    return { modelName: this.model, dimension: this.targetDimension };
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

// Export singleton instance with 384 as the target dimension to match the database
export const embeddingService = EmbeddingService.getInstance('text-embedding-3-small', 384);

// Utility functions for direct use
export async function generateEmbedding(message: string): Promise<number[]> {
  const result = await embeddingService.generateEmbedding(message);
  return result.embedding;
}

export async function generateMultipleEmbeddings(messages: string[]): Promise<number[][]> {
  const results = await embeddingService.generateBatchEmbeddings(messages);
  return results.map(result => result.embedding);
}