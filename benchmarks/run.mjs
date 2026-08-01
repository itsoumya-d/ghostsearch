/**
 * GhostSearch benchmark harness.
 * Generates the numbers published in README.md. Re-run with: npm run bench
 * Reports the host it ran on — numbers are hardware-dependent and must never
 * be quoted without that context.
 */
import { GhostSearch } from '../dist/index.mjs';
import os from 'node:os';

const WORDS = ('machine learning optimization neural network gradient descent vector database search '
  + 'index query latency browser offline worker cache token embedding semantic keyword hybrid ranking '
  + 'cluster shard replica throughput compression serialization').split(' ');
const rnd = (n, seed) => { let s = seed; const out = []; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; out.push(WORDS[s % WORDS.length]); } return out.join(' '); };
const makeDocs = n => Array.from({ length: n }, (_, i) => ({ id: String(i), title: rnd(6, i + 1), content: rnd(28, i + 977) }));

const mb = b => (b / 1024 / 1024);
function measure(label, docs, queries) {
  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  const s = new GhostSearch({ fields: ['title', 'content'] });
  s.addDocuments(docs);
  const indexMs = performance.now() - t0;
  if (global.gc) global.gc();
  const heapMb = mb(process.memoryUsage().heapUsed - before);

  const timeQueries = (opts) => {
    for (let i = 0; i < 50; i++) s.search(queries[i % queries.length], opts);  // warm up
    const runs = [];
    for (let i = 0; i < 500; i++) { const q = queries[i % queries.length]; const a = performance.now(); s.search(q, opts); runs.push(performance.now() - a); }
    runs.sort((x, y) => x - y);
    return { median: runs[Math.floor(runs.length / 2)], p95: runs[Math.floor(runs.length * 0.95)] };
  };
  const exact = timeQueries({ limit: 20 });
  const fuzzy = timeQueries({ limit: 20, fuzzy: true });
  s.dispose?.();
  return { label, docs: docs.length, indexMs, heapMb, exact, fuzzy };
}

const queries = ['machine learning', 'vector database', 'gradient', 'browser offline cache', 'semantic ranking'];
const sizes = [1_000, 10_000, 50_000, 100_000];
console.log(`\nGhostSearch benchmark`);
console.log(`host: ${os.cpus()[0].model.trim()} | ${os.cpus().length} vCPU | node ${process.version} | ${os.platform()}-${os.arch()}`);
console.log(`method: median and p95 of 500 timed queries after 50 warm-up runs\n`);
const rows = sizes.map(n => measure(n, makeDocs(n), queries));
console.log('| Documents | Index time | Heap used | Query p50 (exact) | Query p95 (exact) | Query p50 (fuzzy) |');
console.log('|-----------|------------|-----------|-------------------|-------------------|-------------------|');
for (const r of rows) {
  console.log(`| ${r.docs.toLocaleString()} | ${r.indexMs.toFixed(0)} ms | ${r.heapMb.toFixed(1)} MB | ${r.exact.median.toFixed(3)} ms | ${r.exact.p95.toFixed(3)} ms | ${r.fuzzy.median.toFixed(3)} ms |`);
}
console.log('');
