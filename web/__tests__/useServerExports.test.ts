import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

// A 'use server' module may only export async functions (types are erased).
// Next 15 throws "A "use server" file can only export async functions, found
// object" the first time such a module is evaluated on a cold server — which
// neither tsc nor `next build` reports. Shared constants belong in a plain module
// (see app/(auth)/login/loginActionState.ts).

const ROOTS = ['app', 'lib'].map((d) => path.resolve(__dirname, '..', d));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

function isUseServerModule(src: string): boolean {
  // The directive must be the first statement (comments/blank lines may precede it).
  const body = src.replace(/^(\s*(\/\/.*|\/\*[\s\S]*?\*\/))*/, '').trimStart();
  return /^(['"])use server\1/.test(body);
}

function offendingExports(src: string): string[] {
  return src
    .split('\n')
    .filter((line) => /^export\s/.test(line))
    .filter((line) => !/^export\s+(async\s+function\b|type\b|interface\b)/.test(line));
}

const useServerFiles = ROOTS.flatMap(sourceFiles).filter((f) => isUseServerModule(readFileSync(f, 'utf8')));

describe("'use server' modules export only async functions", () => {
  it('finds the server-action modules it is meant to guard', () => {
    expect(useServerFiles.length).toBeGreaterThanOrEqual(5);
  });

  it.each(useServerFiles.map((f) => [path.relative(path.resolve(__dirname, '..'), f), f]))(
    '%s',
    (_rel, file) => {
      expect(offendingExports(readFileSync(file as string, 'utf8'))).toEqual([]);
    },
  );
});
