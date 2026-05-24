// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ── Supabase + Hermes interop ────────────────────────────────────────────────
// @supabase/supabase-js ships an ESM build (dist/index.mjs) whose optional
// OpenTelemetry support uses a dynamic `import(variableSpecifier)`. Hermes'
// bytecode compiler — used by `expo export` and EAS production Android builds —
// cannot statically compile a dynamic import with a non-literal specifier and
// fails the build. The CommonJS build (dist/index.cjs) uses `require()` for the
// same optional dependency, which Metro/Hermes handle (the dep is absent, so it
// resolves to null via the library's own `.catch(() => null)`).
//
// Package-exports resolution (default since SDK 53) selects the `import`
// condition → the .mjs build. Force the cjs entry for this one package only,
// leaving all other resolution untouched.
const supabaseCjs = path.resolve(
  __dirname,
  'node_modules/@supabase/supabase-js/dist/index.cjs',
);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@supabase/supabase-js') {
    return { type: 'sourceFile', filePath: supabaseCjs };
  }
  const resolver = defaultResolveRequest ?? context.resolveRequest;
  return resolver(context, moduleName, platform);
};

module.exports = config;
