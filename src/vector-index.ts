// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

/**
 * HNSW (Hierarchical Navigable Small World) vector index for client-side
 * approximate nearest-neighbor search. Supports Matryoshka MRL
 * variable-dimension embeddings for funnel search (64d → 768d).
 *
 * Research: Kusupati et al., 2022 — "Matryoshka Representation Learning"
 */

export interface VectorEntry {
  id: string;
  vector: Float32Array;
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface HNSWNode {
  id: string;
  vector: Float32Array;
  metadata?: Record<string, unknown>;
  neighbors: Map<number, string[]>; // level -> neighbor IDs
}

export interface VectorIndexOptions {
  dimensions: number;
  maxElements?: number;
  efConstruction?: number;
  efSearch?: number;
  m?: number;           // Max connections per layer
  mMax0?: number;       // Max connections at layer 0
  matryoshkaDims?: number[]; // MRL funnel dimensions e.g. [64, 256, 768]
}

export class VectorIndex {
  private nodes: Map<string, HNSWNode> = new Map();
  private entryPointId: string | null = null;
  private maxLevel: number = 0;
  private readonly dimensions: number;
  private readonly efConstruction: number;
  private readonly efSearch: number;
  private readonly m: number;
  private readonly mMax0: number;
  private readonly matryoshkaDims: number[];
  private readonly ml: number; // Level generation factor

  constructor(options: VectorIndexOptions) {
    this.dimensions = options.dimensions;
    this.efConstruction = options.efConstruction || 200;
    this.efSearch = options.efSearch || 50;
    this.m = options.m || 16;
    this.mMax0 = options.mMax0 || this.m * 2;
    this.matryoshkaDims = options.matryoshkaDims || [options.dimensions];
    this.ml = 1 / Math.log(this.m);
  }

  /**
   * Add a vector to the index.
   */
  add(entry: VectorEntry): void {
    const vec = entry.vector.length > this.dimensions
      ? entry.vector.slice(0, this.dimensions)
      : entry.vector;

    const level = this.getRandomLevel();

    const node: HNSWNode = {
      id: entry.id,
      vector: vec,
      metadata: entry.metadata,
      neighbors: new Map(),
    };

    // Initialize empty neighbor lists for all levels
    for (let l = 0; l <= level; l++) {
      node.neighbors.set(l, []);
    }

    this.nodes.set(entry.id, node);

    if (!this.entryPointId) {
      this.entryPointId = entry.id;
      this.maxLevel = level;
      return;
    }

    let currentId = this.entryPointId;

    // Phase 1: Traverse from top to target level (greedy search)
    for (let l = this.maxLevel; l > level; l--) {
      currentId = this.greedySearch(vec, currentId, l);
    }

    // Phase 2: Insert at each layer from level down to 0
    for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
      const neighbors = this.searchLayer(vec, currentId, this.efConstruction, l);
      const maxConn = l === 0 ? this.mMax0 : this.m;
      const selected = this.selectNeighbors(vec, neighbors, maxConn);

      node.neighbors.set(l, selected.map(n => n.id));

      // Add bidirectional connections
      for (const neighbor of selected) {
        const neighborNode = this.nodes.get(neighbor.id);
        if (!neighborNode) continue;

        const neighborConns = neighborNode.neighbors.get(l) || [];
        neighborConns.push(entry.id);

        // Prune if too many connections
        if (neighborConns.length > maxConn) {
          const pruned = this.selectNeighbors(
            neighborNode.vector,
            neighborConns.map(nid => ({
              id: nid,
              score: this.cosineSimilarity(neighborNode.vector, this.nodes.get(nid)!.vector)
            })),
            maxConn
          );
          neighborNode.neighbors.set(l, pruned.map(p => p.id));
        } else {
          neighborNode.neighbors.set(l, neighborConns);
        }
      }

      if (selected.length > 0) {
        currentId = selected[0].id;
      }
    }

