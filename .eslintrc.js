module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended', '@typescript-eslint/recommended'],
  plugins: ['@typescript-eslint'],
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'off',
    'prefer-const': 'error',
  },
  globals: {
    game: 'readonly',
    canvas: 'readonly',
    ui: 'readonly',
    foundry: 'readonly',
    Hooks: 'readonly',
    CONFIG: 'readonly',
    CONST: 'readonly',
    duplicate: 'readonly',
    mergeObject: 'readonly',
    setProperty: 'readonly',
    getProperty: 'readonly',
    hasProperty: 'readonly',
    expandObject: 'readonly',
    flattenObject: 'readonly',
    filterObject: 'readonly',
    diffObject: 'readonly',
    isObjectEmpty: 'readonly',
    encodeURL: 'readonly',
    randomID: 'readonly',
  },
};
