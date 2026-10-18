const sidebar = document.getElementById('sidebar');
const main = document.querySelector('main');

function makeLink(href, text) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  return a;
}

async function blocksToNodes(blocks = []) {
  return Promise.all(blocks.map(async b => {
    if (b.text) {
      const res = await fetch(b.text);
      if (!res.ok) throw new Error('Missing file: ' + b.text);
      const div = document.createElement('div');
      div.className = 'text';
      div.innerHTML = marked.parse(await res.text());
      return div;
    }
    const fig = document.createElement('figure');
    const img = document.createElement('img');
    img.src = b.image;
    img.alt = b.alt || '';
    img.loading = 'lazy';
    fig.append(img);
    return fig;
  }));
}

async function build() {
  const res = await fetch('contents.json');
  if (!res.ok) throw new Error('Missing file: contents.json');
  const { sections } = await res.json();
  const toc = document.createElement('ul');
  toc.className = 'toc';

  for (const s of sections) {
    const li = document.createElement('li');
    li.append(makeLink('#' + s.id, s.title));

    const article = document.createElement('article');
    article.id = s.id;
    article.hidden = true;

    const crumb = makeLink('#' + s.id, '\u2039 ' + s.title);
    crumb.className = 'crumb';
    const h1 = document.createElement('h1');
    h1.textContent = s.title;
    const intro = document.createElement('div');
    intro.className = 'intro';
    intro.append(...await blocksToNodes(s.intro));
    article.append(crumb, h1, intro);

    const subList = document.createElement('ul');
    for (const ss of s.subsections || []) {
      const subLi = document.createElement('li');
      subLi.append(makeLink('#' + ss.id, ss.title));
      subList.append(subLi);

      const section = document.createElement('section');
      section.id = ss.id;
      const h2 = document.createElement('h2');
      h2.textContent = ss.title;
      section.append(h2, ...await blocksToNodes(ss.blocks));
      article.append(section);
    }
    if (subList.children.length) li.append(subList);

    toc.append(li);
    main.append(article);
  }
  sidebar.append(toc);
}

function showPage() {
  const id = decodeURIComponent(location.hash.slice(1)) || 'home';
  const target = document.getElementById(id);
  const article = target && target.closest('main article');
  if (!article) { location.hash = '#home'; return; }

  document.querySelectorAll('main article').forEach(a => {
    a.hidden = true;
    a.classList.remove('single');
    a.querySelectorAll('section').forEach(s => (s.hidden = false));
  });

  article.hidden = false;
  if (target.tagName === 'SECTION') {
    article.classList.add('single');
    article.querySelectorAll('section').forEach(s => (s.hidden = s !== target));
  }

  sidebar.querySelectorAll('a').forEach(a => {
    if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  window.scrollTo(0, 0);
}

build()
  .then(() => {
    window.addEventListener('hashchange', showPage);
    showPage();
  })
  .catch(err => {
    const p = document.createElement('p');
    p.textContent = 'Could not load the content (' + err.message + '). ' +
      'If you opened this file by double-clicking it, use a local server or the GitHub Pages link instead.';
    main.append(p);
  });
