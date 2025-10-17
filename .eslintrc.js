module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Core Principles: Prefer clarity over cleverness
    'no-unused-vars': 'error',
    'no-dead-code': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    
    // Code Quality Gates
    'no-console': 'warn', // Allow console in development
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    
    // Security & Reliability
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Error Handling
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // Code Style
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    
    // Function Quality
    'max-lines-per-function': ['warn', { max: 50 }],
    'max-params': ['warn', { max: 4 }],
    'complexity': ['warn', { max: 10 }],
    
    // Documentation
    'valid-jsdoc': 'off', // We'll use JSDoc comments manually
    
    // Figma Runtime ES5 Compatibility Guards
    'no-restricted-syntax': [
      'error',
      { 'selector': 'CatchClause[param=null]', 'message': 'Figma runtime: no optional catch binding' },
      { 'selector': 'OptionalMemberExpression', 'message': 'Figma runtime: no optional chaining' },
      { 'selector': 'OptionalCallExpression', 'message': 'Figma runtime: no optional call' },
      { 'selector': 'LogicalExpression[operator=\'??\']', 'message': 'Figma runtime: no nullish coalescing' }
    ]
    
    // Accessibility (for UI code)
    'jsx-a11y/alt-text': 'off', // Not applicable for vanilla JS
    'jsx-a11y/anchor-has-content': 'off',
    'jsx-a11y/aria-props': 'off',
    'jsx-a11y/aria-proptypes': 'off',
    'jsx-a11y/aria-unsupported-elements': 'off',
    'jsx-a11y/heading-has-content': 'off',
    'jsx-a11y/img-redundant-alt': 'off',
    'jsx-a11y/no-access-key': 'off',
    'jsx-a11y/role-has-required-aria-props': 'off',
    'jsx-a11y/role-supports-aria-props': 'off',
    'jsx-a11y/scope': 'off',
    'jsx-a11y/tabindex-no-positive': 'off'
  },
  globals: {
    // Figma Plugin API globals
    'figma': 'readonly',
    'parent': 'readonly'
  }
};

