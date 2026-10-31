// Upload dashboard. Writes new apps directly into the GitHub repo via the GitHub API.
// Security: only someone with a GitHub token that has write access to the repo can upload.
// The token is stored on this device only, encrypted with a PIN (AES-GCM, PBKDF2).
// It is never stored unencrypted and only kept in memory while the dashboard is open.
(() => {
  const REPO = 'Huehnchen2023/pocket-apps';
  const BRANCH = 'main';
  const AUTHOR = { name: 'Huehnchen2023', email: '113251537+Huehnchen2023@users.noreply.github.com' };
  const VAULT_KEY = 'admin.vault';
  const LANG_KEY = 'pocket.lang';
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const MAX_FILES = 300;

  const $ = id => document.getElementById(id);

  // ---------- Texts ----------
  const TEXT = {
    en: {
      back: '← Launcher', title: 'Dashboard',
      setupTitle: 'Set up this device',
      setupIntro: 'Uploading needs a GitHub key that can only write to your pocket-apps repo. It is stored only on this device, locked with a PIN.',
      setupSteps: `<li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → New fine-grained token</a></li>
        <li>Name: <b>Pocket Apps upload</b>, pick an expiration</li>
        <li>Repository access: <b>Only select repositories</b> → <b>pocket-apps</b></li>
        <li>Permissions → Repository permissions → <b>Contents: Read and write</b></li>
        <li><b>Generate token</b>, copy it and paste it below</li>`,
      token: 'GitHub token', pin: 'PIN', pinRepeat: 'Repeat PIN', saveToken: 'Check & save',
      unlockTitle: 'Unlock', unlock: 'Unlock', forget: 'Remove key from this device',
      forgetConfirm: 'Remove the saved key from this device?',
      uploadTitle: 'Upload an app',
      uploadIntro: 'Choose an .html file, a .zip of a project folder, or several files (one must be index.html).',
      pick: 'Tap to choose files', nameEn: 'Name (English)', nameDe: 'Name (German)',
      descEn: 'Description (English)', descDe: 'Description (German)', emoji: 'Emoji', color: 'Color',
      iconImg: 'Icon image (optional)', id: 'Folder name (id)', uploadBtn: 'Upload', updateBtn: 'Update app',
      lock: 'Lock dashboard',
      errPinShort: 'PIN must have at least 4 characters.', errPinMatch: 'PINs do not match.',
      errToken: 'Please paste a token.', checking: 'Checking token…',
      errNoAccess: 'This token cannot write to the pocket-apps repo. Check the "Contents: Read and write" permission and the repository selection.',
      errBadToken: 'GitHub rejected this token (wrong or expired).',
      errPinWrong: 'Wrong PIN.', errNoIndex: 'No index.html (or other .html file) found.',
      errTooBig: 'File too large (max 25 MB):', errTooMany: 'Too many files (max 300).',
      errBadPath: 'Unsafe file path in upload:', errId: 'Folder name: only a–z, 0–9 and dashes.',
      errName: 'Please enter a name.', errZip: 'Could not read the zip file:',
      exists: 'An app with this folder name exists. It will be replaced.',
      isNew: 'This will be a new app.',
      step: { prep: 'Preparing files…', blobs: 'Uploading files', commit: 'Saving…',
              done: '✓ Uploaded! Waiting for the site to update (about 1 minute)…',
              live: '✓ Live! Open the launcher to see it.', slow: 'Still building. Check the launcher in a minute.' },
      expired: 'Your token expired or was revoked. Please set up again.',
      manageTitle: 'Your apps', manageIntro: 'Remove an app from the launcher. Tap Remove, then tap again to confirm.',
      noApps: 'No apps yet.', remove: 'Remove', removeConfirm: 'Tap to confirm',
      removing: 'Removing', removed: '✓ Removed. The launcher updates in about 1 minute.',
      removedLive: '✓ Gone from the launcher.', notFound: 'This app is no longer in the repo.',
    },
    de: {
      back: '← Launcher', title: 'Dashboard',
      setupTitle: 'Dieses Gerät einrichten',
      setupIntro: 'Zum Hochladen brauchst du einen GitHub-Schlüssel, der nur in dein pocket-apps-Repo schreiben darf. Er wird nur auf diesem Gerät gespeichert, mit einer PIN gesperrt.',
      setupSteps: `<li>Öffne <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Neuer fine-grained Token</a></li>
        <li>Name: <b>Pocket Apps upload</b>, Ablaufdatum wählen</li>
        <li>Repository access: <b>Only select repositories</b> → <b>pocket-apps</b></li>
        <li>Permissions → Repository permissions → <b>Contents: Read and write</b></li>
        <li><b>Generate token</b>, kopieren und unten einfügen</li>`,
      token: 'GitHub-Token', pin: 'PIN', pinRepeat: 'PIN wiederholen', saveToken: 'Prüfen & speichern',
      unlockTitle: 'Entsperren', unlock: 'Entsperren', forget: 'Schlüssel von diesem Gerät entfernen',
      forgetConfirm: 'Gespeicherten Schlüssel von diesem Gerät entfernen?',
      uploadTitle: 'App hochladen',
      uploadIntro: 'Wähle eine .html-Datei, eine .zip eines Projektordners oder mehrere Dateien (eine muss index.html sein).',
      pick: 'Tippen, um Dateien zu wählen', nameEn: 'Name (Englisch)', nameDe: 'Name (Deutsch)',
      descEn: 'Beschreibung (Englisch)', descDe: 'Beschreibung (Deutsch)', emoji: 'Emoji', color: 'Farbe',
      iconImg: 'Icon-Bild (optional)', id: 'Ordnername (ID)', uploadBtn: 'Hochladen', updateBtn: 'App aktualisieren',
      lock: 'Dashboard sperren',
      errPinShort: 'Die PIN braucht mindestens 4 Zeichen.', errPinMatch: 'Die PINs stimmen nicht überein.',
      errToken: 'Bitte einen Token einfügen.', checking: 'Token wird geprüft…',
      errNoAccess: 'Dieser Token darf nicht ins pocket-apps-Repo schreiben. Prüfe die Berechtigung „Contents: Read and write“ und die Repo-Auswahl.',
      errBadToken: 'GitHub hat den Token abgelehnt (falsch oder abgelaufen).',
      errPinWrong: 'Falsche PIN.', errNoIndex: 'Keine index.html (oder andere .html-Datei) gefunden.',
      errTooBig: 'Datei zu groß (max. 25 MB):', errTooMany: 'Zu viele Dateien (max. 300).',
      errBadPath: 'Unsicherer Dateipfad im Upload:', errId: 'Ordnername: nur a–z, 0–9 und Bindestriche.',
      errName: 'Bitte einen Namen eingeben.', errZip: 'Zip-Datei konnte nicht gelesen werden:',
      exists: 'Eine App mit diesem Ordnernamen existiert. Sie wird ersetzt.',
      isNew: 'Das wird eine neue App.',
      step: { prep: 'Dateien vorbereiten…', blobs: 'Dateien hochladen', commit: 'Speichern…',
              done: '✓ Hochgeladen! Warte, bis die Seite aktualisiert ist (ca. 1 Minute)…',
              live: '✓ Live! Öffne den Launcher, um sie zu sehen.', slow: 'Wird noch gebaut. Schau in einer Minute im Launcher nach.' },
      expired: 'Dein Token ist abgelaufen oder wurde widerrufen. Bitte neu einrichten.',
      manageTitle: 'Deine Apps', manageIntro: 'Entferne eine App aus dem Launcher. Tippe auf Entfernen und zur Bestätigung noch einmal.',
      noApps: 'Noch keine Apps.', remove: 'Entfernen', removeConfirm: 'Zum Bestätigen tippen',
      removing: 'Wird entfernt', removed: '✓ Entfernt. Der Launcher aktualisiert sich in ca. 1 Minute.',
      removedLive: '✓ Aus dem Launcher verschwunden.', notFound: 'Diese App ist nicht mehr im Repo.',
    },
  };
  let lang = localStorage.getItem(LANG_KEY) ||
    ((navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en');
  const t = k => TEXT[lang][k];

  function applyLanguage() {
    document.documentElement.lang = lang;
    $('lang').textContent = lang === 'de' ? 'EN' : 'DE';
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-t-html]').forEach(el => { el.innerHTML = t(el.dataset.tHtml); });
    updateIdNote();
    renderApps();
  }
  $('lang').addEventListener('click', () => {
    lang = lang === 'de' ? 'en' : 'de';
    localStorage.setItem(LANG_KEY, lang);
    applyLanguage();
  });

  // ---------- Encrypted token storage ----------
  const enc = new TextEncoder();
  const b64 = bytes => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function deriveKey(pin, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function saveVault(tokenStr, pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(pin, salt);
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(tokenStr)));
    localStorage.setItem(VAULT_KEY, JSON.stringify({ salt: b64(salt), iv: b64(iv), data: b64(data) }));
  }
  async function openVault(pin) {
    const v = JSON.parse(localStorage.getItem(VAULT_KEY));
    const key = await deriveKey(pin, unb64(v.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, key, unb64(v.data));
    return new TextDecoder().decode(plain);
  }

  // Token lives only in this variable while unlocked.
  let token = null;

  // ---------- GitHub API ----------
  async function gh(path, opts = {}, tok = token) {
    const res = await fetch('https://api.github.com' + path, {
      ...opts,
      cache: 'no-store',
      headers: {
        Authorization: 'Bearer ' + tok,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(`GitHub ${res.status}: ${body.message || res.statusText}`);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  // Reads the current head of the branch, with the full file list.
  async function getHead() {
    const ref = await gh(`/repos/${REPO}/git/ref/heads/${BRANCH}`);
    const headSha = ref.object.sha;
    const head = await gh(`/repos/${REPO}/git/commits/${headSha}`);
    const tree = await gh(`/repos/${REPO}/git/trees/${head.tree.sha}?recursive=1`);
    return { headSha, treeSha: head.tree.sha, files: tree.tree.filter(e => e.type === 'blob').map(e => e.path) };
  }

  // Commits tree changes (entries with sha: null delete a file) on top of the head and moves the branch.
  async function commitChanges({ headSha, treeSha }, entries, message) {
    const newTree = await gh(`/repos/${REPO}/git/trees`, {
      method: 'POST', body: JSON.stringify({ base_tree: treeSha, tree: entries }),
    });
    const now = new Date().toISOString();
    const commit = await gh(`/repos/${REPO}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message, tree: newTree.sha, parents: [headSha],
        author: { ...AUTHOR, date: now }, committer: { ...AUTHOR, date: now },
      }),
    });
    await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`, {
      method: 'PATCH', body: JSON.stringify({ sha: commit.sha }),
    });
  }

  async function checkToken(tok) {
    try {
      const repo = await gh(`/repos/${REPO}`, {}, tok);
      return repo.permissions && repo.permissions.push ? 'ok' : 'noaccess';
    } catch (e) {
      return e.status === 401 ? 'bad' : (e.status === 404 || e.status === 403 ? 'noaccess' : 'error:' + e.message);
    }
  }

  // ---------- Screens ----------
  function show(screen) {
    for (const id of ['setup', 'unlock', 'upload']) $(id).hidden = id !== screen;
    $('manage').hidden = screen !== 'upload';
  }
  const msg = (id, text, ok) => { const el = $(id); el.textContent = text || ''; el.classList.toggle('ok', !!ok); };

  $('save-token').addEventListener('click', async () => {
    const tok = $('token').value.trim(), p1 = $('pin1').value, p2 = $('pin2').value;
    if (!tok) return msg('setup-msg', t('errToken'));
    if (p1.length < 4) return msg('setup-msg', t('errPinShort'));
    if (p1 !== p2) return msg('setup-msg', t('errPinMatch'));
    msg('setup-msg', t('checking'), true);
    const result = await checkToken(tok);
    if (result === 'bad') return msg('setup-msg', t('errBadToken'));
    if (result === 'noaccess') return msg('setup-msg', t('errNoAccess'));
    if (result !== 'ok') return msg('setup-msg', result);
    await saveVault(tok, p1);
    token = tok;
    $('token').value = $('pin1').value = $('pin2').value = '';
    msg('setup-msg', '');
    enterUpload();
  });

  async function doUnlock() {
    try {
      const tok = await openVault($('pin').value);
      $('pin').value = '';
      msg('unlock-msg', t('checking'), true);
      const result = await checkToken(tok);
      if (result === 'bad' || result === 'noaccess') {
        localStorage.removeItem(VAULT_KEY);
        alertMsgThenSetup();
        return;
      }
      token = tok;
      msg('unlock-msg', '');
      enterUpload();
    } catch {
      msg('unlock-msg', t('errPinWrong'));
    }
  }
  function alertMsgThenSetup() {
    show('setup');
    msg('setup-msg', t('expired'));
  }
  $('unlock-btn').addEventListener('click', doUnlock);
  $('pin').addEventListener('keydown', e => { if (e.key === 'Enter') doUnlock(); });

  $('forget').addEventListener('click', () => {
    if (!window.confirm(t('forgetConfirm'))) return;
    localStorage.removeItem(VAULT_KEY);
    token = null;
    show('setup');
  });
  $('lock').addEventListener('click', () => { token = null; resetUpload(); show('unlock'); });

  // Lock automatically when leaving the page / app goes to background for a while.
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (token && Date.now() - hiddenAt > 5 * 60 * 1000) { token = null; resetUpload(); show('unlock'); }
  });

  // ---------- Reading uploads ----------
  async function unzip(buffer) {
    const dv = new DataView(buffer), u8 = new Uint8Array(buffer);
    let eocd = -1;
    for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('not a zip file');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = [];
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('broken zip');
      const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith('/')) continue;
      if (flags & 1) throw new Error('encrypted zips are not supported');
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const data = u8.subarray(start, start + csize);
      let bytes;
      if (method === 0) bytes = data.slice();
      else if (method === 8) {
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      } else throw new Error('unsupported compression');
      out.push({ path: name, bytes });
    }
    return out;
  }

  function cleanPath(path) {
    const parts = path.replace(/\\/g, '/').split('/').filter(s => s && s !== '.');
    if (parts.some(s => s === '..') || /^[a-zA-Z]:/.test(path) || path.startsWith('/')) {
      throw new Error(t('errBadPath') + ' ' + path);
    }
    return parts.join('/');
  }
  const junk = path => /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|\.git)(\/|$)/.test(path);

  // Turns the chosen files into [{path, bytes}] with an index.html at the top level.
  async function collectFiles(fileList) {
    let files = [];
    for (const f of fileList) {
      if (f.size > MAX_FILE_BYTES) throw new Error(`${t('errTooBig')} ${f.name}`);
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (/\.zip$/i.test(f.name)) {
        try { files.push(...await unzip(bytes.buffer)); }
        catch (e) { throw new Error(`${t('errZip')} ${e.message}`); }
      } else {
        files.push({ path: f.name, bytes });
      }
    }
    files = files.filter(f => !junk(f.path)).map(f => ({ ...f, path: cleanPath(f.path) })).filter(f => f.path);
    if (files.length > MAX_FILES) throw new Error(t('errTooMany'));
    for (const f of files) if (f.bytes.length > MAX_FILE_BYTES) throw new Error(`${t('errTooBig')} ${f.path}`);

    // Strip a single shared top folder (typical for zipped folders).
    const tops = new Set(files.map(f => f.path.includes('/') ? f.path.split('/')[0] : ''));
    if (tops.size === 1 && !tops.has('')) {
      const top = [...tops][0] + '/';
      files = files.map(f => ({ ...f, path: f.path.slice(top.length) }));
    }
    // Ensure an index.html entry point.
    if (!files.some(f => f.path.toLowerCase() === 'index.html')) {
      const htmls = files.filter(f => !f.path.includes('/') && /\.html?$/i.test(f.path));
      if (htmls.length !== 1) throw new Error(t('errNoIndex'));
      htmls[0].path = 'index.html';
    } else {
      const idx = files.find(f => f.path.toLowerCase() === 'index.html');
      idx.path = 'index.html';
    }
    // project.json is written from the form; an uploaded one is used as a default only.
    return files;
  }

  // ---------- Upload form ----------
  let picked = null;        // [{path, bytes}]
  let existingIds = new Set();
  let idTouched = false;

  const slug = s => s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  function updateIdNote() {
    if (!picked) return;
    const id = $('app-id').value;
    const exists = existingIds.has(id);
    $('id-note').textContent = id ? t(exists ? 'exists' : 'isNew') : '';
    $('id-note').classList.toggle('ok', !exists);
    $('upload-btn').textContent = t(exists ? 'updateBtn' : 'uploadBtn');
  }

  let projects = [];
  async function loadExistingIds() {
    try {
      const data = await (await fetch('projects.json?t=' + Date.now(), { cache: 'no-store' })).json();
      projects = data.projects;
      existingIds = new Set(projects.map(p => p.id));
      renderApps();
      return data.version;
    } catch { return ''; }
  }

  // ---------- Manage: list and remove apps ----------
  const removedIds = new Set(); // removed this session; projects.json lags behind for a minute
  const pickName = v => (v && typeof v === 'object') ? (v[lang] || v.en || v.de || '') : (v || '');

  function renderApps() {
    const list = $('app-list');
    if (!list) return;
    list.innerHTML = '';
    const shown = projects.filter(p => !removedIds.has(p.id));
    if (!shown.length) {
      list.innerHTML = `<li class="muted">${t('noApps')}</li>`;
      return;
    }
    for (const p of shown) {
      const li = document.createElement('li');
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.style.backgroundColor = p.color || '#7c6cff';
      if (p.iconImage) tile.style.backgroundImage = `url("${p.iconImage}")`;
      else tile.textContent = p.icon || '🎮';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = pickName(p.name) || p.id;
      const small = document.createElement('small');
      small.textContent = p.id;
      name.appendChild(small);
      const btn = document.createElement('button');
      btn.className = 'remove';
      btn.textContent = t('remove');
      btn.addEventListener('click', () => onRemoveTap(btn, p));
      li.append(tile, name, btn);
      list.appendChild(li);
    }
  }

  // Two taps: the first arms the button for a few seconds, the second removes.
  function onRemoveTap(btn, p) {
    if (!btn.classList.contains('armed')) {
      btn.classList.add('armed');
      btn.textContent = t('removeConfirm');
      clearTimeout(btn.disarm);
      btn.disarm = setTimeout(() => { btn.classList.remove('armed'); btn.textContent = t('remove'); }, 4000);
      return;
    }
    clearTimeout(btn.disarm);
    removeApp(p, btn);
  }

  function manageLog(line, append) {
    const el = $('manage-log');
    el.hidden = !line && !append;
    el.textContent = append ? el.textContent + '\n' + line : line;
  }

  async function removeApp(p, btn) {
    if (!token) return;
    document.querySelectorAll('button.remove').forEach(b => { b.disabled = true; });
    const name = pickName(p.name) || p.id;
    try {
      manageLog(`${t('removing')}: ${name}…`);
      const before = (await loadExistingIds()) || '';
      const head = await getHead();
      const prefix = `projects/${p.id}/`;
      const files = head.files.filter(path => path.startsWith(prefix));
      if (!files.length) { manageLog('✗ ' + t('notFound')); return; }
      const enName = (p.name && typeof p.name === 'object' ? p.name.en : p.name) || p.id;
      await commitChanges(head, files.map(path => ({ path, mode: '100644', type: 'blob', sha: null })),
        `Remove ${enName} (via dashboard)`);
      removedIds.add(p.id);
      existingIds.delete(p.id);
      renderApps();
      manageLog(t('removed'));
      const gone = await waitForVersion(before, data => !data.projects.some(x => x.id === p.id));
      manageLog(gone ? t('removedLive') : t('step').slow, true);
    } catch (e) {
      if (e.status === 401) { token = null; alertMsgThenSetup(); }
      manageLog('✗ ' + e.message, true);
    } finally {
      document.querySelectorAll('button.remove').forEach(b => { b.disabled = false; });
      if (btn.isConnected) { btn.classList.remove('armed'); btn.textContent = t('remove'); }
    }
  }

  function enterUpload() {
    show('upload');
    loadExistingIds();
  }

  function resetUpload() {
    picked = null; idTouched = false;
    $('files').value = ''; $('icon-file').value = '';
    $('file-list').innerHTML = '';
    $('details').hidden = true;
    for (const id of ['name-en', 'name-de', 'desc-en', 'desc-de', 'app-id']) $(id).value = '';
    $('emoji').value = '🎮'; $('color').value = '#7c6cff';
  }

  $('files').addEventListener('change', async () => {
    const list = [...$('files').files];
    if (!list.length) return;
    log('');
    try {
      picked = await collectFiles(list);
    } catch (e) {
      picked = null; $('details').hidden = true; log('✗ ' + e.message); return;
    }
    $('file-list').innerHTML = '';
    for (const f of picked.slice(0, 12)) {
      const li = document.createElement('li');
      li.textContent = `${f.path} (${Math.ceil(f.bytes.length / 1024)} KB)`;
      $('file-list').appendChild(li);
    }
    if (picked.length > 12) $('file-list').insertAdjacentHTML('beforeend', `<li>… +${picked.length - 12}</li>`);

    // Pre-fill from an uploaded project.json or the HTML <title>.
    const metaFile = picked.find(f => f.path === 'project.json');
    let meta = {};
    if (metaFile) { try { meta = JSON.parse(new TextDecoder().decode(metaFile.bytes)); } catch {} }
    const html = new TextDecoder().decode(picked.find(f => f.path === 'index.html').bytes);
    const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
    const pickLang = (v, l) => (v && typeof v === 'object') ? (v[l] || '') : (v || '');
    $('name-en').value = pickLang(meta.name, 'en') || title.trim();
    $('name-de').value = pickLang(meta.name, 'de') || '';
    $('desc-en').value = pickLang(meta.description, 'en');
    $('desc-de').value = pickLang(meta.description, 'de');
    if (meta.icon) $('emoji').value = meta.icon;
    if (meta.color) $('color').value = meta.color;
    if (!idTouched) $('app-id').value = slug($('name-en').value || $('name-de').value);
    $('details').hidden = false;
    updateIdNote();
  });

  for (const id of ['name-en', 'name-de']) {
    $(id).addEventListener('input', () => {
      if (!idTouched) { $('app-id').value = slug($('name-en').value || $('name-de').value); updateIdNote(); }
    });
  }
  $('app-id').addEventListener('input', () => {
    idTouched = true;
    $('app-id').value = $('app-id').value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    updateIdNote();
  });

  function log(line, append) {
    const el = $('log');
    el.hidden = !line && !append;
    el.textContent = append ? el.textContent + '\n' + line : line;
  }

  $('upload-btn').addEventListener('click', async () => {
    if (!token || !picked) return;
    const id = $('app-id').value;
    const nameEn = $('name-en').value.trim(), nameDe = $('name-de').value.trim();
    if (!/^[a-z0-9-]+$/.test(id)) return log('✗ ' + t('errId'));
    if (!nameEn && !nameDe) return log('✗ ' + t('errName'));

    const btn = $('upload-btn');
    btn.disabled = true;
    try {
      log(t('step').prep);
      const before = (await loadExistingIds()) || '';
      const files = picked.filter(f => f.path !== 'project.json' && !/^icon\.(png|jpe?g|webp|svg)$/i.test(f.path));
      const iconFile = $('icon-file').files[0];
      if (iconFile) {
        const ext = (iconFile.name.match(/\.(png|jpe?g|webp)$/i) || ['.png'])[0].toLowerCase();
        files.push({ path: 'icon' + ext, bytes: new Uint8Array(await iconFile.arrayBuffer()) });
      } else {
        const oldIcon = picked.find(f => /^icon\.(png|jpe?g|webp|svg)$/i.test(f.path));
        if (oldIcon) files.push(oldIcon);
      }
      const meta = {
        name: { en: nameEn || nameDe, de: nameDe || nameEn },
        description: { en: $('desc-en').value.trim(), de: $('desc-de').value.trim() || $('desc-en').value.trim() },
        icon: $('emoji').value.trim() || '🎮',
        color: $('color').value,
        added: new Date().toISOString().slice(0, 10),
      };
      files.push({ path: 'project.json', bytes: enc.encode(JSON.stringify(meta, null, 2) + '\n') });

      const head = await getHead();
      const headSha = head.headSha;
      const prefix = `projects/${id}/`;
      const existing = head.files.filter(path => path.startsWith(prefix));
      const isUpdate = existing.length > 0;
      // Keep the original "added" date when updating.
      if (isUpdate) {
        try {
          const oldMeta = await gh(`/repos/${REPO}/contents/${prefix}project.json?ref=${headSha}`);
          const old = JSON.parse(new TextDecoder().decode(unb64(oldMeta.content.replace(/\n/g, ''))));
          if (old.added) {
            meta.added = old.added;
            files[files.length - 1].bytes = enc.encode(JSON.stringify(meta, null, 2) + '\n');
          }
        } catch {}
      }

      const entries = [];
      for (let i = 0; i < files.length; i++) {
        log(`${t('step').blobs} ${i + 1}/${files.length}`);
        const blob = await gh(`/repos/${REPO}/git/blobs`, {
          method: 'POST', body: JSON.stringify({ content: b64(files[i].bytes), encoding: 'base64' }),
        });
        entries.push({ path: prefix + files[i].path, mode: '100644', type: 'blob', sha: blob.sha });
      }
      const keep = new Set(entries.map(e => e.path));
      for (const path of existing) {
        if (!keep.has(path)) entries.push({ path, mode: '100644', type: 'blob', sha: null });
      }

      log(t('step').commit);
      await commitChanges(head, entries, `${isUpdate ? 'Update' : 'Add'} ${meta.name.en} (via dashboard)`);

      log(t('step').done);
      const live = await waitForVersion(before, data => data.projects.some(p => p.id === id));
      log(live ? t('step').live : t('step').slow, true);
      existingIds.add(id);
      removedIds.delete(id);
      resetUpload();
      loadExistingIds();
    } catch (e) {
      if (e.status === 401) { token = null; alertMsgThenSetup(); }
      log('✗ ' + e.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  // Polls the published projects.json until a new version satisfies `done` (max 4 minutes).
  async function waitForVersion(oldVersion, done) {
    const until = Date.now() + 4 * 60 * 1000;
    while (Date.now() < until) {
      await new Promise(r => setTimeout(r, 6000));
      try {
        const data = await (await fetch('projects.json?t=' + Date.now(), { cache: 'no-store' })).json();
        if (data.version !== oldVersion && done(data)) return true;
      } catch {}
    }
    return false;
  }

  // ---------- Start ----------
  applyLanguage();
  if (!window.crypto || !crypto.subtle) {
    document.body.insertAdjacentHTML('beforeend', '<p class="msg">This page must be opened via https.</p>');
  } else {
    show(localStorage.getItem(VAULT_KEY) ? 'unlock' : 'setup');
  }
})();
