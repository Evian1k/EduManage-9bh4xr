// Deno global type declarations for EduManage edge functions.
//
// This file provides ambient declarations so that TypeScript-aware tooling
// (linters, editors, tsc) can resolve the `Deno` global and the standard
// library imports even when running outside a Deno-aware environment.
// Under Deno itself, these declarations are superseded by the official
// `lib.deno.ns.d.ts`.

/// <reference lib="es2022" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// ---------------------------------------------------------------------------
// Deno namespace (subset used by EduManage edge functions)
// ---------------------------------------------------------------------------

declare const Deno: {
  /** Environment variables. */
  env: {
    get(name: string): string | undefined;
    set(name: string, value: string): void;
    delete(name: string): void;
    toObject(): Record<string, string>;
  };

  /** Start an HTTP server. Mirrors Deno.serve. */
  serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): { finished: Promise<void>; shutdown(): Promise<void> };
  serve(
    options:
      | number
      | { port?: number; hostname?: string; cert?: string; key?: string; signal?: AbortSignal },
    handler: (request: Request) => Response | Promise<Response>,
  ): { finished: Promise<void>; shutdown(): Promise<void> };

  /** Read the entire contents of a file. */
  readFile(path: string | URL): Promise<Uint8Array>;
  readTextFile(path: string | URL): Promise<string>;

  /** Write to a file. */
  writeFile(
    path: string | URL,
    data: Uint8Array,
    options?: { create?: boolean; append?: boolean },
  ): Promise<void>;
  writeTextFile(
    path: string | URL,
    data: string,
    options?: { create?: boolean; append?: boolean },
  ): Promise<void>;

  /** Cryptographically secure random bytes. */
  getRandomValues<T extends ArrayBufferView>(array: T): T;

  /** Synchronous crypto hash. */
  /** Inspect process information. */
  pid: number;
  args: string[];
  mainModule: string;
  cwd(): string;

  /** Logging — writes to stderr on Deno. */
  inspect(value: unknown, options?: Record<string, unknown>): string;
};

// ---------------------------------------------------------------------------
// Global types
// ---------------------------------------------------------------------------

declare interface Console {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}
