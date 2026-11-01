// Starts the app: appearance, tabs, login, and saving to the cloud.
import { startCalculator } from './app.js';
import { startDeadlines } from './deadlines-app.js';
import { delayedSaver } from './saver.js';

const APPEARANCE_KEY = 'ib-appearance';
const VIEW_KEY = 'ib-view';

const $ = (id) => document.getElementById(id);

// Browser storage is used only for these small preferences, never for grades.
function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The preference just won't be remembered.
  }
}

function setUpAppearance() {
  let appearance = { theme: 'system', accent: 'blue' };
  try {
    appearance = { ...appearance, ...JSON.parse(read(APPEARANCE_KEY)) };
  } catch {
    // Keep the defaults.
  }

  const apply = () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = appearance.theme === 'system' ? (prefersDark ? 'dark' : 'light') : appearance.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = appearance.accent;
  };

  for (const name of ['theme', 'accent']) {
    $(name).value = appearance[name];
    $(name).addEventListener('change', () => {
      appearance[name] = $(name).value;
      write(APPEARANCE_KEY, JSON.stringify(appearance));
      apply();
    });
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
  apply();
}

function showView(view) {
  for (const button of document.querySelectorAll('.tabs button')) {
    const active = button.dataset.view === view;
    $(`view-${button.dataset.view}`).hidden = !active;
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  write(VIEW_KEY, view);
}

function showScreen(screen) {
  $('login-screen').hidden = screen !== 'login';
  $('app-screen').hidden = screen !== 'app';
  $('loading').hidden = screen !== 'loading';
}

function showFatal(message) {
  showScreen('loading');
  $('loading').textContent = message;
}

const SAVE_TEXT = {
  saving: '저장 중...',
  saved: '저장됨',
  failed: '저장 실패. 인터넷을 확인해 주세요. 다음 변경 때 다시 시도해요.',
};

async function openApp(cloud, user) {
  showScreen('loading');
  $('loading').textContent = '불러오는 중...';
  const [saved, shared, isAdmin] = await Promise.all([
    cloud.loadUserData(user.id),
    cloud.loadSharedDeadlines(),
    cloud.checkIsAdmin(user.id),
  ]);

  const saver = delayedSaver({
    save: (changes) => cloud.saveUserData(user.id, changes),
    onStatus: (status) => {
      $('save-status').textContent = SAVE_TEXT[status];
    },
  });

  startCalculator(saved.calculator, (calculator) => saver.change({ calculator }));
  startDeadlines(saved.deadlines, shared, (deadlines) => saver.change({ deadlines }), {
    addShared: isAdmin ? cloud.addSharedDeadline : null,
  });

  $('account').textContent = user.email;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saver.flush();
  });
  $('logout').onclick = async () => {
    await saver.flush();
    await cloud.logOut();
    // A full reload clears this user's grades from the page.
    window.location.reload();
  };
  $('password-form').onsubmit = async (event) => {
    event.preventDefault();
    const message = $('password-message');
    try {
      await cloud.changePassword($('new-password').value);
      $('new-password').value = '';
      message.textContent = '비밀번호를 바꿨어요.';
    } catch (error) {
      message.textContent = `바꾸지 못했어요: ${error.message}`;
    }
  };
  $('security-check').onclick = async () => {
    const list = $('security-results');
    list.textContent = '확인 중...';
    const results = await cloud.runSecurityCheck(user.id, isAdmin);
    list.replaceChildren(...results.map(({ label, safe }) => {
      const item = document.createElement('li');
      item.textContent = `${safe ? '통과' : '문제 있음'}: ${label}`;
      item.className = safe ? '' : 'error';
      return item;
    }));
  };

  showScreen('app');
}

function setUpLogin(cloud) {
  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('login-error').textContent = '';
    $('login-button').disabled = true;
    try {
      const user = await cloud.logIn($('email').value.trim(), $('password').value);
      $('password').value = '';
      await openApp(cloud, user);
    } catch (error) {
      showScreen('login');
      const wrongLogin = error.code === 'invalid_credentials' || error.status === 400;
      $('login-error').textContent = wrongLogin
        ? '이메일 또는 비밀번호가 맞지 않아요.'
        : `로그인하지 못했어요: ${error.message}`;
    } finally {
      $('login-button').disabled = false;
    }
  });
}

async function start() {
  setUpAppearance();
  for (const button of document.querySelectorAll('.tabs button')) {
    button.addEventListener('click', () => showView(button.dataset.view));
  }
  showView(read(VIEW_KEY) === 'deadlines' ? 'deadlines' : 'calculator');

  // The older version kept grades in this browser. They now live in the account.
  try {
    localStorage.removeItem('ib-calculator');
    localStorage.removeItem('ib-deadlines');
  } catch {
    // Nothing to remove.
  }

  let cloud;
  try {
    cloud = await import('./cloud.js');
  } catch {
    showFatal('로그인 기능을 불러오지 못했어요. 인터넷을 확인하고 새로고침해 주세요.');
    return;
  }

  setUpLogin(cloud);
  try {
    const user = await cloud.currentUser();
    if (user) await openApp(cloud, user);
    else showScreen('login');
  } catch (error) {
    showFatal(`데이터를 불러오지 못했어요. 새로고침해 주세요. (${error.message})`);
  }
}

start();
