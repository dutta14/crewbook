module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: 'detect' } },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  rules: {
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    'no-console': ['error', { allow: ['error'] }],
  },
  ignorePatterns: ['dist', 'coverage', 'node_modules', 'playwright-report', 'test-results'],
  overrides: [
    { files: ['*.cjs', '*.config.ts', 'e2e/**/*.ts'], env: { node: true } },
    // Playwright fixtures expose `use`, which the hooks rule mistakes for React's `use`.
    { files: ['e2e/**/*.ts'], rules: { 'react-hooks/rules-of-hooks': 'off' } },
    {
      files: ['*.test.ts', '*.test.tsx', 'vitest.setup.ts'],
      env: { node: true },
    },
  ],
};
