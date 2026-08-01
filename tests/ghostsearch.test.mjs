import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GhostSearch, VectorIndex, EmbeddingEngine } from '../dist/index.mjs';

const docs = [
  { id: '1', title: 'Machine learning basics',  content: 'neural networks and gradient descent' },
  { id: '2', title: 'Cooking pasta',            content: 'boil water add salt and olive oil' },
  { id: '3', title: 'Optimization methods',     content: 'machine learning optimization techniques' },
  { id: '4', title: 'Gardening in spring',      content: 'planting tomatoes and watering soil' },
];
const mk = () => { const s = new GhostSearch({ fields: ['title', 'content'] }); s.addDocuments(docs); return s; };

describe('module surface', () => {
  test('ESM entry exposes the documented classes', () => {
    for (const C of [GhostSearch, VectorIndex, EmbeddingEngine]) assert.equal(typeof C, 'function');
  });
  // Regression guard: flexsearch 0.7.x is CJS. A named `import { Document }`
  // used to throw "Named export 'Document' not found" for every ESM consumer.
  test('ESM entry imports without CJS interop error', async () => {
    const m = await import('../dist/index.mjs');
    assert.ok(m.GhostSearch, 'ESM entry must load cleanly');
  });
});

describe('indexing and search', () => {
  test('addDocuments then search returns matching hits', () => {
    const r = mk().search('machine learning');
    assert.ok(r.hits.length > 0);
    assert.ok(r.hits.every(h => h.id && h.document));
  });
  test('search reports totalHits and a numeric queryTimeMs', () => {
    const r = mk().search('machine');
    assert.equal(typeof r.totalHits, 'number');
    assert.equal(typeof r.queryTimeMs, 'number');
    assert.ok(r.queryTimeMs >= 0);
  });
  test('irrelevant query returns no hits', () => {
    assert.equal(mk().search('quantum chromodynamics').hits.length, 0);
  });
  test('limit option is respected', () => {
    assert.ok(mk().search('machine', { limit: 1 }).hits.length <= 1);
  });
  test('documentCount reflects added docs', () => assert.equal(mk().documentCount, docs.length));
  test('removeDocument drops it from results', () => {
    const s = mk(); s.removeDocument('2');
    assert.equal(s.search('pasta').hits.length, 0);
  });
  test('empty query does not throw', () => assert.doesNotThrow(() => mk().search('')));
});

describe('index portability', () => {
  test('exportIndex/importIndex round-trips', () => {
    const s2 = new GhostSearch({ fields: ['title', 'content'] });
    s2.importIndex(mk().exportIndex());
    assert.ok(s2.search('pasta').hits.length > 0);
  });
  test('exportIndex emits parseable JSON', () => {
    assert.doesNotThrow(() => JSON.parse(mk().exportIndex()));
  });
});

describe('semantic + hybrid search', () => {
  test('semanticSearch before enable throws a clear, actionable error', async () => {
    await assert.rejects(() => mk().semanticSearch({ query: 'x' }), /enableSemanticSearch/);
  });
  test('enableSemanticSearch then hybridSearch returns scored hits', async () => {
    const s = mk();
    await s.enableSemanticSearch({ dimensions: 384, matryoshkaDims: [64, 256, 384] });
    assert.equal(s.isSemanticEnabled, true);
    const r = await s.hybridSearch('machine learning optimization');
    assert.ok(r.hits.length > 0);
    assert.ok(r.hits.every(h => typeof h.score === 'number'));
  });
  test('hybrid scores are sorted descending', async () => {
    const s = mk(); await s.enableSemanticSearch({ dimensions: 384 });
    const sc = (await s.hybridSearch('machine learning')).hits.map(h => h.score);
    assert.deepEqual(sc, [...sc].sort((a, b) => b - a));
  });
});

describe('adversarial / resilience', () => {
  test('constructing with zero documents is safe', () => {
    assert.equal(new GhostSearch({ fields: ['title'] }).search('anything').hits.length, 0);
  });
  test('malformed importIndex throws rather than corrupting state', () => {
    assert.throws(() => new GhostSearch({ fields: ['title'] }).importIndex('{not json'));
  });
  test('documents missing an indexed field do not crash search', () => {
    const s = new GhostSearch({ fields: ['title', 'content'] });
    s.addDocuments([{ id: 'x', title: 'only a title' }]);
    assert.doesNotThrow(() => s.search('title'));
  });
  test('clear() empties the index', () => { const s = mk(); s.clear(); assert.equal(s.documentCount, 0); });
  test('dispose() releases semantic resources', async () => {
    const s = mk(); await s.enableSemanticSearch({ dimensions: 64 });
    s.dispose(); assert.equal(s.isSemanticEnabled, false);
  });
});
