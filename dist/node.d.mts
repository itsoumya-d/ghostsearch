import { G as GhostDocument, a as GhostSearchOptions } from './types-D4mp6fLX.mjs';

declare class IndexBuilder {
    static build<T extends GhostDocument>(docs: T[], options: GhostSearchOptions, outputPath: string): void;
}

export { IndexBuilder };
