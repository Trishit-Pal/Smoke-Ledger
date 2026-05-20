/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['/dist/*', '/node_modules/*', '/supabase/functions/*', '/.expo/*'],
  // eslint-config-expo/core enables `import/resolver.typescript: true`, which loads
  // eslint-import-resolver-typescript (native `unrs-resolver`). That breaks on some
  // installs (e.g. `npm install --ignore-scripts` or optional-deps issues). Typecheck
  // already validates imports; disable import rules that require that resolver.
  rules: {
    'import/no-unresolved': 'off',
    'import/named': 'off',
    'import/namespace': 'off',
    'import/default': 'off',
    'import/export': 'off',
  },
  overrides: [{ files: ['scripts/**/*.js'], env: { node: true } }],
};
