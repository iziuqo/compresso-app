# Vendored engine — `compresso.js` v0.4.0


These six files are the compresso compression core, vendored as **source** (not as a
built bundle) so Vite can tree-shake it and so the worker backend in `platform.js`
compiles into the worker chunk directly.

**Do not edit here.** Fix upstream, then re-copy — and update the checksums below.

## Provenance

Copied from `iziuqo/compresso` → `packages/compresso/src/` at version **0.4.0**.

> **v0.4.0 is not published to npm yet**, and at the time of vendoring it was not yet
> committed upstream either. That makes drift the real risk here: two copies of the
> same six files with nothing linking them. The checksums are the guard — run
> `shasum -a 256` against the upstream `src/` and compare before touching anything in
> this directory.

| file | sha256 |
|---|---|
| `index.js` | `c01c3712358754a0…` |
| `compress.js` | `ef28473d3ca2b18f…` |
| `platform.js` | `078c397cb01b6775…` |
| `resize.js` | `6f740f235c203ca8…` |
| `utils.js` | `0b02ff12dacee409…` |
| `heic.js` | `dd2553e8bc9625cf…` |

## Replacing this with the published package

Once v0.4.0 is on npm:

```bash
rm -rf src/engine/core
npm i compresso.js@^0.4.0
```

Then repoint the two imports (`src/engine/worker.ts`, `src/state/queue.ts`) from
`'./core/index.js'` / `'../engine/core/index.js'` to `'compresso.js'`. Nothing else
changes — that is why it is vendored unmodified.
