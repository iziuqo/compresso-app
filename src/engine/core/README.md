# Vendored engine — `compresso.js` v0.4.0

These six files are the compresso compression core, vendored as **source** (not as a
built bundle) so Vite can tree-shake it and so the worker backend in `platform.js`
compiles into the worker chunk directly.

**Provenance:** `iziuqo/compresso` → `packages/compresso/src/` at v0.4.0.
**Do not edit here.** Fix upstream, then re-copy.

Once v0.4.0 is published to npm this directory is replaced by a dependency:

```
npm i compresso.js@^0.4.0
```

…and every `from '../engine/core/index.js'` becomes `from 'compresso.js'`. Nothing
else changes — that is why it is vendored as-is rather than adapted.
