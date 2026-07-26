// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

export function highlightText(text: string, query: string, tag: string = 'mark'): string {
  if (!query || !text) return text;
  
  const terms = query.trim().split(/\s+/).filter(t => t.length > 0);
  if (terms.length === 0) return text;

  let highlighted = text;
  
  for (const term of terms) {
    const regex = new RegExp(`(${term})`, 'gi');
    highlighted = highlighted.replace(regex, `<${tag}>$1</${tag}>`);
  }
  
  return highlighted;
}
