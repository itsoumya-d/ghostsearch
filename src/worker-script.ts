// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

import { GhostSearch } from './ghost-search';
import { GhostDocument } from './types';

let searchEngine: GhostSearch<GhostDocument> | null = null;

self.onmessage = (event: MessageEvent) => {
  const { id, type, payload } = event.data;

  try {
    let result;
    switch (type) {
      case 'init':
        searchEngine = new GhostSearch<GhostDocument>(payload.options);
        break;
      case 'add':
        searchEngine?.addDocument(payload.doc);
        break;
      case 'addDocuments':
        searchEngine?.addDocuments(payload.docs);
        break;
      case 'search':
        result = searchEngine?.search(payload.query, payload.options);
        break;
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
    
    self.postMessage({ id, type: 'success', payload: result });
  } catch (error: any) {
    self.postMessage({ id, type: 'error', error: error.message });
  }
};
