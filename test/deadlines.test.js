import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUBJECTS,
  renameOldSubjects,
  visibleDeadlines,
  countDueWithin,
  dayLabel,
  daysUntil,
  groupDeadlines,
  isOverdue,
  mergeSharedDeadlines,
  parseDue,
  sortByDue,
  subjectsOf,
  validateDeadline,
} from '../src/deadlines.js';

const now = new Date(2026, 10, 2, 12, 0);
const item = (due, subject = 'Physics', done = false) => ({ id: due, title: 'task', subject, due, done });

test('parseDue rejects impossible dates and bad text', () => {
  assert.equal(parseDue('2026-02-31T10:00'), null);
  assert.equal(parseDue('2026-11-04T25:00'), null);
  assert.equal(parseDue('tomorrow'), null);
  assert.equal(parseDue(undefined), null);
});

test('daysUntil counts calendar days, not 24-hour blocks', () => {
  assert.equal(daysUntil('2026-11-03T00:01', now), 1);
  assert.equal(daysUntil('2026-11-02T23:59', now), 0);
  assert.equal(daysUntil('2026-11-01T23:59', now), -1);
});

test('daysUntil works across a month and year change', () => {
  assert.equal(daysUntil('2026-12-02T12:00', now), 30);
  assert.equal(daysUntil('2027-01-08T10:55', now), 67);
});

test('isOverdue uses the time, and done items are never overdue', () => {
  assert.equal(isOverdue(item('2026-11-02T11:59'), now), true);
  assert.equal(isOverdue(item('2026-11-02T12:01'), now), false);
  assert.equal(isOverdue(item('2026-11-01T10:00', 'Physics', true), now), false);
});

test('dayLabel shows future, today and past', () => {
  assert.equal(dayLabel(item('2026-11-04T09:20'), now), 'D-2');
  assert.equal(dayLabel(item('2026-11-02T18:00'), now), 'Today');
  assert.equal(dayLabel(item('2026-11-02T09:00'), now), 'Today, past due');
  assert.equal(dayLabel(item('2026-10-31T09:00'), now), 'D+2');
});

test('sortByDue puts the earliest first without changing the original', () => {
  const items = [item('2026-12-01T10:00'), item('2026-11-05T10:00')];
  assert.equal(sortByDue(items)[0].due, '2026-11-05T10:00');
  assert.equal(items[0].due, '2026-12-01T10:00');
});

test('groupDeadlines separates overdue, upcoming and done', () => {
  const groups = groupDeadlines([
    item('2026-11-01T10:00'),
    item('2026-11-05T10:00'),
    item('2026-11-06T10:00', 'Physics', true),
  ], now);
  assert.equal(groups.overdue.length, 1);
  assert.equal(groups.upcoming.length, 1);
  assert.equal(groups.done.length, 1);
});

test('groupDeadlines filters by subject', () => {
  const groups = groupDeadlines([item('2026-11-05T10:00'), item('2026-11-06T10:00', 'Math')], now, 'Math');
  assert.equal(groups.upcoming.length, 1);
  assert.equal(groups.upcoming[0].subject, 'Math');
});

test('countDueWithin includes the last day and skips done and overdue items', () => {
  const items = [
    item('2026-11-09T23:00'),
    item('2026-11-10T00:00'),
    item('2026-11-03T10:00', 'Physics', true),
    item('2026-11-01T10:00'),
  ];
  assert.equal(countDueWithin(items, now, 7), 1);
});

test('subjectsOf lists each subject once', () => {
  assert.deepEqual(subjectsOf([item('2026-11-05T10:00', 'Math'), item('2026-11-06T10:00', 'Math')]), ['Math']);
});

test('mergeSharedDeadlines gives a new user every school date, not done', () => {
  const shared = [{ id: 's1', title: 'a', subject: 'Math', due: '2026-11-05T10:00' }];
  const result = mergeSharedDeadlines([], [], shared);
  assert.equal(result.items[0].done, false);
  assert.deepEqual(result.seenSharedIds, ['s1']);
  assert.equal(result.added, 1);
});

