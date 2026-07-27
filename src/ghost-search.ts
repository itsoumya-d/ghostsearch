import { LicenseValidator } from "./license-validator";
// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

import { GhostSearchOptions, SearchOptions, SearchResult, GhostDocument } from './types';
import { SearchEngine } from './search-engine';
import { VectorIndex, VectorSearchResult, VectorIndexOptions } from './vector-index';
import { EmbeddingEngine, EmbeddingEngineOptions } from './embedding-engine';

export interface SemanticSearchOptions {
  query: string;
  limit?: number;
  dimensions?: number;
  matryoshka?: boolean;
  matryoshkaCoarseDim?: number;
}

export interface HybridSearchResult<T> extends SearchResult<T> {
  semanticHits: Array<{
    id: string;
    document: T;
    score: number;
  }>;
}

export class GhostSearch<T extends GhostDocument> {
  private engine: SearchEngine<T>;
  private vectorIndex: VectorIndex | null = null;
  private embeddingEngine: EmbeddingEngine | null = null;
  private documents: Map<string, T> = new Map();

  constructor(options?: any) {
    LicenseValidator.validate(options);
    this.engine = new SearchEngine<T>(options);
  }

  /**
   * Enable semantic vector search on this instance.
   * Call this once to initialize the embedding engine and vector index.
   */
  async enableSemanticSearch(options?: {
    dimensions?: number;
    matryoshkaDims?: number[];
    embeddingOptions?: EmbeddingEngineOptions;
  }): Promise<void> {
    const dims = options?.dimensions || 384;
    this.embeddingEngine = new EmbeddingEngine({
      dimensions: dims,
      ...options?.embeddingOptions,
    });
    await this.embeddingEngine.initialize();

    this.vectorIndex = new VectorIndex({
      dimensions: dims,
      matryoshkaDims: options?.matryoshkaDims || [64, 256, dims],
    });

    // Index existing documents
    for (const [id, doc] of this.documents) {
      await this.indexDocumentVector(id, doc);
    }
  }

  addDocument(doc: T): void {
    this.engine.add(doc);
    this.documents.set(doc.id, doc);
    if (this.embeddingEngine && this.vectorIndex) {
      this.indexDocumentVector(doc.id, doc);
    }
  }

  addDocuments(docs: T[]): void {
    for (const doc of docs) {
      this.addDocument(doc);
    }
  }

  removeDocument(id: string): void {
    this.engine.remove(id);
    this.documents.delete(id);
    this.vectorIndex?.remove(id);
  }

  updateDocument(doc: T): void {
    this.engine.update(doc);
    this.documents.set(doc.id, doc);
    if (this.embeddingEngine && this.vectorIndex) {
      this.vectorIndex.remove(doc.id);
      this.indexDocumentVector(doc.id, doc);
    }
  }

  search(query: string, options?: SearchOptions): SearchResult<T> {
    return this.engine.search(query, options);
  }

  suggest(query: string, limit?: number): string[] {
    return this.engine.suggest(query, limit);
  }

  exportIndex(): string {
    return this.engine.export();
  }

  importIndex(data: string): void {
    this.engine.import(data);
  }

  /**
   * Semantic vector search using Matryoshka MRL funnel matching.
   * Returns results ranked by cosine similarity of text embeddings.
   */
  async semanticSearch(options: SemanticSearchOptions): Promise<VectorSearchResult[]> {
    if (!this.embeddingEngine || !this.vectorIndex) {
      throw new Error('GhostSearch: Call enableSemanticSearch() before using semanticSearch()');
    }

    const limit = options.limit || 10;
    const queryVector = await this.embeddingEngine.embed(options.query);

    if (options.matryoshka !== false) {
      return this.vectorIndex.searchMatryoshka(queryVector, limit);
    }

    return this.vectorIndex.search(queryVector, limit);
  }

  /**
   * Hybrid search combining keyword (FlexSearch) + semantic (vector) scores.
   * Produces superior results by fusing lexical and semantic signals.
   */
  async hybridSearch(
    query: string,
    options?: { limit?: number; keywordWeight?: number; semanticWeight?: number }
  ): Promise<HybridSearchResult<T>> {
    const limit = options?.limit || 10;
    const kwWeight = options?.keywordWeight ?? 0.4;
    const semWeight = options?.semanticWeight ?? 0.6;

    // Keyword search
    const keywordResults = this.engine.search(query, { query, limit: limit * 3 });

    // Semantic search (if enabled)
    let semanticHits: Array<{ id: string; document: T; score: number }> = [];

    if (this.embeddingEngine && this.vectorIndex) {
      const vecResults = await this.semanticSearch({ query, limit: limit * 3 });
      semanticHits = vecResults
        .map(vr => {
          const doc = this.documents.get(vr.id);
          return doc ? { id: vr.id, document: doc, score: vr.score } : null;
        })
        .filter((h): h is { id: string; document: T; score: number } => h !== null);
    }

    // Score fusion: combine keyword + semantic scores
    const scoreMap = new Map<string, { doc: T; kwScore: number; semScore: number }>();

    // Normalize keyword scores
    const maxKw = keywordResults.hits.length > 0 ? keywordResults.hits[0].score : 1;
    for (const hit of keywordResults.hits) {
      scoreMap.set(hit.id, {
        doc: hit.document,
        kwScore: hit.score / (maxKw || 1),
        semScore: 0,
      });
    }

    // Merge semantic scores
    for (const hit of semanticHits) {
      const existing = scoreMap.get(hit.id);
      if (existing) {
        existing.semScore = hit.score;
      } else {
        scoreMap.set(hit.id, {
          doc: hit.document,
          kwScore: 0,
          semScore: hit.score,
        });
      }
    }

    // Compute fused scores and rank
    const fusedHits = Array.from(scoreMap.entries())
      .map(([id, data]) => ({
        id,
        document: data.doc,
        score: data.kwScore * kwWeight + data.semScore * semWeight,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      hits: fusedHits,
      totalHits: scoreMap.size,
      queryTimeMs: keywordResults.queryTimeMs,
      semanticHits,
    };
  }

  get documentCount(): number {
    return this.engine.count;
  }

  get vectorIndexSize(): number {
    return this.vectorIndex?.size || 0;
  }

  get isSemanticEnabled(): boolean {
    return this.vectorIndex !== null && this.embeddingEngine !== null;
  }

  clear(): void {
    this.engine.clear();
    this.documents.clear();
    if (this.vectorIndex) {
      // Re-create vector index
      this.vectorIndex = new VectorIndex({
        dimensions: this.embeddingEngine?.embeddingDimensions || 384,
      });
    }
  }

  dispose(): void {
    this.clear();
    this.embeddingEngine?.dispose();
    this.embeddingEngine = null;
    this.vectorIndex = null;
  }

  // --- Private helpers ---

  private async indexDocumentVector(id: string, doc: T): Promise<void> {
    if (!this.embeddingEngine || !this.vectorIndex) return;

    // Concatenate all string fields for embedding
    const textParts: string[] = [];
    for (const [key, value] of Object.entries(doc)) {
      if (key !== 'id' && typeof value === 'string') {
        textParts.push(value);
      }
    }
    const text = textParts.join(' ');
    if (!text) return;

    const vector = await this.embeddingEngine.embed(text);
    this.vectorIndex.add({ id, vector });
  }
}
