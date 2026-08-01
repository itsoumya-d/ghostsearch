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

// ---------------------------------------------------------------------------
// Regression guards added during an external audit. Each of these reproduced a
// real failure before the accompanying fix; they exist to stop it coming back.
// ---------------------------------------------------------------------------
describe('regression: highlight must not compile the query as a regex', () => {
  const hdocs = [{ id: '1', title: 'Buy the new apple iPhone today', content: 'apple (fruit)' }];
  const hs = () => { const s = new GhostSearch({ fields: ['title', 'content'] }); s.addDocuments(hdocs); return s; };

  // `new RegExp('(' + term + ')')` threw SyntaxError for any query containing
  // unbalanced regex metacharacters, so a user typing "a)" broke search entirely.
  for (const q of ['a)', '((((((((((a', 'a{2,', '[', '\\', 'app*le', 'f(x)', '?', '+', '|']) {
    test(`query ${JSON.stringify(q)} does not throw with highlight:true`, () => {
      assert.doesNotThrow(() => hs().search(q, { highlight: true }));
    });
  }
  test('highlighting still wraps matches in the requested tag', () => {
    const h = hs().search('apple', { highlight: true, highlightTag: 'strong' }).hits[0].highlights;
    assert.match(h.title, /<strong>apple<\/strong>/i);
  });
  test('highlightTag cannot inject markup', () => {
    const h = hs().search('apple', { highlight: true, highlightTag: 'script>alert(1)</script' }).hits[0].highlights;
    assert.ok(!h.title.includes('<script>'), 'must fall back to a safe tag');
    assert.match(h.title, /<mark>apple<\/mark>/i);
  });
});

describe('regression: SearchOptions.query must stay optional', () => {
  // Declaring it required made every documented search() call a TS2345 error.
  test('search(query, options) works without repeating the query', () => {
    const s = new GhostSearch({ fields: ['title'] });
    s.addDocuments([{ id: '1', title: 'machine learning' }]);
    assert.equal(s.search('machine', { limit: 5 }).hits.length, 1);
    assert.deepEqual(s.suggest('machine'), ['machine learning']);
  });
});

describe('regression: VectorIndex survives interleaved add/remove', () => {
  const D = 8;
  const rv = seed => { let x = seed; const v = new Float32Array(D);
    for (let i = 0; i < D; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; v[i] = (x / 0x7fffffff) * 2 - 1; }
    return v; };

  // Neighbour lists become asymmetric once pruning runs, so remove() can leave a
  // reference to a deleted node. add() then dereferenced it via a `!` assertion
  // and threw "Cannot read properties of undefined (reading 'vector')".
  for (const N of [60, 100, 200]) {
    test(`add ${N}, remove half, add again`, () => {
      const idx = new VectorIndex({ dimensions: D });
      for (let i = 0; i < N; i++) idx.add({ id: 'n' + i, vector: rv(i + 1) });
      for (let i = 0; i < N / 2; i++) idx.remove('n' + i);
      assert.doesNotThrow(() => idx.add({ id: 'later', vector: rv(999) }));
      assert.ok(idx.search(rv(7), 5).length > 0);
    });
  }
  test('search and remove are safe on an empty index', () => {
    const idx = new VectorIndex({ dimensions: D });
    assert.deepEqual(idx.search(rv(1), 5), []);
    assert.equal(idx.remove('nope'), false);
  });
});

describe('regression: vector indexing errors never escape as unhandled rejections', () => {
  test('removeDocument then addDocument stays stable and is awaitable', async () => {
    const s = new GhostSearch({ fields: ['title'] });
    await s.enableSemanticSearch({ dimensions: 64 });
    for (let i = 0; i < 120; i++) s.addDocument({ id: 'd' + i, title: 'document ' + i + ' topic ' + (i % 7) });
    await s.whenIndexed();
    assert.equal(s.vectorIndexSize, 120, 'whenIndexed() must flush pending vector writes');
    for (let i = 0; i < 60; i++) s.removeDocument('d' + i);
    s.addDocument({ id: 'later', title: 'a new document about topic 3' });
    await s.whenIndexed();
    assert.equal(s.documentCount, 61);
    assert.equal(s.vectorIndexSize, 61);
  });
});
