import { GhostSearch } from './ghost-search';
import { GhostSearchOptions, GhostDocument } from './types';
import * as fs from 'fs';

export class IndexBuilder {
  static build<T extends GhostDocument>(docs: T[], options: GhostSearchOptions, outputPath: string): void {
    const engine = new GhostSearch<T>(options);
    engine.addDocuments(docs);
    const indexData = engine.exportIndex();
    fs.writeFileSync(outputPath, indexData, 'utf-8');
  }
}
