import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: path.resolve(__dirname, '../src') + '/',
      },
      {
        find: /^@web\//,
        replacement: path.resolve(__dirname) + '/',
      },
    ],
  },
});
