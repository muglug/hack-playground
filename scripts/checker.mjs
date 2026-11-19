import {readFile} from 'node:fs/promises';
import init from '../dist/pkg/hack_playground.mjs';

export async function loadChecker() {
  const wasmBinary = await readFile(new URL('../dist/pkg/hack_playground.wasm', import.meta.url));
  const wasm = await init({wasmBinary});
  const encoder = new TextEncoder();
  return source => {
    const bytes = encoder.encode(source);
    const json = wasm.ccall('check_hack', 'string', ['array', 'number'], [bytes, bytes.length]);
    const result = JSON.parse(json);
    if (!Array.isArray(result.Ok)) throw new Error(result.Err ?? 'Invalid checker response');
    return result.Ok;
  };
}
