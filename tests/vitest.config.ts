import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['case-*/**/*.test.ts'],
    testTimeout: 360_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    pool: 'forks',
  },
})
