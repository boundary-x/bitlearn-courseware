// Conservative recognition: only known, empty starter callbacks count as empty.
// Never remove strings or arbitrary declarations to decide a project is empty.
function isEmptyProject(code) {
  if (typeof code !== 'string') throw new Error('현재 코드를 확인하지 못했습니다.');
  let clean = '';
  for (let i = 0; i < code.length;) {
    if (code.startsWith('//', i)) {
      const end = code.indexOf('\n', i + 2); i = end < 0 ? code.length : end; clean += ' ';
    } else if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2); if (end < 0) return false;
      i = end + 2; clean += ' ';
    } else {
      if ('\'"`'.includes(code[i])) return false;
      clean += code[i++];
    }
  }
  const emptyCallback = '(?:function\\s*\\(\\s*\\)|\\(\\s*\\)\\s*=>)\\s*\\{\\s*\\}';
  const starter = new RegExp('^(?:\\s|;|basic\\.forever\\s*\\(\\s*' + emptyCallback + '\\s*\\)|input\\.onButtonPressed\\s*\\(\\s*Button\\.(?:A|B|AB)\\s*,\\s*' + emptyCallback + '\\s*\\))*$');
  return starter.test(clean);
}

function generationMode(requestMode, code) {
  if (typeof code !== 'string') throw new Error('현재 코드를 확인하지 못했습니다.');
  if (requestMode === 'fix') return 'fix';
  if (requestMode === 'new') return 'new';
  return isEmptyProject(code) ? 'new' : 'improve';
}
