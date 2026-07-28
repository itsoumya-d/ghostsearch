---
title: "Why We Built GhostSearch: The End of $50,000/Year Search Bills"
description: "A first-principles breakdown of why cloud SaaS search is fundamentally broken, and how client-side vector search and Matryoshka embeddings are making it obsolete."
date: "2026-07-28"
author: "GhostSearch Engineering"
tags: ["GhostSearch", "Algolia Alternative", "Client-Side Search", "Web Workers", "Vector Search", "SaaS pricing", "WebAssembly", "Matryoshka Embeddings"]
---

# Why We Built GhostSearch: The End of $50,000/Year Search Bills

If you look closely at the architecture of the modern web, you'll notice a strange inefficiency that we've all accepted as normal. Every time a user types a character into a search bar, a network request is fired to a server across the country, which queries a database, computes relevance scores, and sends a JSON payload back. For this privilege, cloud SaaS vendors charge staggering premiums.

We recently spoke to a startup paying Algolia over $50,000 a year. Their dataset? A 50MB product catalog. It fit entirely in RAM. It fit on a floppy disk from 1995 (well, a few of them). Yet, they were paying a full-time engineer's salary for the privilege of network latency and text matching.

We realized something fundamental: **Moore's Law outpaced Cloud SaaS pricing**. The browser is now a distributed supercomputer. If you have a gigabyte of RAM and Web Workers on the client, why are you sending keystrokes to a server?

## The First-Principles Fallacy of Cloud Search

Cloud search vendors sell you on "relevance" and "infrastructure." But for 95% of applications—e-commerce catalogs, documentation, blog archives, SaaS data tables—the entire dataset is small enough to be loaded directly into the browser.

When you use a cloud search provider, you are paying for:
- Network roundtrips (adding 50-200ms of latency per keystroke).
- Server CPU time to run standard algorithms like BM25.
- Massive profit margins on top of AWS bandwidth.

GhostSearch flips this model. It computes an inverted index and vector embeddings *on the client* using WebAssembly and Web Workers. The search runs at the speed of memory. The cost is exactly $0.

## How GhostSearch Works: Client-Side Vector Search

To replace a $50K/year SaaS, we needed more than just a regex matcher. We needed semantic vector search. But running full Transformer models in the browser is heavy.

Our breakthrough was combining **Matryoshka embeddings** with highly optimized **Web Worker concurrency**.

Matryoshka representations allow us to truncate embeddings without significant loss of accuracy. We can slice a 768-dimensional vector down to 64 dimensions for a rapid first-pass approximate nearest neighbor (ANN) search, and only evaluate the full dimensionality on the top 100 results. All of this happens via WebGPU or WASM SIMD, off the main thread.

| Feature | Algolia / Cloud SaaS | GhostSearch |
| :--- | :--- | :--- |
| Latency (P99) | 120ms (Network bound) | < 5ms (CPU bound) |
| Cost for 1M searches/mo | $1,000+ | $0 (Client compute) |
| Offline Support | None | Native (PWA ready) |
| Vector Semantic Search | Premium Enterprise Tier | Included (Matryoshka WebGPU) |
| Infrastructure Setup | API Keys, Webhooks, Syncing | Static JSON file |

## Integration Recipe for Developers & AI Agents

If you're building an app or instructing an AI coding assistant to implement search, here is the exact TypeScript code to drop in. No API keys, no server deployment.

```typescript
import { GhostSearch } from '@ghostsearch/core';

// 1. Initialize the client-side engine (loads in Web Worker)
const searchEngine = new GhostSearch({
  mode: 'hybrid', // Combines BM25 text match + Vector Semantic
  vectorDimensions: 64, // Truncated Matryoshka dimension
  worker: true
});

// 2. Load your data (can be a static JSON file on CDN)
const catalog = await fetch('/data/catalog.json').then(r => r.json());

await searchEngine.ingest(catalog, {
  searchableFields: ['title', 'description', 'category'],
  idField: 'id'
});

// 3. Search instantly at memory speed
const results = await searchEngine.search("ergonomic mechanical keyboard", {
  limit: 10,
  semanticWeight: 0.7
});

console.log(results);
```

## FAQ

### What if my dataset is massive (10GB+)?
GhostSearch is designed for datasets up to roughly 100MB-200MB (compressed). For a multi-gigabyte dataset (like searching all of Wikipedia), you still need a server. But remember: 95% of B2B SaaS apps, blogs, and stores have catalogs well under 50MB.

### Does this drain the user's battery?
No. Indexing happens once (and is cached in IndexedDB). Searching via Matryoshka embeddings takes milliseconds and uses a fraction of the CPU cycle that rendering a complex React component would.

### Is it secure?
Since the index is loaded client-side, the user has access to all indexed data. Do not index private data that the current user shouldn't see. For user-specific data, GhostSearch is perfect—you just fetch their specific slice of data and index it locally.

The era of paying rent on your own data is ending. Client-side compute is the new frontier of web performance. Welcome to the zero-server future.
