import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterQuestions,
  parseQuestionName,
  parseQuestionPath,
  pickRandom,
  progressStats,
  rowFromManifest,
  unitsOf,
} from '../src/questions.js';

test('parseQuestionName reads a normal May paper', () => {
  assert.deepEqual(parseQuestionName('May 2005 HL TZ1 Q22 B.png'), {
    paper: 'May 2005 HL TZ1 Q22',
    year: 2005,
    answer: 'B',
  });
});

test('parseQuestionName reads a Nov paper and a missing Q', () => {
  assert.equal(parseQuestionName('Nov 2015 HL Q11 D.png').answer, 'D');
  assert.equal(parseQuestionName('May 2007 HL TZ2 5 A.png').answer, 'A');
});

test('parseQuestionName reads a specimen paper', () => {
  const parsed = parseQuestionName('Specimen Paper 2025 HL Q1 C.png');
  assert.equal(parsed.year, 2025);
  assert.equal(parsed.answer, 'C');
});

test('parseQuestionName keeps both answers for a two-part image', () => {
  assert.equal(parseQuestionName('May 2004 HL TZ2 Q6 Q7 B D.png').answer, 'B D');
});

test('parseQuestionName reads either-answer and no-answer questions', () => {
  assert.equal(parseQuestionName('May 2003 HL Q7 C+D.png').answer, 'C+D');
  assert.equal(parseQuestionName('Nov 2001 HL Q35 X.png').answer, 'No answer listed');
  assert.equal(parseQuestionName('May 2003 HL Q39 None.png').answer, 'No answer listed');
});

test('parseQuestionName keeps the paper name apart from the answer', () => {
  assert.equal(parseQuestionName('May 2003 HL Q7 C+D.png').paper, 'May 2003 HL Q7');
  assert.equal(parseQuestionName('May 2021 HL TZ2 Q35 1 of 2 A.png').paper, 'May 2021 HL TZ2 Q35 1 of 2');
});

test('filterQuestions narrows by subject, paper and level', () => {
  const list = [
    { id: 'p', subject: 'Physics', unit: 'A', year: 2020 },
    { id: 's', subject: 'Chemistry', unit: 'B', year: 0, paper_type: '1-A', levels: ['SL', 'HL'] },
    { id: 'h', subject: 'Chemistry', unit: 'B', year: 0, paper_type: '2', levels: ['HL only'] },
  ];
  const ids = (extra) => filterQuestions(list, {}, '', 'all', 0, extra).map((q) => q.id);
  assert.deepEqual(ids({ subject: 'Physics' }), ['p']);
  assert.deepEqual(ids({ subject: 'Chemistry', paperType: '2' }), ['h']);
  assert.deepEqual(ids({ subject: 'Chemistry', level: 'SL' }), ['s']);
  assert.deepEqual(ids({ subject: 'Chemistry', level: 'HL' }), ['s', 'h']);
});

test('rowFromManifest maps a Chemistry entry', () => {
  const row = rowFromManifest({
    id: 'x', subject: 'Chemistry', topic: 'Redox', subtopic: 'Redox', paper: '1-A',
    levels: ['SL'], letter: 'B', source: 'SL Paper 1-A Redox.pdf', files: { question: 'x-q.png', answer: 'x-a.png' },
  });
  assert.equal(row.unit, 'Redox');
  assert.equal(row.answer, 'B');
  assert.equal(row.paper_type, '1-A');
  assert.equal(row.has_answer_image, true);
  assert.equal(row.has_report, false);
  assert.equal(row.year, 0);
});

test('filterQuestions can hide older years', () => {
  const dated = [{ id: 'old', unit: 'A', year: 2005 }, { id: 'new', unit: 'A', year: 2021 }];
  assert.deepEqual(filterQuestions(dated, {}, '', 'all', 2016).map((q) => q.id), ['new']);
});

test('parseQuestionName rejects names with no answer', () => {
  assert.equal(parseQuestionName('May 2005 HL Q22.png'), null);
  assert.equal(parseQuestionName('notes.png'), null);
});

test('parseQuestionPath finds the unit and topic', () => {
  const parsed = parseQuestionPath('Root/Miscellaneous/Waves/Beats/May 2014 HL TZ2 Q19 D.png');
  assert.equal(parsed.unit, 'Miscellaneous');
  assert.equal(parsed.topic, 'Waves / Beats');
});

test('parseQuestionPath skips Mac system files', () => {
  assert.equal(parseQuestionPath('__MACOSX/Root/C.2/May 2005 HL Q1 A.png'), null);
  assert.equal(parseQuestionPath('Root/C.2/._May 2005 HL Q1 A.png'), null);
});

const questions = [
  { id: 'a', unit: 'A.1' },
  { id: 'b', unit: 'A.1' },
  { id: 'c', unit: 'C.2' },
];
const progress = { a: { result: 'right' }, b: { result: 'wrong' } };

test('filterQuestions filters by unit and status', () => {
  assert.equal(filterQuestions(questions, progress, 'A.1', 'all').length, 2);
  assert.deepEqual(filterQuestions(questions, progress, '', 'new').map((q) => q.id), ['c']);
  assert.deepEqual(filterQuestions(questions, progress, '', 'wrong').map((q) => q.id), ['b']);
});

test('progressStats counts results', () => {
  assert.deepEqual(progressStats(questions, progress), { total: 3, right: 1, wrong: 1, left: 1 });
});

test('unitsOf lists each unit once in order', () => {
  assert.deepEqual(unitsOf(questions), ['A.1', 'C.2']);
});

test('pickRandom handles an empty list and stays in range', () => {
  assert.equal(pickRandom([]), null);
  assert.equal(pickRandom(['x', 'y'], () => 0.999), 'y');
});
