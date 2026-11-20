# Hack Playground

The playground runs the Rust port of the Hack typechecker in a browser worker.
It checks one `main.hack` buffer against embedded Hack and HSL declarations.
It highlights Hack syntax and checks each edit automatically.
Write code using `.hack` syntax, with no `<?hh` opening tag. Use **Get link**
to copy a URL that stores the current buffer in its fragment using Hakana’s
URL-safe LZMA format. Earlier `#code=` links also open. Hover over an
underlined expression to see its diagnostic message. The panel below includes the reasons.

## Local build

Install [rustup](https://rustup.rs/) and have npm, Python 3, Make, and a native C
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

Open <http://localhost:8000> to see the sample’s return-type diagnostic. The
reasons point to the declared `string` return type and the HSL declaration
that supplies `int`. Click a `main.hack` location to select it in the editor.
Change the return expression to `$name` to clear the diagnostic.

Run `"$EMSDK_NODE" scripts/benchmark.mjs` to time module startup, the first
check, and repeated edits independently. It alternates valid and invalid
return expressions in buffers of one and 25 functions, warms each workload
for 20 edits, and reports median and p95 over the next 100. Times include
encoding the source and decoding diagnostics. Browser downloads, worker
messages, and rendering are outside the measurement.

The build extracts the Rust sources and builtin declarations from the checked-out
`hhvm` commit, applies [the Emscripten patch](patches/hhvm-emscripten.patch) to
that temporary copy, and builds with `probe/Cargo.lock`. It downloads and
verifies the PCRE 8.45 source archive. For offline rebuilds, set
`PCRE_SOURCE_ARCHIVE` to a previously downloaded copy and use a populated Cargo
cache. The generated module and WASM are under `dist/pkg/`. The packaging
step prints the WASM size in bytes, both raw and compressed with gzip level 9.
The release uses Rust’s size profile, whole-program link-time optimization,
and the Emscripten SDK’s `wasm-opt -Oz` pass.

## GitHub Pages

In the GitHub repository, select **Settings → Pages → Source → GitHub Actions**.
The [Pages workflow](.github/workflows/pages.yml) checks out the HHVM submodule,
builds and smoke-tests the WASM, then uploads `dist/` to Pages. Pushes to
`main` deploy automatically. A manual run on `main` can also deploy. The page,
worker and WASM use relative URLs so the site can sit under a repository path.

This follows [Hakana's build and deploy workflow](https://github.com/slackhq/hakana/blob/main/.github/workflows/pages.yml).
Hakana uses wasm-pack and Webpack for its frontend. This playground uses
Emscripten’s generated ES module and serves CodeMirror alongside the checker.

## Browser build choices

- Emscripten supplies the Unix-shaped standard library and C runtime that HHVM
  and its dependencies expect. The patch handles the remaining platform
  differences and the Rust port's 32-bit identifier and memory configuration.
  The checker uses the single-file typechecking service and an in-memory file
  overlay. The worker loads builtin declarations once. Each edit runs in the
  checker’s isolated IDE context so changed declarations, folded classes,
  syntax errors, and suppressions have the lifetime of that revision.
- The browser build uses process-local declaration stores. It excludes the
  daemon’s SQLite naming-table queries and on-disk dependency graph writer,
  allowing the linker to drop the SQLite engine. SQLite types still occur in
  the Rust dependency graph. The staged manifests disable SQLite session
  support, which also removes the build-time dependency on bindgen and libclang.
- HHVM uses PCRE to validate `re` literals and determine capture groups, so the
  WASM link includes a static PCRE build. Hakana
  [extracts capture groups in Rust](https://github.com/slackhq/hakana/blob/main/src/code_info_builder/pcre_parser.rs).
  Its Oniguruma WASM is for the editor's syntax highlighting.

The original local HHVM submodule was cloned using a shared object store from
`../hhvm`. Run `git -C hhvm repack -a -d` before removing that sibling checkout.
Fresh clones obtain the pinned revision from the public submodule URL.
