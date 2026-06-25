/* ── admin.js — /goal admin dashboard logic ── */
'use strict';

const API_URL  = '/api.php';
const AUTH_URL = '/auth.php';

/* ── Session token stored in sessionStorage ──────────────── */
let adminToken = sessionStorage.getItem('oneiq_token') || '';

/* ── DOM refs ─────────────────────────────────────────────── */
const loginScreen  = document.getElementById('login-screen');
const adminWrap    = document.getElementById('admin-wrap');
const loginInput   = document.getElementById('login-pass');
const loginBtn     = document.getElementById('login-btn');
const loginErr     = document.getElementById('login-error');
const logoutBtn    = document.getElementById('logout-btn');
const matchList    = document.getElementById('match-list');
const totalEl      = document.getElementById('stat-total');
const liveEl       = document.getElementById('stat-live');

/* Form */
const form         = document.getElementById('match-form');
const formTitle    = document.getElementById('form-title');
const editIdInput  = document.getElementById('edit-id');
const nameInput    = document.getElementById('f-name');
const teamAInput   = document.getElementById('f-team-a');
const teamBInput   = document.getElementById('f-team-b');
const timeInput    = document.getElementById('f-time');
const linkInput    = document.getElementById('f-link');
const liveToggle   = document.getElementById('f-live');
const cancelBtn    = document.getElementById('cancel-btn');
const submitBtn    = document.getElementById('submit-btn');

/* ── Toast ────────────────────────────────────────────────── */
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className   = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = ''; }, 3200);
}

/* ── Auth ─────────────────────────────────────────────────── */
function showAdmin() {
  loginScreen.classList.add('hidden');
  adminWrap.classList.remove('hidden');
  fetchMatches();
}

/* Check existing token on load */
if (adminToken) showAdmin();

loginBtn.addEventListener('click', doLogin);
loginInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function doLogin() {
  const pass = loginInput.value.trim();
  if (!pass) { loginErr.textContent = 'أدخل كلمة المرور'; return; }

  loginBtn.disabled = true;
  loginBtn.textContent = '⏳';

  fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pass }),
  })
  .then(r => r.json())
  .then(d => {
    if (d.success && d.token) {
      adminToken = d.token;
      sessionStorage.setItem('oneiq_token', d.token);
      loginErr.textContent = '';
      showAdmin();
    } else {
      loginErr.textContent = 'كلمة المرور غير صحيحة';
    }
  })
  .catch(() => { loginErr.textContent = 'خطأ في الاتصال بالخادم'; })
  .finally(() => { loginBtn.disabled = false; loginBtn.textContent = 'دخول'; });
}

logoutBtn.addEventListener('click', () => {
  adminToken = '';
  sessionStorage.removeItem('oneiq_token');
  loginScreen.classList.remove('hidden');
  adminWrap.classList.add('hidden');
  loginInput.value = '';
});

/* ── Fetch & render match list ────────────────────────────── */
async function fetchMatches() {
  try {
    const res  = await fetch(API_URL, { cache: 'no-store' });
    const data = await res.json();
    renderList(data.matches || []);
  } catch {
    showToast('تعذّر تحميل المباريات', 'error');
  }
}

function renderList(matches) {
  totalEl.textContent = matches.length;
  liveEl.textContent  = matches.filter(m => parseInt(m.is_live) === 1).length;

  matchList.innerHTML = '';
  if (!matches.length) {
    matchList.innerHTML = '<div class="empty-list">لا توجد مباريات مضافة بعد.</div>';
    return;
  }

  matches.forEach(m => {
    const isLive = parseInt(m.is_live) === 1;
    const item   = document.createElement('div');
    item.className = 'match-item' + (isLive ? ' match-item--live' : '');
    item.innerHTML = `
      <div class="match-item-info">
        <div class="match-item-name" title="${esc(m.match_name)}">${esc(m.match_name)}</div>
        <div class="match-item-teams">${m.team_a && m.team_b ? esc(m.team_a)+' ⚽ '+esc(m.team_b) : '—'} ${m.match_time ? '| '+esc(m.match_time) : ''}</div>
      </div>
      ${isLive ? '<span class="live-pill">مباشر</span>' : ''}
      <div class="match-item-actions">
        <button class="btn-edit"   data-id="${m.id}">تعديل</button>
        <button class="btn-delete" data-id="${m.id}">حذف</button>
      </div>
    `;
    item.querySelector('.btn-edit').addEventListener('click',   () => populateForm(m));
    item.querySelector('.btn-delete').addEventListener('click', () => confirmDelete(m.id, m.match_name));
    matchList.appendChild(item);
  });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

/* ── Form logic ───────────────────────────────────────────── */
function resetForm() {
  form.reset();
  editIdInput.value   = '';
  liveToggle.checked  = false;
  formTitle.textContent = '➕ إضافة مباراة جديدة';
  submitBtn.textContent = 'إضافة المباراة';
  cancelBtn.classList.add('hidden');
  nameInput.focus();
}

function populateForm(m) {
  editIdInput.value   = m.id;
  nameInput.value     = m.match_name;
  teamAInput.value    = m.team_a    || '';
  teamBInput.value    = m.team_b    || '';
  timeInput.value     = m.match_time || '';
  linkInput.value     = m.stream_link;
  liveToggle.checked  = parseInt(m.is_live) === 1;
  formTitle.textContent = '✏️ تعديل المباراة';
  submitBtn.textContent = 'حفظ التعديلات';
  cancelBtn.classList.remove('hidden');
  nameInput.focus();
  nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

cancelBtn.addEventListener('click', resetForm);

form.addEventListener('submit', async e => {
  e.preventDefault();
  const id   = editIdInput.value;
  const body = {
    match_name:  nameInput.value.trim(),
    team_a:      teamAInput.value.trim(),
    team_b:      teamBInput.value.trim(),
    match_time:  timeInput.value.trim(),
    stream_link: linkInput.value.trim(),
    is_live:     liveToggle.checked,
  };

  if (!body.match_name || !body.stream_link) {
    showToast('اسم المباراة ورابط البث إلزاميان', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ جارٍ الحفظ…';

  try {
    const method = id ? 'PUT' : 'POST';
    const url    = id ? `${API_URL}?id=${id}` : API_URL;
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      showToast(id ? 'تم تحديث المباراة ✓' : 'تمت الإضافة ✓');
      resetForm();
      fetchMatches();
    } else {
      showToast(data.error || 'حدث خطأ', 'error');
    }
  } catch {
    showToast('خطأ في الاتصال بالخادم', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editIdInput.value ? 'حفظ التعديلات' : 'إضافة المباراة';
  }
});

/* ── Delete ───────────────────────────────────────────────── */
function confirmDelete(id, name) {
  if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
  deleteMatch(id);
}

async function deleteMatch(id, silent = false) {
  try {
    const res  = await fetch(`${API_URL}?id=${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (data.success) {
      if (!silent) { showToast('تم حذف المباراة'); fetchMatches(); }
    } else {
      if (!silent) showToast(data.error || 'فشل الحذف', 'error');
    }
  } catch {
    if (!silent) showToast('خطأ في الاتصال', 'error');
  }
}
