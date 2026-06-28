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

// New M3U8 settings DOM refs
const classicSettings = document.getElementById('classic-settings');
const m3u8Settings    = document.getElementById('m3u8-settings');
const groupNameInput  = document.getElementById('f-group-name');
const logoUrlInput    = document.getElementById('f-logo-url');
const logoPreviewWrap = document.getElementById('logo-preview-wrap');
const logoPreview     = document.getElementById('logo-preview');
const qualitiesList   = document.getElementById('qualities-list');
const btnAddQuality   = document.getElementById('btn-add-quality');

function togglePlayerTypeFields(type) {
  if (type === 'm3u8') {
    classicSettings.classList.add('hidden');
    m3u8Settings.classList.remove('hidden');
    linkInput.removeAttribute('required');
  } else {
    classicSettings.classList.remove('hidden');
    m3u8Settings.classList.add('hidden');
    linkInput.setAttribute('required', '');
  }
}

// Add event listener for radio change
document.querySelectorAll('input[name="f-player-type"]').forEach(radio => {
  radio.addEventListener('change', e => {
    togglePlayerTypeFields(e.target.value);
  });
});

// Logo preview helper
logoUrlInput.addEventListener('input', () => {
  const url = logoUrlInput.value.trim();
  if (url) {
    logoPreview.src = url;
    logoPreviewWrap.style.display = 'block';
  } else {
    logoPreviewWrap.style.display = 'none';
  }
});
logoPreview.addEventListener('error', () => {
  logoPreviewWrap.style.display = 'none';
});

function addQualityRow(title = '', url = '') {
  const row = document.createElement('div');
  row.className = 'quality-row';
  row.style.display = 'flex';
  row.style.gap = '0.5rem';
  row.style.alignItems = 'center';
  row.style.marginBottom = '0.4rem';
  
  row.innerHTML = `
    <input type="text" placeholder="الجودة (مثال: FHD)" class="form-input q-title" value="${esc(title)}" style="flex: 1;" required />
    <input type="url" placeholder="رابط البث (.m3u8)" class="form-input q-url" value="${esc(url)}" style="flex: 2; font-family: monospace;" dir="ltr" required />
    <button type="button" class="btn-delete btn-remove-quality" style="padding: 0.75rem 1rem; border-radius: var(--radius-lg); flex-shrink: 0; line-height: 1;">حذف</button>
  `;
  
  row.querySelector('.btn-remove-quality').addEventListener('click', () => {
    row.remove();
  });
  
  qualitiesList.appendChild(row);
}

btnAddQuality.addEventListener('click', () => {
  addQualityRow();
});

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
    
    const infoText = m.player_type === 'm3u8' 
      ? `<span class="live-pill" style="background:rgba(232,255,0,0.1); border-color:var(--yellow); color:var(--yellow);">مشغل M3U8</span>` + (m.team_a ? ` <span style="color:rgba(255,255,255,0.6);">${esc(m.team_a)}</span>` : '')
      : `${m.team_a && m.team_b ? esc(m.team_a)+' ⚽ '+esc(m.team_b) : '—'} ${m.match_time ? '| '+esc(m.match_time) : ''}`;

    item.innerHTML = `
      <div class="match-item-info">
        <div class="match-item-name" title="${esc(m.match_name)}">${esc(m.match_name)}</div>
        <div class="match-item-teams">${infoText}</div>
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
  
  // Reset M3U8 settings
  qualitiesList.innerHTML = '';
  logoPreviewWrap.style.display = 'none';
  const defaultRadio = document.querySelector('input[name="f-player-type"][value="default"]');
  if (defaultRadio) defaultRadio.checked = true;
  togglePlayerTypeFields('default');

  formTitle.textContent = '➕ إضافة مباراة جديدة';
  submitBtn.textContent = 'إضافة المباراة';
  cancelBtn.classList.add('hidden');
  nameInput.focus();
}

function populateForm(m) {
  editIdInput.value   = m.id;
  nameInput.value     = m.match_name;
  liveToggle.checked  = parseInt(m.is_live) === 1;

  const playerType = m.player_type || 'default';
  const typeRadio = document.querySelector(`input[name="f-player-type"][value="${playerType}"]`);
  if (typeRadio) typeRadio.checked = true;
  togglePlayerTypeFields(playerType);

  if (playerType === 'm3u8') {
    groupNameInput.value = m.team_a || '';
    logoUrlInput.value   = m.channel_logo || '';
    if (m.channel_logo) {
      logoPreview.src = m.channel_logo;
      logoPreviewWrap.style.display = 'block';
    } else {
      logoPreviewWrap.style.display = 'none';
    }
    
    qualitiesList.innerHTML = '';
    const qualities = m.qualities || [];
    qualities.forEach(q => {
      addQualityRow(q.title, q.url);
    });
  } else {
    teamAInput.value    = m.team_a    || '';
    teamBInput.value    = m.team_b    || '';
    timeInput.value     = m.match_time || '';
    linkInput.value     = m.stream_link;
  }

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
  const playerRadio = document.querySelector('input[name="f-player-type"]:checked');
  const playerType = playerRadio ? playerRadio.value : 'default';
  
  const body = {
    match_name:  nameInput.value.trim(),
    is_live:     liveToggle.checked,
    player_type: playerType
  };

  if (playerType === 'm3u8') {
    body.team_a = groupNameInput.value.trim(); // group name
    body.team_b = '';
    body.match_time = '';
    body.channel_logo = logoUrlInput.value.trim();
    
    // Read dynamic qualities
    const rows = qualitiesList.querySelectorAll('.quality-row');
    const qualities = [];
    rows.forEach(row => {
      const title = row.querySelector('.q-title').value.trim();
      const url = row.querySelector('.q-url').value.trim();
      if (title && url) {
        qualities.push({ title, url });
      }
    });
    body.qualities = qualities;

    if (!body.match_name) {
      showToast('اسم القناة إلزامي', 'error');
      return;
    }
    if (qualities.length === 0) {
      showToast('يجب إضافة جودة واحدة على الأقل للمشغل الجديد', 'error');
      return;
    }
  } else {
    body.team_a      = teamAInput.value.trim();
    body.team_b      = teamBInput.value.trim();
    body.match_time  = timeInput.value.trim();
    body.stream_link = linkInput.value.trim();

    if (!body.match_name || !body.stream_link) {
      showToast('اسم المباراة ورابط البث إلزاميان', 'error');
      return;
    }
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
