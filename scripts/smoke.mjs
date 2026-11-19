import {strict as assert} from 'node:assert';
import {loadChecker} from './checker.mjs';

const check = await loadChecker();
const greet = 'function greet(string $name): string {\n  return HH\\Lib\\Str\\length($name);\n}';
const [diagnostic] = check(greet);
assert.equal(diagnostic.code, 4110);
assert.equal(diagnostic.phase, 'Typing');
assert.equal(diagnostic.line, 2);
assert.equal(greet.slice(diagnostic.start, diagnostic.end), 'HH\\Lib\\Str\\length($name)');
const [expected, actual] = diagnostic.reasons;
assert.equal(expected.message, 'Expected `string' + String.fromCharCode(96));
assert.equal(expected.file, 'main.hack');
assert.equal(greet.slice(expected.start, expected.end), 'string');
assert.equal(actual.message, 'But got `int' + String.fromCharCode(96));
assert.match(actual.file, /str\/introspect\.hhi$/);
assert.ok(actual.line > 0);

assert.deepEqual(check(greet.replace('): string', '): int')), []);
assert.deepEqual(check('function f(): int { return count(vec[1, 2]); }'), []);
assert.ok(check('function f( { return 42; }').some(d => d.code === 1002));
assert.ok(check('function f(): void { $p = re"/(/"; }').some(d => d.code === 4275));

// The same worker must forget old shallow declarations and folded classes.
const call = 'function f(C $c): int { return $c->value(); }';
const classes = 'class B { public function value(): int {return 1;} } class C extends B {}';
assert.deepEqual(check(classes + call), []);
assert.ok(check(classes.replace('int {return 1;', 'string {return "";') + call).some(d => d.code === 4110));
assert.ok(check(call).some(d => d.code === 2049));
assert.deepEqual(check(classes + call), []);
assert.deepEqual(check(''), []);
console.log('Hack WASM passed diagnostic, reason, and edit-isolation checks.');
