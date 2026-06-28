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

/* M3U8 Player refs */
const playerSection       = document.getElementById('player-section');
const videoElement         = document.getElementById('hls-video');
const playerWatermark     = document.getElementById('player-watermark');
const playerGroupName     = document.getElementById('player-group');
const playerChannelName   = document.getElementById('player-channel-name');
const playerQualitiesList = document.getElementById('player-qualities-list');
const playerCloseBtn      = document.getElementById('player-close-btn');

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

  /* Open player or modal on click */
  const open = () => {
    if (match.player_type === 'm3u8') {
      playM3U8Stream(match);
    } else {
      openModal(match);
    }
  };
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

/* ── M3U8 Streaming Player Logic ──────────────────────────── */
let hlsInstance = null;
let currentMatch = null;
let activeQualityUrl = '';

function playM3U8Stream(match) {
  // Close any existing player first
  closePlayer();

  currentMatch = match;
  
  // Set metadata
  playerChannelName.textContent = match.match_name;
  if (match.team_a) {
    playerGroupName.textContent = match.team_a;
    playerGroupName.classList.remove('hidden');
  } else {
    playerGroupName.classList.add('hidden');
  }

  // Set watermark logo
  if (match.channel_logo) {
    playerWatermark.src = match.channel_logo;
    playerWatermark.classList.remove('hidden');
  } else {
    playerWatermark.classList.add('hidden');
  }

  // Render quality buttons
  playerQualitiesList.innerHTML = '';
  const qualities = match.qualities || [];
  
  if (qualities.length > 0) {
    qualities.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quality-btn' + (idx === 0 ? ' quality-btn--active' : '');
      btn.textContent = q.title;
      btn.addEventListener('click', () => {
        if (activeQualityUrl === q.url) return;
        
        // Remove active class from all
        playerQualitiesList.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('quality-btn--active'));
        btn.classList.add('quality-btn--active');
        
        loadM3U8Url(q.url);
      });
      playerQualitiesList.appendChild(btn);
    });
    
    // Load first quality
    activeQualityUrl = qualities[0].url;
    loadM3U8Url(activeQualityUrl, false);
  }

  // Show player section
  playerSection.classList.remove('hidden');
  
  // Scroll to player
  playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function loadM3U8Url(url, preserveTime = true) {
  const video = videoElement;
  const seekTime = preserveTime ? video.currentTime : 0;

  activeQualityUrl = url;

  if (Hls.isSupported()) {
    if (!hlsInstance) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: true
      });
      hlsInstance.attachMedia(video);
    }
    
    hlsInstance.loadSource(url);
    
    hlsInstance.once(Hls.Events.MANIFEST_PARSED, () => {
      if (seekTime > 0) {
        video.currentTime = seekTime;
      }
      video.play().catch(e => console.log('Autoplay blocked:', e));
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari / iOS Native player
    video.src = url;
    video.addEventListener('loadedmetadata', function onLoaded() {
      if (seekTime > 0) {
        video.currentTime = seekTime;
      }
      video.play().catch(e => console.log('Autoplay blocked:', e));
      video.removeEventListener('loadedmetadata', onLoaded);
    });
  }
}

function closePlayer() {
  const video = videoElement;
  video.pause();
  video.removeAttribute('src');
  video.load();

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  
  playerSection.classList.add('hidden');
  currentMatch = null;
  activeQualityUrl = '';
}

playerCloseBtn.addEventListener('click', closePlayer);
