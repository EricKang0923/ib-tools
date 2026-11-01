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
    .select('calculator, deadlines')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? { calculator: {}, deadlines: {} };
}

export async function loadSharedDeadlines() {
  const { data, error } = await client.from('shared_deadlines').select('id, title, subject, due');
  if (error) throw error;
  return data;
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
    { label: '다른 사람의 데이터가 보이지 않아요', safe: !others.error && others.data.length === 0 },
    // 42501 means the rules refused it, not that something else went wrong.
    { label: '다른 사람 이름으로 저장할 수 없어요', safe: write.error?.code === '42501' },
    { label: '다른 사람의 데이터를 바꿀 수 없어요', safe: !change.error && change.data.length === 0 },
    { label: '스스로 관리자가 될 수 없어요', safe: madeAdmin.error?.code === '42501' },
  ];

  // This attempt would really succeed for the admin, so only run it for others.
  if (!isAdmin) {
    const school = await client
      .from('shared_deadlines')
      .insert({ id: 'security-check', title: 'x', subject: 'x', due: '2026-01-01T00:00' });
    results.push({ label: '일반 사용자는 공유 일정을 추가할 수 없어요', safe: school.error?.code === '42501' });
  }
  return results;
}
