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

// Turns one entry of a split-questions manifest into a database row.
export function rowFromManifest(entry) {
  return {
    id: entry.id,
    subject: entry.subject,
    unit: entry.topic,
    topic: entry.subtopic ?? '',
    paper: entry.source,
    year: 0,
    answer: entry.letter ?? '',
    paper_type: entry.paper,
    levels: entry.levels,
    has_answer_image: Boolean(entry.files.answer),
    has_report: Boolean(entry.files.report),
  };
}

export function unitsOf(questions) {
  return [...new Set(questions.map((question) => question.unit))].sort();
}

// status is 'all', 'new' (not tried) or 'wrong' (last attempt was wrong).
// extra can narrow by subject, paper type and level. 'HL' includes 'HL only' questions.
export function filterQuestions(questions, progress, unit, status, minYear = 0, extra = {}) {
  return questions.filter((question) => {
    if (extra.subject && question.subject !== extra.subject) return false;
    if (extra.paperType && question.paper_type !== extra.paperType) return false;
    if (extra.level) {
      const levels = question.levels ?? [];
      const fits = extra.level === 'HL' ? levels.includes('HL') || levels.includes('HL only') : levels.includes(extra.level);
      if (!fits) return false;
    }
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
