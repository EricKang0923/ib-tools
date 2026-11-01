// Practice screen: shows a question, reveals the answer, records right or wrong.
import {
  filterQuestions,
  parseQuestionPath,
  pickRandom,
  progressStats,
  rowFromManifest,
  unitsOf,
} from './questions.js';

const $ = (id) => document.getElementById(id);

let cloud = null;
let questions = [];
let progress = {};
let current = null;
let notifyChange = () => {};
let loaded = false;
let showToken = 0;

const NOTES = {
  Physics: 'Older questions may not match the current syllabus. Answers come from the file names and were not checked against official mark schemes.',
  Chemistry: 'The Questionbank uses older syllabus topics, so some questions may not match the current syllabus. Specimen markschemes show whole pages, which can include the next question.',
};

function isChemistry() {
  return $('p-subject').value === 'Chemistry';
}

function extraFilters() {
  return {
    subject: $('p-subject').value,
    paperType: isChemistry() ? $('p-paper').value : '',
    level: isChemistry() ? $('p-level').value : '',
  };
}

function minYear() {
  return isChemistry() ? 0 : Number($('p-year').value);
}

function matching() {
  return filterQuestions(questions, progress, $('p-unit').value, $('p-status').value, minYear(), extraFilters());
}

function renderStats() {
  const chosen = filterQuestions(questions, {}, $('p-unit').value, 'all', minYear(), extraFilters());
  const { total, right, wrong, left } = progressStats(chosen, progress);
  $('p-stats').textContent = `${total} questions · ${right} right · ${wrong} wrong · ${left} not tried`;
}

function renderUnits() {
  const units = unitsOf(questions.filter((question) => question.subject === $('p-subject').value));
  $('p-unit').replaceChildren(new Option('All units', ''), ...units.map((unit) => new Option(unit, unit)));
}

function renderSubjectControls() {
  const chem = isChemistry();
  $('p-paper-row').hidden = !chem;
  $('p-level-row').hidden = !chem;
  $('p-year-row').hidden = chem;
  $('p-note').textContent = NOTES[$('p-subject').value];
}

function hideImage(image) {
  image.hidden = true;
  image.removeAttribute('src');
}

async function showImage(image, name, label, token) {
  try {
    const url = await cloud.questionImageUrl(name, 'webp');
    if (token !== showToken) return;
    image.src = url;
    image.alt = label;
    image.hidden = false;
  } catch (error) {
    if (token === showToken) $('p-error').textContent = `Could not load the image: ${error.message}`;
  }
}

function reveal() {
  const token = showToken;
  const parts = [];
  if (current.answer) parts.push(`Answer: ${current.answer}`);
  parts.push(`(${current.paper})`);
  $('p-answer').textContent = parts.join('  ');
  $('p-answer').hidden = false;
  $('p-reveal').hidden = true;
  $('p-mark').hidden = false;
  if (current.has_answer_image) showImage($('p-answer-image'), `${current.id}-a`, 'Markscheme', token);
  if (current.has_report) {
    $('p-report-label').hidden = false;
    showImage($('p-report-image'), `${current.id}-r`, 'Examiner report', token);
  }
}

async function showQuestion(question) {
  const token = ++showToken;
  current = question;
  $('p-answer').hidden = true;
  $('p-reveal').hidden = !question;
  $('p-mark').hidden = true;
  $('p-report-label').hidden = true;
  hideImage($('p-image'));
  hideImage($('p-answer-image'));
  hideImage($('p-report-image'));
  $('p-error').textContent = '';
  if (!question) {
    $('p-meta').textContent = 'No questions match these filters.';
    return;
  }
  $('p-meta').textContent = `${question.unit}${question.topic ? ` / ${question.topic}` : ''}`;
  try {
    // Physics images were uploaded as PNG, Chemistry images are smaller WebP files.
    const extension = question.subject === 'Chemistry' ? 'webp' : 'png';
    const url = await cloud.questionImageUrl(question.id, extension);
    // A newer question may have been chosen while this link was loading.
    if (token !== showToken) return;
    $('p-image').src = url;
    $('p-image').alt = `Question from ${question.paper}`;
    $('p-image').hidden = false;
  } catch (error) {
    if (token === showToken) $('p-error').textContent = `Could not load the question: ${error.message}`;
  }
}

function nextQuestion() {
  showQuestion(pickRandom(matching().filter((question) => question.id !== current?.id)) ?? pickRandom(matching()));
}

function mark(result) {
  progress[current.id] = { result, at: new Date().toISOString() };
  notifyChange({ progress });
  renderStats();
  nextQuestion();
}

