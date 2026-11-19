import {createEditor} from './editor.js';
import {renderDiagnostics} from './diagnostics.js';
import {decodeSource, encodeSource} from './share.js';

const textarea = document.querySelector('#code');
const status = document.querySelector('#status');
const output = document.querySelector('#output');
const retry = document.querySelector('#retry');
const shareStatus = document.querySelector('#share-status');

if (location.hash.length > 1) {
  textarea.readOnly = true;
  try {
    textarea.value = await decodeSource(location.hash.slice(1));
  } catch {
    shareStatus.textContent = 'Could not open the shared code.';
  } finally {
    textarea.readOnly = false;
  }
}
const editor = createEditor(textarea);
let version = 0;
let worker, timer, ready, checking;
let annotations = [];
editor.setOption('lint', {lintOnChange: false, getAnnotations: () => annotations});

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
    annotations = renderDiagnostics(editor, output, data.diagnostics);
    editor.performLint();
  };
}

editor.on('changes', () => {
  version++;
  if (annotations.length) {
    annotations = [];
    editor.performLint();
  }
  output.replaceChildren();
  shareStatus.textContent = '';
  if (ready) status.textContent = 'Checking…';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  check();
});

retry.onclick = start;
const share = document.querySelector('#share');
share.onclick = async () => {
  const revision = version;
  share.disabled = true;
  try {
    const fragment = await encodeSource(editor.getValue());
    if (revision !== version) return;
    location.hash = fragment;
    try {
      await navigator.clipboard.writeText(location.href);
      shareStatus.textContent = 'Link copied.';
    } catch {
      shareStatus.textContent = 'Copy the link from your address bar.';
    }
  } catch (error) {
    shareStatus.textContent = error.message;
  } finally {
    share.disabled = false;
  }
};
start();
