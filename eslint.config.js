import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'src-tauri/', '**/node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  { files: ['e2e/**/*.mjs', 'e2e/**/*.ts', 'playwright.config.ts'], languageOptions: { globals: { ...globals.node } } },
);
