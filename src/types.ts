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
