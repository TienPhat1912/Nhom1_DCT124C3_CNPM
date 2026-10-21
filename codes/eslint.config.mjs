import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.expo/**', 'apps/mobile/android/**', 'apps/mobile/ios/**', '**/playwright-report/**', '**/test-results/**'] },
  ...ts.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } }
);
