// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

// flexsearch 0.7.x is CommonJS and exposes no named ESM exports. Importing
// `{ Document }` directly breaks every ESM consumer (Node ESM, SSR, Next.js)
// with "Named export 'Document' not found". Default-import the module object
// and read the constructor off it — works under both CJS and ESM.
import FlexSearchModule from 'flexsearch';

const FlexSearch: any = (FlexSearchModule as any)?.default ?? FlexSearchModule;
const Document: any = FlexSearch.Document;
import { GhostSearchOptions, SearchOptions, SearchResult, GhostDocument } from './types';
import { highlightText } from './highlighter';

export class SearchEngine<T extends GhostDocument> {
  private index: any;
  private documents: Map<string, T> = new Map();
  private options: GhostSearchOptions;

  constructor(options: GhostSearchOptions) {
    this.options = options;
    this.initIndex();
  }

  private initIndex() {
    const documentOptions: any = {
      id: 'id',
      index: this.options.fields,
      tokenize: this.options.tokenize || 'forward',
      cache: this.options.cache || false
    };

    this.index = new Document(documentOptions);
  }

  add(doc: T): void {
    this.documents.set(doc.id, doc);
    this.index.add(doc);
  }

  remove(id: string): void {
    this.documents.delete(id);
    this.index.remove(id);
  }

  update(doc: T): void {
    this.add(doc);
  }

  search(query: string, options?: SearchOptions): SearchResult<T> {
    const start = performance.now();
    const opts = options || { query };
    const limit = opts.limit || 20;
    const offset = opts.offset || 0;
    
    // FlexSearch document search
    const results = this.index.search(query, {
      limit: limit + offset,
      suggest: opts.fuzzy ? true : false,
    });
    
    // Aggregate results
    const idMap = new Map<string, number>();
    for (const fieldResult of results) {
      const field = fieldResult.field;
      const boost = this.options.boost && this.options.boost[field] ? this.options.boost[field] : 1;
      
      for (const id of fieldResult.result) {
        idMap.set(id, (idMap.get(id) || 0) + boost);
      }
    }

    // Sort by score
    const sortedIds = Array.from(idMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
    
    // Apply filters if any (simple implementation)
    let filteredIds = sortedIds;
    if (opts.filters) {
      filteredIds = sortedIds.filter(id => {
        const doc = this.documents.get(id);
        if (!doc) return false;
        for (const [key, value] of Object.entries(opts.filters!)) {
          if (doc[key] !== value) return false;
        }
        return true;
      });
    }

    // Facets computation
    let facets: Record<string, Record<string, number>> | undefined;
    if (opts.facets && opts.facets.length > 0) {
      facets = {};
      for (const field of opts.facets) {
        facets[field] = {};
        for (const id of filteredIds) {
          const doc = this.documents.get(id);
          if (doc && doc[field] !== undefined) {
            const val = String(doc[field]);
            facets[field][val] = (facets[field][val] || 0) + 1;
          }
        }
      }
    }

    const paginatedIds = filteredIds.slice(offset, offset + limit);
    
    const hits = paginatedIds.map(id => {
      const document = this.documents.get(id)!;
      const score = idMap.get(id)!;
      // Explicitly typed: inferring `{}` made the index assignment below a
      // TS7053 implicit-any error, which broke `npm run typecheck`.
      let highlights: Record<string, string> | undefined = undefined;

      if (opts.highlight) {
        highlights = {};
        for (const field of this.options.fields) {
          if (typeof document[field] === 'string') {
            highlights[field] = highlightText(document[field], query, opts.highlightTag || 'mark');
          }
        }
      }
      
      return { id, document, score, highlights };
    });

    const end = performance.now();
    
    return {
      hits,
      totalHits: filteredIds.length,
      facets,
      queryTimeMs: end - start
    };
  }

  suggest(query: string, limit: number = 5): string[] {
    const results = this.search(query, { query, limit });
    const suggestions = results.hits
      .map(hit => {
        const doc = hit.document as any;
        return doc.title || doc.name || doc[this.options.fields[0]];
      })
      .filter(val => typeof val === 'string');
      
    return Array.from(new Set(suggestions)).slice(0, limit);
  }

  get count(): number {
    return this.documents.size;
  }

  clear(): void {
    this.documents.clear();
    this.initIndex();
  }

  export(): string {
    const data = { documents: Array.from(this.documents.entries()) };
    return JSON.stringify(data);
  }

  import(data: string): void {
    const parsed = JSON.parse(data);
    this.documents = new Map(parsed.documents);
    this.initIndex();
    for (const [_, doc] of this.documents) {
      this.index.add(doc);
    }
  }
}
