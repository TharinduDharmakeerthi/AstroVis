const tree = document.getElementById('tree');
const page = document.getElementById('page');
const sections = new Map();   // id -> { id, title, body, children }
const links = new Map();      // id -> sidebar <a>
let firstId = null;

// Reads content/<id>.md. The first line "# Heading" is the title; the rest is the content.
async function loadSection(id) {
  const s = { id, title: id, body: '', children: [] };
  try {
    const res = await fetch('content/' + id + '.md');
    if (!res.ok) throw new Error('not found');
    let text = (await res.text()).replace(/^\uFEFF/, '');
    const m = text.match(/^\s*#\s+(.+?)\s*(?:\r?\n|$)/);
    if (m) { s.title = m[1]; text = text.slice(m[0].length); }
    s.body = text.trim();
  } catch (e) {
    s.body = '[Could not load content/' + id + '.md]';
  }
  return s;
}

const expandable = new Map(); // id -> { li, btn } for entries that have subtopics

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
  const loaded = await Promise.all(ids.map(loadSection));
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

function show() {
  const wanted = decodeURIComponent(location.hash.slice(1));
  const s = sections.get(wanted) || sections.get(firstId);
  if (!s) return;

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

  page.replaceChildren(...(trail.length ? [crumbs] : []), h1, renderBody(s.body));
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
