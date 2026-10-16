// @ts-check
import js from '@eslint/js';
import remotion from '@remotion/eslint-plugin';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['node_modules/**', '_seed/**', 'runs/**', 'videos/**', '.remotion/**'],
  },
  {
    files: ['lib/**/*.ts', 'templates/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Remotion's Easing helpers are static class methods passed as
      // callbacks (Easing.out(Easing.cubic)); static methods have no `this`.
      '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],
    },
  },
  {
    files: ['templates/**/*.{ts,tsx}'],
    ...remotion.flatPlugin,
  },
  {
    files: ['templates/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
);
