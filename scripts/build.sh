#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
root=$PWD

# Build from the pinned source without modifying the submodule checkout.
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
mkdir "$stage/hhvm" "$stage/probe"
git -C hhvm archive HEAD hphp/hack/src hphp/hack/hhi hphp/hsl/src |
    tar -xf - -C "$stage/hhvm"
git -C "$stage/hhvm" apply "$root/patches/hhvm-emscripten.patch"
cp -R probe/Cargo.toml probe/Cargo.lock probe/src "$stage/probe/"

# HHVM's regex typechecker links PCRE 1. Compile the same library for WASM.
pcre_sha256=4dae6fdcd2bb0bb6c37b5f97c33c2be954da743985369cddac3546e3218bffb8
pcre_archive=${PCRE_SOURCE_ARCHIVE:-$stage/pcre-8.45.tar.bz2}
if [[ -z ${PCRE_SOURCE_ARCHIVE:-} ]]; then
    curl --fail --silent --show-error --location --retry 3 \
        https://downloads.sourceforge.net/project/pcre/pcre/8.45/pcre-8.45.tar.bz2 \
        --output "$pcre_archive"
fi
printf '%s  %s\n' "$pcre_sha256" "$pcre_archive" | shasum -a 256 -c -
tar -xf "$pcre_archive" -C "$stage"
pcre=$stage/pcre-8.45
(
    cd "$pcre"
    emconfigure ./configure --disable-shared --enable-static --enable-utf \
        --enable-unicode-properties --disable-cpp
    emmake make -j4 libpcre.la
)

target=wasm32-unknown-emscripten
cargo rustc --locked --release --manifest-path "$stage/probe/Cargo.toml" \
    --target-dir "$stage/target" --target "$target" --bin hack_playground -- \
    -L "native=$pcre/.libs" \
    -C link-arg=-Wl,--strip-all \
    -C link-arg=-sMODULARIZE=1 \
    -C link-arg=-sEXPORT_ES6=1 \
    -C link-arg=-sENVIRONMENT=web,worker,node \
    -C link-arg=-sEXPORTED_FUNCTIONS=_check_hack \
    -C link-arg=-sEXPORTED_RUNTIME_METHODS=ccall \
    -C link-arg=-sSTACK_SIZE=8388608 \
    -C link-arg=-sALLOW_MEMORY_GROWTH=1 \
    -C link-arg=-sMAXIMUM_MEMORY=536870912

python3 scripts/package.py "$stage/target/$target/release"
mkdir -p dist/licenses
cp hhvm/hphp/hack/LICENSE dist/licenses/Hack.txt
cp hhvm/hphp/hsl/LICENSE dist/licenses/HSL.txt
cp "$pcre/LICENCE" dist/licenses/PCRE.txt
