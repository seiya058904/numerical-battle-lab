# Acorn upstream provenance

- Component: Acorn
- Version: 8.15.0
- Upstream: https://github.com/acornjs/acorn
- Package: https://www.npmjs.com/package/acorn
- License: MIT
- Vendored file: `vendor/acorn-8.15.0.js`
- SHA-256: `fdb08546776ec6228b03e8d02b40d4ab3255bae5f401adba7ff5dad927ac5c9c`
- Usage: parse the restricted formula expression into an AST. The battle engine does not execute Acorn output directly; `src/formula.js` validates a small node/operator/function whitelist and evaluates only that safe subset.
