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
    // Everything sensitive must go through useEncryptedStorage.
    'no-restricted-globals': [
      'error',
      { name: 'localStorage', message: 'Use useEncryptedStorage instead of raw localStorage.' },
      { name: 'sessionStorage', message: 'Use useEncryptedStorage instead of raw sessionStorage.' },
    ],
    'no-restricted-properties': [
      'error',
      {
        object: 'window',
        property: 'localStorage',
        message: 'Use useEncryptedStorage instead of raw localStorage.',
      },
      {
        object: 'window',
        property: 'sessionStorage',
        message: 'Use useEncryptedStorage instead of raw sessionStorage.',
      },
    ],
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
    // The raw storage layer, the theme preference and the prep-dismissed flag (no personal data).
    {
      files: [
        'src/utils/encryptedStorage.ts',
        'src/hooks/useDarkMode.ts',
        'src/data/prepDismissal.ts',
        '*.test.ts',
        '*.test.tsx',
        'vitest.setup.ts',
        'e2e/**/*.ts',
      ],
      rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
    },
  ],
};
