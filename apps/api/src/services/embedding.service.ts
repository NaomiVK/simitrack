import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AwsConfigService } from './aws-config.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private openaiClient: OpenAI | null = null;
  private readonly model = 'text-embedding-3-large';

  constructor(private readonly awsConfigService: AwsConfigService) {}

  private async getClient(): Promise<OpenAI> {
    if (!this.openaiClient) {
      const secrets = await this.awsConfigService.getSecrets();
      this.openaiClient = new OpenAI({ apiKey: secrets.OPENAI_API_KEY });
    }
    return this.openaiClient;
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    try {
      const client = await this.getClient();
      const response = await client.embeddings.create({
        model: this.model,
        input: text.slice(0, 8000), // Truncate to avoid token limits
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`Embedding failed: ${error.message}`);
      return [];
    }
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    try {
      const client = await this.getClient();
      const truncatedTexts = texts.map((t) => (t || '').slice(0, 8000));
      const response = await client.embeddings.create({
        model: this.model,
        input: truncatedTexts,
      });
      return response.data.map((d) => d.embedding);
    } catch (error) {
      this.logger.error(`Batch embedding failed: ${error.message}`);
      return texts.map(() => []);
    }
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (!a?.length || !b?.length || a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
