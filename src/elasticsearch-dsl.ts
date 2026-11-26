// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1619@gmail.com | +91 7031648617

import { SearchOptions } from './types';

export interface ElasticsearchMatchQuery {
  [field: string]: string | { query: string; fuzziness?: number | string; boost?: number };
}

export interface ElasticsearchMultiMatchQuery {
  query: string;
  fields?: string[];
  fuzziness?: number | string;
}

export interface ElasticsearchTermQuery {
  [field: string]: any;
}

export interface ElasticsearchTermsQuery {
  [field: string]: any[];
}

export interface ElasticsearchRangeQuery {
  [field: string]: {
    gte?: number | string;
    lte?: number | string;
    gt?: number | string;
    lt?: number | string;
  };
}

export interface ElasticsearchBoolQuery {
  must?: any | any[];
  filter?: any | any[];
  should?: any | any[];
  must_not?: any | any[];
}

export interface ElasticsearchQueryPayload {
  query?: {
    match?: ElasticsearchMatchQuery;
    multi_match?: ElasticsearchMultiMatchQuery;
    term?: ElasticsearchTermQuery;
    terms?: ElasticsearchTermsQuery;
    range?: ElasticsearchRangeQuery;
    bool?: ElasticsearchBoolQuery;
    match_all?: Record<string, any>;
    [key: string]: any;
  };
  size?: number;
  from?: number;
  highlight?: {
    fields?: Record<string, any>;
    pre_tags?: string[];
    post_tags?: string[];
  };
  sort?: any;
}

export interface ParsedElasticsearchQuery {
  queryString: string;
  options: SearchOptions;
  filterPredicate?: (doc: any) => boolean;
}

/**
 * Parse an Elasticsearch Query DSL payload into GhostSearch query terms,
 * options, and document filter predicates.
 */
export function parseElasticsearchDSL(payload: ElasticsearchQueryPayload): ParsedElasticsearchQuery {
  const options: SearchOptions = {};
  if (typeof payload.size === 'number') {
    options.limit = payload.size;
  }
  if (typeof payload.from === 'number') {
    options.offset = payload.from;
  }
  if (payload.highlight) {
    options.highlight = true;
    if (payload.highlight.pre_tags && payload.highlight.pre_tags[0]) {
      options.highlightTag = payload.highlight.pre_tags[0].replace(/[<>]/g, '');
    }
  }

  const queryObj = payload.query;
  if (!queryObj || queryObj.match_all) {
    return {
      queryString: '',
      options,
    };
  }

  const queries: string[] = [];
  const filters: Record<string, any> = {};
  const predicates: Array<(doc: any) => boolean> = [];

  function processClause(clause: any) {
    if (!clause || typeof clause !== 'object') return;

    if (clause.match) {
      for (const val of Object.values(clause.match)) {
        if (typeof val === 'string') {
          queries.push(val);
        } else if (val && typeof val === 'object' && 'query' in (val as any)) {
          queries.push((val as any).query);
          if ((val as any).fuzziness) {
            options.fuzzy = true;
          }
        }
      }
    }

    if (clause.multi_match) {
      const mm = clause.multi_match;
      if (typeof mm.query === 'string') {
        queries.push(mm.query);
      }
      if (mm.fuzziness) {
        options.fuzzy = true;
      }
    }

    if (clause.term) {
      for (const [field, val] of Object.entries(clause.term)) {
        const targetVal = (val && typeof val === 'object' && 'value' in val) ? (val as any).value : val;
        filters[field] = targetVal;
        predicates.push(doc => doc[field] === targetVal);
      }
    }

    if (clause.terms) {
      for (const [field, val] of Object.entries(clause.terms)) {
        if (Array.isArray(val)) {
          const set = new Set(val);
          predicates.push(doc => set.has(doc[field]));
        }
      }
    }

    if (clause.range) {
      for (const [field, rangeSpec] of Object.entries(clause.range as ElasticsearchRangeQuery)) {
        predicates.push(doc => {
          const val = doc[field];
          if (val === undefined || val === null) return false;
          if (rangeSpec.gte !== undefined && val < rangeSpec.gte) return false;
          if (rangeSpec.gt !== undefined && val <= rangeSpec.gt) return false;
          if (rangeSpec.lte !== undefined && val > rangeSpec.lte) return false;
          if (rangeSpec.lt !== undefined && val >= rangeSpec.lt) return false;
          return true;
        });
      }
    }

    if (clause.bool) {
      const boolObj = clause.bool as ElasticsearchBoolQuery;
      const normalize = (c: any) => Array.isArray(c) ? c : (c ? [c] : []);

      for (const sub of normalize(boolObj.must)) {
        processClause(sub);
      }
      for (const sub of normalize(boolObj.filter)) {
        processClause(sub);
      }
      for (const sub of normalize(boolObj.should)) {
        processClause(sub);
      }
      for (const sub of normalize(boolObj.must_not)) {
        if (sub && sub.term) {
          for (const [field, val] of Object.entries(sub.term)) {
            const targetVal = (val && typeof val === 'object' && 'value' in val) ? (val as any).value : val;
            predicates.push(doc => doc[field] !== targetVal);
          }
        }
      }
    }
  }

  processClause(queryObj);

  if (Object.keys(filters).length > 0) {
    options.filters = filters;
  }

  const compositePredicate = predicates.length > 0
    ? (doc: any) => predicates.every(fn => fn(doc))
    : undefined;

  return {
    queryString: queries.join(' ').trim(),
    options,
    filterPredicate: compositePredicate,
  };
}

/**
 * Format a human-readable summary of parsed query DSL filters and terms.
 */
export function formatQueryDSLSummary(payload: ElasticsearchQueryPayload): string {
  const parsed = parseElasticsearchDSL(payload);
  const parts: string[] = [];
  if (parsed.queryString) {
    parts.push(`query="${parsed.queryString}"`);
  }
  if (parsed.options.limit !== undefined) {
    parts.push(`limit=${parsed.options.limit}`);
  }
  if (parsed.options.offset !== undefined) {
    parts.push(`offset=${parsed.options.offset}`);
  }
  if (parsed.options.fuzzy) {
    parts.push('fuzzy=true');
  }
  return parts.join(', ') || 'match_all';
}
