// Worksheet logic. No screen code here, so tests can check it directly.

// Reads "[MAA 1.13-1.15] COMPLEX NUMBERS (POLAR FORM)_solutions.pdf".
// Only Math AA files count, so Math AI ("MAI") files can't be added by mistake.
export function parseWorksheetName(fileName) {
  const match = /^\[MAA ([\d.]+(?:-[\d.]+)?)\] (.+?)(_solutions)?\.pdf$/i.exec(fileName);
  if (!match) return null;
  return { code: match[1], title: match[2].trim(), isSolution: Boolean(match[3]) };
}

// Puts each worksheet together with its solutions file.
export function groupWorksheetFiles(files) {
  const groups = new Map();
  const skipped = [];
  for (const file of files) {
    const parsed = parseWorksheetName(file.name);
    if (!parsed) {
      skipped.push(file.name);
      continue;
    }
    const group = groups.get(parsed.code) ?? { code: parsed.code, title: parsed.title, questionFile: null, solutionFile: null };
    group[parsed.isSolution ? 'solutionFile' : 'questionFile'] = file;
    groups.set(parsed.code, group);
  }
  return { groups: [...groups.values()], skipped };
}

// Sorts as numbers, so 1.9 comes before 1.10.
export function compareCodes(a, b) {
  const [aUnit, aPart] = a.split('-')[0].split('.').map(Number);
  const [bUnit, bPart] = b.split('-')[0].split('.').map(Number);
  return aUnit - bUnit || aPart - bPart;
}

export function unitOf(code) {
  return Number(code.split('.')[0]);
}
