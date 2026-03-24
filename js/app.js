// app.js

// Supabase setup
const SUPABASE_URL = 'https://xjxqrsiyabjlkrzzsugg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqeHFyc2l5YWJqbGtyenpzdWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODkyNjUsImV4cCI6MjA4OTc2NTI2NX0.mix1hdRAaZhqRA1ZTVziwhMdQjqvh1PuINqP_jGgg-k';

// Create the Supabase client (the SDK was loaded via CDN in index.html)
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Constants
const TRASH = '__trash__';

// Colors for categories and folders
const PAL = [
  { k: 'blue',   bg: '#dbeafe', text: '#1e40af', ico: '#3b82f6' },
  { k: 'green',  bg: '#d1fae5', text: '#065f46', ico: '#10b981' },
  { k: 'purple', bg: '#ede9fe', text: '#5b21b6', ico: '#8b5cf6' },
  { k: 'pink',   bg: '#fce7f3', text: '#9d174d', ico: '#ec4899' },
  { k: 'orange', bg: '#ffedd5', text: '#9a3412', ico: '#f97316' },
  { k: 'yellow', bg: '#fef9c3', text: '#713f12', ico: '#eab308' },
  { k: 'red',    bg: '#fee2e2', text: '#991b1b', ico: '#ef4444' },
  { k: 'teal',   bg: '#ccfbf1', text: '#134e4a', ico: '#14b8a6' },
];

// State: all data is stored here
let S = {
  user:     null,
  notes:    [],
  folders:  [],
  cats:     [],
  catOrder: [],
  view:     null,
};

// Temporary UI state
let foldersOpen     = true;
let editNoteId      = null;
let editFolderId    = null;
let newCatColor     = 'blue';
let newFolderColor  = 'blue';
let editFolderColor = 'blue';
let authMode        = 'signin';
let dragSrcCat      = null;

// Helper functions

/** Get palette entry by color key */
function pal(k) { return PAL.find(p => p.k === k) || PAL[0]; }

/** Escape HTML to prevent XSS attacks */
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Get a date string (YYYY-MM-DD) N days from today */
function daysFrom(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Current timestamp as ISO string */
function now() { return new Date().toISOString(); }

/** Show/hide loading overlay */
function showLoading() { document.getElementById('loading-page').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading-page').style.display = 'none'; }

// Init: runs when page loads
async function init() {
  showLoading();

  const { data: { session } } = await db.auth.getSession();

  if (session) {
    S.user = session.user;
    await loadData();
    showApp();
  } else {
    hideLoading();
    document.getElementById('auth-page').style.display = 'flex';
  }

  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      hideLoading();
      document.getElementById('auth-page').style.display          = 'flex';
      document.getElementById('auth-form-main').style.display     = 'none';
      document.getElementById('forgot-btn').style.display         = 'none';
      document.getElementById('auth-toggle-row').style.display    = 'none';
      document.getElementById('reset-screen').style.display       = 'none';
      document.getElementById('new-password-screen').style.display = '';
      return;
    }

    if (event === 'SIGNED_IN' && session) {
      S.user = session.user;
      await loadData();
      showApp();
    } else if (event === 'SIGNED_OUT') {
      S = { user: null, notes: [], folders: [], cats: [], catOrder: [], view: null };
      document.getElementById('app-page').style.display  = 'none';
      document.getElementById('auth-page').style.display = 'flex';
      document.getElementById('a-email').value = '';
      document.getElementById('a-pw').value    = '';
    }
  });
}

// Auth functions
function toggleAuth() {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  document.getElementById('auth-sub').textContent     = authMode === 'signin' ? 'Welcome back!' : 'Create your account';
  document.getElementById('a-btn').textContent         = authMode === 'signin' ? 'Sign In' : 'Sign Up';
  document.getElementById('a-tog-txt').textContent     = authMode === 'signin' ? "Don't have an account?" : 'Already have an account?';
  document.getElementById('a-tog-lnk').textContent     = authMode === 'signin' ? ' Sign Up' : ' Sign In';
  document.getElementById('forgot-btn').style.display = authMode === 'signin' ? '' : 'none';
  hideAuthError();
}

async function doAuth() {
  const email    = document.getElementById('a-email').value.trim();
  const password = document.getElementById('a-pw').value;

  if (!email || !password) { showAuthError('Please fill in all fields.'); return; }
  if (password.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }

  const btn = document.getElementById('a-btn');
  btn.disabled     = true;
  btn.innerHTML    = '<div class="loading-spinner" style="width:16px;height:16px;border-width:2px;border-color:rgba(255,255,255,.3);border-top-color:#fff"></div> Loading…';
  hideAuthError();

  let error;

  if (authMode === 'signin') {
    const res = await db.auth.signInWithPassword({ email, password });
    error = res.error;
  } else {
    const res = await db.auth.signUp({ email, password });
    error = res.error;

    if (!error && res.data.user && !res.data.session) {
      btn.disabled  = false;
      btn.textContent = 'Sign Up';
      showAuthError('✉️ Check your email to confirm your account, then sign in.');
      return;
    }
  }

  btn.disabled    = false;
  btn.textContent = authMode === 'signin' ? 'Sign In' : 'Sign Up';

  if (error) {
    showAuthError(error.message);
  }
}

