import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // .claude/ can hold git worktrees of this repo; their copies of the tests aren't ours to run.
    exclude: ['**/node_modules/**', 'dist/**', '.claude/**'],
  },
});
