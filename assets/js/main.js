/* ── main.js — Index page: fetch matches & render cards ── */
'use strict';

const API_URL   = '/api.php';
const grid      = document.getElementById('matches-grid');
const errorBox  = document.getElementById('error-state');
const emptyBox  = document.getElementById('empty-state');
const liveCount = document.getElementById('live-count');
const liveBadge = document.getElementById('live-badge');

/* Modal refs */
const overlay    = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalTeams = document.getElementById('modal-teams');
const modalTime  = document.getElementById('modal-time');
const modalBtn   = document.getElementById('modal-watch-btn');

/* ── Year ─────────────────────────────────────────────────── */
document.getElementById('year').textContent = new Date().getFullYear();

/* ── Helpers ──────────────────────────────────────────────── */
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ── Render match card ────────────────────────────────────── */
function renderCard(match, index) {
  const isLive = parseInt(match.is_live) === 1;
  const card   = document.createElement('div');
  card.className = 'match-card' + (isLive ? ' match-card--live' : '');
  card.style.animationDelay = `${index * 0.07}s`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `مشاهدة ${match.match_name}`);

  const teamsHtml = (match.team_a && match.team_b)
    ? `<div class="card-teams">
         <span class="team-name">${esc(match.team_a)}</span>
         <span class="vs-badge">VS</span>
         <span class="team-name">${esc(match.team_b)}</span>
       </div>`
    : '';

  const timeHtml = match.match_time
    ? `<div class="card-time"><span class="card-time-icon">🕐</span>${esc(match.match_time)}</div>`
    : '';

  card.innerHTML = `
    <div class="card-ball-decor" aria-hidden="true"></div>
    <div class="card-top">
      <span class="card-status ${isLive ? 'card-status--live' : 'card-status--upcoming'}">
        ${isLive ? '<span class="live-dot"></span>مباشر' : '⏳ قريبًا'}
      </span>
      ${timeHtml}
    </div>
    ${teamsHtml}
    <p class="card-name">${esc(match.match_name)}</p>
    <button class="card-watch-btn" id="watch-${match.id}">
      <span class="btn-icon">▶</span>
      ${isLive ? 'شاهد الآن' : 'سيتوفر قريبًا'}
    </button>
  `;

  /* Open modal on click */
  const open = () => openModal(match);
  card.addEventListener('click', open);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });

  return card;
}

/* ── Modal ────────────────────────────────────────────────── */
function openModal(match) {
  modalTitle.textContent = match.match_name || 'مباراة';

  // Route through go.php to strip Referer — prevents CDN 401 errors
  const gatewayUrl = `/go?id=${match.id}`;
  modalBtn.href = gatewayUrl;

  if (match.team_a && match.team_b) {
    modalTeams.innerHTML =
      `<span>${esc(match.team_a)}</span>
       <span style="color:var(--red);font-weight:900">VS</span>
       <span>${esc(match.team_b)}</span>`;
  } else {
    modalTeams.innerHTML = '';
  }

  modalTime.textContent = match.match_time ? `⏰ ${match.match_time}` : '';
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  modalClose.focus();
}

function closeModal() {
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ── Fetch & Render ───────────────────────────────────────── */
async function loadMatches() {
  /* Reset states */
  errorBox.classList.add('hidden');
  emptyBox.classList.add('hidden');
  grid.innerHTML = '';
  ['','','',''].forEach(() => {
    const sk = document.createElement('div');
    sk.className = 'skeleton-card';
    grid.appendChild(sk);
  });

  try {
    const res  = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const matches = data.matches || [];
    const liveNum = matches.filter(m => parseInt(m.is_live) === 1).length;

    /* Update live counter */
    liveCount.textContent = liveNum;
    if (liveNum > 0) {
      liveBadge.style.display = '';
    }

    grid.innerHTML = '';

    if (matches.length === 0) {
      emptyBox.classList.remove('hidden');
      return;
    }

    matches.forEach((match, i) => {
      grid.appendChild(renderCard(match, i));
    });

  } catch (err) {
    console.error('loadMatches:', err);
    grid.innerHTML = '';
    errorBox.classList.remove('hidden');
  }
}

/* ── Boot ─────────────────────────────────────────────────── */
loadMatches();

/* Auto-refresh every 60 s to catch new live matches */
setInterval(loadMatches, 60_000);
