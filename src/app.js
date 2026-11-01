// Calculator screen: reads what the user typed, calls calculator.js, shows the results.
import {
  DEFAULT_CUTOFFS,
  average,
  calculateTotal,
  cutoffsAreValid,
  gapToNextMark,
  markFromPercent,
  parseScores,
} from './calculator.js';

const SUBJECT_COUNT = 6;
const GRADES = ['A', 'B', 'C', 'D', 'E'];

const $ = (id) => document.getElementById(id);

function emptyState() {
  return {
    subjects: Array.from({ length: SUBJECT_COUNT }, () => ({ name: '', scores: '' })),
    tok: '',
    ee: '',
    target: '',
    cutoffs: DEFAULT_CUTOFFS.map((cutoff) => ({ ...cutoff })),
  };
}

let state = emptyState();
let notifyChange = () => {};
const rows = [];

function buildSubjects() {
  $('subjects').replaceChildren();
  rows.length = 0;
  state.subjects.forEach((subject, i) => {
    const row = document.createElement('div');
    row.className = 'subject';

    const name = document.createElement('input');
    name.setAttribute('aria-label', `Subject ${i + 1} name`);
    name.placeholder = 'e.g. Physics HL';
    name.value = subject.name;
    name.addEventListener('input', () => {
      subject.name = name.value;
      notifyChange(state);
    });

    const scores = document.createElement('input');
    scores.className = 'scores';
    scores.setAttribute('aria-label', `Subject ${i + 1} scores`);
    scores.placeholder = '92, 80, 76';
    scores.value = subject.scores;
    scores.addEventListener('input', () => {
      subject.scores = scores.value;
      update();
      notifyChange(state);
    });

    const result = document.createElement('div');
    result.className = 'result';
    const mark = document.createElement('div');
    mark.className = 'mark';
    const avg = document.createElement('div');
    avg.className = 'average';
    result.append(mark, avg);

    const detail = document.createElement('p');
    detail.className = 'detail';

    row.append(name, scores, result, detail);
    $('subjects').append(row);
    rows.push({ mark, avg, detail });
  });
}

function buildGradeSelect(select, value, onChange) {
  select.replaceChildren(new Option('Select', ''), ...GRADES.map((grade) => new Option(grade, grade)));
  select.value = value;
  select.onchange = () => onChange(select.value);
}

function buildCutoffs() {
  $('cutoffs').replaceChildren();
  state.cutoffs.forEach((cutoff) => {
    const label = document.createElement('label');
    label.textContent = `Mark ${cutoff.mark} (%)`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.step = '0.1';
    input.value = cutoff.min;
    input.addEventListener('input', () => {
      cutoff.min = input.value === '' ? NaN : Number(input.value);
      update();
      // Don't save a broken table; it would come back broken on the next login.
      if (cutoffsAreValid(state.cutoffs)) notifyChange(state);
    });
    label.append(input);
    $('cutoffs').append(label);
  });
}

function update() {
  const valid = cutoffsAreValid(state.cutoffs);
  $('cutoff-error').textContent = valid ? '' : 'Higher marks need higher percentages, and values must be from 0 to 100.';

  const marks = state.subjects.map((subject, i) => {
    const { scores, invalid } = parseScores(subject.scores);
    const percent = average(scores);
    const mark = valid ? markFromPercent(percent, state.cutoffs) : null;
    const next = valid ? gapToNextMark(percent, state.cutoffs) : null;
    const row = rows[i];

    row.mark.textContent = mark ?? '-';
    row.avg.textContent = percent === null ? '' : `Average ${percent.toFixed(2)}%`;
    row.detail.classList.toggle('error', invalid.length > 0);
    if (invalid.length > 0) {
      row.detail.textContent = `Left out: ${invalid.join(', ')} (only numbers from 0 to 100 count)`;
    } else if (next) {
      row.detail.textContent = `${next.gap.toFixed(2)}% to a ${next.mark}`;
    } else {
      row.detail.textContent = '';
    }
    return mark;
  });

  const result = calculateTotal(marks, state.tok, state.ee);
  $('total').textContent = result.total ?? '-';

  if (result.failing) {
    $('breakdown').textContent = 'An E in TOK or EE is a failing condition for the diploma.';
  } else if (result.total === null) {
    const missing = marks.filter((mark) => mark === null).length;
    const parts = [];
    if (missing > 0) parts.push(`${missing} subject${missing === 1 ? '' : 's'}`);
    if (!state.tok || !state.ee) parts.push('TOK and EE');
    $('breakdown').textContent = `Still needed: ${parts.join(', ') || 'check the grade cutoffs'}`;
  } else {
    $('breakdown').textContent = `${result.subjectTotal} from subjects + ${result.core} bonus. An estimate based on school cutoffs.`;
  }

  const target = state.target === '' ? null : Number(state.target);
  if (target === null || result.total === null) {
    $('target-result').textContent = '';
  } else if (result.total >= target) {
    $('target-result').textContent = `${result.total - target} above your target.`;
  } else {
    $('target-result').textContent = `${target - result.total} below your target.`;
  }
}

function buildAll() {
  buildSubjects();
  buildCutoffs();
  buildGradeSelect($('tok'), state.tok, (value) => { state.tok = value; update(); notifyChange(state); });
  buildGradeSelect($('ee'), state.ee, (value) => { state.ee = value; update(); notifyChange(state); });
  $('target').value = state.target;
  update();
}

export function startCalculator(saved, onChange) {
  state = { ...emptyState(), ...saved };
  notifyChange = onChange;

  $('target').addEventListener('input', () => {
    state.target = $('target').value;
    update();
    notifyChange(state);
  });

  $('reset').addEventListener('click', () => {
    if (!window.confirm('Clear all subjects, scores and your target?')) return;
    state = emptyState();
    buildAll();
    notifyChange(state);
  });

  buildAll();
}
