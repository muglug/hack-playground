# Hack Playground

The playground runs the Rust port of the Hack typechecker in a browser worker.
It checks one `main.hack` buffer against embedded Hack and HSL declarations.
Write code using `.hack` syntax, with no `<?hh` opening tag. **Get link** puts
the editor contents in the URL fragment.

## Local build

Install [rustup](https://rustup.rs/) and have Python 3, Make, and a native C
compiler available. The repository's `rust-toolchain.toml` selects the Rust
nightly and browser target.

```sh
git submodule update --init
mkdir -p probe/target
git clone --depth 1 --branch 3.1.68 https://github.com/emscripten-core/emsdk.git probe/target/emsdk
probe/target/emsdk/emsdk install 3.1.68
probe/target/emsdk/emsdk activate 3.1.68
source probe/target/emsdk/emsdk_env.sh

bash scripts/build.sh
"$EMSDK_NODE" scripts/smoke.mjs
python3 -m http.server 8000 --directory dist
```

Open <http://localhost:8000> and click **Check code** to see the sample's
invalid-return-type diagnostic. Change `return 42;` to `return $name;` and
check again. The smoke test runs the actual WASM and checks valid code, a
type mismatch, a syntax error, and an invalid regex literal.

The build extracts the Rust sources and builtin declarations from the checked-out
`hhvm` commit, applies [the Emscripten patch](patches/hhvm-emscripten.patch) to
that temporary copy, and builds with `probe/Cargo.lock`. It downloads and
verifies the PCRE 8.45 source archive. For offline rebuilds, set
`PCRE_SOURCE_ARCHIVE` to a previously downloaded copy and use a populated Cargo
cache. The generated module and WASM are under `dist/pkg/`.

## GitHub Pages

In the GitHub repository, select **Settings → Pages → Source → GitHub Actions**.
The [Pages workflow](.github/workflows/pages.yml) checks out the HHVM submodule,
builds and smoke-tests the WASM, then uploads `dist/` to Pages. Pushes to
`main` deploy automatically. A manual run on `main` can also deploy. The page,
worker and WASM use relative URLs so the site can sit under a repository path.

This follows [Hakana's build and deploy workflow](https://github.com/slackhq/hakana/blob/main/.github/workflows/pages.yml).
Hakana uses wasm-pack and Webpack for its frontend. This playground uses
Emscripten's generated ES module with the existing static editor.

## Browser build choices

- Emscripten supplies the Unix-shaped standard library and C runtime that HHVM
  and its dependencies expect. The patch handles the remaining platform
  differences and the Rust port's 32-bit identifier and memory configuration.
  The checker uses the single-file typechecking service and an in-memory file
  overlay. Each check gets a fresh worker so diagnostics and provider caches
  from previous edits are discarded.
- SQLite is present in the dependency graph through naming-table support and
  shared types. This entry point uses the in-memory naming store. The build
  patch disables SQLite session support in its staged dependency manifests,
  which eliminates bindgen and libclang from the build.
- HHVM uses PCRE to validate `re` literals and determine capture groups, so the
  WASM link includes a static PCRE build. Hakana
  [extracts capture groups in Rust](https://github.com/slackhq/hakana/blob/main/src/code_info_builder/pcre_parser.rs).
  Its Oniguruma WASM is for the editor's syntax highlighting.

The original local HHVM submodule was cloned using a shared object store from
`../hhvm`. Run `git -C hhvm repack -a -d` before removing that sibling checkout.
Fresh clones obtain the pinned revision from the public submodule URL.
