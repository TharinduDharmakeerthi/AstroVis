const body = document.body;
const toggle = document.getElementById('toggle');
const sidebar = document.getElementById('sidebar');
const articles = [...document.querySelectorAll('main article')];

function setSidebar(open) {
  body.classList.toggle('collapsed', !open);
  toggle.setAttribute('aria-expanded', open);
  toggle.setAttribute('aria-label', open ? 'Hide contents' : 'Show contents');
}

function showPage() {
  const id = decodeURIComponent(location.hash.slice(1)) || 'home';
  const target = document.getElementById(id);
  const article = target && target.closest('main article');
  if (!article) { location.hash = '#home'; return; }

  articles.forEach(a => {
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

toggle.addEventListener('click', () => setSidebar(body.classList.contains('collapsed')));

// Clicking an entry in the contents hides the sidebar so the content fills the page
sidebar.addEventListener('click', e => {
  if (e.target.closest('a')) setSidebar(false);
});

window.addEventListener('hashchange', showPage);
showPage();
