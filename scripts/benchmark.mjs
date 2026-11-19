import {performance} from 'node:perf_hooks';
import {loadChecker} from './checker.mjs';

const start = performance.now();
const check = await loadChecker();
const loaded = performance.now();
check('function greet(string $name): string { return HH\\Lib\\Str\\length($name); }');
console.log('Read and instantiate WASM: %s ms. First check with builtins: %s ms.',
  (loaded - start).toFixed(1), (performance.now() - loaded).toFixed(1));

for (const count of [1, 25]) {
  const previous = Array.from({length: count - 1}, (_, i) =>
    'function f' + i + '(string $s): int { return HH\\Lib\\Str\\length($s); }\n'
  ).join('');
  const samples = [];
  for (let i = 0; i < 120; i++) {
    const expression = i % 2 ? '$name' : 'HH\\Lib\\Str\\length($name)';
    const code = previous + 'function greet(string $name): string { return ' + expression + '; } // edit ' + i;
    const before = performance.now();
    const diagnostics = check(code);
    const elapsed = performance.now() - before;
    if (diagnostics.length !== (i % 2 ? 0 : 1)) throw new Error('Unexpected diagnostics');
    if (i >= 20) samples.push(elapsed);
  }
  samples.sort((a, b) => a - b);
  console.log('%d function(s), 100 warm edits: median %s ms, p95 %s ms.',
    count, samples[49].toFixed(2), samples[94].toFixed(2));
}
