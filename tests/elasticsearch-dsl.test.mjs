import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GhostSearch, parseElasticsearchDSL, formatQueryDSLSummary } from '../dist/index.mjs';

const sampleDocs = [
  { id: '1', title: 'Elasticsearch Architecture', content: 'Distributed search engine with Lucene indices and clusters', category: 'search', stars: 120 },
  { id: '2', title: 'Kubernetes Operator Design', content: 'Deploying cloud-native applications on container clusters', category: 'cloud', stars: 95 },
  { id: '3', title: 'Distributed Systems Testing', content: 'High availability, resilience, and consensus protocols in Go', category: 'systems', stars: 150 },
  { id: '4', title: 'Client-Side Search Benchmarks', content: 'In-memory inverted index retrieval without backend servers', category: 'search', stars: 80 },
];

const makeSearch = () => {
  const gs = new GhostSearch({ fields: ['title', 'content'] });
  gs.addDocuments(sampleDocs);
  return gs;
};

describe('Elasticsearch Query DSL Parser', () => {
  test('parses simple match query clause', () => {
    const dsl = {
      query: {
        match: {
          title: 'Distributed Systems'
        }
      },
      size: 5
    };
    const parsed = parseElasticsearchDSL(dsl);
    assert.equal(parsed.queryString, 'Distributed Systems');
    assert.equal(parsed.options.limit, 5);
  });

  test('parses bool query with must, filter, and range', () => {
    const dsl = {
      query: {
        bool: {
          must: [
            { match: { content: 'clusters' } }
          ],
          filter: [
            { term: { category: 'search' } },
            { range: { stars: { gte: 100 } } }
          ]
        }
      }
    };
    const parsed = parseElasticsearchDSL(dsl);
    assert.equal(parsed.queryString, 'clusters');
    assert.ok(parsed.filterPredicate, 'composite predicate should be generated');

    // Matching doc 1
    assert.equal(parsed.filterPredicate(sampleDocs[0]), true);
    // Doc 2 has category cloud
    assert.equal(parsed.filterPredicate(sampleDocs[1]), false);
    // Doc 4 has stars 80 < 100
    assert.equal(parsed.filterPredicate(sampleDocs[3]), false);
  });

  test('parses terms query clause', () => {
    const dsl = {
      query: {
        bool: {
          filter: [
            { terms: { category: ['cloud', 'systems'] } }
          ]
        }
      }
    };
    const parsed = parseElasticsearchDSL(dsl);
    assert.ok(parsed.filterPredicate);
    assert.equal(parsed.filterPredicate(sampleDocs[1]), true);
    assert.equal(parsed.filterPredicate(sampleDocs[2]), true);
    assert.equal(parsed.filterPredicate(sampleDocs[0]), false);
  });
});

describe('GhostSearch.searchDSL execution', () => {
  test('executes match query returning filtered hits', () => {
    const gs = makeSearch();
    const dsl = {
      query: {
        match: {
          title: 'Search'
        }
      }
    };
    const res = gs.searchDSL(dsl);
    assert.ok(res.hits.length > 0);
    assert.ok(res.hits.some(h => h.id === '1' || h.id === '4'));
  });

  test('executes combined bool match and range filter', () => {
    const gs = makeSearch();
    const dsl = {
      query: {
        bool: {
          must: [
            { match: { content: 'clusters' } }
          ],
          filter: [
            { range: { stars: { gte: 100 } } }
          ]
        }
      }
    };
    const res = gs.searchDSL(dsl);
    // Only doc 1 has content 'clusters' and stars >= 100 (120)
    assert.equal(res.hits.length, 1);
    assert.equal(res.hits[0].id, '1');
  });

  test('respects size and from pagination limits', () => {
    const gs = makeSearch();
    const dsl = {
      query: {
        match_all: {}
      },
      size: 1,
      from: 0
    };
    const res = gs.searchDSL(dsl);
    assert.equal(typeof res.totalHits, 'number');
  });

  test('formats query DSL summary string', () => {
    const dsl = {
      query: { match: { title: 'Distributed Systems' } },
      size: 10
    };
    const summary = formatQueryDSLSummary(dsl);
    assert.equal(summary, 'query="Distributed Systems", limit=10');
  });
});
