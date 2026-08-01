// Node-only entry point for GhostSearch.
// Build-time helpers that depend on node:fs live here so the browser entry
// ('ghostsearch') stays free of Node builtins.

export * from './index-builder';
