// Deadline logic. No screen code here, so tests can check it directly.
// Due dates are stored as local time text: "2026-11-04T09:20".

// These names must match the subject on each school date.
export const SUBJECTS = [
  'Biology',
  'Business',
  'Chemistry',
  'Chinese A',
  'Chinese B',
  'English A',
  'English B',
  'French',
  'Geography',
  'Japanese',
  'Korean',
  'Math AA',
  'Physics',
  'TOK',
];

// Older data used these names. All existing English dates are English B.
const RENAMED = { Math: 'Math AA', English: 'English B' };

// Updates old subject names in saved data. "Chinese" is dropped from the chosen list
// because it could mean A or B, so the user picks again. No dates used that name.
export function renameOldSubjects(items, chosenSubjects) {
  const newItems = items.map((item) => (
    RENAMED[item.subject] ? { ...item, subject: RENAMED[item.subject] } : item
  ));
  const newChosen = chosenSubjects
    .filter((name) => name !== 'Chinese')
    .map((name) => RENAMED[name] ?? name);
  const changed = newItems.some((item, i) => item !== items[i])
    || newChosen.join() !== chosenSubjects.join();
  return { items: newItems, chosenSubjects: newChosen, changed };
}

// Shows the chosen subjects. Anything under a subject name the user typed themselves
// stays visible, because it isn't on the list and so can't be chosen or hidden.
export function visibleDeadlines(items, chosen) {
  return items.filter((item) => chosen.includes(item.subject) || !SUBJECTS.includes(item.subject));
}

export function parseDue(due) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(due ?? '');
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  // JavaScript turns Feb 31 into Mar 3, so check the date stayed the same.
  const same = date.getMonth() === month - 1 && date.getDate() === day
    && date.getHours() === hour && date.getMinutes() === minute;
  return same ? date : null;
}

// Whole calendar days from today to the due date. Negative means past.
export function daysUntil(due, now) {
  const date = parseDue(due);
  const startOfDue = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const startOfToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((startOfDue - startOfToday) / 86400000);
}

export function isOverdue(item, now) {
  return !item.done && parseDue(item.due) < now;
}

export function dayLabel(item, now) {
  const days = daysUntil(item.due, now);
  if (days === 0) return isOverdue(item, now) ? 'Today, past due' : 'Today';
  return days > 0 ? `D-${days}` : `D+${-days}`;
}

export function sortByDue(items) {
  return [...items].sort((a, b) => parseDue(a.due) - parseDue(b.due));
}

export function subjectsOf(items) {
  return [...new Set(items.map((item) => item.subject))].sort();
}

// Sorts one subject (or all, when subject is empty) into the three lists on screen.
export function groupDeadlines(items, now, subject = '') {
  const chosen = sortByDue(items.filter((item) => !subject || item.subject === subject));
  return {
    overdue: chosen.filter((item) => isOverdue(item, now)),
    upcoming: chosen.filter((item) => !item.done && !isOverdue(item, now)),
    done: chosen.filter((item) => item.done),
  };
}

export function countDueWithin(items, now, days) {
  return items.filter((item) => {
    if (item.done || isOverdue(item, now)) return false;
    return daysUntil(item.due, now) <= days;
  }).length;
}

// Copies school dates the user hasn't received yet. A date the user deleted
// stays in seenSharedIds, so it doesn't come back at the next login.
export function mergeSharedDeadlines(items, seenSharedIds, shared) {
  const seen = new Set(seenSharedIds);
  const fresh = shared
    .filter((item) => !seen.has(item.id))
    .map((item) => ({ ...item, done: false }));
  return {
    items: [...items, ...fresh],
    seenSharedIds: [...seenSharedIds, ...fresh.map((item) => item.id)],
    added: fresh.length,
  };
}

// Returns a clean deadline, or an error message to show the user.
export function validateDeadline({ title, subject, date, time }) {
  const cleanTitle = (title ?? '').trim();
  const cleanSubject = (subject ?? '').trim();
  if (!cleanTitle) return { error: 'Please enter a task.' };
  if (!cleanSubject) return { error: 'Please enter a subject.' };
  const due = `${date}T${time || '23:59'}`;
  if (!parseDue(due)) return { error: 'Please check the date and time.' };
  return { value: { title: cleanTitle, subject: cleanSubject, due } };
}
