import {createEditor} from './editor.js';
import {renderDiagnostics} from './diagnostics.js';

const textarea = document.querySelector('#code');
const status = document.querySelector('#status');
const output = document.querySelector('#output');
const retry = document.querySelector('#retry');

const saved = new URLSearchParams(location.hash.slice(1)).get('code');
if (saved !== null && saved.length <= 100000) textarea.value = saved;
const editor = createEditor(textarea);
let version = 0;
let worker, timer, ready, checking;
let marks = [];
let shareTimer;

function check() {
  if (!ready || checking) return;
  checking = true;
  worker.postMessage({version, code: editor.getValue()});
  timer = setTimeout(() => fail('The check timed out. Edit the example or retry.'), 30000);
}

function fail(message) {
  clearTimeout(timer);
  worker?.terminate();
  worker = null;
  ready = checking = false;
  status.textContent = message;
  retry.hidden = false;
}

function start() {
  retry.hidden = true;
  status.textContent = 'Loading typechecker…';
  const current = new Worker(new URL('./checker-worker.js', import.meta.url), {type: 'module'});
  worker = current;
  timer = setTimeout(() => fail('The checker took too long to load.'), 60000);
  current.onerror = () => { if (worker === current) fail('The checker worker stopped.'); };
  current.onmessage = ({data}) => {
    if (worker !== current) return;
    clearTimeout(timer);
    if (data.type === 'failed') return fail(data.message);
    if (data.type === 'ready') {
      ready = true;
      status.textContent = 'Checking…';
      return check();
    }
    checking = false;
    if (data.version !== version) return check();
    if (data.type === 'error') {
      status.textContent = data.message;
      return;
    }
    const count = data.diagnostics.length;
    status.textContent = count ? count + (count === 1 ? ' diagnostic' : ' diagnostics') : 'No diagnostics.';
    editor.operation(() => { marks = renderDiagnostics(editor, output, data.diagnostics); });
  };
}

editor.on('changes', () => {
  version++;
  editor.operation(() => { for (const mark of marks) mark.clear(); });
  marks = [];
  output.replaceChildren();
  if (ready) status.textContent = 'Checking…';
  check();
  clearTimeout(shareTimer);
  shareTimer = setTimeout(updateShareLink, 350);
});

retry.onclick = start;
function updateShareLink() {
  const code = editor.getValue();
  const url = new URL(location.href);
  url.hash = code.length <= 100000 && new TextEncoder().encode(code).length <= 100000
    ? new URLSearchParams({code}).toString() : '';
  history.replaceState(null, '', url);
}

start();
