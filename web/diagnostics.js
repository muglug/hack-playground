// Hack spans use UTF-8 byte offsets. CodeMirror indexes UTF-16 code units.
function editorOffsets(source) {
  if (/^[\x00-\x7f]*$/.test(source)) return byte => byte;
  const offsets = [];
  let byte = 0, index = 0;
  offsets[0] = 0;
  for (const char of source) {
    const point = char.codePointAt(0);
    byte += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    index += char.length;
    offsets[byte] = index;
  }
  return byte => offsets[byte];
}

function element(tag, css, text) {
  const node = document.createElement(tag);
  node.className = css;
  node.textContent = text;
  return node;
}

export function renderDiagnostics(editor, output, diagnostics) {
  const marks = [];
  if (!diagnostics.length) return marks;
  const offset = editorOffsets(editor.getValue());
  function range(message) {
    if (message.file !== 'main.hack') return null;
    const start = offset(message.start), end = offset(message.end);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
    return [editor.posFromIndex(start), editor.posFromIndex(end)];
  }
  function location(message) {
    const positions = range(message);
    const text = [message.file, message.line, message.column].join(':');
    if (!positions) return element('span', 'location', text);
    const link = element('button', 'location', text);
    link.onclick = () => {
      editor.focus();
      editor.setSelection(...positions);
    };
    return link;
  }
  for (const diagnostic of diagnostics) {
    const card = element('div', 'diagnostic', '');
    const claim = element('p', 'claim', diagnostic.message);
    claim.append(element('span', 'code', diagnostic.phase + '[' + diagnostic.code + ']'));
    card.append(claim, location(diagnostic));
    if (diagnostic.reasons.length) {
      const reasons = element('ul', 'reasons', '');
      for (const reason of diagnostic.reasons) {
        const item = document.createElement('li');
        item.append(reason.message, ' ', location(reason));
        reasons.append(item);
      }
      card.append(reasons);
    }
    for (const message of diagnostic.custom_messages) card.append(element('p', '', message));
    output.append(card);
    const positions = range(diagnostic);
    if (positions) marks.push(editor.markText(...positions, {className: 'issue', title: diagnostic.message}));
  }
  return marks;
}