    if (level > this.maxLevel) {
      this.maxLevel = level;
      this.entryPointId = entry.id;
    }
  }

  /**
   * Remove a vector from the index.
   */
  remove(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Collect all orphaned neighbors that need reconnection
    for (const [level, neighborIds] of node.neighbors) {
      for (const neighborId of neighborIds) {
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;
        const conns = neighbor.neighbors.get(level) || [];
        neighbor.neighbors.set(level, conns.filter(nid => nid !== id));
      }

      // Reconnect orphaned neighbors to each other to prevent graph islands
      if (neighborIds.length >= 2) {
        for (let i = 0; i < neighborIds.length; i++) {
          for (let j = i + 1; j < neighborIds.length; j++) {
            const nA = this.nodes.get(neighborIds[i]);
            const nB = this.nodes.get(neighborIds[j]);
            if (!nA || !nB) continue;
            const connsA = nA.neighbors.get(level) || [];
            const connsB = nB.neighbors.get(level) || [];
            const maxConn = level === 0 ? this.mMax0 : this.m;
            if (!connsA.includes(neighborIds[j]) && connsA.length < maxConn) {
              connsA.push(neighborIds[j]);
              nA.neighbors.set(level, connsA);
            }
            if (!connsB.includes(neighborIds[i]) && connsB.length < maxConn) {
              connsB.push(neighborIds[i]);
              nB.neighbors.set(level, connsB);
            }
          }
        }
      }
    }

    this.nodes.delete(id);

    // Pick the most-connected node as new entry point (not arbitrary)
    if (this.entryPointId === id) {
      if (this.nodes.size === 0) {
        this.entryPointId = null;
        this.maxLevel = 0;
      } else {
        let bestId: string | null = null;
        let bestConns = -1;
        for (const [nid, n] of this.nodes) {
          let totalConns = 0;
          for (const neighbors of n.neighbors.values()) {
            totalConns += neighbors.length;
          }
          if (totalConns > bestConns) {
            bestConns = totalConns;
            bestId = nid;
          }
        }
        this.entryPointId = bestId;
      }
    }

    return true;
  }

  /**
   * Search for k nearest neighbors.
   */
  search(query: Float32Array, k: number = 10): VectorSearchResult[] {
    if (!this.entryPointId || this.nodes.size === 0) return [];

    const queryVec = query.length > this.dimensions
      ? query.slice(0, this.dimensions)
      : query;

    let currentId = this.entryPointId;

    // Traverse from top level to level 1
    for (let l = this.maxLevel; l > 0; l--) {
      currentId = this.greedySearch(queryVec, currentId, l);
    }

    // Search at level 0
    const candidates = this.searchLayer(queryVec, currentId, Math.max(this.efSearch, k), 0);

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(c => ({
        id: c.id,
        score: c.score,
        metadata: this.nodes.get(c.id)?.metadata,
      }));
  }

  /**
   * Matryoshka funnel search: fast coarse search at low dim, re-rank at full dim.
   * Uses Matryoshka Representation Learning for cascading precision.
   */
  searchMatryoshka(
    queryFull: Float32Array,
    k: number = 10,
    candidateMultiplier: number = 5
  ): VectorSearchResult[] {
    if (this.matryoshkaDims.length <= 1) {
      return this.search(queryFull, k);
    }

    // Stage 1: Coarse search at smallest dimension
    const coarseDim = this.matryoshkaDims[0];
    const coarseQuery = queryFull.slice(0, coarseDim);
    const coarseK = k * candidateMultiplier;

    // Brute-force at reduced dimension for shortlist
    const shortlist: VectorSearchResult[] = [];
    for (const [id, node] of this.nodes) {
      const truncatedVec = node.vector.slice(0, coarseDim);
      const score = this.cosineSimilarity(coarseQuery, truncatedVec);
      shortlist.push({ id, score, metadata: node.metadata });
    }
    shortlist.sort((a, b) => b.score - a.score);
    const candidates = shortlist.slice(0, coarseK);

    // Stage 2: Re-rank at full dimension
    const reranked = candidates.map(c => {
      const node = this.nodes.get(c.id)!;
      const score = this.cosineSimilarity(queryFull.slice(0, this.dimensions), node.vector);
      return { id: c.id, score, metadata: c.metadata };
    });

    return reranked.sort((a, b) => b.score - a.score).slice(0, k);
  }

