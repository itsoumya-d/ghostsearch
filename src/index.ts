// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

export * from './types';
export * from './ghost-search';
export * from './ghost-worker';
export * from './vector-index';
export * from './embedding-engine';

// NOTE: IndexBuilder is intentionally NOT exported here. It imports node:fs,
// which breaks browser bundling for a library whose entire premise is running
// in the browser. It is available from the 'ghostsearch/node' subpath instead.
