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