async function doSignOut() {
  await db.auth.signOut();
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = '';
}

function hideAuthError() {
  document.getElementById('auth-error').style.display = 'none';
}

function showApp() {
  hideLoading();
  document.getElementById('auth-page').style.display = 'none';
  document.getElementById('app-page').style.display  = 'flex';

  const email = S.user?.email || '';
  document.getElementById('sb-email').textContent  = email;
  document.getElementById('sb-avatar').textContent = email[0]?.toUpperCase() || '?';

  renderAll();
}

// Forgot password
function showForgotPassword() {
  document.getElementById('auth-form-main').style.display  = 'none';
  document.getElementById('forgot-btn').style.display      = 'none';
  document.getElementById('auth-toggle-row').style.display = 'none';
  document.getElementById('reset-screen').style.display    = '';
  document.getElementById('reset-email').value = document.getElementById('a-email').value;
  setTimeout(() => document.getElementById('reset-email').focus(), 100);
}

function hideResetScreen() {
  document.getElementById('reset-screen').style.display    = 'none';
  document.getElementById('auth-form-main').style.display  = '';
  document.getElementById('forgot-btn').style.display      = '';
  document.getElementById('auth-toggle-row').style.display = '';
}

async function sendResetEmail() {
  const email = document.getElementById('reset-email').value.trim();
  const errEl = document.getElementById('reset-error');

  if (!email) {
    errEl.textContent   = 'Please enter your email.';
    errEl.style.display = '';
    return;
  }

  errEl.style.display = 'none';

  const redirectTo = window.location.href;

  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    errEl.textContent   = error.message;
    errEl.style.display = '';
  } else {
    document.getElementById('reset-screen').innerHTML = `
      <div class="auth-form" style="text-align:center; gap:12px">
        <div style="font-size:36px">📧</div>
        <div style="font-weight:700; color:var(--ink); font-size:16px">Check your email!</div>
        <div style="font-size:13px; color:var(--ink3); line-height:1.7">
          We sent a reset link to <strong style="color:var(--ink)">${esc(email)}</strong>.<br>
          Click the link in the email to set your new password.
        </div>
        <button class="btn-primary-auth" onclick="location.reload()" style="margin-top:4px">
          Back to Sign In
        </button>
      </div>
    `;
  }
}

async function updatePassword() {
  const pw    = document.getElementById('new-pw').value;
  const errEl = document.getElementById('newpw-error');

  if (pw.length < 6) {
    errEl.textContent   = 'Password must be at least 6 characters.';
    errEl.style.display = '';
    return;
  }

  errEl.style.display = 'none';

  const { error } = await db.auth.updateUser({ password: pw });

  if (error) {
    errEl.textContent   = error.message;
    errEl.style.display = '';
  } else {
    await db.auth.signOut();
    toast('Password updated! Please sign in with your new password.');
  }
}

