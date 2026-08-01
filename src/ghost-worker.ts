// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

import { GhostSearchOptions, SearchOptions, SearchResult, GhostDocument } from './types';

/** Milliseconds to wait for a worker reply before rejecting. */
export const DEFAULT_WORKER_TIMEOUT_MS = 30_000;

export class GhostWorker<T extends GhostDocument> {
  private worker: Worker;
  private messageId = 0;
  private resolvers = new Map<number, { resolve: Function, reject: Function, timer: any }>();
  private readonly timeoutMs: number;
  private failure: Error | null = null;

  constructor(options: GhostSearchOptions, workerUrl?: string, timeoutMs: number = DEFAULT_WORKER_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
    // Default URL assumes worker script is available at /worker-script.js
    const resolvedUrl = workerUrl || '/worker-script.js';
    this.worker = new Worker(resolvedUrl);
    this.worker.onmessage = this.handleMessage.bind(this);

    // Without these handlers a worker that fails to load (404, or a script error
    // inside the worker) never replies, so every pending promise — and every
    // later call — stayed pending forever, with no error and no timeout.
    this.worker.onerror = (event: any) => {
      this.fail(new Error(
        `GhostSearch: worker at "${resolvedUrl}" failed to load or threw: ` +
        `${(event && event.message) || 'unknown worker error'}`
      ));
    };
    (this.worker as any).onmessageerror = () => {
      this.fail(new Error('GhostSearch: worker message could not be deserialized'));
    };

    // The init handshake is fire-and-forget; swallow its rejection so it cannot
    // surface as an unhandled rejection. Real errors resurface on the next call.
    this.postMessage('init', { options }).catch(() => { /* latched in this.failure */ });
  }

  /** Reject everything outstanding and latch the failure for subsequent calls. */
  private fail(err: Error) {
    this.failure = err;
    for (const [id, r] of this.resolvers) {
      clearTimeout(r.timer);
      this.resolvers.delete(id);
      r.reject(err);
    }
  }

  private handleMessage(event: MessageEvent) {
    const { id, type, payload, error } = event.data;
    const resolver = this.resolvers.get(id);
    if (resolver) {
      clearTimeout(resolver.timer);
      this.resolvers.delete(id);
      if (type === 'error') {
        resolver.reject(new Error(error));
      } else {
        resolver.resolve(payload);
      }
    }
  }

  private postMessage(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.failure) {
        reject(this.failure);
        return;
      }
      const id = ++this.messageId;
      const timer = setTimeout(() => {
        this.resolvers.delete(id);
        reject(new Error(
          `GhostSearch: worker did not respond to "${type}" within ${this.timeoutMs}ms`
        ));
      }, this.timeoutMs);
      // Do not hold a Node event loop open purely for this timer.
      if (timer && typeof (timer as any).unref === 'function') {
        (timer as any).unref();
      }
      this.resolvers.set(id, { resolve, reject, timer });
      try {
        this.worker.postMessage({ id, type, payload });
      } catch (err: any) {
        clearTimeout(timer);
        this.resolvers.delete(id);
        reject(err);
      }
    });
  }

  /** Terminate the underlying worker and reject anything still pending. */
  dispose(): void {
    this.fail(new Error('GhostSearch: worker disposed'));
    this.worker.terminate();
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
