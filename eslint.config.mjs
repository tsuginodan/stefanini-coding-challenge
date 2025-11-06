// ESLint Flat Config for this project
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['node_modules', '.serverless', '.esbuild', '.webpack', 'dist']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        // Not using type-aware linting initially for speed and simplicity
        project: false,
        sourceType: 'commonjs',
        ecmaVersion: 2020
      }
    },
    rules: {
      'eqeqeq': ['error', 'always'],
      'no-unused-vars': 'off',
      // Use the TS-specific no-unused-vars
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Allow 'any' in infrastructure stubs to keep focus on infra upgrade
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
];