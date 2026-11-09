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
    // Share code decides what leaves the device. It may read people, notes, action items and the
    // agenda, and nothing else. src/data/shareIsolation.test.ts holds the full allowlist.
    {
      files: [
        'src/**/*Share*.{ts,tsx}',
        'src/**/*Sharing*.{ts,tsx}',
        'src/**/*shar*.{ts,tsx}',
        'src/pages/ExpiredLink.tsx',
        'src/components/ActiveTokensList.tsx',
        'src/components/QRCode.tsx',
        'src/hooks/useSharedView.ts',
      ],
      excludedFiles: ['*.test.ts', '*.test.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '**/privateStore',
                  '**/feedbackStore',
                  '**/useFeedback*',
                  '**/moodEntries',
                  '**/growthStore',
                  '**/reminders',
                  '**/leave',
                  '**/dateEvents',
                  '**/todos',
                  '**/decisions',
                  '**/timeline',
                  '**/usePrivate*',
                  '**/useGrowthEntries',
                  '**/useLeave',
                  '**/useReminders',
                  '**/useTodos',
                  '**/useDateEvents',
                  '**/FlightRiskIndicator',
                  '**/PrivateNotes',
                  '**/Mood*',
                ],
                message:
                  'Share code must not touch private notes, flight risk, moods, feedback, growth, reminders, leave or key dates.',
              },
            ],
          },
        ],
      },
    },
    // The raw storage layer, the theme preference, the prep-dismissed flag and the dashboard
    // collapse flags (no personal data).
    {
      files: [
        'src/utils/encryptedStorage.ts',
        'src/hooks/useDarkMode.ts',
        'src/data/prepDismissal.ts',
        'src/data/dashboardCollapse.ts',
        '*.test.ts',
        '*.test.tsx',
        'vitest.setup.ts',
        'e2e/**/*.ts',
      ],
      rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
    },
  ],
};