// Load data from Supabase
async function loadData() {
  const userId = S.user.id;

  const [catsRes, foldersRes, notesRes, settingsRes] = await Promise.all([
    db.from('categories').select('*').eq('user_id', userId).order('created_at'),
    db.from('folders').select('*').eq('user_id', userId).order('created_at'),
    db.from('notes').select('*').eq('user_id', userId).order('created_at'),
    db.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  S.cats    = catsRes.data    || [];
  S.folders = foldersRes.data || [];
  S.notes   = notesRes.data   || [];

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const oldIds = S.notes.filter(n => n.deleted_at && n.deleted_at < cutoff).map(n => n.id);
  if (oldIds.length > 0) {
    await db.from('notes').delete().in('id', oldIds);
    S.notes = S.notes.filter(n => !oldIds.includes(n.id));
  }

  const settings = settingsRes.data;
  if (settings?.cat_order?.length) {
    S.catOrder = settings.cat_order;
  } else {
    S.catOrder = S.cats.map(c => c.id);
  }

  if (S.cats.length === 0) {
    await seedDefaultData();
  }
}

// Create default data for new users
async function seedDefaultData() {
  const userId = S.user.id;

  const { data: cats } = await db.from('categories').insert([
    { user_id: userId, name: 'Work',     color: 'blue'   },
    { user_id: userId, name: 'Personal', color: 'pink'   },
    { user_id: userId, name: 'Study',    color: 'purple' },
  ]).select();

  if (!cats) return;
  S.cats     = cats;
  S.catOrder = cats.map(c => c.id);

  const { data: folders } = await db.from('folders').insert([
    { user_id: userId, name: 'Work',     color: 'blue'   },
    { user_id: userId, name: 'College',  color: 'purple' },
    { user_id: userId, name: 'Personal', color: 'pink'   },
    { user_id: userId, name: 'Projects', color: 'teal'   },
  ]).select();

  if (folders) S.folders = folders;

  const work     = cats.find(c => c.name === 'Work');
  const personal = cats.find(c => c.name === 'Personal');
  const study    = cats.find(c => c.name === 'Study');

  const { data: notes } = await db.from('notes').insert([
    { user_id: userId, title: 'Team Meeting',     content: 'Discuss sprint goals and review the backlog.',      category_id: work?.id,     folder_ids: [], deadline: null },
    { user_id: userId, title: 'Shopping List',    content: 'Milk, bread, fruits, vegetables, olive oil.',       category_id: personal?.id, folder_ids: [], deadline: null },
    { user_id: userId, title: 'Study React',      content: 'Hooks, Context API, Performance optimization.',     category_id: study?.id,    folder_ids: [], deadline: daysFrom(5) },
    { user_id: userId, title: 'Project Proposal', content: 'Draft the proposal with timeline and budget.',      category_id: work?.id,     folder_ids: [], deadline: daysFrom(-1) },
    { user_id: userId, title: 'Book Club Notes',  content: 'Atomic Habits: focus on systems, not goals.',       category_id: personal?.id, folder_ids: [], deadline: null },
  ]).select();

  if (notes) S.notes = notes;

  await saveCatOrder();
}

async function saveCatOrder() {
  await db.from('user_settings').upsert({
    user_id:   S.user.id,
    cat_order: S.catOrder,
  });
}

// View selection
function setView(v)     { S.view = v; renderAll(); }
function viewNotes()    {
  if (S.view === TRASH) return S.notes.filter(n => n.deleted_at);
  if (S.view)           return S.notes.filter(n => (n.folder_ids || []).includes(S.view) && !n.deleted_at);
  return S.notes.filter(n => !n.deleted_at);
}
function viewTitle()    {
  if (S.view === TRASH) return 'Trash';
  if (S.view) { const f = S.folders.find(x => x.id === S.view); return f ? f.name : 'Folder'; }
  return 'All Notes';
}

// Render functions
function renderAll()    { renderSidebar(); renderHeader(); renderContent(); }

function renderSidebar() {
  document.getElementById('nav-all').classList.toggle('active', S.view === null);
  document.getElementById('nav-trash').classList.toggle('active', S.view === TRASH);
  document.getElementById('cnt-all').textContent  = S.notes.filter(n => !n.deleted_at).length;
  document.getElementById('cnt-cats').textContent = S.cats.length;

  const tc = S.notes.filter(n => n.deleted_at).length;
  const ct = document.getElementById('cnt-trash');
  ct.textContent = tc; ct.style.display = tc ? '' : 'none';

  const fl = document.getElementById('fol-list');
  fl.innerHTML = '';
  S.folders.forEach(f => {
    const p   = pal(f.color);
    const cnt = S.notes.filter(n => (n.folder_ids || []).includes(f.id) && !n.deleted_at).length;
    const row = document.createElement('div');
    row.className = 'folder-btn' + (S.view === f.id ? ' active' : '');
    row.innerHTML = `
      <div class="folder-dot" style="background:${p.ico}"></div>
      <span class="folder-name">${esc(f.name)}</span>
      <span class="folder-cnt">${cnt || ''}</span>
      <button class="folder-more" onclick="openFolderDD(event,'${f.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
        </svg>
      </button>
    `;
    row.addEventListener('click', ev => { if (!ev.target.closest('.folder-more')) setView(f.id); });
    row.addEventListener('dragover',  ev => { ev.preventDefault(); row.classList.add('drop-over'); });
    row.addEventListener('dragleave', ()  => row.classList.remove('drop-over'));
    row.addEventListener('drop',      ev  => {
      ev.preventDefault(); row.classList.remove('drop-over');
      const nid = ev.dataTransfer.getData('application/note-id');
      if (nid) addToFolder(nid, f.id);
    });
    fl.appendChild(row);
  });
}

function renderHeader() {
  const notes  = viewNotes();
  document.getElementById('h-title').textContent = viewTitle();
  document.getElementById('h-count').textContent = `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`;
  const isTrash = S.view === TRASH;
  document.getElementById('btn-newnote').style.display = isTrash ? 'none' : '';
  const be = document.getElementById('btn-empty');
  be.style.display = isTrash ? '' : 'none';
  be.disabled = notes.length === 0;
}

function renderContent() {
  const ca      = document.getElementById('content-area');
  const notes   = viewNotes();
  const isTrash = S.view === TRASH;
  const isFolder = S.view && S.view !== TRASH;
  if (isTrash || isFolder) renderFlatGrid(ca, notes, isTrash);
  else renderGrouped(ca, notes);
}

function renderFlatGrid(ca, notes, isTrash) {
  if (!notes.length) { ca.innerHTML = emptyHTML(isTrash); return; }
  ca.innerHTML = '';
  const g = document.createElement('div');
  g.className = 'notes-grid';
  notes.forEach((n, i) => g.appendChild(makeCard(n, isTrash, true, i)));
  ca.appendChild(g);
}

function renderGrouped(ca, allNotes) {
  if (!allNotes.length) { ca.innerHTML = emptyHTML(false); return; }
  ca.innerHTML = '';
  const grouped = {};
  S.cats.forEach(c => { grouped[c.id] = []; });
  allNotes.forEach(n => { if (grouped[n.category_id]) grouped[n.category_id].push(n); });

  const visibleCats = getOrderedCats().filter(c => grouped[c.id]?.length > 0);

  visibleCats.forEach(cat => {
    const p     = pal(cat.color);
    const notes = grouped[cat.id];
    const sec   = document.createElement('div');
    sec.className     = 'cat-section';
    sec.dataset.catId = cat.id;
    sec.innerHTML = `
      <div class="cat-header">
        <div class="cat-grip" draggable="true" title="Drag to reorder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
            <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
          </svg>
        </div>
        <div class="cat-dot" style="background:${p.ico}"></div>
        <span class="cat-name">${esc(cat.name)}</span>
        <span class="cat-count">(${notes.length})</span>
        <div class="cat-line"></div>
      </div>
      <div class="notes-grid cg"></div>
    `;
    const grid = sec.querySelector('.cg');
    notes.forEach((n, i) => grid.appendChild(makeCard(n, false, false, i)));

    const grip = sec.querySelector('.cat-grip');
    grip.addEventListener('dragstart', ev => {
      dragSrcCat = cat.id;
      ev.dataTransfer.setData('cat', '1');
      ev.dataTransfer.effectAllowed = 'move';
      setTimeout(() => sec.classList.add('dragging-source'), 0);
    });
    grip.addEventListener('dragend', () => {
      dragSrcCat = null;
      document.querySelectorAll('.cat-section').forEach(s =>
        s.classList.remove('dragging-source', 'drag-above', 'drag-below'));
    });
    sec.addEventListener('dragover', ev => {
      if (!dragSrcCat || dragSrcCat === cat.id) return;
      ev.preventDefault();
      const mid = sec.getBoundingClientRect().top + sec.getBoundingClientRect().height / 2;
      document.querySelectorAll('.cat-section').forEach(s => s.classList.remove('drag-above', 'drag-below'));
      sec.classList.add(ev.clientY < mid ? 'drag-above' : 'drag-below');
    });
    sec.addEventListener('dragleave', () => sec.classList.remove('drag-above', 'drag-below'));
    sec.addEventListener('drop', ev => {
      if (!dragSrcCat || dragSrcCat === cat.id) return;
      ev.preventDefault();
      const mid = sec.getBoundingClientRect().top + sec.getBoundingClientRect().height / 2;
      reorderCat(dragSrcCat, cat.id, ev.clientY < mid);
      dragSrcCat = null;
    });
    ca.appendChild(sec);
  });
}

function emptyHTML(isTrash) {
  return `<div class="empty-state">
    <div class="empty-icon-wrap">${isTrash ? '🗑️' : '📝'}</div>
    <div class="empty-title">${isTrash ? 'Trash is empty' : 'No notes yet'}</div>
    <div class="empty-body">${isTrash
      ? 'Deleted notes appear here for 30 days before permanent removal.'
      : 'Click "New Note" to start organizing your ideas.'}</div>
  </div>`;
}

// Note cards
function makeCard(note, isTrash, showCat, idx) {
  const card = document.createElement('div');
  card.className = 'note-card';

  if (!isTrash) {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', ev => {
      ev.stopPropagation();
      ev.dataTransfer.setData('application/note-id', note.id);
      ev.dataTransfer.effectAllowed = 'copy';
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  }

  const cat       = S.cats.find(c => c.id === note.category_id);
  const p         = cat ? pal(cat.color) : null;
  const inFolders = S.folders.filter(f => (note.folder_ids || []).includes(f.id));
  const dl        = note.deadline ? dlBadge(note.deadline) : null;

  let h = '';
  if (showCat && cat && p)
    h += `<div class="nc-cat-badge" style="background:${p.bg}; color:${p.text}">${esc(cat.name)}</div>`;
  h += `<h3 class="nc-title">${esc(note.title)}</h3>`;
  if (note.content)
    h += `<p class="nc-content">${esc(note.content)}</p>`;
  if (dl && !isTrash)
    h += `<div class="nc-deadline"><span class="dl-badge" style="background:${dl.bg}; color:${dl.color}">${dl.icon} ${dl.text}</span></div>`;
  if (inFolders.length && !isTrash)
    h += `<div class="nc-folder-tags">${inFolders.map(f => `<span class="folder-tag">${esc(f.name)}</span>`).join('')}</div>`;
  if (isTrash && note.deleted_at)
    h += `<div class="nc-trash-date">Deleted ${new Date(note.deleted_at).toLocaleDateString()}</div>`;

  const menuFn = isTrash
    ? `openTrashDD(event,'${note.id}')`
    : `openNoteDD(event,'${note.id}')`;
  h += `<button class="nc-menu-btn" onclick="${menuFn}">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
    </svg></button>`;

  card.innerHTML = h;
  return card;
}

// Deadline badge
function dlBadge(dl) {
  const today  = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dl + 'T00:00:00');
  const days   = Math.round((target - today) / 86400000);
  if (days < 0)  return { text: 'Expired',   icon: '⚠️', bg: 'var(--timer-danger-bg)', color: 'var(--timer-danger-text)' };
  if (days === 0) return { text: 'Due today', icon: '⏰', bg: 'var(--timer-danger-bg)', color: 'var(--timer-danger-text)' };
  if (days <= 2)  return { text: `${days} day${days > 1 ? 's' : ''}`, icon: '⏰', bg: 'var(--timer-danger-bg)', color: 'var(--timer-danger-text)' };
  if (days <= 7)  return { text: `${days} days`, icon: '⏰', bg: 'var(--timer-warn-bg)',   color: 'var(--timer-warn-text)'   };
  return           { text: `${days} days`, icon: '✓',  bg: 'var(--timer-safe-bg)',   color: 'var(--timer-safe-text)'   };
}

// Notes CRUD
function openNewNoteModal() {
  editNoteId = null;
  document.getElementById('note-modal-title').textContent = 'New Note';
  document.getElementById('note-save-btn').textContent    = 'Create';
  document.getElementById('n-title').value   = '';
  document.getElementById('n-content').value = '';
  document.getElementById('n-dl').value      = '';
  document.getElementById('dl-clr').style.display = 'none';
  buildCatSelect(null);
  openOv('ov-note');
  setTimeout(() => document.getElementById('n-title').focus(), 120);
}

function openEditNoteModal(nid) {
  const n = S.notes.find(x => x.id === nid);
  if (!n) return;
  editNoteId = nid;
  document.getElementById('note-modal-title').textContent = 'Edit Note';
  document.getElementById('note-save-btn').textContent    = 'Save';
  document.getElementById('n-title').value   = n.title;
  document.getElementById('n-content').value = n.content || '';
  document.getElementById('n-dl').value      = n.deadline || '';
  document.getElementById('dl-clr').style.display = n.deadline ? 'flex' : 'none';
  buildCatSelect(n.category_id);
  openOv('ov-note');
}

function buildCatSelect(selectedId) {
  const sel = document.getElementById('n-cat');
  sel.innerHTML = '';
  S.cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    if (c.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function saveNote() {
  const title   = document.getElementById('n-title').value.trim();
  const catId   = document.getElementById('n-cat').value;
  const content = document.getElementById('n-content').value.trim();
  const dl      = document.getElementById('n-dl').value || null;
  if (!title) { toast('Please enter a title'); return; }

  const btn = document.getElementById('note-save-btn');
  btn.disabled = true;

  if (editNoteId) {
    const { data, error } = await db.from('notes')
      .update({ title, content, category_id: catId, deadline: dl, updated_at: now() })
      .eq('id', editNoteId)
      .select().single();

    if (!error && data) {
      const i = S.notes.findIndex(n => n.id === editNoteId);
      if (i !== -1) S.notes[i] = data;
      toast('Note updated');
    } else {
      toast('Error saving note');
    }
  } else {
    const { data, error } = await db.from('notes')
      .insert({ user_id: S.user.id, title, content, category_id: catId, folder_ids: [], deadline: dl })
      .select().single();

    if (!error && data) {
      S.notes.push(data);
      toast('Note created');
    } else {
      toast('Error creating note');
    }
  }

  btn.disabled = false;
  closeOv('ov-note');
  renderAll();
}

async function trashNote(nid) {
  const { data, error } = await db.from('notes')
    .update({ deleted_at: now() })
    .eq('id', nid)
    .select().single();

  if (!error && data) {
    const i = S.notes.findIndex(n => n.id === nid);
    if (i !== -1) S.notes[i] = data;
    renderAll();
    toast('Moved to Trash');
  }
}

async function restoreNote(nid) {
  const { data, error } = await db.from('notes')
    .update({ deleted_at: null })
    .eq('id', nid)
    .select().single();

  if (!error && data) {
    const i = S.notes.findIndex(n => n.id === nid);
    if (i !== -1) S.notes[i] = data;
    renderAll();
    toast('Note restored');
  }
}

async function permDelete(nid) {
  const { error } = await db.from('notes').delete().eq('id', nid);
  if (!error) {
    S.notes = S.notes.filter(n => n.id !== nid);
    renderAll();
    toast('Permanently deleted');
  }
}

function confirmEmptyTrash() {
  const count = S.notes.filter(n => n.deleted_at).length;
  if (!count) return;
  showConfirm('Empty Trash',
    `Permanently delete all ${count} note${count > 1 ? 's' : ''}? This cannot be undone.`,
    async () => {
      const ids = S.notes.filter(n => n.deleted_at).map(n => n.id);
      await db.from('notes').delete().in('id', ids);
      S.notes = S.notes.filter(n => !n.deleted_at);
      renderAll();
      toast('Trash emptied');
    }
  );
}

async function onTrashDrop(ev) {
  ev.preventDefault();
  document.getElementById('nav-trash').classList.remove('drop-over');
  const nid = ev.dataTransfer.getData('application/note-id');
  if (nid) await trashNote(nid);
}

// Folders CRUD
function toggleFoldersList() {
  foldersOpen = !foldersOpen;
  document.getElementById('fol-list').classList.toggle('hidden', !foldersOpen);
  document.getElementById('fol-hd').classList.toggle('collapsed', !foldersOpen);
}

function openNewFolderModal() {
  editFolderId = null; newFolderColor = 'blue';
  document.getElementById('fol-modal-title').textContent = 'New Folder';
  document.getElementById('fol-save-btn').textContent    = 'Create';
  document.getElementById('fol-name').value = '';
  buildFolderColorGrid('fcg', 'blue', c => newFolderColor = c);
  openOv('ov-folder');
  setTimeout(() => document.getElementById('fol-name').focus(), 120);
}

function openEditFolderModal(fid) {
  const f = S.folders.find(x => x.id === fid);
  if (!f) return;
  editFolderId = fid; editFolderColor = f.color;
  document.getElementById('fol-modal-title').textContent = 'Edit Folder';
  document.getElementById('fol-save-btn').textContent    = 'Save';
  document.getElementById('fol-name').value = f.name;
  buildFolderColorGrid('fcg', f.color, c => editFolderColor = c);
  openOv('ov-folder');
}

function buildFolderColorGrid(id, sel, cb) {
  const el = document.getElementById(id); el.innerHTML = '';
  PAL.forEach(p => {
    const sw = document.createElement('div');
    sw.className = 'folder-color-swatch' + (p.k === sel ? ' sel' : '');
    sw.style.background = p.bg;
    sw.addEventListener('click', () => {
      el.querySelectorAll('.folder-color-swatch').forEach(x => x.classList.remove('sel'));
      sw.classList.add('sel'); cb(p.k);
    });
    el.appendChild(sw);
  });
}

async function saveFolder() {
  const name = document.getElementById('fol-name').value.trim();
  if (!name) { toast('Enter a name'); return; }

  if (editFolderId) {
    const { data, error } = await db.from('folders')
      .update({ name, color: editFolderColor })
      .eq('id', editFolderId).select().single();
    if (!error && data) {
      const i = S.folders.findIndex(f => f.id === editFolderId);
      if (i !== -1) S.folders[i] = data;
      toast('Folder updated');
    }
  } else {
    const { data, error } = await db.from('folders')
      .insert({ user_id: S.user.id, name, color: newFolderColor })
      .select().single();
    if (!error && data) { S.folders.push(data); toast(`"${name}" created`); }
  }

  closeOv('ov-folder'); renderAll();
}

async function deleteFolder(fid) {
  const notesInFolder = S.notes.filter(n => (n.folder_ids || []).includes(fid));
  for (const note of notesInFolder) {
    const newIds = note.folder_ids.filter(id => id !== fid);
    await db.from('notes').update({ folder_ids: newIds }).eq('id', note.id);
    const i = S.notes.findIndex(n => n.id === note.id);
    if (i !== -1) S.notes[i].folder_ids = newIds;
  }
  await db.from('folders').delete().eq('id', fid);
  S.folders = S.folders.filter(f => f.id !== fid);
  if (S.view === fid) S.view = null;
  renderAll(); toast('Folder deleted');
}

async function addToFolder(nid, fid) {
  const i = S.notes.findIndex(n => n.id === nid);
  if (i === -1) return;
  if ((S.notes[i].folder_ids || []).includes(fid)) { toast('Already in folder'); return; }

  const newIds = [...(S.notes[i].folder_ids || []), fid];
  const { data, error } = await db.from('notes')
    .update({ folder_ids: newIds, updated_at: now() })
    .eq('id', nid).select().single();

  if (!error && data) {
    S.notes[i] = data;
    renderAll();
    toast(`Added to "${S.folders.find(f => f.id === fid)?.name || 'folder'}"`);
  }
}

async function removeFromFolder(nid, fid) {
  const i = S.notes.findIndex(n => n.id === nid);
  if (i === -1) return;

  const newIds = (S.notes[i].folder_ids || []).filter(id => id !== fid);
  const { data, error } = await db.from('notes')
    .update({ folder_ids: newIds, updated_at: now() })
    .eq('id', nid).select().single();

  if (!error && data) { S.notes[i] = data; renderAll(); toast('Removed from folder'); }
}

// Categories CRUD
function renderCatsList() {
  const el = document.getElementById('cats-list');
  el.innerHTML = '';
  S.cats.forEach(cat => {
    const p    = pal(cat.color);
    const item = document.createElement('div');
    item.className = 'cat-item'; item.id = 'ci-' + cat.id;
    item.innerHTML = `
      <div class="cat-item-dot" style="background:${p.ico}"></div>
      <span class="cat-item-name">${esc(cat.name)}</span>
      <div class="cat-item-actions">
        <button class="icon-btn" onclick="startEditCat('${cat.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn red" onclick="deleteCat('${cat.id}')" ${S.cats.length <= 1 ? 'disabled' : ''}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>`;
    el.appendChild(item);
  });
  document.getElementById('min-cat-note').style.display = S.cats.length <= 1 ? '' : 'none';
}

function startEditCat(cid) {
  const cat = S.cats.find(c => c.id === cid); if (!cat) return;
  const p = pal(cat.color); const item = document.getElementById('ci-' + cid);
  item.dataset.ec = cat.color;
  item.innerHTML = `
    <div class="cat-item-dot" id="ecd-${cid}" style="background:${p.ico}"></div>
    <div class="cat-edit-row">
      <input class="inline-fi" id="eci-${cid}" value="${esc(cat.name)}" autocomplete="off"/>
      <div class="color-grid" id="ecc-${cid}"></div>
    </div>
    <div class="cat-item-actions">
      <button class="icon-btn" onclick="saveEditCat('${cid}')" style="color:#16a34a">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <button class="icon-btn" onclick="renderCatsList()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  buildColorPicker('ecc-' + cid, cat.color, c => {
    item.dataset.ec = c;
    document.getElementById('ecd-' + cid).style.background = pal(c).ico;
  });
  const inp = document.getElementById('eci-' + cid);
  inp.focus(); inp.select();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') saveEditCat(cid); if (e.key === 'Escape') renderCatsList(); });
}

async function saveEditCat(cid) {
  const inp   = document.getElementById('eci-' + cid);
  const item  = document.getElementById('ci-' + cid);
  const name  = inp?.value.trim() || '';
  const color = item?.dataset.ec || 'blue';

  const { data, error } = await db.from('categories')
    .update({ name, color }).eq('id', cid).select().single();

  if (!error && data) {
    const i = S.cats.findIndex(c => c.id === cid);
    if (i !== -1) S.cats[i] = data;
    renderCatsList(); renderAll(); toast('Category updated');
  }
}

async function addCat() {
  const name = document.getElementById('ncat-name').value.trim();
  if (!name) { toast('Enter a name'); return; }

  const { data, error } = await db.from('categories')
    .insert({ user_id: S.user.id, name, color: newCatColor })
    .select().single();

  if (!error && data) {
    S.cats.push(data);
    S.catOrder.push(data.id);
    await saveCatOrder();
    document.getElementById('ncat-name').value = '';
    newCatColor = 'blue';
    buildColorPicker('ncp', 'blue', c => newCatColor = c);
    renderCatsList(); renderAll(); toast(`"${name}" added`);
  }
}

async function deleteCat(cid) {
  if (S.cats.length <= 1) { toast('Must have at least one category'); return; }
  const fallback = S.cats.find(c => c.id !== cid);

  const toReassign = S.notes.filter(n => n.category_id === cid);
  for (const note of toReassign) {
    await db.from('notes').update({ category_id: fallback.id }).eq('id', note.id);
    const i = S.notes.findIndex(n => n.id === note.id);
    if (i !== -1) S.notes[i].category_id = fallback.id;
  }

  await db.from('categories').delete().eq('id', cid);
  S.cats     = S.cats.filter(c => c.id !== cid);
  S.catOrder = S.catOrder.filter(id => id !== cid);
  await saveCatOrder();
  renderCatsList(); renderAll(); toast('Category deleted');
}

function buildColorPicker(containerId, selected, onChange) {
  const el = document.getElementById(containerId); if (!el) return;
  el.innerHTML = '';
  PAL.forEach(p => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (p.k === selected ? ' sel' : '');
    sw.style.background = p.bg; sw.title = p.k;
    sw.addEventListener('click', () => {
      el.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('sel'));
      sw.classList.add('sel'); onChange(p.k);
    });
    el.appendChild(sw);
  });
}

// Category reorder
function getOrderedCats() {
  const ordered = [];
  S.catOrder.forEach(id => { const c = S.cats.find(x => x.id === id); if (c) ordered.push(c); });
  S.cats.forEach(c => { if (!ordered.find(x => x.id === c.id)) ordered.push(c); });
  return ordered;
}

async function reorderCat(srcId, targetId, before) {
  const order = [...S.catOrder];
  const si = order.indexOf(srcId), ti = order.indexOf(targetId);
  if (si === -1 || ti === -1) return;
  order.splice(si, 1);
  const nt = order.indexOf(targetId);
  order.splice(before ? nt : nt + 1, 0, srcId);
  S.catOrder = order;
  renderAll();
  await saveCatOrder();
}

// Dropdown menus
function posDD(dd, ev) {
  closeDD();
  const x = Math.min(ev.clientX, window.innerWidth  - 190);
  const y = Math.min(ev.clientY, window.innerHeight - 230);
  dd.style.left = x + 'px'; dd.style.top = y + 'px';
}
function closeDD() { document.querySelectorAll('.dd.open').forEach(d => d.classList.remove('open')); }

function openNoteDD(ev, nid) {
  ev.stopPropagation();
  const note = S.notes.find(n => n.id === nid);
  const dd   = document.getElementById('dd-note');
  posDD(dd, ev);
  document.getElementById('ddn-edit').onclick  = () => { closeDD(); openEditNoteModal(nid); };
  document.getElementById('ddn-trash').onclick = () => { closeDD(); trashNote(nid); };

  const avail = S.folders.filter(f => !(note?.folder_ids || []).includes(f.id));
  document.getElementById('ddn-add-sub').style.display = avail.length ? '' : 'none';
  const addList = document.getElementById('ddn-add-list');
  addList.innerHTML = '';
  avail.forEach(f => { const b = document.createElement('button'); b.className = 'dd-item'; b.textContent = f.name; b.onclick = () => { closeDD(); addToFolder(nid, f.id); }; addList.appendChild(b); });

  const inF = S.folders.filter(f => (note?.folder_ids || []).includes(f.id));
  document.getElementById('ddn-rem-sub').style.display = inF.length ? '' : 'none';
  const remList = document.getElementById('ddn-rem-list');
  remList.innerHTML = '';
  inF.forEach(f => { const b = document.createElement('button'); b.className = 'dd-item'; b.textContent = f.name; b.onclick = () => { closeDD(); removeFromFolder(nid, f.id); }; remList.appendChild(b); });

  dd.classList.add('open');
}

function openTrashDD(ev, nid) {
  ev.stopPropagation();
  const dd = document.getElementById('dd-trash-note');
  posDD(dd, ev);
  document.getElementById('ddt-restore').onclick = () => { closeDD(); restoreNote(nid); };
  document.getElementById('ddt-perm').onclick    = () => {
    closeDD();
    showConfirm('Delete Permanently', 'This note will be permanently removed. Cannot be undone.', () => permDelete(nid));
  };
  dd.classList.add('open');
}

function openFolderDD(ev, fid) {
  ev.stopPropagation();
  const dd = document.getElementById('dd-folder');
  posDD(dd, ev);
  document.getElementById('ddf-edit').onclick = () => { closeDD(); openEditFolderModal(fid); };
  document.getElementById('ddf-del').onclick  = () => {
    closeDD();
    const f = S.folders.find(x => x.id === fid);
    showConfirm('Delete Folder', `Delete "${f?.name}"? Notes inside will be unlinked.`, () => deleteFolder(fid));
  };
  dd.classList.add('open');
}

// Confirm dialog
function showConfirm(title, message, onConfirm) {
  document.getElementById('cfm-title').textContent = title;
  document.getElementById('cfm-msg').textContent   = message;
  document.getElementById('cfm-btn').onclick       = () => { onConfirm(); closeOv('ov-confirm'); };
  openOv('ov-confirm');
}

// Modal helpers
function openOv(id)          { document.getElementById(id).classList.add('open');    }
function closeOv(id)         { document.getElementById(id).classList.remove('open'); }
function bgClose(ev, id)     { if (ev.target === ev.currentTarget) closeOv(id);      }

// Toast notification
function toast(message) {
  const t = document.getElementById('toast');
  t.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>${message}`;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2400);
}

// Global event listeners
document.addEventListener('click', ev => {
  if (!ev.target.closest('.dd') && !ev.target.closest('.nc-menu-btn') && !ev.target.closest('.folder-more'))
    closeDD();
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') {
    document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'));
    closeDD();
  }
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'n' && S.user && S.view !== TRASH) {
    ev.preventDefault();
    openNewNoteModal();
  }
});

document.getElementById('a-pw').addEventListener('keydown',    ev => { if (ev.key === 'Enter') doAuth(); });
document.getElementById('a-email').addEventListener('keydown', ev => { if (ev.key === 'Enter') document.getElementById('a-pw').focus(); });
document.getElementById('reset-email').addEventListener('keydown', ev => { if (ev.key === 'Enter') sendResetEmail(); });
document.getElementById('new-pw').addEventListener('keydown',     ev => { if (ev.key === 'Enter') updatePassword(); });

// Start
init();