/** Type shims for verovio (no official @types package). */

declare module "verovio" {
  const verovio: any;
  export default verovio;
  export const toolkit: any;
  export const createToolkit: () => any;
}

declare module "verovio/esm" {
  export class VerovioToolkit {
    constructor(module: unknown);
    loadData(data: string): boolean;
    renderToSVG(page: number): string;
    getPageCount(): number;
    setOptions(opts: Record<string, unknown>): void;
    destroy(): void;
  }
}

declare module "verovio/wasm" {
  const createVerovioModule: (
    arg?: Record<string, unknown>,
  ) => Promise<unknown>;
  export default createVerovioModule;
}
