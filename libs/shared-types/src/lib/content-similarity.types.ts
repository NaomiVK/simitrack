// Content page with extracted text and embeddings
export interface ContentPage {
  url: string;
  title: string;
  h1: string;
  intro_text: string;
  body_text: string;
  embeddings?: {
    title: number[];
    intro: number[];
    body: number[];
    full: number[];
  };
  fetchError?: string;
}

// Similarity scores between two pages
export interface SimilarityScore {
  url_a: string;
  url_b: string;
  title_similarity: number;
  intro_similarity: number;
  body_similarity: number;
  full_similarity: number;
}

// Classification types
export type SimilarityClassification =
  | 'Definite Duplicate'
  | 'Near Duplicate'
  | 'Intent Collision'
  | 'Template Overlap'
  | 'Unique';

// Analyzed relationship between two pages
export interface ContentRelationship {
  url_a: string;
  url_b: string;
  classification: SimilarityClassification;
  confidence: number;
  similarity_summary: {
    title: number;
    intro: number;
    body: number;
    full: number;
  };
  recommended_action: string;
  reasoning: string;
}

// Cluster of URLs with intent collision
export interface IntentCluster {
  primary_url: string;
  cluster_urls: string[];
  reasoning: string;
}

// Main result type
export interface ContentSimilarityResult {
  relationships: ContentRelationship[];
  intent_collision_clusters: IntentCluster[];
  pages_analyzed: number;
  pages_failed: number;
  failed_urls?: string[];
}

// Request types
export interface AnalyzeUrlsRequest {
  urls: string[];
}

export interface AnalyzeContentRequest {
  pages: ContentPage[];
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
