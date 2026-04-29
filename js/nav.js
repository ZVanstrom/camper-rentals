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
        <ul class="nav-links">
            <li class="nav-dropdown">
                <a href="${root}#campers">Our Campers</a>
                <div class="dropdown-menu">
                    <a href="salem-26dbud.html">2025 Salem 26DBUD</a>
                    <a href="salem-32bhds.html">2025 Salem 32BHDS</a>
                    <a href="grey-wolf-26rr.html">2021 Grey Wolf Cherokee 26RR</a>
                </div>
            </li>
            <li><a href="${root}#location">Location</a></li>
            <li><a href="${root}#faq">FAQ</a></li>
            <li><a href="${root}#process">Booking Process</a></li>
            <li><a href="${quoteHref}">Get a Quote</a></li>
            <li><a href="${quoteHref}" class="nav-cta">Book Now</a></li>
        </ul>
    `;
})();
