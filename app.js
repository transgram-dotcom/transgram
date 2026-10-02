(() => {
  'use strict';

  const feed = document.getElementById('feed');
  const toastEl = document.getElementById('toast');

  const ICONS = {
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.3 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.7 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    verified: '<svg class="verified" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#3897f0"/><path d="M7 12.5l3 3 7-7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  const state = { muted: true, active: -1, items: [] };

  // Saved likes (the heart stays red after a refresh)
  const LIKED_KEY = 'reels_liked_v1';
  let likedSet = new Set();
  try { likedSet = new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]')); } catch (_) {}
  const saveLikes = () => { try { localStorage.setItem(LIKED_KEY, JSON.stringify([...likedSet])); } catch (_) {} };

  // Helpers
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n.toLocaleString('en-US');
  const reelURL = id => `${location.origin}${location.pathname}?reel=${encodeURIComponent(id)}`;

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  // Build one reel
  function build(reel, i) {
    const p = Object.assign({}, PROFILE, reel.profile || {});
    const el = document.createElement('section');
    el.className = 'reel';
    el.dataset.index = i;

    el.innerHTML = `
      <video class="reel-video" playsinline webkit-playsinline loop muted preload="none"
        ${reel.poster ? `poster="${esc(reel.poster)}"` : ''}></video>
      <div class="reel-shade"></div>
      <div class="tap-zone"></div>
      <div class="spinner"></div>
      <div class="play-indicator">${ICONS.play}</div>

      <div class="reel-actions">
        <button class="action like-btn" aria-label="Like" aria-pressed="false">
          <div class="icon">${ICONS.heart}</div>
          <span class="like-count">0</span>
        </button>
        <button class="action copy-btn" aria-label="Copy link">
          <div class="icon">${ICONS.link}</div>
          <span>Copy</span>
        </button>
        <button class="action mute-btn" aria-label="Toggle sound">
          <div class="icon">${state.muted ? ICONS.soundOff : ICONS.soundOn}</div>
        </button>
      </div>

      <div class="reel-info">
        <a class="profile" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">
          <span class="avatar-ring"><img src="${esc(p.avatar)}" alt="${esc(p.name)}" loading="lazy"></span>
          <span class="name">${esc(p.name)}</span>
          ${p.verified ? ICONS.verified : ''}
        </a>
        ${reel.caption ? `<p class="caption">${esc(reel.caption)}</p>` : ''}
      </div>

      <div class="progress"><div class="progress-bar"></div></div>
    `;

    const item = {
      reel, el, index: i,
      video: el.querySelector('video'),
      likeBtn: el.querySelector('.like-btn'),
      countEl: el.querySelector('.like-count'),
      muteIcon: el.querySelector('.mute-btn .icon'),
      bar: el.querySelector('.progress-bar'),
      base: rand(LIKES.min, LIKES.max), // new random count on every visit
      liked: likedSet.has(reel.id),
      loaded: false
    };

    renderLike(item);
    wire(item);
    return item;
  }

  // Likes
  function renderLike(item) {
    item.likeBtn.classList.toggle('liked', item.liked);
    item.likeBtn.setAttribute('aria-pressed', item.liked);
    item.countEl.textContent = fmt(item.base + (item.liked ? 1 : 0));
  }

  function toggleLike(item) {
    item.liked = !item.liked;
    item.liked ? likedSet.add(item.reel.id) : likedSet.delete(item.reel.id);
    saveLikes();
    renderLike(item);
    item.likeBtn.classList.remove('pop');
    void item.likeBtn.offsetWidth; // restart the animation
    item.likeBtn.classList.add('pop');
  }

  function burst(item, e) {
    const rect = item.el.getBoundingClientRect();
    const b = document.createElement('div');
    b.className = 'burst';
    b.style.left = (e.clientX - rect.left) + 'px';
    b.style.top = (e.clientY - rect.top) + 'px';
    b.style.setProperty('--r', rand(-20, 20) + 'deg');
    b.innerHTML = ICONS.heart;
    item.el.appendChild(b);
    b.addEventListener('animationend', () => b.remove());
  }

  // Playback
  function play(item) {
    item.video.muted = state.muted;
    item.el.classList.remove('paused');
    const p = item.video.play();
    if (p) p.catch(() => {
      if (!item.video.muted) {           // sound blocked, so retry muted
        state.muted = true; syncMute();
        item.video.play().catch(() => item.el.classList.add('paused'));
      } else {
        item.el.classList.add('paused');
      }
    });
  }

  function togglePlay(item) {
    if (item.video.paused) play(item);
    else { item.video.pause(); item.el.classList.add('paused'); }
  }

  function syncMute() {
    state.items.forEach(it => {
      it.video.muted = state.muted;
      it.muteIcon.innerHTML = state.muted ? ICONS.soundOff : ICONS.soundOn;
    });
  }

  function toggleMute() {
    state.muted = !state.muted;
    syncMute();
    const cur = state.items[state.active];
    if (cur && cur.video.paused && !cur.el.classList.contains('paused')) play(cur);
  }

  // Copy link
  async function copyLink(id) {
    const url = reelURL(id);
    try {
      await navigator.clipboard.writeText(url);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('Link copied');
  }

  // Events per reel
  function wire(item) {
    const { el, video } = item;
    const tap = el.querySelector('.tap-zone');
    let timer = null, last = 0;

    tap.addEventListener('click', e => {
      const now = performance.now();
      if (now - last < 280) {          // double tap = like
        clearTimeout(timer);
        last = 0;
        burst(item, e);
        if (!item.liked) toggleLike(item);
      } else {                          // single tap = play/pause
        last = now;
        timer = setTimeout(() => togglePlay(item), 280);
      }
    });

    item.likeBtn.addEventListener('click', () => toggleLike(item));
    el.querySelector('.copy-btn').addEventListener('click', () => copyLink(item.reel.id));
    el.querySelector('.mute-btn').addEventListener('click', toggleMute);

    const cap = el.querySelector('.caption');
    if (cap) cap.addEventListener('click', () => cap.classList.toggle('open'));

    video.addEventListener('waiting', () => el.classList.add('loading'));
    video.addEventListener('playing', () => el.classList.remove('loading'));
    video.addEventListener('canplay', () => el.classList.remove('loading'));
  }

  // Load only the nearby videos so scrolling stays smooth
  function manageSources(index) {
    state.items.forEach((it, i) => {
      const d = Math.abs(i - index);
      if (d <= 1 && !it.loaded) {
        it.video.preload = 'auto';
        it.video.src = it.reel.src;
        it.loaded = true;
      } else if (d > 3 && it.loaded) {
        it.video.pause();
        it.video.removeAttribute('src');
        it.video.load();
        it.loaded = false;
      }
    });
  }

  function setActive(i) {
    if (i === state.active || !state.items[i]) return;
    state.active = i;
    manageSources(i);

    state.items.forEach((it, j) => {
      if (j === i) {
        play(it);
      } else if (it.loaded) {
        it.video.pause();
        it.video.currentTime = 0;
        it.el.classList.remove('paused');
      }
    });

    // Unique URL for the current reel
    history.replaceState(null, '', '?reel=' + encodeURIComponent(state.items[i].reel.id));
  }

  function goTo(i) {
    i = Math.max(0, Math.min(state.items.length - 1, i));
    feed.scrollTo({ top: i * feed.clientHeight, behavior: 'smooth' });
  }

  // Progress bar
  function tick() {
    const it = state.items[state.active];
    if (it && it.video.duration) {
      it.bar.style.transform = `scaleX(${it.video.currentTime / it.video.duration})`;
    }
    requestAnimationFrame(tick);
  }

  // Init
  if (typeof REELS === 'undefined' || !Array.isArray(REELS) || REELS.length === 0) {
    feed.innerHTML = '<div class="empty">No reels yet. Add some in config.js</div>';
    return;
  }

  const ids = new Set();
  REELS.forEach(r => {
    if (ids.has(r.id)) console.warn(`Duplicate reel id "${r.id}". Every id must be unique.`);
    ids.add(r.id);
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting && en.intersectionRatio >= 0.6) setActive(+en.target.dataset.index);
    });
  }, { root: feed, threshold: [0.6] });

  REELS.forEach((r, i) => {
    const item = build(r, i);
    feed.appendChild(item.el);
    state.items.push(item);
    io.observe(item.el);
  });

  // Open the reel from the URL (?reel=id)
  const startId = new URLSearchParams(location.search).get('reel');
  const start = Math.max(0, REELS.findIndex(r => r.id === startId));
  requestAnimationFrame(() => {
    feed.scrollTop = start * feed.clientHeight;
    setActive(start);
  });

  requestAnimationFrame(tick);

  // Desktop: one wheel/trackpad gesture moves one reel
  let wheelLocked = false, wheelIdle;
  feed.addEventListener('wheel', e => {
    e.preventDefault();
    clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => { wheelLocked = false; }, 200);
    if (wheelLocked || Math.abs(e.deltaY) < 8) return;
    wheelLocked = true;
    goTo(state.active + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });

  document.getElementById('prevBtn').addEventListener('click', () => goTo(state.active - 1));
  document.getElementById('nextBtn').addEventListener('click', () => goTo(state.active + 1));

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const cur = state.items[state.active];
    if (!cur) return;
    switch (e.key) {
      case 'ArrowDown': case 'PageDown': case 'j': e.preventDefault(); goTo(state.active + 1); break;
      case 'ArrowUp': case 'PageUp': case 'k': e.preventDefault(); goTo(state.active - 1); break;
      case ' ': e.preventDefault(); togglePlay(cur); break;
      case 'm': toggleMute(); break;
      case 'l': toggleLike(cur); break;
    }
  });

  // Stay snapped on resize or rotation
  window.addEventListener('resize', () => {
    feed.scrollTop = state.active * feed.clientHeight;
  });

  // Pause when the tab is hidden
  document.addEventListener('visibilitychange', () => {
    const cur = state.items[state.active];
    if (!cur) return;
    if (document.hidden) cur.video.pause();
    else if (!cur.el.classList.contains('paused')) play(cur);
  });
})();
