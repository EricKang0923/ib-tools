// Starts the app: appearance, tabs, login, and saving to the cloud.
import { startCalculator } from './app.js';
import { startDeadlines } from './deadlines-app.js';
import { openPractice, startPractice } from './practice-app.js';
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
  saving: 'Saving...',
  saved: 'Saved',
  failed: 'Could not save. Check your internet. It will try again on your next change.',
};

async function openApp(cloud, user) {
  showScreen('loading');
  $('loading').textContent = 'Loading...';
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
  startPractice(saved.practice, (practice) => saver.change({ practice }), { cloud, isAdmin });
  for (const button of document.querySelectorAll('.tabs button')) {
    button.addEventListener('click', () => {
      if (button.dataset.view === 'practice') openPractice();
    });
  }
  if (!$('view-practice').hidden) openPractice();

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
      message.textContent = 'Password changed.';
    } catch (error) {
      message.textContent = `Could not change it: ${error.message}`;
    }
  };
  $('security-check').onclick = async () => {
    const list = $('security-results');
    list.textContent = 'Checking...';
    const results = await cloud.runSecurityCheck(user.id, isAdmin);
    list.replaceChildren(...results.map(({ label, safe }) => {
      const item = document.createElement('li');
      item.textContent = `${safe ? 'Pass' : 'PROBLEM'}: ${label}`;
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
        ? 'Wrong email or password.'
        : `Could not log in: ${error.message}`;
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
  showView(['deadlines', 'practice'].includes(read(VIEW_KEY)) ? read(VIEW_KEY) : 'calculator');

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
    showFatal('Could not load the login. Check your internet and refresh.');
    return;
  }

  setUpLogin(cloud);
  try {
    const user = await cloud.currentUser();
    if (user) await openApp(cloud, user);
    else showScreen('login');
  } catch (error) {
    showFatal(`Could not load your data. Please refresh. (${error.message})`);
  }
}

start();
