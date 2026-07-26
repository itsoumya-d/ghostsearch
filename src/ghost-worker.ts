// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

import { GhostSearchOptions, SearchOptions, SearchResult, GhostDocument } from './types';

export class GhostWorker<T extends GhostDocument> {
  private worker: Worker;
  private messageId = 0;
  private resolvers = new Map<number, { resolve: Function, reject: Function }>();

  constructor(options: GhostSearchOptions, workerUrl?: string) {
    // Default URL assumes worker script is available at /worker-script.js
    this.worker = new Worker(workerUrl || '/worker-script.js');
    this.worker.onmessage = this.handleMessage.bind(this);
    
    this.postMessage('init', { options });
  }

  private handleMessage(event: MessageEvent) {
    const { id, type, payload, error } = event.data;
    const resolver = this.resolvers.get(id);
    if (resolver) {
      if (type === 'error') {
        resolver.reject(new Error(error));
      } else {
        resolver.resolve(payload);
      }
      this.resolvers.delete(id);
    }
  }

  private postMessage(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.resolvers.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, payload });
    });
  }

  async addDocument(doc: T): Promise<void> {
    await this.postMessage('add', { doc });
  }

  async addDocuments(docs: T[]): Promise<void> {
    await this.postMessage('addDocuments', { docs });
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult<T>> {
    return this.postMessage('search', { query, options });
  }
}
