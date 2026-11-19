"""Assemble the static site from a freshly linked Emscripten bundle."""
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
pkg = dist / "pkg"
pkg.mkdir(exist_ok=True)
shutil.copyfile(glue, pkg / "hack_playground.mjs")
shutil.copyfile(wasm, pkg / wasm.name)
print(dist)
