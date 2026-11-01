// Deadline screen.
import {
  SUBJECTS,
  countDueWithin,
  dayLabel,
  groupDeadlines,
  isOverdue,
  mergeSharedDeadlines,
  renameOldSubjects,
  sortByDue,
  subjectsOf,
  validateDeadline,
  visibleDeadlines,
} from './deadlines.js';

const $ = (id) => document.getElementById(id);

let items = [];
let seenSharedIds = [];
let chosenSubjects = [];
let editingId = null;
let notifyChange = () => {};
let addShared = null;

function changed() {
  notifyChange({ items, seenSharedIds, chosenSubjects });
}

function formatDue(due) {
  const [date, time] = due.split('T');
  const [year, month, day] = date.split('-');
  return `${year}.${month}.${day} ${time}`;
}

function renderItem(item, now) {
  const row = document.createElement('div');
  row.className = item.done ? 'deadline done' : 'deadline';

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.checked = item.done;
  check.setAttribute('aria-label', `Mark ${item.title} as done`);
  check.addEventListener('change', () => {
    item.done = check.checked;
    changed();
    render();
  });

  const text = document.createElement('div');
  const title = document.createElement('p');
  title.className = 'title';
  title.textContent = item.title;
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = `${item.subject} · ${formatDue(item.due)}`;
  text.append(title, meta);

  const day = document.createElement('div');
  day.className = isOverdue(item, now) ? 'day late' : 'day';
  day.textContent = item.done ? 'Done' : dayLabel(item, now);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.textContent = 'Edit';
  edit.addEventListener('click', () => startEdit(item));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    items = items.filter((other) => other.id !== item.id);
    if (editingId === item.id) resetForm();
    changed();
    render();
  });
  actions.append(edit, remove);

  row.append(check, text, day, actions);
  return row;
}

function renderGroup(container, label, list, now, late = false) {
  if (list.length === 0) return;
  const title = document.createElement('p');
  title.className = late ? 'group-title late' : 'group-title';
  title.textContent = `${label} (${list.length})`;
  container.append(title, ...list.map((item) => renderItem(item, now)));
}

function renderFilter() {
  const select = $('d-filter');
  const current = select.value;
  const subjects = subjectsOf(visibleDeadlines(items, chosenSubjects));
  select.replaceChildren(new Option('All', ''), ...subjects.map((name) => new Option(name, name)));
  select.value = subjects.includes(current) ? current : '';
  $('subject-list').replaceChildren(...SUBJECTS.map((name) => new Option(name)));
}

function renderSubjectChoices() {
  $('d-subject-choices').replaceChildren(...SUBJECTS.map((name) => {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = chosenSubjects.includes(name);
    box.addEventListener('change', () => {
      chosenSubjects = box.checked
        ? [...chosenSubjects, name]
        : chosenSubjects.filter((subject) => subject !== name);
      changed();
      render();
    });
    label.append(box, ` ${name}`);
    return label;
  }));
}

function render() {
  const now = new Date();
  // Until a subject is chosen, the page only asks for subjects.
  const ready = chosenSubjects.length > 0;
  $('d-content').hidden = !ready;
  $('d-choose-note').hidden = ready;
  if (!ready) {
    $('d-subjects').open = true;
    return;
  }
  renderFilter();
  const visible = visibleDeadlines(items, chosenSubjects);
  const groups = groupDeadlines(visible, now, $('d-filter').value);
  const lists = $('deadline-lists');
  lists.replaceChildren();
  renderGroup(lists, 'Overdue', groups.overdue, now, true);
  renderGroup(lists, 'Upcoming', groups.upcoming, now);
  renderGroup(lists, 'Done', groups.done, now);
  if (lists.childElementCount === 0) {
    const empty = document.createElement('p');
    empty.className = 'note';
    empty.textContent = 'No deadlines for these subjects yet. Add one above.';
    lists.append(empty);
  }

  $('due-soon').textContent = countDueWithin(visible, now, 7);
  const next = sortByDue(visible).find((item) => !item.done && !isOverdue(item, now));
  $('next-due').textContent = next ? `Next: ${next.title} (${dayLabel(next, now)})` : '';
}

function startEdit(item) {
  editingId = item.id;
  const [date, time] = item.due.split('T');
  $('d-title').value = item.title;
  $('d-subject').value = item.subject;
  $('d-date').value = date;
  $('d-time').value = time;
  $('form-title').textContent = 'Edit deadline';
  $('d-save').textContent = 'Save';
  $('d-cancel').hidden = false;
  $('d-share-row').hidden = true;
  $('d-error').textContent = '';
  $('deadline-form').scrollIntoView({ block: 'center' });
  $('d-title').focus();
}

function resetForm() {
  editingId = null;
  $('deadline-form').reset();
  $('form-title').textContent = 'Add a deadline';
  $('d-save').textContent = 'Add';
  $('d-cancel').hidden = true;
  $('d-share-row').hidden = !addShared;
  $('d-error').textContent = '';
}

export function startDeadlines(saved, shared, onChange, options = {}) {
  notifyChange = onChange;
  addShared = options.addShared ?? null;
  $('d-share-row').hidden = !addShared;
  const merged = mergeSharedDeadlines(saved.items ?? [], saved.seenSharedIds ?? [], shared);
  const renamed = renameOldSubjects(merged.items, saved.chosenSubjects ?? []);
  items = renamed.items;
  seenSharedIds = merged.seenSharedIds;
  chosenSubjects = renamed.chosenSubjects;
  renderSubjectChoices();
  if (merged.added > 0 || renamed.changed) changed();

  $('deadline-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const { value, error } = validateDeadline({
      title: $('d-title').value,
      subject: $('d-subject').value,
      date: $('d-date').value,
      time: $('d-time').value,
    });
    if (error) {
      $('d-error').textContent = error;
      return;
    }
    if (editingId) {
      Object.assign(items.find((item) => item.id === editingId), value);
    } else if (addShared && $('d-share').checked) {
      const id = `school-${crypto.randomUUID()}`;
      $('d-save').disabled = true;
      try {
        await addShared({ id, ...value });
      } catch (shareError) {
        $('d-error').textContent = `Could not share: ${shareError.message}`;
        return;
      } finally {
        $('d-save').disabled = false;
      }
      items.push({ id, ...value, done: false });
      seenSharedIds.push(id);
    } else {
      items.push({ id: `${Date.now()}-${Math.random()}`, ...value, done: false });
    }
    resetForm();
    changed();
    render();
  });

  $('d-cancel').addEventListener('click', resetForm);
  $('d-filter').addEventListener('change', render);
  render();
}
