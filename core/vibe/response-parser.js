function parseCodeResponse(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('AI가 빈 응답을 반환했습니다. 다시 시도해주세요.');
  const fences = [...raw.matchAll(/```([^\r\n]*)\r?\n([\s\S]*?)```/g)];
  const blocks = fences.filter(match => /^(typescript|javascript|ts|js)?$/i.test(match[1].trim()));
  const refusalText = raw.trim().replace(/^\/\/\s*/, '');
  const refusals = [
    '⚠️ 바이브코딩 스튜디오는 개인정보를 수집하지 않으며, 관련 답변을 할 수 없어요',
    '⚠️ 수업과 관련된 바이브코딩 프롬프트를 넣어주세요.',
    '⚠️ 마이크로비트 메모리 한계(070 에러)로 인해 네오픽셀, 블루투스, OLED를 동시에 사용할 수 없어요. 두 가지만 선택해주세요.'
  ];
  if (refusals.includes(refusalText)) return { refusal: refusalText };
  if (blocks.length !== 1 || fences.length !== 1) throw new Error('응답에 하나의 코드 블록이 필요합니다. 다시 요청해주세요. 기존 코드는 변경하지 않았습니다.');
  const code = blocks[0][2].trim();
  const executable = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').trim();
  if (!executable) throw new Error('실행할 코드가 없는 응답입니다. 기존 코드는 변경하지 않았습니다.');
  return { code, explanation: raw.replace(blocks[0][0], '').trim() };
}
