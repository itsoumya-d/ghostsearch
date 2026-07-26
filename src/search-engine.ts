import { Document } from 'flexsearch';
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
      let highlights = undefined;
      
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
    const results = this.index.search(query, { limit, suggest: true });
    // basic mock of suggest since flexsearch suggest returns docs
    return []; // For real suggest we need a specialized trie or dictionary
  }

  get count(): number {
    return this.documents.size;
  }

  clear(): void {
    this.documents.clear();
    this.initIndex();
  }

  export(): string {
    const data: any = { documents: Array.from(this.documents.entries()), indexData: {} };
    // FlexSearch async export workaround for sync need, might require tweaking
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
