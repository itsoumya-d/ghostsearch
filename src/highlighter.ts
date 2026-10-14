// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1619@gmail.com | +91 7031648617

// Characters that carry special meaning inside a RegExp. The query string is
// end-user input from a search box, so it must be escaped before it is compiled
// into a pattern — otherwise a query as ordinary as "f(x)" or "a)" throws
// SyntaxError: Invalid regular expression, and search() fails for the whole request.
const REGEXP_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

function escapeRegExp(literal: string): string {
  return literal.replace(REGEXP_METACHARACTERS, '\\$&');
}

// Only permit a bare HTML tag name. `highlightTag` reaches the output unquoted,
// so an unvalidated value such as "script>alert(1)</script" would inject markup.
const SAFE_TAG_NAME = /^[A-Za-z][A-Za-z0-9-]*$/;

export function highlightText(text: string, query: string, tag: string = 'mark'): string {
  if (!query || !text) return text;

  const safeTag = SAFE_TAG_NAME.test(tag) ? tag : 'mark';

  const terms = [...new Set(query.trim().split(/\s+/).filter(t => t.length > 0))]
    .sort((a, b) => b.length - a.length);
  if (terms.length === 0) return text;

  // Match the original text once. Repeated replacements can match markup we
  // just inserted (e.g. the query "market mark") and produce broken HTML.
  // Prefer the longest literal at the same position for overlapping terms.
  const regex = new RegExp(terms.map(escapeRegExp).join('|'), 'gi');
  return text.replace(regex, match => `<${safeTag}>${match}</${safeTag}>`);
}
