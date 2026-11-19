const code = document.querySelector('#code');
const status = document.querySelector('#status');
const output = document.querySelector('#output');
const check = document.querySelector('#check');
const share = document.querySelector('#share');
try {
  const saved = new URLSearchParams(location.hash.slice(1)).get('code');
  if (saved !== null && saved.length <= 100000) code.value = saved;
} catch { status.textContent = 'Could not read the shared code.'; }
let worker, timer;
function start(run = false) {
  worker?.terminate(); // Reset Rust thread-local caches between runs.
  clearTimeout(timer);
  check.disabled = true;
  status.textContent = run ? 'Checking…' : 'Loading typechecker…';
  const source = code.value;
  worker = new Worker(new URL('./checker-worker.js', import.meta.url), {type:'module'});
  timer = setTimeout(() => fail('Checker timed out. Try a smaller example.'), 30000);
  worker.onerror = () => fail('The checker worker failed to start.');
  worker.onmessage = ({data}) => {
    if (data.type === 'ready') {
      if (run) worker.postMessage({code:source});
      else { clearTimeout(timer); check.disabled = false; status.textContent = 'Ready to check.'; }
    } else if (data.type === 'unavailable') {
      fail('Could not load the Hack typechecker.');
      output.textContent = data.message;
    } else if (data.type === 'error') {
      fail('Typechecker failed.'); output.textContent = data.message;
    } else if (data.type === 'result') {
      clearTimeout(timer); check.disabled = false;
      worker.terminate();
      if (source !== code.value) {
        status.textContent = 'Code changed. Check again.';
        return;
      }
      status.textContent = data.diagnostics.length === 0 ? 'No diagnostics.' :
        `${data.diagnostics.length} ${data.diagnostics.length === 1 ? 'diagnostic' : 'diagnostics'}`;
      output.textContent = data.diagnostics.map(d => `${d.file}:${d.line}:${d.column} [${d.code}] ${d.message}`).join('\n\n');
    }
  };
}
function fail(message) { clearTimeout(timer); worker?.terminate(); status.textContent = message; check.disabled = false; }
check.onclick = () => { output.textContent = ''; start(true); };
share.onclick = async () => {
  if (code.value.length > 100000) { status.textContent = 'Example is too large for a share link.'; return; }
  location.hash = new URLSearchParams({code:code.value}).toString();
  try { await navigator.clipboard.writeText(location.href); status.textContent = 'Link copied.'; }
  catch { status.textContent = 'Copy the link from your address bar.'; }
};
start();
