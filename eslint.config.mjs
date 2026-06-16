import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'dist/**',
      'coverage/**',
      'libs/common/src/generated/**',
      '**/__mocks__/*.ts',
      '**/__mock__/*.ts',
      'apps/app-notifications/src/common/tabt-client/**/*',
      'apps/tabt-rest/src/common/tabt-client/model/**/*',
      'apps/tabt-rest/src/entity/tabt-soap/**/*',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Match prior (typescript-eslint v7) default: don't flag unused catch bindings.
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }],
      // New in ESLint 10 recommended; enabling proper error-cause chaining is a
      // behavioral refactor tracked separately, not part of the dependency bump.
      'preserve-caught-error': 'off',
    },
  },
);
