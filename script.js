// ---- Switches: set to false when the site is finished -------------------
const SHOW_UNDER_CONSTRUCTION = true;  // "under construction" strip below the banner
const SHOW_PLACEHOLDER_IMAGE = true;   // placeholder picture in sections that have no image yet

// ---- Logo sizing -------------------------------------------------------
// The AstroVis logo is shown at two-thirds of its size (its width is first kept between
// LOGO_BASE_MIN and LOGO_BASE_MAX pixels). The sidebar is as wide as the logo, but never
// narrower than SIDEBAR_MIN so the topic list stays readable.
const LOGO_SCALE = 2 / 3;
const LOGO_BASE_MIN = 220;
const LOGO_BASE_MAX = 380;
const SIDEBAR_MIN = 220;
const logo = document.getElementById('logo');

function fitSidebar() {
  if (!logo.naturalWidth) return;
  const base = Math.min(Math.max(logo.naturalWidth, LOGO_BASE_MIN), LOGO_BASE_MAX);
  const logoW = Math.round(base * LOGO_SCALE);
  const root = document.documentElement.style;
  root.setProperty('--logo-w', logoW + 'px');
  root.setProperty('--sbw', Math.max(logoW, SIDEBAR_MIN) + 'px');
}
if (logo.complete) fitSidebar();
else logo.addEventListener('load', fitSidebar);

// If a logo file is missing, hide it instead of showing a broken-image icon
function hideIfBroken(img) {
  const hide = () => {
    img.hidden = true;
    console.warn('Image not found: ' + img.getAttribute('src'));
  };
  img.addEventListener('error', hide);
  if (img.complete && !img.naturalWidth) hide();
}
document.querySelectorAll('.logo img, .banner img').forEach(hideIfBroken);

if (SHOW_UNDER_CONSTRUCTION) {
  const strip = document.createElement('aside');
  strip.className = 'construction';
  const img = document.createElement('img');
  img.src = 'images/under_construction.png';
  img.alt = 'Under construction: this site is still growing';
  img.addEventListener('error', () => strip.remove());
  strip.append(img);
  document.querySelector('.banner').after(strip);
}

// ---- Sections ----------------------------------------------------------
const tree = document.getElementById('tree');
const page = document.getElementById('page');
const sections = new Map();   // id -> { id, title, children, parts }
const links = new Map();      // id -> sidebar <a>
const expandable = new Map(); // id -> { li, btn } for entries that have subtopics
let firstId = null;
let renderToken = 0;

const TITLE_RE = /^\s*#\s+(.+?)\s*(?:\r?\n|$)/;

async function fetchText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.text()).replace(/^\uFEFF/, '');
  } catch (e) {
    return null;
  }
}

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Sidebar title = the "# Heading" line at the top of <id>_0.md
async function loadTitle(id) {
  const s = { id, title: id, children: [], parts: null };
  const text = await fetchText('content/' + id + '_0.md');
  const m = text && text.match(TITLE_RE);
  if (m) s.title = m[1];
  return s;
}

// Finds <id>_0.md, <id>_1.md ... and images/<id>_0.png, <id>_1.png ... until a number has neither
async function loadParts(id) {
  const parts = [];
  for (let i = 0; i < 200; i++) {
    const [text, img] = await Promise.all([
      fetchText('content/' + id + '_' + i + '.md'),
      loadImage('images/' + id + '_' + i + '.png')
    ]);
    if (text === null && !img) break;
    parts.push({ text, img });
  }
  return parts;
}

function getParts(s) {
  if (!s.parts) s.parts = loadParts(s.id);
  return s.parts;
}

function setOpen(id, open) {
  const e = expandable.get(id);
  if (!e) return;
  e.li.classList.toggle('open', open);
  e.btn.setAttribute('aria-expanded', String(open));
}

function renderList(nodes) {
  const ul = document.createElement('ul');
  for (const n of nodes) {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'row';

    if (n.children.length) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toggle';
      btn.setAttribute('aria-label', 'Show or hide subtopics of ' + n.title);
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => setOpen(n.id, !li.classList.contains('open')));
      row.append(btn);
      expandable.set(n.id, { li, btn });
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'spacer';
      row.append(spacer);
    }

    const a = document.createElement('a');
    a.href = '#' + n.id;
    a.textContent = n.title;
    links.set(n.id, a);
    row.append(a);
    li.append(row);

    if (n.children.length) li.append(renderList(n.children));
    ul.append(li);
  }
  return ul;
}

