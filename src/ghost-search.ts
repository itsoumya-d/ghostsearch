import { GhostSearchOptions, SearchOptions, SearchResult, GhostDocument } from './types';
import { SearchEngine } from './search-engine';

export class GhostSearch<T extends GhostDocument> {
  private engine: SearchEngine<T>;

  constructor(options: GhostSearchOptions) {
    this.engine = new SearchEngine<T>(options);
  }

  addDocument(doc: T): void {
    this.engine.add(doc);
  }

  addDocuments(docs: T[]): void {
    for (const doc of docs) {
      this.engine.add(doc);
    }
  }

  removeDocument(id: string): void {
    this.engine.remove(id);
  }

  updateDocument(doc: T): void {
    this.engine.update(doc);
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

  get documentCount(): number {
    return this.engine.count;
  }

  clear(): void {
    this.engine.clear();
  }
}
