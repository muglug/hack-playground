import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';

import init from '../dist/pkg/hack_playground.mjs';

const wasmBinary = await readFile(new URL('../dist/pkg/hack_playground.wasm', import.meta.url));
const encoder = new TextEncoder();

async function check(source) {
  // The site also starts a fresh instance for each check.
  const wasm = await init({wasmBinary});
  const input = encoder.encode(source);
  const result = JSON.parse(
    wasm.ccall('check_hack', 'string', ['array', 'number'], [input, input.length])
  );
  assert.ok(Array.isArray(result.Ok), JSON.stringify(result));
  return result.Ok;
}

assert.deepEqual(await check('function f(): int { return count(vec[1, 2]); }'), []);

const errors = await check('function f(): string {\n  return 42;\n}');
assert.ok(errors.some(diagnostic =>
  diagnostic.code === 4110 && diagnostic.file === 'main.hack' && diagnostic.line === 2
), JSON.stringify(errors));

const parseErrors = await check('function f( { return 42; }');
assert.ok(parseErrors.some(diagnostic => diagnostic.code === 1002), JSON.stringify(parseErrors));

const regexErrors = await check('function f(): void { $p = re"/(/"; }');
assert.ok(regexErrors.some(diagnostic => diagnostic.code === 4275), JSON.stringify(regexErrors));
console.log('Hack WASM returned the expected type, syntax, and regex diagnostics.');