async function build() {
  const res = await fetch('content/sections.json');
  if (!res.ok) throw new Error('content/sections.json not found');
  const ids = await res.json();
  const loaded = await Promise.all(ids.map(loadTitle));
  loaded.forEach(s => sections.set(s.id, s));
  firstId = ids[0];

  // The hierarchy comes from the ids: S1.1.2 sits under S1.1, which sits under S1
  const roots = [];
  for (const s of loaded) {
    const cut = s.id.lastIndexOf('.');
    const parent = cut > 0 ? sections.get(s.id.slice(0, cut)) : null;
    (parent ? parent.children : roots).push(s);
  }
  tree.append(renderList(roots));
}

function renderBody(text) {
  const div = document.createElement('div');
  if (typeof marked !== 'undefined') {
    div.innerHTML = marked.parse(text);
  } else {
    text.split(/\n\s*\n/).forEach(para => {
      const p = document.createElement('p');
      p.textContent = para.trim();
      div.append(p);
    });
  }
  return div;
}

// Each part: its image (if any) first, then its text (if any)
function renderParts(s, parts) {
  const nodes = [];
  parts.forEach((part, i) => {
    if (part.img) {
      const img = part.img.cloneNode();
      img.alt = s.title + ' (figure ' + (i + 1) + ')';
      nodes.push(img);
    }
    if (part.text !== null) {
      const text = (i === 0 ? part.text.replace(TITLE_RE, '') : part.text).trim();
      if (text) nodes.push(renderBody(text));
    }
  });
  if (!nodes.length) {
    const p = document.createElement('p');
    p.textContent = 'No content yet. Add content/' + s.id + '_0.md for this section.';
    nodes.push(p);
  }
  if (SHOW_PLACEHOLDER_IMAGE && !parts.some(part => part.img)) {
    const ph = document.createElement('img');
    ph.src = 'images/placeholder.png';
    ph.alt = 'Image coming soon';
    ph.className = 'placeholder';
    ph.addEventListener('error', () => ph.remove());
    nodes.push(ph);
  }
  return nodes;
}

async function show() {
  const wanted = decodeURIComponent(location.hash.slice(1));
  const s = sections.get(wanted) || sections.get(firstId);
  if (!s) return;
  const token = ++renderToken;

  // Breadcrumb of parent topics
  const crumbs = document.createElement('p');
  crumbs.className = 'crumbs';
  const trail = [];
  for (let cut = s.id.lastIndexOf('.'); cut > 0; cut = s.id.lastIndexOf('.', cut - 1)) {
    const parent = sections.get(s.id.slice(0, cut));
    if (parent) trail.unshift(parent);
  }
  trail.forEach((p, i) => {
    const a = document.createElement('a');
    a.href = '#' + p.id;
    a.textContent = p.title;
    crumbs.append(a, i < trail.length - 1 ? ' / ' : '');
  });

  const h1 = document.createElement('h1');
  h1.textContent = s.title;

  page.replaceChildren(...(trail.length ? [crumbs] : []), h1);
  document.title = s.title + ' \u00B7 AstroVis Digital Garden';

  // Open the current section and its parents; collapse everything else
  const openIds = new Set([...trail.map(p => p.id), s.id]);
  expandable.forEach((_, id) => setOpen(id, openIds.has(id)));

  links.forEach((a, id) => {
    if (id === s.id) {
      a.setAttribute('aria-current', 'page');
      a.scrollIntoView({ block: 'nearest' });
    } else {
      a.removeAttribute('aria-current');
    }
  });
  window.scrollTo(0, 0);

  const parts = await getParts(s);
  if (token !== renderToken) return;   // the reader already moved to another section
  page.append(...renderParts(s, parts));
}

build()
  .then(() => {
    window.addEventListener('hashchange', show);
    show();
  })
  .catch(err => {
    const p = document.createElement('p');
    p.textContent = 'Could not load the content (' + err.message + '). ' +
      'If you opened this file by double-clicking it, use a local server or the GitHub Pages link instead.';
    page.replaceChildren(p);
  });
