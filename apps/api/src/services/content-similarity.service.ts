import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { EmbeddingService } from './embedding.service';
import { AwsConfigService } from './aws-config.service';
import {
  ContentPage,
  SimilarityScore,
  ContentRelationship,
  IntentCluster,
  ContentSimilarityResult,
  SimilarityClassification,
} from '@simitrack/shared-types';

@Injectable()
export class ContentSimilarityService {
  private readonly logger = new Logger(ContentSimilarityService.name);
  private geminiClient: GoogleGenAI | null = null;

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly awsConfigService: AwsConfigService
  ) {}

  private async getGeminiClient(): Promise<GoogleGenAI> {
    if (!this.geminiClient) {
      const secrets = await this.awsConfigService.getSecrets();
      this.geminiClient = new GoogleGenAI({ apiKey: secrets.GEMINI_API_KEY });
    }
    return this.geminiClient;
  }

  async fetchPageContent(url: string): Promise<ContentPage> {
    const client = await this.getGeminiClient();

    const prompt = `Extract the following from this URL: ${url}

Return JSON with these fields:
- title: The page's <title> tag content
- h1: The main H1 heading
- intro_text: First 2-3 paragraphs or introduction section (max 500 words)
- body_text: Main content body (max 2000 words)

Use Google Search to find and analyze this page's content.`;

    try {
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash-preview-05-20',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      const parsed = JSON.parse(text);
      return {
        url,
        title: parsed.title || '',
        h1: parsed.h1 || '',
        intro_text: parsed.intro_text || '',
        body_text: parsed.body_text || '',
      };
    } catch (error) {
      this.logger.error(`Failed to fetch ${url}: ${error.message}`);
      return {
        url,
        title: '',
        h1: '',
        intro_text: '',
        body_text: '',
        fetchError: error.message,
      };
    }
  }

  async fetchMultiplePages(urls: string[]): Promise<ContentPage[]> {
    const pages: ContentPage[] = [];

    for (const url of urls) {
      this.logger.log(`Fetching content from: ${url}`);
      const page = await this.fetchPageContent(url);
      pages.push(page);
      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return pages;
  }

  async generateEmbeddings(pages: ContentPage[]): Promise<ContentPage[]> {
    const pagesWithEmbeddings: ContentPage[] = [];

    for (const page of pages) {
      if (page.fetchError) {
        pagesWithEmbeddings.push(page);
        continue;
      }

      const fullText = `${page.title} ${page.h1} ${page.intro_text} ${page.body_text}`;

      this.logger.log(`Generating embeddings for: ${page.url}`);

      const [titleEmb, introEmb, bodyEmb, fullEmb] = await Promise.all([
        this.embeddingService.getEmbedding(page.title),
        this.embeddingService.getEmbedding(page.intro_text),
        this.embeddingService.getEmbedding(page.body_text.slice(0, 8000)),
        this.embeddingService.getEmbedding(fullText.slice(0, 8000)),
      ]);

      pagesWithEmbeddings.push({
        ...page,
        embeddings: {
          title: titleEmb,
          intro: introEmb,
          body: bodyEmb,
          full: fullEmb,
        },
      });
    }

    return pagesWithEmbeddings;
  }

  calculateSimilarityMatrix(pages: ContentPage[]): SimilarityScore[] {
    const scores: SimilarityScore[] = [];
    const validPages = pages.filter((p) => p.embeddings && !p.fetchError);

    for (let i = 0; i < validPages.length; i++) {
      for (let j = i + 1; j < validPages.length; j++) {
        const pageA = validPages[i];
        const pageB = validPages[j];

        scores.push({
          url_a: pageA.url,
          url_b: pageB.url,
          title_similarity: this.embeddingService.cosineSimilarity(
            pageA.embeddings!.title,
            pageB.embeddings!.title
          ),
          intro_similarity: this.embeddingService.cosineSimilarity(
            pageA.embeddings!.intro,
            pageB.embeddings!.intro
          ),
          body_similarity: this.embeddingService.cosineSimilarity(
            pageA.embeddings!.body,
            pageB.embeddings!.body
          ),
          full_similarity: this.embeddingService.cosineSimilarity(
            pageA.embeddings!.full,
            pageB.embeddings!.full
          ),
        });
      }
    }

    return scores;
  }

  classifyRelationships(scores: SimilarityScore[]): ContentRelationship[] {
    return scores.map((score) => {
      let classification: SimilarityClassification;
      let confidence: number;
      let recommended_action: string;
      let reasoning: string;

      if (score.body_similarity >= 0.95 && score.title_similarity >= 0.9) {
        classification = 'Definite Duplicate';
        confidence = Math.round(
          ((score.body_similarity + score.title_similarity) / 2) * 100
        );
        recommended_action = 'Canonicalize, redirect, or remove one URL';
        reasoning = `Very high body (${(score.body_similarity * 100).toFixed(1)}%) and title (${(score.title_similarity * 100).toFixed(1)}%) similarity indicates duplicate content.`;
      } else if (
        score.body_similarity >= 0.9 &&
        score.intro_similarity >= 0.85
      ) {
        classification = 'Near Duplicate';
        confidence = Math.round(
          ((score.body_similarity + score.intro_similarity) / 2) * 100
        );
        recommended_action = 'Merge content or rewrite to differentiate';
        reasoning = `High body (${(score.body_similarity * 100).toFixed(1)}%) and intro (${(score.intro_similarity * 100).toFixed(1)}%) similarity suggests near-duplicate content.`;
      } else if (
        score.title_similarity >= 0.85 &&
        score.body_similarity < 0.8
      ) {
        classification = 'Intent Collision';
        confidence = Math.round(score.title_similarity * 100);
        recommended_action = 'Clarify intent and differentiate focus';
        reasoning = `Similar titles (${(score.title_similarity * 100).toFixed(1)}%) but different body content (${(score.body_similarity * 100).toFixed(1)}%) indicates SEO intent collision.`;
      } else if (
        score.full_similarity >= 0.9 &&
        score.body_similarity < 0.75
      ) {
        classification = 'Template Overlap';
        confidence = Math.round(score.full_similarity * 100);
        recommended_action = 'Reduce boilerplate dominance';
        reasoning = `High full-page similarity (${(score.full_similarity * 100).toFixed(1)}%) but lower body (${(score.body_similarity * 100).toFixed(1)}%) suggests template/navigation overlap.`;
      } else {
        classification = 'Unique';
        confidence = Math.round((1 - score.full_similarity) * 100);
        recommended_action = 'No action needed';
        reasoning = 'Content is sufficiently different.';
      }

      return {
        url_a: score.url_a,
        url_b: score.url_b,
        classification,
        confidence,
        similarity_summary: {
          title: Math.round(score.title_similarity * 100) / 100,
          intro: Math.round(score.intro_similarity * 100) / 100,
          body: Math.round(score.body_similarity * 100) / 100,
          full: Math.round(score.full_similarity * 100) / 100,
        },
        recommended_action,
        reasoning,
      };
    });
  }

  identifyIntentClusters(relationships: ContentRelationship[]): IntentCluster[] {
    const collisions = relationships.filter(
      (r) => r.classification === 'Intent Collision'
    );
    if (collisions.length === 0) return [];

    const urlConnections: Map<string, Set<string>> = new Map();

    for (const collision of collisions) {
      if (!urlConnections.has(collision.url_a)) {
        urlConnections.set(collision.url_a, new Set());
      }
      if (!urlConnections.has(collision.url_b)) {
        urlConnections.set(collision.url_b, new Set());
      }
      urlConnections.get(collision.url_a)!.add(collision.url_b);
      urlConnections.get(collision.url_b)!.add(collision.url_a);
    }

    const visited = new Set<string>();
    const clusters: IntentCluster[] = [];

    for (const url of urlConnections.keys()) {
      if (visited.has(url)) continue;

      const cluster: string[] = [];
      const queue = [url];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        cluster.push(current);

        const connections = urlConnections.get(current) || new Set();
        for (const connected of connections) {
          if (!visited.has(connected)) {
            queue.push(connected);
          }
        }
      }

      if (cluster.length > 1) {
        clusters.push({
          primary_url: cluster[0],
          cluster_urls: cluster.slice(1),
          reasoning: `${cluster.length} URLs are competing for similar search intent. Consider consolidating or differentiating.`,
        });
      }
    }

    return clusters;
  }

  async analyzeUrls(urls: string[]): Promise<ContentSimilarityResult> {
    this.logger.log(`Analyzing ${urls.length} URLs for content similarity`);

    // Step 1: Fetch content
    const pages = await this.fetchMultiplePages(urls);
    const failedUrls = pages.filter((p) => p.fetchError).map((p) => p.url);

    // Step 2: Generate embeddings
    const pagesWithEmbeddings = await this.generateEmbeddings(pages);

    // Step 3: Calculate similarity matrix
    const similarityScores = this.calculateSimilarityMatrix(pagesWithEmbeddings);

    // Step 4: Classify relationships
    const relationships = this.classifyRelationships(similarityScores);

    // Step 5: Identify clusters
    const clusters = this.identifyIntentClusters(relationships);

    return {
      relationships,
      intent_collision_clusters: clusters,
      pages_analyzed: pages.length - failedUrls.length,
      pages_failed: failedUrls.length,
      failed_urls: failedUrls.length > 0 ? failedUrls : undefined,
    };
  }
}
