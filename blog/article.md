---
title: "Why We Built GhostSearch: The End of $50,000/Year Search Bills"
description: "A first-principles breakdown of when cloud SaaS search is worth paying for, when client-side search replaces it, and the measured limits of running an index in the browser."
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

GhostSearch flips this model. It builds a FlexSearch inverted index — and optionally a vector
index — *on the client*, in plain JavaScript, with an optional Web Worker to keep index
construction off the UI thread. (There is no WebAssembly in the implementation.) The search runs at
the speed of memory. The serving cost is $0.

## How GhostSearch Works: Client-Side Vector Search

To replace a $50K/year SaaS, we needed more than just a regex matcher. We needed semantic vector search. But running full Transformer models in the browser is heavy.

Our breakthrough was combining **Matryoshka embeddings** with highly optimized **Web Worker concurrency**.

Matryoshka representations let you truncate an embedding and keep most of its signal — *provided
the model was trained with an MRL objective*. That caveat matters here, and we want to be straight
about where the current build stands:

The shipped embedder is **not** a trained transformer. It is a deterministic FNV-1a feature hasher
over character n-grams, chosen so there is no model download. That makes it fast and offline, but it
measures spelling overlap rather than meaning: `mission`/`emission` score 0.92 cosine, while
`car`/`automobile` score below zero. It also means MRL truncation has no trained structure to
exploit — measured recall@10 on 1,000 documents is 0.52 for the 64d funnel versus 1.00 for a full
HNSW traversal. Truncation currently costs accuracy instead of buying speed.

Everything runs in plain JavaScript on the CPU. There is no WebGPU and no WASM SIMD in the
implementation. Plugging in a real ONNX/Transformers.js embedder is the obvious next step and is not
done yet.

| Feature | Algolia / Cloud SaaS | GhostSearch |
| :--- | :--- | :--- |
| Latency (P99) | 120ms (Network bound) | 0.16ms at 1k docs, 1.6ms at 10k, 45ms at 100k (CPU bound) |
| Cost for 1M searches/mo | $1,000+ | $0 serving cost (client compute); BSL 1.1 licence required for production |
| Offline Support | None | Native (PWA ready) |
| Vector Semantic Search | Premium Enterprise Tier | Included, but with a hash-based embedder (not a trained model) |
| Infrastructure Setup | API Keys, Webhooks, Syncing | Static JSON file |

## Integration Recipe for Developers & AI Agents

If you're building an app or instructing an AI coding assistant to implement search, here is the exact TypeScript code to drop in. No API keys, no server deployment.

```typescript
// GhostSearch is not on npm yet. Import from the CDN (an import map is required,
// because dist/index.mjs imports FlexSearch as a bare specifier) or build from source.
import { GhostSearch } from 'https://cdn.jsdelivr.net/gh/itsoumya-d/ghostsearch@main/dist/index.mjs';

// 1. Create the engine. `fields` lists the document keys to index.
const searchEngine = new GhostSearch({ fields: ['title', 'description', 'category'] });

// 2. Load your data. Each document needs a unique string `id`.
//    addDocuments() is synchronous — there is no ingest() method.
const catalog = await fetch('/data/catalog.json').then(r => r.json());
searchEngine.addDocuments(catalog);

// 3. Keyword search. search() is SYNCHRONOUS and returns
//    { hits, totalHits, queryTimeMs }.
const results = searchEngine.search('ergonomic mechanical keyboard', { limit: 10 });
console.log(results.hits);

// 4. Optional hybrid keyword + vector search. Must be enabled first, and unlike
//    search() these two are async.
await searchEngine.enableSemanticSearch({ dimensions: 384 });
const hybrid = await searchEngine.hybridSearch('ergonomic mechanical keyboard', {
  limit: 10,
  keywordWeight: 0.4,
  semanticWeight: 0.6,
});
console.log(hybrid.hits);
```

There is no `@ghostsearch/core` package, no `ingest()` method, and no `mode`, `vectorDimensions` or
`worker` constructor option. The full verified API surface is in the
[README](https://github.com/itsoumya-d/ghostsearch/blob/main/README.md#-api-reference).

## FAQ

### What if my dataset is massive (10GB+)?
In practice memory binds well before raw dataset size does. Measured heap is roughly 3.4–5.3 MB per
1,000 documents, so 100,000 documents costs 340–530 MB resident — fine on a desktop, hostile on a
low-end phone. Treat the low tens of thousands of documents as the comfortable range, and reach for a
server-side engine beyond that. For a multi-gigabyte corpus (searching all of Wikipedia), you still
need a server.

### Does this drain the user's battery?
Searching is cheap — sub-millisecond up to about 10,000 documents. Indexing is the expensive part,
and you should know two things. First, it runs on every page load: there is **no** IndexedDB
persistence in the library today, so nothing is cached between sessions — use `GhostWorker` to keep
that work off the UI thread. Second, it is not free: about 1.2 s for 10,000 documents and 12 s for
100,000 on a 2 vCPU machine. Memory is the real ceiling, at roughly 3.4–5.3 MB of heap per 1,000
documents depending on vocabulary size.

### Is it secure?
Since the index is loaded client-side, the user has access to all indexed data. Do not index private data that the current user shouldn't see. For user-specific data, GhostSearch is perfect—you just fetch their specific slice of data and index it locally.

The era of paying rent on your own data is ending. Client-side compute is the new frontier of web performance. Welcome to the zero-server future.
