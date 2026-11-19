// Hakana shares an LZMA-alone stream (preset 7) as URL-safe base64.
// Use LZMA-JS's worker protocol so compression stays off the editor thread.
const COMPRESS = 1;
const DECOMPRESS = 2;
const MAX_SOURCE_BYTES = 100000;
const encoder = new TextEncoder();

function runCodec(action, input) {
  const worker = new Worker(new URL('./lzma-worker.js', import.meta.url));
  let timer;
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Shared code timed out.')), 15000);
    worker.onerror = () => reject(new Error('Could not load the link codec.'));
    worker.onmessage = ({data}) => {
      if (data.action !== action) return; // Skip progress messages.
      if (data.error) reject(new Error('Invalid shared code.'));
      else resolve(data.result);
    };
    worker.postMessage({action, data: input, mode: 7, cbn: 1});
  }).finally(() => {
    clearTimeout(timer);
    worker.terminate();
  });
}

function checkSize(source) {
  if (typeof source !== 'string') throw new Error('Invalid shared code.');
  if (source.length > MAX_SOURCE_BYTES || encoder.encode(source).length > MAX_SOURCE_BYTES) {
    throw new Error('Example is too large for a share link.');
  }
  return source;
}

export async function encodeSource(source) {
  const bytes = await runCodec(COMPRESS, checkSize(source));
  const binary = Array.from(bytes, byte => String.fromCharCode(byte & 255)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function decodeSource(fragment) {
  if (fragment.length > 400000) throw new Error('Shared code is too large.');
  if (fragment.startsWith('code=')) return checkSize(new URLSearchParams(fragment).get('code'));
  const binary = atob(decodeURIComponent(fragment).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  if (bytes.length < 13) throw new Error('Invalid shared code.');
  const header = new DataView(bytes.buffer);
  const size = header.getBigUint64(5, true);
  // LZMA-JS writes modified UTF-8, which can take two bytes for a single NUL.
  if (bytes[0] !== 0x5d || header.getUint32(1, true) > 32 * 1024 * 1024 ||
      size > BigInt(2 * MAX_SOURCE_BYTES)) throw new Error('Invalid shared code.');
  if (size === 0n) return '';
  return checkSize(await runCodec(DECOMPRESS, bytes));
}
