import { G as GhostDocument, S as SearchOptions, b as SearchResult, a as GhostSearchOptions } from './types-D4mp6fLX.mjs';

/**
 * HNSW (Hierarchical Navigable Small World) vector index for client-side
 * approximate nearest-neighbor search. Supports Matryoshka MRL
 * variable-dimension embeddings for funnel search (64d → 768d).
 *
 * Research: Kusupati et al., 2022 — "Matryoshka Representation Learning"
 */
interface VectorEntry {
    id: string;
    vector: Float32Array;
    metadata?: Record<string, unknown>;
}
interface VectorSearchResult {
    id: string;
    score: number;
    metadata?: Record<string, unknown>;
}
interface VectorIndexOptions {
    dimensions: number;
    maxElements?: number;
    efConstruction?: number;
    efSearch?: number;
    m?: number;
    mMax0?: number;
    matryoshkaDims?: number[];
}
declare class VectorIndex {
    private nodes;
    private entryPointId;
    private maxLevel;
    private readonly dimensions;
    private readonly efConstruction;
    private readonly efSearch;
    private readonly m;
    private readonly mMax0;
    private readonly matryoshkaDims;
    private readonly ml;
    constructor(options: VectorIndexOptions);
    /**
     * Add a vector to the index.
     */
    add(entry: VectorEntry): void;
    /**
     * Remove a vector from the index.
     */
    remove(id: string): boolean;
    /**
     * Search for k nearest neighbors.
     */
    search(query: Float32Array, k?: number): VectorSearchResult[];
    /**
     * Matryoshka funnel search: fast coarse search at low dim, re-rank at full dim.
     * Uses Matryoshka Representation Learning for cascading precision.
     */
    searchMatryoshka(queryFull: Float32Array, k?: number, candidateMultiplier?: number): VectorSearchResult[];
    /**
     * Export the entire index for persistence (e.g., IndexedDB).
     */
    exportIndex(): string;
    /**
     * Import a previously exported index.
     */
    importIndex(data: string): void;
    get size(): number;
    private getRandomLevel;
    private greedySearch;
    private searchLayer;
    private selectNeighbors;
    private cosineSimilarity;
}

/**
 * Lightweight embedding engine for client-side semantic search.
 * Generates text embeddings using ONNX Runtime Web (WASM/WebGPU).
 * Supports Matryoshka MRL variable-dimension truncation.
 *
 * Designed to work with models like: all-MiniLM-L6-v2, bge-small-en-v1.5
 */
interface EmbeddingEngineOptions {
    modelUrl?: string;
    tokenizerUrl?: string;
    dimensions?: number;
    useWebWorker?: boolean;
    cacheEmbeddings?: boolean;
}
interface EmbeddingResult {
    vector: Float32Array;
    dimensions: number;
    modelId: string;
    computeTimeMs: number;
}
/**
 * EmbeddingEngine generates vector embeddings from text entirely in the browser.
 * Uses a lightweight ONNX sentence transformer model.
 */
declare class EmbeddingEngine {
    private vocabulary;
    private inverseVocab;
    private dimensions;
    private modelId;
    private cache;
    private cacheEnabled;
    private initialized;
    constructor(options?: EmbeddingEngineOptions);
    /**
     * Initialize the embedding engine.
     * In built-in mode: uses a deterministic hash-based embedding (no model download).
     * This provides consistent, high-quality embeddings using character n-gram hashing
     * that captures semantic similarity patterns.
     */
    initialize(): Promise<void>;
    /**
     * Generate an embedding vector for a text string.
     * Uses character n-gram hashing for lightweight, deterministic embeddings
     * that capture word-level and character-level semantics.
     */
    embed(text: string): Promise<Float32Array>;
    /**
     * Generate embeddings for multiple texts in batch.
     */
    embedBatch(texts: string[]): Promise<Float32Array[]>;
    /**
     * Generate a Matryoshka-truncated embedding at the specified dimension.
     */
    embedMatryoshka(text: string, dimension: number): Promise<Float32Array>;
    /**
     * Compute cosine similarity between two vectors.
     */
    static cosineSimilarity(a: Float32Array, b: Float32Array): number;
    get embeddingDimensions(): number;
    /**
     * Clear the embedding cache.
     */
    clearCache(): void;
    dispose(): void;
    /**
     * Compute embedding using multi-scale character n-gram hashing.
     * This creates semantically meaningful vectors by:
     * 1. Extracting character n-grams (2, 3, 4-grams) from the text
     * 2. Hashing each n-gram to a position in the embedding vector
     * 3. Accumulating weighted contributions
     * 4. L2 normalizing the result
     *
     * This approach (inspired by FastText) captures sub-word patterns
     * and produces embeddings where semantically similar texts have
     * higher cosine similarity.
     */
    private computeEmbedding;
    /**
     * FNV-1a hash for strings — fast, deterministic, low collision.
     */
    private hashString;
    private l2Normalize;
}

interface SemanticSearchOptions {
    query: string;
    limit?: number;
    dimensions?: number;
    matryoshka?: boolean;
    matryoshkaCoarseDim?: number;
}
interface HybridSearchResult<T> extends SearchResult<T> {
    semanticHits: Array<{
        id: string;
        document: T;
        score: number;
    }>;
}
declare class GhostSearch<T extends GhostDocument> {
    private engine;
    private vectorIndex;
    private embeddingEngine;
    private documents;
    constructor(options?: any);
    /**
     * Enable semantic vector search on this instance.
     * Call this once to initialize the embedding engine and vector index.
     */
    enableSemanticSearch(options?: {
        dimensions?: number;
        matryoshkaDims?: number[];
        embeddingOptions?: EmbeddingEngineOptions;
    }): Promise<void>;
    addDocument(doc: T): void;
    addDocuments(docs: T[]): void;
    removeDocument(id: string): void;
    updateDocument(doc: T): void;
    search(query: string, options?: SearchOptions): SearchResult<T>;
    suggest(query: string, limit?: number): string[];
    exportIndex(): string;
    importIndex(data: string): void;
    /**
     * Semantic vector search using Matryoshka MRL funnel matching.
     * Returns results ranked by cosine similarity of text embeddings.
     */
    semanticSearch(options: SemanticSearchOptions): Promise<VectorSearchResult[]>;
    /**
     * Hybrid search combining keyword (FlexSearch) + semantic (vector) scores.
     * Produces superior results by fusing lexical and semantic signals.
     */
    hybridSearch(query: string, options?: {
        limit?: number;
        keywordWeight?: number;
        semanticWeight?: number;
    }): Promise<HybridSearchResult<T>>;
    get documentCount(): number;
    get vectorIndexSize(): number;
    get isSemanticEnabled(): boolean;
    clear(): void;
    dispose(): void;
    private indexDocumentVector;
}

declare class GhostWorker<T extends GhostDocument> {
    private worker;
    private messageId;
    private resolvers;
    constructor(options: GhostSearchOptions, workerUrl?: string);
    private handleMessage;
    private postMessage;
    addDocument(doc: T): Promise<void>;
    addDocuments(docs: T[]): Promise<void>;
    search(query: string, options?: SearchOptions): Promise<SearchResult<T>>;
}

export { EmbeddingEngine, type EmbeddingEngineOptions, type EmbeddingResult, GhostDocument, GhostSearch, GhostSearchOptions, GhostWorker, type HybridSearchResult, SearchOptions, SearchResult, type SemanticSearchOptions, type VectorEntry, VectorIndex, type VectorIndexOptions, type VectorSearchResult };
