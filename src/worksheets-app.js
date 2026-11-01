// Math worksheet list: open a worksheet or its solutions, tick it off when done.
import { compareCodes, groupWorksheetFiles, unitOf } from './worksheets.js';

const $ = (id) => document.getElementById(id);

let cloud = null;
let worksheets = [];
let done = {};
let notifyChange = () => {};
let loaded = false;

async function openFile(path) {
  // Open the tab right away: browsers block tabs opened after waiting for the network.
  const tab = window.open('', '_blank');
  try {
    const url = await cloud.worksheetFileUrl(path);
    if (tab) tab.location = url;
    else window.location.href = url;
  } catch (error) {
    if (tab) tab.close();
    $('w-error').textContent = `Could not open the file: ${error.message}`;
  }
}

function fileButton(label, path) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.disabled = !path;
  button.addEventListener('click', () => openFile(path));
  return button;
}

function render() {
  const list = $('w-list');
  list.replaceChildren();
  const sorted = [...worksheets].sort((a, b) => compareCodes(a.code, b.code));
  let lastUnit = null;
  for (const sheet of sorted) {
    if (unitOf(sheet.code) !== lastUnit) {
      lastUnit = unitOf(sheet.code);
      const heading = document.createElement('p');
      heading.className = 'group-title';
      heading.textContent = `Unit ${lastUnit}`;
      list.append(heading);
    }
    const row = document.createElement('div');
    row.className = done[sheet.code] ? 'deadline done' : 'deadline';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = Boolean(done[sheet.code]);
    check.setAttribute('aria-label', `Mark ${sheet.title} as done`);
    check.addEventListener('change', () => {
      if (check.checked) done[sheet.code] = true;
      else delete done[sheet.code];
      notifyChange({ worksheets: done });
      render();
    });

    const text = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'title';
    title.textContent = sheet.title;
    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = sheet.code;
    text.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(fileButton('Worksheet', sheet.question_file), fileButton('Solutions', sheet.solution_file));

    row.append(check, text, document.createElement('div'), actions);
    list.append(row);
  }
  if (sorted.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'note';
    empty.textContent = 'No worksheets yet.';
    list.append(empty);
  }
  const finished = sorted.filter((sheet) => done[sheet.code]).length;
  $('w-stats').textContent = sorted.length ? `${finished} of ${sorted.length} done` : '';
}

async function sha256(file) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function uploadFile(file) {
  if (!file) return null;
  const path = `${await sha256(file)}.pdf`;
  await cloud.uploadWorksheetFile(file, path);
  return path;
}

async function uploadWorksheets(files) {
  const status = $('w-upload-status');
  const { groups, skipped } = groupWorksheetFiles(files);
  const failed = [];
  let count = 0;
  for (const group of groups) {
    count += 1;
    status.textContent = `Uploading ${count} of ${groups.length}: ${group.title}... Do not close this window.`;
    try {
      const existing = worksheets.find((sheet) => sheet.code === group.code);
      const sheet = {
        code: group.code,
        title: group.title,
        question_file: (await uploadFile(group.questionFile)) ?? existing?.question_file ?? null,
        solution_file: (await uploadFile(group.solutionFile)) ?? existing?.solution_file ?? null,
      };
      await cloud.saveWorksheet(sheet);
      worksheets = [...worksheets.filter((other) => other.code !== sheet.code), sheet];
    } catch (error) {
      failed.push(`${group.title}: ${error.message}`);
    }
  }
  status.textContent = `Finished. ${groups.length - failed.length} worksheets saved, ${failed.length} failed, ${skipped.length} files skipped (not Math AA).`;
  if (failed.length > 0) $('w-error').textContent = failed.join(' / ');
  render();
}

// Worksheets load the first time the Practice tab opens.
export async function openWorksheets() {
  if (loaded) return;
  loaded = true;
  try {
    worksheets = await cloud.loadWorksheets();
    render();
  } catch (error) {
    loaded = false;
    // The list starts folded, so open it or the message would stay hidden.
    $('w-section').open = true;
    $('w-error').textContent = `Could not load worksheets: ${error.message}`;
  }
}

export function startWorksheets(saved, onChange, options) {
  cloud = options.cloud;
  done = saved ?? {};
  notifyChange = onChange;
  $('w-admin').hidden = !options.isAdmin;
  $('w-files').addEventListener('change', async () => {
    await openWorksheets();
    await uploadWorksheets($('w-files').files);
    $('w-files').value = '';
  });
}
