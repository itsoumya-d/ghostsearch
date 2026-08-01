// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1619@gmail.com | +91 7031648617

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
