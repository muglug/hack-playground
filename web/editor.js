// The tagless PHP tokenizer handles Hack variables, comments, and interpolated
// strings. Extend its vocabulary for Hack types, declarations, and namespaces.
const php = CodeMirror.resolveMode('text/x-php');
const words = list => Object.fromEntries(list.split(' ').map(word => [word, true]));
const types = words('arraykey bool classname darray dict dynamic float int keyset mixed nonnull noreturn nothing num resource shape string supportdyn this typename varray vec vec_or_dict void');
CodeMirror.defineMIME('text/x-hack', {
  ...php,
  keywords: {...php.keywords, ...words('abstract as async attribute await case category children concurrent ctx enum internal is lateinit let match module nameof newctx newtype package readonly reify require required super type upcast using where xhp')},
  defKeywords: {...php.defKeywords, ...words('newtype type module')},
  types,
  namespaceSeparator: '\\',
  hooks: {
    ...php.hooks,
    token(stream, state, style) {
      if (Object.hasOwn(types, stream.current()) && ['keyword', 'variable', 'builtin'].includes(style)) return 'type';
    },
  },
});

export function createEditor(textarea) {
  return CodeMirror.fromTextArea(textarea, {
    mode: 'text/x-hack',
    lineNumbers: true,
    indentUnit: 2,
    tabSize: 2,
    lineSeparator: '\n',
    screenReaderLabel: 'Hack source code',
    extraKeys: {Tab: false, 'Shift-Tab': false},
  });
}
