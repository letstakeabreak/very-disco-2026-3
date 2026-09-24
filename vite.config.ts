import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'safari16.4' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