test('mergeSharedDeadlines keeps edits and does not bring back deleted dates', () => {
  const shared = [
    { id: 's1', title: 'school title', subject: 'Math', due: '2026-11-05T10:00' },
    { id: 's2', title: 'b', subject: 'Math', due: '2026-11-06T10:00' },
  ];
  const mine = [{ id: 's1', title: 'my title', subject: 'Math', due: '2026-11-05T10:00', done: true }];
  const result = mergeSharedDeadlines(mine, ['s1', 's2'], shared);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, 'my title');
  assert.equal(result.added, 0);
});

test('mergeSharedDeadlines adds a school date published later', () => {
  const shared = [{ id: 's3', title: 'new', subject: 'Math', due: '2026-12-01T10:00' }];
  const result = mergeSharedDeadlines([], ['s1'], shared);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.seenSharedIds, ['s1', 's3']);
});

test('visibleDeadlines keeps chosen subjects and hides the rest', () => {
  const items = [item('2026-11-05T10:00', 'Physics'), item('2026-11-06T10:00', 'Biology')];
  assert.deepEqual(visibleDeadlines(items, ['Physics']).map((i) => i.subject), ['Physics']);
  assert.equal(visibleDeadlines(items, []).length, 0);
});

test('visibleDeadlines keeps a subject the user typed themselves', () => {
  const items = [item('2026-11-05T10:00', 'Driving test')];
  assert.equal(visibleDeadlines(items, ['Physics']).length, 1);
});

test('the subject list has unique names and the requested subjects', () => {
  assert.equal(new Set(SUBJECTS).size, SUBJECTS.length);
  for (const name of ['French', 'Chinese A', 'Chinese B', 'English A', 'English B', 'Japanese', 'Biology', 'Math AA', 'Geography']) {
    assert.ok(SUBJECTS.includes(name));
  }
  for (const old of ['Math', 'English', 'Chinese']) {
    assert.ok(!SUBJECTS.includes(old));
  }
});

test('renameOldSubjects moves existing Math and English data', () => {
  const result = renameOldSubjects(
    [item('2026-11-05T10:00', 'Math'), item('2026-11-06T10:00', 'English', true), item('2026-11-07T10:00', 'Physics')],
    ['Math', 'English', 'Physics'],
  );
  assert.deepEqual(result.items.map((i) => i.subject), ['Math AA', 'English B', 'Physics']);
  assert.equal(result.items[1].done, true);
  assert.deepEqual(result.chosenSubjects, ['Math AA', 'English B', 'Physics']);
  assert.equal(result.changed, true);
});

test('renameOldSubjects drops the unclear Chinese choice', () => {
  assert.deepEqual(renameOldSubjects([], ['Chinese', 'TOK']).chosenSubjects, ['TOK']);
});

test('renameOldSubjects changes nothing in up-to-date data', () => {
  const items = [item('2026-11-05T10:00', 'Math AA')];
  const result = renameOldSubjects(items, ['Math AA']);
  assert.equal(result.changed, false);
  assert.equal(result.items[0], items[0]);
});

test('validateDeadline cleans a good entry', () => {
  const { value } = validateDeadline({ title: ' IA ', subject: ' Math ', date: '2027-01-08', time: '10:55' });
  assert.deepEqual(value, { title: 'IA', subject: 'Math', due: '2027-01-08T10:55' });
});

test('validateDeadline uses 23:59 when no time is given', () => {
  assert.equal(validateDeadline({ title: 'IA', subject: 'Math', date: '2027-01-08', time: '' }).value.due, '2027-01-08T23:59');
});

test('validateDeadline reports missing or wrong input', () => {
  assert.ok(validateDeadline({ title: '', subject: 'Math', date: '2027-01-08' }).error);
  assert.ok(validateDeadline({ title: 'IA', subject: '', date: '2027-01-08' }).error);
  assert.ok(validateDeadline({ title: 'IA', subject: 'Math', date: '' }).error);
});
