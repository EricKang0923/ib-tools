// Question bank logic. No screen code here, so tests can check it directly.

// Reads "May 2005 HL TZ1 Q22 B.png", "May 2004 HL TZ2 Q6 Q7 B D.png" (two questions)
// or "May 2003 HL Q7 C+D.png" (either is right). The answer is the end of the name.
// "X" and "None" mean the collection lists no usable answer for that question.
export function parseQuestionName(fileName) {
  const match = /^(.+?) (\d{4}) (.*?) ?((?:[A-D](?:\+[A-D])* ?)+|X|None)\.png$/.exec(fileName);
  if (!match) return null;
  const answer = match[4].trim();
  return {
    paper: `${match[1]} ${match[2]} ${match[3]}`.trim(),
    year: Number(match[2]),
    answer: answer === 'X' || answer === 'None' ? 'No answer listed' : answer,
  };
}

// Takes a path inside the chosen folder: "Root/C.2 Wave Model/Nov 2018 HL Q11 B.png".
export function parseQuestionPath(relativePath) {
  const parts = relativePath.split('/');
  const fileName = parts.at(-1);
  if (parts.includes('__MACOSX') || fileName.startsWith('._') || parts.length < 3) return null;
  const parsed = parseQuestionName(fileName);
  if (!parsed) return null;
  return { ...parsed, unit: parts[1], topic: parts.slice(2, -1).join(' / ') };
}

export function unitsOf(questions) {
  return [...new Set(questions.map((question) => question.unit))].sort();
}

// status is 'all', 'new' (not tried) or 'wrong' (last attempt was wrong).
export function filterQuestions(questions, progress, unit, status, minYear = 0) {
  return questions.filter((question) => {
    if (unit && question.unit !== unit) return false;
    if (question.year < minYear) return false;
    const result = progress[question.id]?.result;
    if (status === 'new') return !result;
    if (status === 'wrong') return result === 'wrong';
    return true;
  });
}

export function progressStats(questions, progress) {
  let right = 0;
  let wrong = 0;
  for (const question of questions) {
    const result = progress[question.id]?.result;
    if (result === 'right') right += 1;
    if (result === 'wrong') wrong += 1;
  }
  return { total: questions.length, right, wrong, left: questions.length - right - wrong };
}

export function pickRandom(list, random = Math.random) {
  if (list.length === 0) return null;
  return list[Math.floor(random() * list.length)];
}
