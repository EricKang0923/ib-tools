// Chemistry revision notes: PDFs grouped by theme.
import { parseNotePath } from './worksheets.js';

const $ = (id) => document.getElementById(id);

let cloud = null;
let notes = [];
let loaded = false;
const openGroups = new Set();

async function openNote(id) {
  // Open the tab right away: browsers block tabs opened after waiting for the network.
  const tab = window.open('', '_blank');
  try {
    const url = await cloud.worksheetFileUrl(`${id}.pdf`);
    if (tab) tab.location = url;
    else window.location.href = url;
  } catch (error) {
    if (tab) tab.close();
    $('n-error').textContent = `Could not open the file: ${error.message}`;
  }
}

function render() {
  const list = $('n-list');
  list.replaceChildren();
  const groups = [...new Set(notes.map((note) => note.group_name))].sort();
  for (const group of groups) {
    const section = document.createElement('details');
    section.className = 'unit-group';
    section.open = openGroups.has(group);
    section.addEventListener('toggle', () => {
      if (section.open) openGroups.add(group);
      else openGroups.delete(group);
    });
    const summary = document.createElement('summary');
    summary.textContent = group;
    section.append(summary);
    const items = notes.filter((note) => note.group_name === group).sort((a, b) => a.title.localeCompare(b.title));
    for (const note of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'note-button';
      button.textContent = note.title;
      button.addEventListener('click', () => openNote(note.id));
      section.append(button);
    }
    list.append(section);
  }
  if (groups.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'note';
    empty.textContent = 'No notes yet.';
    list.append(empty);
  }
  $('n-stats').textContent = notes.length ? `${notes.length} files` : '';
}

async function sha256(file) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function uploadNotes(files) {
  const status = $('n-upload-status');
  const existing = new Set(notes.map((note) => note.id));
  const todo = [...files].filter((file) => parseNotePath(file.webkitRelativePath));
  let failed = 0;
  let count = 0;
  for (const file of todo) {
    count += 1;
    status.textContent = `Uploading ${count} of ${todo.length}... Do not close this window.`;
    try {
      const { group, title } = parseNotePath(file.webkitRelativePath);
      const id = await sha256(file);
      if (!existing.has(id)) {
        await cloud.uploadWorksheetFile(file, `${id}.pdf`);
        const note = { id, subject: 'Chemistry', group_name: group, title };
        await cloud.saveNote(note);
        notes.push(note);
        existing.add(id);
      }
    } catch (error) {
      failed += 1;
      $('n-error').textContent = error.message;
    }
  }
  status.textContent = `Finished. ${notes.length} notes in total, ${failed} failed. If any failed, choose the same folder again.`;
  render();
}

export async function openNotes() {
  if (loaded) return;
  loaded = true;
  try {
    notes = await cloud.loadNotes();
    render();
  } catch (error) {
    loaded = false;
    // The list starts folded, so open it or the message would stay hidden.
    $('n-section').open = true;
    $('n-error').textContent = `Could not load notes: ${error.message}`;
  }
}

export function startNotes(options) {
  cloud = options.cloud;
  $('n-admin').hidden = !options.isAdmin;
  $('n-folder').addEventListener('change', async () => {
    await openNotes();
    await uploadNotes($('n-folder').files);
    $('n-folder').value = '';
  });
}
