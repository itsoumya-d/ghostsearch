import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GhostSearch } from '../dist/index.mjs';

const makeCatalog = () => {
  const search = new GhostSearch({ fields: ['title'] });
  search.addDocuments(Array.from({ length: 30 }, (_, i) => ({
    id: String(i),
    title: `Notebook ${i}`,
    category: i < 24 ? 'archived' : 'available',
    color: i % 2 === 0 ? 'blue' : 'green',
  })));
  return search;
};

describe('full-text pagination uses the complete matching set', () => {
  test('default and small pages report the same full total and facets', () => {
    const search = makeCatalog();
    for (const limit of [undefined, 1, 7]) {
      const result = search.search('notebook', { limit, facets: ['category'] });
      assert.equal(result.hits.length, limit ?? 20);
      assert.equal(result.totalHits, 30);
      assert.deepEqual(result.facets, { category: { archived: 24, available: 6 } });
    }
  });

  test('filters find documents beyond the unfiltered page boundary', () => {
    const result = makeCatalog().search('notebook', {
      limit: 2,
      filters: { category: 'available' },
      facets: ['color'],
    });
    assert.deepEqual(result.hits.map(hit => hit.id), ['24', '25']);
    assert.equal(result.totalHits, 6);
    assert.deepEqual(result.facets, { color: { blue: 3, green: 3 } });
  });

  test('offset is applied after filtering without skipping matching pages', () => {
    const search = makeCatalog();
    const ids = [];
    for (let offset = 0; offset <= 6; offset += 2) {
      const result = search.search('notebook', {
        limit: 2,
        offset,
        filters: { category: 'available' },
        facets: ['category'],
      });
      ids.push(...result.hits.map(hit => hit.id));
      assert.equal(result.hits.length, offset < 6 ? 2 : 0);
      assert.equal(result.totalHits, 6);
      assert.deepEqual(result.facets, { category: { available: 6 } });
    }
    assert.deepEqual(ids, ['24', '25', '26', '27', '28', '29']);
  });

  test('scores every matching field before selecting the first page', () => {
    const search = new GhostSearch({ fields: ['title', 'content'], boost: { title: 2 } });
    search.addDocuments([
      { id: 'title-only', title: 'notebook', content: 'paper' },
      { id: 'content-only', title: 'paper', content: 'notebook' },
      { id: 'both', title: 'notebook', content: 'notebook' },
    ]);
    const first = search.search('notebook', { limit: 1 });
    assert.deepEqual(first.hits.map(hit => [hit.id, hit.score]), [['both', 3]]);
    assert.equal(first.totalHits, 3);
    const second = search.search('notebook', { limit: 1, offset: 1 });
    assert.deepEqual(second.hits.map(hit => [hit.id, hit.score]), [['title-only', 2]]);
    assert.equal(second.totalHits, 3);
  });

  test('empty indexes and filters with no matches retain empty results', () => {
    const empty = new GhostSearch({ fields: ['title'] }).search('notebook', { limit: 1 });
    assert.deepEqual(empty.hits, []);
    assert.equal(empty.totalHits, 0);
    const filtered = makeCatalog().search('notebook', {
      limit: 1,
      filters: { category: 'missing' },
      facets: ['category'],
    });
    assert.deepEqual(filtered.hits, []);
    assert.equal(filtered.totalHits, 0);
    assert.deepEqual(filtered.facets, { category: {} });
  });
});
