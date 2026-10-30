import { defineConfig } from 'vitest/config';
import path from 'path';

// jsdom 30 needs Node 22.15+; on an older Node the run dies later with an unreadable undici
// error and "no tests". Say what is wrong instead.
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 15)) {
  throw new Error(
    `Node >= 22.15 is required (found ${process.versions.node}). Run "nvm use" (see .nvmrc).`,
  );
}

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // One jsdom per worker (files stay isolated) instead of one per file: 26 jsdom
    // startups cost about 40 s of CPU.
    pool: 'vmThreads',
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
