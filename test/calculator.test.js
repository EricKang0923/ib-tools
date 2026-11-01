import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CUTOFFS,
  average,
  calculateTotal,
  corePoints,
  cutoffsAreValid,
  gapToNextMark,
  markFromPercent,
  parseScores,
} from '../src/calculator.js';

test('parseScores reads commas, spaces, plus signs and percent signs', () => {
  assert.deepEqual(parseScores('92, 80 + 76%'), { scores: [92, 80, 76], invalid: [] });
});

test('parseScores rejects text and values outside 0-100', () => {
  assert.deepEqual(parseScores('abc 101 -5 50'), { scores: [50], invalid: ['abc', '101', '-5'] });
});

test('average returns null with no scores', () => {
  assert.equal(average([]), null);
});

test('average matches a hand calculation', () => {
  assert.ok(Math.abs(average([92, 80, 76]) - 82.6667) < 0.001);
});

test('every school cutoff gives its own mark exactly at the minimum', () => {
  for (const { mark, min } of DEFAULT_CUTOFFS) {
    assert.equal(markFromPercent(min), mark);
  }
});

test('just below a cutoff gives the lower mark', () => {
  assert.equal(markFromPercent(84.99), 6);
  assert.equal(markFromPercent(74.99), 5);
  assert.equal(markFromPercent(0.5), 0);
});

test('gapToNextMark gives the distance to the next mark', () => {
  const result = gapToNextMark(82.5);
  assert.equal(result.mark, 7);
  assert.equal(result.gap, 2.5);
});

test('gapToNextMark is null at the top mark', () => {
  assert.equal(gapToNextMark(85), null);
});

test('cutoffsAreValid accepts the school table', () => {
  assert.equal(cutoffsAreValid(DEFAULT_CUTOFFS), true);
});

test('cutoffsAreValid rejects out-of-order and out-of-range values', () => {
  assert.equal(cutoffsAreValid([{ mark: 7, min: 50 }, { mark: 6, min: 60 }]), false);
  assert.equal(cutoffsAreValid([{ mark: 7, min: 120 }, { mark: 6, min: 60 }]), false);
});

test('corePoints gives known matrix values', () => {
  assert.equal(corePoints('A', 'A'), 3);
  assert.equal(corePoints('B', 'A'), 3);
  assert.equal(corePoints('B', 'B'), 2);
});

test('an E in TOK or EE is a failing condition', () => {
  assert.equal(corePoints('E', 'A'), 'fail');
  assert.equal(corePoints('A', 'E'), 'fail');
});

test('calculateTotal adds six subjects and core points', () => {
  const result = calculateTotal([7, 7, 6, 6, 6, 6], 'B', 'A');
  assert.equal(result.subjectTotal, 38);
  assert.equal(result.total, 41);
});

test('calculateTotal has no total while anything is missing', () => {
  assert.equal(calculateTotal([7, 7, 6, 6, 6, null], 'B', 'A').total, null);
  assert.equal(calculateTotal([7, 7, 6, 6, 6, 6], '', 'A').total, null);
});

test('calculateTotal has no total with a failing condition', () => {
  const result = calculateTotal([7, 7, 7, 7, 7, 7], 'E', 'A');
  assert.equal(result.failing, true);
  assert.equal(result.total, null);
});

test('maximum score is 45', () => {
  assert.equal(calculateTotal([7, 7, 7, 7, 7, 7], 'A', 'A').total, 45);
});
