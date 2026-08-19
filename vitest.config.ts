import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        // React entrypoint: it only mounts <App />, there is nothing to assert.
        'src/main.tsx',
        // Type-only modules compile away to nothing.
        'src/types/**',
        'src/vite-env.d.ts',
      ],
    },
  },
});
