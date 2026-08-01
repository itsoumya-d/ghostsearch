import { G as GhostDocument, a as GhostSearchOptions } from './types-DB5UXTjD.js';

declare class IndexBuilder {
    static build<T extends GhostDocument>(docs: T[], options: GhostSearchOptions, outputPath: string): void;
}

export { IndexBuilder };