  /**
   * Export the entire index for persistence (e.g., IndexedDB).
   */
  exportIndex(): string {
    const data = {
      dimensions: this.dimensions,
      entryPointId: this.entryPointId,
      maxLevel: this.maxLevel,
      nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
        id,
        vector: Array.from(node.vector),
        metadata: node.metadata,
        neighbors: Array.from(node.neighbors.entries()),
      })),
    };
    return JSON.stringify(data);
  }

  /**
   * Import a previously exported index.
   */
  importIndex(data: string): void {
    const parsed = JSON.parse(data);
    this.nodes.clear();
    this.entryPointId = parsed.entryPointId;
    this.maxLevel = parsed.maxLevel;

    for (const entry of parsed.nodes) {
      const node: HNSWNode = {
        id: entry.id,
        vector: new Float32Array(entry.vector),
        metadata: entry.metadata,
        neighbors: new Map(entry.neighbors),
      };
      this.nodes.set(entry.id, node);
    }
  }

  get size(): number {
    return this.nodes.size;
  }

  // --- Private HNSW helpers ---

  private getRandomLevel(): number {
    let level = 0;
    while (Math.random() < (1 / this.m) && level < 16) {
      level++;
    }
    return level;
  }

  private greedySearch(query: Float32Array, startId: string, level: number): string {
    let bestId = startId;
    let bestDist = this.cosineSimilarity(query, this.nodes.get(startId)!.vector);
    let improved = true;

    while (improved) {
      improved = false;
      const neighbors = this.nodes.get(bestId)?.neighbors.get(level) || [];
      for (const neighborId of neighbors) {
        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;
        const dist = this.cosineSimilarity(query, neighborNode.vector);
        if (dist > bestDist) {
          bestDist = dist;
          bestId = neighborId;
          improved = true;
        }
      }
    }

    return bestId;
  }

  private searchLayer(
    query: Float32Array,
    startId: string,
    ef: number,
    level: number
  ): Array<{ id: string; score: number }> {
    const visited = new Set<string>();
    const candidates: Array<{ id: string; score: number }> = [];
    const results: Array<{ id: string; score: number }> = [];

    const startScore = this.cosineSimilarity(query, this.nodes.get(startId)!.vector);
    candidates.push({ id: startId, score: startScore });
    results.push({ id: startId, score: startScore });
    visited.add(startId);

    while (candidates.length > 0) {
      // Get best candidate
      candidates.sort((a, b) => b.score - a.score);
      const current = candidates.shift()!;

      // Get worst result
      const worstResult = results[results.length - 1];
      if (results.length >= ef && current.score < worstResult.score) break;

      const neighbors = this.nodes.get(current.id)?.neighbors.get(level) || [];
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const score = this.cosineSimilarity(query, neighborNode.vector);
        const worst = results.length >= ef ? results[results.length - 1].score : -Infinity;

        if (results.length < ef || score > worst) {
          candidates.push({ id: neighborId, score });
          results.push({ id: neighborId, score });
          results.sort((a, b) => b.score - a.score);
          if (results.length > ef) results.pop();
        }
      }
    }

    return results;
  }

  private selectNeighbors(
    query: Float32Array,
    candidates: Array<{ id: string; score: number }>,
    maxConn: number
  ): Array<{ id: string; score: number }> {
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, maxConn);
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    const len = Math.min(a.length, b.length);
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
