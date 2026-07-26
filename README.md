# 👻 GhostSearch — Client-Side Full-Text Search Engine

> **Sub-millisecond search. Zero server. Zero API calls. Zero cost. Replaces Algolia ($100K/mo).**

GhostSearch is a full-text search engine that runs **entirely in the user's browser**. There is no server, no API call, no network latency. Search results appear in **<1ms** — faster than any server-based search can ever be, because the speed of light is the bottleneck for network requests, and GhostSearch eliminates network requests entirely.

## How It Works

1. **Build Phase**: At deploy time, your documents are indexed into a compressed search index (~5MB per 100K documents)
2. **Runtime**: The index is downloaded once by the browser and cached by a ServiceWorker
3. **Search**: Every keystroke runs a local search query using FlexSearch (the fastest JS search engine) inside a Web Worker
4. **Result**: Sub-millisecond results with typo tolerance, fuzzy matching, faceted filtering, and relevance ranking

## Quick Start

```typescript
import { GhostSearch } from 'ghostsearch';

// Build the index (at deploy time or in browser)
const ghost = new GhostSearch();
ghost.addDocuments([
  { id: '1', title: 'iPhone 15 Pro', category: 'Electronics', price: 999 },
  { id: '2', title: 'MacBook Air M3', category: 'Laptops', price: 1299 },
  // ... 100,000 documents
]);

// Search (runs in <1ms, in the browser, offline)
const results = ghost.search('macbok', {
  fuzzy: true,       // Handles typos
  limit: 20,         // Top 20 results
  facets: ['category'], // Faceted filtering
});
```

## License

AGPL-3.0 (Open Source) | Commercial License available

📧 soumyadebnath1661@gmail.com | 📞 +91 7031648617
