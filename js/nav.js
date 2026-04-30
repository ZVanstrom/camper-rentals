/* Shared nav — injected on every page.
 * Pass the page's quote anchor as a data attribute on the <nav> tag:
 *   <nav data-quote="#quote"></nav>          (camper pages)
 *   <nav data-quote="#instant-quote"></nav>  (index)
 */
(function () {
    const nav = document.querySelector('nav[data-quote]');
    if (!nav) return;
    const quoteHref = nav.getAttribute('data-quote');
    const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
    const root = isIndex ? '' : 'index.html';

    nav.innerHTML = `
        <a href="${root || '#'}" class="logo">Red River Camper Co.</a>
        <button class="nav-hamburger" aria-label="Open menu" aria-expanded="false">
            <span></span><span></span><span></span>
        </button>
        <ul class="nav-links">
            <li class="nav-dropdown">
                <a href="${root}#campers">Our Campers</a>
                <div class="dropdown-menu">
                    <a href="salem-26dbud.html">2025 Salem 26DBUD</a>
                    <a href="salem-32bhds.html">2025 Salem 32BHDS</a>
                    <a href="grey-wolf-26rr.html">2021 Grey Wolf Cherokee 26RR</a>
                </div>
            </li>
            <li><a href="${root}#faq">FAQ</a></li>
            <li><a href="${root}#process">Booking Process</a></li>
            <li><a href="${root}#location">Location</a></li>
            <li><a href="${quoteHref}">Get a Quote</a></li>
            <li><a href="${quoteHref}" class="nav-cta">Book Now</a></li>
        </ul>
    `;

    const hamburger = nav.querySelector('.nav-hamburger');
    const navLinks  = nav.querySelector('.nav-links');
    const dropdown  = nav.querySelector('.nav-dropdown');

    hamburger.addEventListener('click', () => {
        const open = nav.classList.toggle('nav-open');
        hamburger.setAttribute('aria-expanded', open);
    });

    // Our Campers tap-to-expand on mobile
    dropdown.querySelector('a').addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            e.preventDefault();
            dropdown.classList.toggle('open');
        }
    });

    // Close menu when any nav link (other than the Our Campers toggle) is tapped
    navLinks.querySelectorAll('a:not(.nav-dropdown > a)').forEach(a => {
        a.addEventListener('click', () => {
            nav.classList.remove('nav-open');
            dropdown.classList.remove('open');
            hamburger.setAttribute('aria-expanded', 'false');
        });
    });
})();
