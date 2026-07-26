// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

export interface GhostSearchOptions {
  fields: string[];
  boost?: Record<string, number>;
  tokenize?: 'full' | 'forward' | 'reverse' | 'strict';
  fuzzy?: boolean | number;
  cache?: boolean | number;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  fuzzy?: boolean | number;
  facets?: string[];
  filters?: Record<string, any>;
  highlight?: boolean;
  highlightTag?: string;
}

export interface SearchResult<T> {
  hits: Array<{
    id: string;
    document: T;
    score: number;
    highlights?: Record<string, string>;
  }>;
  totalHits: number;
  facets?: Record<string, Record<string, number>>;
  queryTimeMs: number;
}

export interface GhostDocument {
  id: string;
  [key: string]: any;
}
