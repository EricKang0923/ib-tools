// Practice screen: shows a question, reveals the answer, records right or wrong.
import {
  filterQuestions,
  parseQuestionPath,
  pickRandom,
  progressStats,
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

function matching() {
  return filterQuestions(questions, progress, $('p-unit').value, $('p-status').value, Number($('p-year').value));
}

function renderStats() {
  const chosen = filterQuestions(questions, {}, $('p-unit').value, 'all', Number($('p-year').value));
  const { total, right, wrong, left } = progressStats(chosen, progress);
  $('p-stats').textContent = `${total} questions · ${right} right · ${wrong} wrong · ${left} not tried`;
}

function renderUnits() {
  $('p-unit').replaceChildren(new Option('All units', ''), ...unitsOf(questions).map((unit) => new Option(unit, unit)));
}

async function showQuestion(question) {
  const token = ++showToken;
  current = question;
  $('p-answer').hidden = true;
  $('p-reveal').hidden = !question;
  $('p-mark').hidden = true;
  $('p-image').hidden = true;
  $('p-image').removeAttribute('src');
  $('p-error').textContent = '';
  if (!question) {
    $('p-meta').textContent = 'No questions match these filters.';
    return;
  }
  $('p-meta').textContent = `${question.unit}${question.topic ? ` / ${question.topic}` : ''}`;
  try {
    const url = await cloud.questionImageUrl(question.id);
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
            const question = { id, ...parsed };
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

// Questions load the first time the tab opens, so other tabs stay fast.
export async function openPractice() {
  if (loaded) return;
  loaded = true;
  $('p-meta').textContent = 'Loading questions...';
  try {
    questions = await cloud.loadQuestions();
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

  for (const id of ['p-unit', 'p-status', 'p-year']) {
    $(id).addEventListener('change', () => {
      renderStats();
      nextQuestion();
    });
  }
  $('p-next').addEventListener('click', nextQuestion);
  $('p-reveal').addEventListener('click', () => {
    $('p-answer').textContent = `Answer: ${current.answer}  (${current.paper})`;
    $('p-answer').hidden = false;
    $('p-reveal').hidden = true;
    $('p-mark').hidden = false;
  });
  $('p-right').addEventListener('click', () => mark('right'));
  $('p-wrong').addEventListener('click', () => mark('wrong'));
  $('p-folder').addEventListener('change', async () => {
    await openPractice();
    await uploadFolder($('p-folder').files);
    $('p-folder').value = '';
  });
}
