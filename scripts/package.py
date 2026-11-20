"""Assemble the static site from a freshly linked Emscripten bundle."""
import gzip
from pathlib import Path
import shutil
import sys

root = Path(__file__).resolve().parent.parent
bundle = Path(sys.argv[1])
glue = bundle / "hack_playground.js"
wasm = bundle / "hack_playground.wasm"
if not glue.is_file() or not wasm.is_file():
    raise SystemExit(f"Missing Emscripten output in {bundle}")
with wasm.open("rb") as module:
    if module.read(8) != b"\x00asm\x01\x00\x00\x00":
        raise SystemExit(f"Invalid WebAssembly file at {wasm}")

dist = root / "dist"
shutil.copytree(root / "web", dist, dirs_exist_ok=True)
codemirror = root / "node_modules" / "codemirror"
editor = dist / "editor"
editor.mkdir(exist_ok=True)
for asset in [
    "lib/codemirror.js", "lib/codemirror.css", "mode/clike/clike.js", "mode/php/php.js",
    "addon/lint/lint.js", "addon/lint/lint.css",
]:
    shutil.copy(codemirror / asset, editor)
licenses = dist / "licenses"
licenses.mkdir(exist_ok=True)
shutil.copyfile(codemirror / "LICENSE", licenses / "CodeMirror.txt")

lzma = root / "node_modules" / "lzma"
# The minified distribution mangles MessageEvent.data in the worker handler.
shutil.copyfile(lzma / "src/lzma_worker.js", dist / "lzma-worker.js")
shutil.copyfile(lzma / "LICENSE", licenses / "LZMA.txt")

pkg = dist / "pkg"
pkg.mkdir(exist_ok=True)
shutil.copyfile(glue, pkg / "hack_playground.mjs")
shutil.copyfile(wasm, pkg / wasm.name)
gzip_size = len(gzip.compress(wasm.read_bytes(), compresslevel=9, mtime=0))
print(f"{wasm.name}: {wasm.stat().st_size:,} bytes raw, {gzip_size:,} bytes with gzip -9")
print(dist)
