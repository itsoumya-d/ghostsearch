interface GhostSearchOptions {
    fields: string[];
    boost?: Record<string, number>;
    tokenize?: 'full' | 'forward' | 'reverse' | 'strict';
    fuzzy?: boolean | number;
    cache?: boolean | number;
}
interface SearchOptions {
    /**
     * Optional. `search(query, options)` already takes the query as its first
     * positional argument, so this field is redundant there. Declaring it as
     * required made every documented `search()` call a TS2345 compile error for
     * TypeScript consumers, and broke `tsc --noEmit` inside this repo too.
     */
    query?: string;
    limit?: number;
    offset?: number;
    fuzzy?: boolean | number;
    facets?: string[];
    filters?: Record<string, any>;
    highlight?: boolean;
    highlightTag?: string;
}
interface SearchResult<T> {
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
interface GhostDocument {
    id: string;
    [key: string]: any;
}

export type { GhostDocument as G, SearchOptions as S, GhostSearchOptions as a, SearchResult as b };
