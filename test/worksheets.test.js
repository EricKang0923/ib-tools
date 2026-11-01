import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCodes, groupWorksheetFiles, parseNotePath, parseWorksheetName, unitOf } from '../src/worksheets.js';

test('parseWorksheetName reads a worksheet', () => {
  assert.deepEqual(parseWorksheetName('[MAA 1.7] DEDUCTIVE PROOF.pdf'), {
    code: '1.7',
    title: 'DEDUCTIVE PROOF',
    isSolution: false,
  });
});

test('parseWorksheetName reads a range, brackets and solutions', () => {
  assert.deepEqual(parseWorksheetName('[MAA 1.13-1.15] COMPLEX NUMBERS (POLAR FORM)_solutions.pdf'), {
    code: '1.13-1.15',
    title: 'COMPLEX NUMBERS (POLAR FORM)',
    isSolution: true,
  });
});

test('parseWorksheetName refuses Math AI and other files', () => {
  assert.equal(parseWorksheetName('[MAI 2.1] LINES.pdf'), null);
  assert.equal(parseWorksheetName('notes.pdf'), null);
});

test('groupWorksheetFiles pairs files and reports what it skipped', () => {
  const { groups, skipped } = groupWorksheetFiles([
    { name: '[MAA 1.1] NUMBERS - ROUNDING.pdf' },
    { name: '[MAA 1.1] NUMBERS - ROUNDING_solutions.pdf' },
    { name: '[MAA 1.7] DEDUCTIVE PROOF.pdf' },
    { name: '[MAI 2.1] LINES.pdf' },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].questionFile.name, '[MAA 1.1] NUMBERS - ROUNDING.pdf');
  assert.equal(groups[0].solutionFile.name, '[MAA 1.1] NUMBERS - ROUNDING_solutions.pdf');
  assert.equal(groups[1].solutionFile, null);
  assert.deepEqual(skipped, ['[MAI 2.1] LINES.pdf']);
});

test('parseNotePath reads the group and title', () => {
  assert.deepEqual(parseNotePath('SME/Tools/Tool 1 Experimental Techniques.pdf'), {
    group: 'Tools',
    title: 'Tool 1 Experimental Techniques',
  });
});

test('parseNotePath skips other files', () => {
  assert.equal(parseNotePath('SME/Tools/._Tool 1.pdf'), null);
  assert.equal(parseNotePath('__MACOSX/Tools/Tool 1.pdf'), null);
  assert.equal(parseNotePath('SME/Tools/notes.txt'), null);
  assert.equal(parseNotePath('Tool 1.pdf'), null);
});

test('compareCodes sorts as numbers', () => {
  const codes = ['1.13-1.15', '1.10', '2.1', '1.9', '1.2-1.3'];
  assert.deepEqual(codes.sort(compareCodes), ['1.2-1.3', '1.9', '1.10', '1.13-1.15', '2.1']);
});

test('unitOf reads the unit number', () => {
  assert.equal(unitOf('1.13-1.15'), 1);
  assert.equal(unitOf('2.1'), 2);
});
