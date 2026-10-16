// Both pages use this header so logo, navigation layout, and mobile behavior stay aligned.
const ambassadorPage = document.body.dataset.page === 'ambassador';
const header = document.querySelector('[data-site-header]');
const navigation = ambassadorPage
  ? [['Store', 'index.html'], ['Program', '#program'], ['How It Works', '#how'], ['FAQ', '#faq']]
  : [['Services', '#services'], ['New Arrivals', '#arrivals'], ['Ambassador Program', 'thompsons-jewellers-ambassador.html']];

if (header) {
  header.innerHTML = `
    <div class="navin">
      <a class="brand" href="index.html" aria-label="Thompson Jewellers home">
        <img class="brand-logo" src="images/thompson-jewellers-header-logo.png" alt="Thompson Jewellers" width="2142" height="734" fetchpriority="high">
      </a>
      <div class="header-actions">
        <nav class="links" id="mainMenu" aria-label="Main navigation">
          ${navigation.map(([label, href]) => `<a href="${href}">${label}</a>`).join('')}
        </nav>
        <a class="btn header-action" href="${ambassadorPage ? '#apply' : '#contact'}">${ambassadorPage ? 'Apply' : 'Visit us'}</a>
        <button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mainMenu">
          <span class="menu-icon" aria-hidden="true"></span>
        </button>
      </div>
    </div>`;

  const button = header.querySelector('.menu-toggle');
  const menu = header.querySelector('#mainMenu');
  const setMenu = open => {
    menu.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  button.addEventListener('click', () => setMenu(button.getAttribute('aria-expanded') !== 'true'));
  header.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      button.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) setMenu(false);
  });
  window.matchMedia('(max-width: 900px)').addEventListener('change', () => setMenu(false));
}