async function sha256(file) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Stored under a hash of the image, so the file name can't give away the answer.
async function uploadFolder(files) {
  const status = $('p-upload-status');
  const existing = new Set(questions.map((question) => question.id));
  const todo = [...files].filter((file) => file.name.endsWith('.png') && !file.name.startsWith('._'));
  const unreadable = [];
  const failed = [];
  let done = 0;
  let index = 0;

  async function worker() {
    while (index < todo.length) {
      const file = todo[index];
      index += 1;
      const parsed = parseQuestionPath(file.webkitRelativePath);
      if (!parsed) {
        unreadable.push(file.name);
      } else {
        try {
          const id = await sha256(file);
          if (!existing.has(id)) {
            existing.add(id);
            const question = { id, subject: 'Physics', ...parsed };
            await cloud.uploadQuestion(file, question);
            questions.push(question);
          }
        } catch (error) {
          failed.push(`${file.name}: ${error.message}`);
        }
      }
      done += 1;
      status.textContent = `Processing ${done} of ${todo.length}... Do not close this window.`;
    }
  }

  await Promise.all([worker(), worker(), worker(), worker()]);
  status.textContent = `Finished. ${questions.length} questions in total, ${failed.length} failed, ${unreadable.length} unreadable names. If any failed, choose the same folder again.`;
  if (failed.length > 0) console.error(failed);
  renderUnits();
  renderStats();
  if (!current) nextQuestion();
}

// Uploads a folder made by the split tool: images plus manifest files that describe them.
async function uploadChemistryFolder(files) {
  const status = $('p-chem-status');
  const byName = new Map([...files].map((file) => [file.name, file]));
  const manifests = [...files].filter((file) => /^manifest.*\.json$/.test(file.name));
  const entries = [];
  for (const file of manifests) entries.push(...JSON.parse(await file.text()).questions);
  const existing = new Set(questions.map((question) => question.id));
  const todo = entries.filter((entry) => !existing.has(entry.id));
  let failed = 0;
  let done = 0;
  let index = 0;

  async function worker() {
    while (index < todo.length) {
      const entry = todo[index];
      index += 1;
      try {
        await cloud.uploadQuestionImage(byName.get(entry.files.question), entry.id);
        if (entry.files.answer) await cloud.uploadQuestionImage(byName.get(entry.files.answer), `${entry.id}-a`);
        if (entry.files.report) await cloud.uploadQuestionImage(byName.get(entry.files.report), `${entry.id}-r`);
        const row = rowFromManifest(entry);
        await cloud.saveQuestionRow(row);
        questions.push(row);
      } catch (error) {
        failed += 1;
        console.error(entry.source, error);
      }
      done += 1;
      status.textContent = `Uploading ${done} of ${todo.length}... Do not close this window.`;
    }
  }

  await Promise.all([worker(), worker(), worker(), worker()]);
  const total = questions.filter((question) => question.subject === 'Chemistry').length;
  status.textContent = `Finished. ${total} Chemistry questions in total, ${failed} failed. If any failed, choose the same folder again.`;
  renderUnits();
  renderStats();
}

// Questions load the first time the tab opens, so other tabs stay fast.
export async function openPractice() {
  if (loaded) return;
  loaded = true;
  $('p-meta').textContent = 'Loading questions...';
  try {
    questions = await cloud.loadQuestions();
    renderSubjectControls();
    renderUnits();
    renderStats();
    if (questions.length === 0) {
      $('p-meta').textContent = 'No questions yet.';
      $('p-reveal').hidden = true;
    } else {
      nextQuestion();
    }
  } catch (error) {
    loaded = false;
    $('p-meta').textContent = '';
    $('p-error').textContent = `Could not load questions: ${error.message}`;
  }
}

export function startPractice(saved, onChange, options) {
  cloud = options.cloud;
  progress = saved?.progress ?? {};
  notifyChange = onChange;
  $('p-admin').hidden = !options.isAdmin;

  for (const id of ['p-unit', 'p-status', 'p-year', 'p-paper', 'p-level']) {
    $(id).addEventListener('change', () => {
      renderStats();
      nextQuestion();
    });
  }
  $('p-subject').addEventListener('change', () => {
    renderSubjectControls();
    renderUnits();
    renderStats();
    nextQuestion();
  });
  $('p-next').addEventListener('click', nextQuestion);
  $('p-reveal').addEventListener('click', reveal);
  $('p-chem-folder').addEventListener('change', async () => {
    await openPractice();
    await uploadChemistryFolder($('p-chem-folder').files);
    $('p-chem-folder').value = '';
  });
  $('p-right').addEventListener('click', () => mark('right'));
  $('p-wrong').addEventListener('click', () => mark('wrong'));
  $('p-folder').addEventListener('change', async () => {
    await openPractice();
    await uploadFolder($('p-folder').files);
    $('p-folder').value = '';
  });
}
