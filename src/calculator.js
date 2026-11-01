// Score calculations. No screen code here, so tests can check it directly.

export const DEFAULT_CUTOFFS = [
  { mark: 7, min: 85 },
  { mark: 6, min: 75 },
  { mark: 5, min: 65 },
  { mark: 4, min: 55 },
  { mark: 3, min: 40 },
  { mark: 2, min: 20 },
  { mark: 1, min: 1 },
  { mark: 0, min: 0 },
];

// Rows are TOK grades, columns are EE grades. 'fail' means a failing condition.
const CORE_MATRIX = {
  A: { A: 3, B: 3, C: 2, D: 2, E: 'fail' },
  B: { A: 3, B: 2, C: 2, D: 1, E: 'fail' },
  C: { A: 2, B: 2, C: 1, D: 0, E: 'fail' },
  D: { A: 2, B: 1, C: 0, D: 0, E: 'fail' },
  E: { A: 'fail', B: 'fail', C: 'fail', D: 'fail', E: 'fail' },
};

// Turns text such as "92, 80 + 76%" into numbers and lists anything invalid.
export function parseScores(text) {
  const scores = [];
  const invalid = [];
  for (const part of text.split(/[\s,+]+/).filter(Boolean)) {
    const value = Number(part.replace(/%$/, ''));
    if (Number.isFinite(value) && value >= 0 && value <= 100) {
      scores.push(value);
    } else {
      invalid.push(part);
    }
  }
  return { scores, invalid };
}

export function average(scores) {
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function markFromPercent(percent, cutoffs = DEFAULT_CUTOFFS) {
  if (percent === null) return null;
  const sorted = [...cutoffs].sort((a, b) => b.min - a.min);
  const row = sorted.find((cutoff) => percent >= cutoff.min);
  return row ? row.mark : null;
}

// How many percentage points are missing for the next mark up. Null at the top mark.
export function gapToNextMark(percent, cutoffs = DEFAULT_CUTOFFS) {
  if (percent === null) return null;
  const higher = cutoffs
    .filter((cutoff) => cutoff.min > percent)
    .sort((a, b) => a.min - b.min)[0];
  return higher ? { mark: higher.mark, gap: higher.min - percent } : null;
}

// A higher mark must always need a higher percentage.
export function cutoffsAreValid(cutoffs) {
  const sorted = [...cutoffs].sort((a, b) => b.mark - a.mark);
  return sorted.every((cutoff, i) => {
    const inRange = Number.isFinite(cutoff.min) && cutoff.min >= 0 && cutoff.min <= 100;
    return inRange && (i === 0 || cutoff.min < sorted[i - 1].min);
  });
}

export function corePoints(tok, ee) {
  return CORE_MATRIX[tok]?.[ee] ?? null;
}

// Total is null until all six subject marks and both core grades are known.
export function calculateTotal(marks, tok, ee) {
  const core = corePoints(tok, ee);
  const subjectTotal = marks.reduce((sum, mark) => sum + (mark ?? 0), 0);
  const complete = marks.length === 6 && marks.every((mark) => mark !== null) && core !== null;
  return {
    subjectTotal,
    core,
    failing: core === 'fail',
    total: complete && core !== 'fail' ? subjectTotal + core : null,
  };
}
