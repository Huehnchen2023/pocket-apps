// Pocket Apps launcher: lists everything in projects.json and runs it full-screen in an iframe.
(() => {
  const grid = document.getElementById('grid');
  const statusEl = document.getElementById('status');
  const player = document.getElementById('player');
  const frame = document.getElementById('frame');
  const homeBtn = document.getElementById('home');

  const langBtn = document.getElementById('lang');
  const hintEl = document.getElementById('install-hint');

  const SEEN_KEY = 'launcher.seen';
  const CACHE_KEY = 'launcher.projects';
  const HOME_POS_KEY = 'launcher.homePos';
  // Shared with all projects (same origin): they read this key to pick their language.
  const LANG_KEY = 'pocket.lang';

  // ---------- Language (German / English) ----------
  const TEXT = {
    en: {
      empty: 'No apps yet. Build one in Claude Code!',
      hint: 'Tip: tap <b>Share</b> → <b>Add to Home Screen</b> to install Pocket Apps.',
      syncing: 'Syncing…',
      offline: 'Offline ready',
      online: 'Online only',
      new: 'NEW',
      back: 'Back to launcher',
    },
    de: {
      empty: 'Noch keine Apps. Bau eine in Claude Code!',
      hint: 'Tipp: Tippe auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b>, um Pocket Apps zu installieren.',
      syncing: 'Synchronisiere…',
      offline: 'Offline bereit',
      online: 'Nur online',
      new: 'NEU',
      back: 'Zurück zum Launcher',
    },
  };

  let lang = localStorage.getItem(LANG_KEY) ||
    ((navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en');
  let statusKey = '';
  let current = { version: '', projects: [] };

  const t = key => TEXT[lang][key];
  // Project fields may be a plain string or { "de": "...", "en": "..." }.
  const pick = v => (v && typeof v === 'object') ? (v[lang] || v.en || v.de || '') : (v || '');

  function setStatus(key) {
    statusKey = key;
    statusEl.textContent = key ? t(key) : '';
  }

  function applyLanguage() {
    document.documentElement.lang = lang;
    langBtn.textContent = lang === 'de' ? 'EN' : 'DE'; // shows the language you can switch to
    homeBtn.setAttribute('aria-label', t('back'));
    hintEl.innerHTML = t('hint');
    setStatus(statusKey);
    render(current.projects);
  }

  langBtn.addEventListener('click', () => {
    lang = lang === 'de' ? 'en' : 'de';
    localStorage.setItem(LANG_KEY, lang);
    applyLanguage();
  });

  const isStandalone = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  if (!isStandalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    hintEl.hidden = false;
  }

  // ---------- Loading the project list ----------
  async function loadProjects() {
    try {
      const res = await fetch('projects.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      return data;
    } catch {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : { version: '', projects: [] };
    }
  }

  function render(projects) {
    const seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
    const firstRun = seen.size === 0;
    grid.innerHTML = '';

    if (!projects.length) {
      grid.innerHTML = `<div class="empty">${t('empty')}</div>`;
      return;
    }

    for (const p of projects) {
      const tile = document.createElement('button');
      tile.className = 'tile';

      const icon = document.createElement('div');
      icon.className = 'icon';
      if (p.color) icon.style.background = p.color;
      if (p.iconImage) {
        const img = document.createElement('img');
        img.src = p.iconImage;
        img.alt = '';
        icon.appendChild(img);
      } else {
        icon.textContent = p.icon || '🎮';
      }

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = pick(p.name);

      const desc = document.createElement('div');
      desc.className = 'desc';
      desc.textContent = pick(p.description);

      tile.append(icon, name, desc);

      if (!firstRun && !seen.has(p.id)) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = t('new');
        tile.appendChild(badge);
      }

      tile.addEventListener('click', () => {
        seen.add(p.id);
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
        tile.querySelector('.badge')?.remove();
        openProject(p);
      });
      grid.appendChild(tile);
    }

    if (firstRun) localStorage.setItem(SEEN_KEY, JSON.stringify(projects.map(p => p.id)));
  }

  // ---------- Running a project ----------
  function openProject(p) {
    frame.src = p.entry;
    player.hidden = false;
    history.pushState({ app: p.id }, '', '#' + p.id);
  }

  function closeProject() {
    frame.src = 'about:blank'; // stops sound and timers of the running app
    player.hidden = true;
  }

  window.addEventListener('popstate', () => { if (!player.hidden) closeProject(); });

  // Draggable home button: tap = back to launcher, drag = move it out of the way.
  (function setupHomeButton() {
    const saved = JSON.parse(localStorage.getItem(HOME_POS_KEY) || 'null');
    if (saved) place(saved.x, saved.y);

    let start = null;
    homeBtn.addEventListener('pointerdown', e => {
      homeBtn.setPointerCapture(e.pointerId);
      const r = homeBtn.getBoundingClientRect();
      start = { px: e.clientX, py: e.clientY, x: r.left, y: r.top, moved: false };
    });
    homeBtn.addEventListener('pointermove', e => {
      if (!start) return;
      const dx = e.clientX - start.px, dy = e.clientY - start.py;
      if (!start.moved && Math.hypot(dx, dy) < 8) return;
      start.moved = true;
      place(start.x + dx, start.y + dy);
    });
    homeBtn.addEventListener('pointerup', () => {
      if (!start) return;
      if (start.moved) {
        const r = homeBtn.getBoundingClientRect();
        localStorage.setItem(HOME_POS_KEY, JSON.stringify({ x: r.left, y: r.top }));
      } else if (history.state && history.state.app) {
        history.back(); // triggers popstate → closeProject
      } else {
        closeProject();
      }
      start = null;
    });
    homeBtn.addEventListener('pointercancel', () => { start = null; });

    function place(x, y) {
      const size = 40;
      x = Math.max(4, Math.min(window.innerWidth - size - 4, x));
      y = Math.max(4, Math.min(window.innerHeight - size - 4, y));
      homeBtn.style.left = x + 'px';
      homeBtn.style.top = y + 'px';
    }
  })();

  // ---------- Offline support ----------
  async function precacheAll(data) {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) return;
    const urls = data.projects.flatMap(p => p.files);
    setStatus('syncing');
    const channel = new MessageChannel();
    channel.port1.onmessage = e => setStatus(e.data.ok ? 'offline' : 'online');
    reg.active.postMessage({ type: 'precache', version: data.version, urls }, [channel.port2]);
  }

  async function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    const data = current = await loadProjects();
    applyLanguage();
    precacheAll(data).catch(() => {});

    // Deep link: open a project directly via #id
    const id = location.hash.slice(1);
    const p = id && data.projects.find(x => x.id === id);
    if (p) {
      history.replaceState(null, '', location.pathname);
      openProject(p);
    }
  }

  // Refresh the list when coming back to the app (e.g. after a new deploy)
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && player.hidden) {
      const data = current = await loadProjects();
      render(data.projects);
      precacheAll(data).catch(() => {});
    }
  });

  init();
})();
