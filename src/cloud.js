// Everything that talks to Supabase: login, loading and saving.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_KEY, SUPABASE_URL } from './config.js';

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function currentUser() {
  const { data } = await client.auth.getSession();
  return data.session?.user ?? null;
}

export async function logIn(email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function logOut() {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function changePassword(password) {
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

// Returns this user's saved data, or empty data on their first login.
export async function loadUserData(userId) {
  const { data, error } = await client
    .from('user_data')
    .select('calculator, deadlines, practice')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? { calculator: {}, deadlines: {}, practice: {} };
}

export async function loadSharedDeadlines() {
  const { data, error } = await client.from('shared_deadlines').select('id, title, subject, due');
  if (error) throw error;
  return data;
}

// The database returns at most 1,000 rows at a time, so ask page by page.
export async function loadQuestions() {
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('questions')
      .select('id, unit, topic, paper, year, answer')
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < pageSize) return all;
  }
}

// The link stops working after an hour, so it can't be passed around.
export async function questionImageUrl(id) {
  const { data, error } = await client.storage.from('questions').createSignedUrl(`${id}.png`, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadQuestion(file, question) {
  const { error: uploadError } = await client.storage
    .from('questions')
    .upload(`${question.id}.png`, file, { contentType: 'image/png' });
  // An earlier interrupted upload may have stored the image already.
  if (uploadError && String(uploadError.statusCode) !== '409') throw uploadError;
  const { error } = await client.from('questions').insert(question);
  if (error) throw error;
}

// If the check itself fails, the user just gets the normal, non-admin screen.
export async function checkIsAdmin(userId) {
  const { data, error } = await client.from('admins').select('user_id').eq('user_id', userId);
  return !error && data.length === 1;
}

export async function addSharedDeadline(deadline) {
  const { error } = await client.from('shared_deadlines').insert(deadline);
  if (error) throw error;
}

export async function saveUserData(userId, changes) {
  const { error } = await client
    .from('user_data')
    .upsert({ user_id: userId, ...changes, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Tries things the database rules must block, using the real signed-in account.
// Each result is true when the data is protected.
export async function runSecurityCheck(userId, isAdmin) {
  const fakeId = '00000000-0000-0000-0000-000000000000';

  const others = await client.from('user_data').select('user_id').neq('user_id', userId);
  const write = await client.from('user_data').insert({ user_id: fakeId });
  const change = await client
    .from('user_data')
    .update({ deadlines: {} })
    .neq('user_id', userId)
    .select('user_id');
  const madeAdmin = await client.from('admins').insert({ user_id: userId });

  const results = [
    { label: 'Other users\' data is not visible', safe: !others.error && others.data.length === 0 },
    // 42501 means the rules refused it, not that something else went wrong.
    { label: 'Cannot save as another user', safe: write.error?.code === '42501' },
    { label: 'Cannot change other users\' data', safe: !change.error && change.data.length === 0 },
    { label: 'Cannot make yourself an admin', safe: madeAdmin.error?.code === '42501' },
  ];

  // This attempt would really succeed for the admin, so only run it for others.
  if (!isAdmin) {
    const school = await client
      .from('shared_deadlines')
      .insert({ id: 'security-check', title: 'x', subject: 'x', due: '2026-01-01T00:00' });
    results.push({ label: 'Regular users cannot add shared dates', safe: school.error?.code === '42501' });
    const question = await client
      .from('questions')
      .insert({ id: 'security-check', unit: 'x', paper: 'x', year: 2000, answer: 'x' });
    results.push({ label: 'Regular users cannot add questions', safe: question.error?.code === '42501' });
  }
  return results;
}
