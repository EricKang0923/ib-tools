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
    name.setAttribute('aria-label', `과목 ${i + 1} 이름`);
    name.placeholder = '예: Physics HL';
    name.value = subject.name;
    name.addEventListener('input', () => {
      subject.name = name.value;
      notifyChange(state);
    });

    const scores = document.createElement('input');
    scores.className = 'scores';
    scores.setAttribute('aria-label', `과목 ${i + 1} 점수`);
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
  select.replaceChildren(new Option('선택', ''), ...GRADES.map((grade) => new Option(grade, grade)));
  select.value = value;
  select.onchange = () => onChange(select.value);
}

function buildCutoffs() {
  $('cutoffs').replaceChildren();
  state.cutoffs.forEach((cutoff) => {
    const label = document.createElement('label');
    label.textContent = `${cutoff.mark}점 (%)`;
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
  $('cutoff-error').textContent = valid ? '' : '높은 점수일수록 퍼센트도 높아야 하고, 값은 0~100 사이여야 해요.';

  const marks = state.subjects.map((subject, i) => {
    const { scores, invalid } = parseScores(subject.scores);
    const percent = average(scores);
    const mark = valid ? markFromPercent(percent, state.cutoffs) : null;
    const next = valid ? gapToNextMark(percent, state.cutoffs) : null;
    const row = rows[i];

    row.mark.textContent = mark ?? '-';
    row.avg.textContent = percent === null ? '' : `평균 ${percent.toFixed(2)}%`;
    row.detail.classList.toggle('error', invalid.length > 0);
    if (invalid.length > 0) {
      row.detail.textContent = `계산에서 뺀 값: ${invalid.join(', ')} (0~100 숫자만 가능해요)`;
    } else if (next) {
      row.detail.textContent = `${next.mark}점까지 ${next.gap.toFixed(2)}% 남음`;
    } else {
      row.detail.textContent = '';
    }
    return mark;
  });

  const result = calculateTotal(marks, state.tok, state.ee);
  $('total').textContent = result.total ?? '-';

  if (result.failing) {
    $('breakdown').textContent = 'TOK 또는 EE의 E는 디플로마 탈락 조건이에요.';
  } else if (result.total === null) {
    const missing = marks.filter((mark) => mark === null).length;
    const parts = [];
    if (missing > 0) parts.push(`과목 ${missing}개`);
    if (!state.tok || !state.ee) parts.push('TOK와 EE');
    $('breakdown').textContent = `입력 필요: ${parts.join(', ') || '점수 기준 확인'}`;
  } else {
    $('breakdown').textContent = `과목 ${result.subjectTotal}점 + 보너스 ${result.core}점. 학교 내신 기준의 추정치예요.`;
  }

  const target = state.target === '' ? null : Number(state.target);
  if (target === null || result.total === null) {
    $('target-result').textContent = '';
  } else if (result.total >= target) {
    $('target-result').textContent = `목표보다 ${result.total - target}점 높아요.`;
  } else {
    $('target-result').textContent = `목표까지 ${target - result.total}점 남았어요.`;
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
    if (!window.confirm('입력한 과목, 점수, 목표를 모두 지울까요?')) return;
    state = emptyState();
    buildAll();
    notifyChange(state);
  });

  buildAll();
}
