/* ── CAROUSEL ── */
const slides   = document.querySelectorAll('.carousel-slide img');
const total    = slides.length;
const photos   = Array.from(slides).map(img => img.getAttribute('src'));
const track    = document.getElementById('carouselTrack');
const thumbEls = document.querySelectorAll('.carousel-thumb');
const counter  = document.getElementById('carouselCounter');
let current = 0;

function carouselGoTo(idx) {
    current = (idx + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    thumbEls.forEach((t, i) => t.classList.toggle('active', i === current));
    counter.textContent = `${current + 1} / ${total}`;
    thumbEls[current].scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
}
function carouselMove(dir) { carouselGoTo(current + dir); }

/* Drag to swipe */
const trackContainer = document.querySelector('.carousel-track-container');
let dragStartX = 0, dragDelta = 0, isDragging = false, wasDrag = false;

trackContainer.addEventListener('mousedown', e => {
    dragStartX = e.clientX; dragDelta = 0; isDragging = true; wasDrag = false;
    trackContainer.classList.add('dragging'); e.preventDefault();
});
window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    dragDelta = e.clientX - dragStartX;
    if (Math.abs(dragDelta) > 5) wasDrag = true;
});
window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    trackContainer.classList.remove('dragging');
    if (dragDelta < -50) carouselMove(1);
    else if (dragDelta > 50) carouselMove(-1);
});
trackContainer.addEventListener('click', e => {
    if (wasDrag) { e.stopImmediatePropagation(); wasDrag = false; }
}, true);

/* Thumbnail drag scroll */
const thumbStrip = document.getElementById('carouselThumbs');
let thumbDragStartX = 0, thumbScrollStart = 0, isThumbDragging = false, wasThumbDrag = false;

thumbStrip.addEventListener('dragstart', e => e.preventDefault());
thumbStrip.addEventListener('mousedown', e => {
    thumbDragStartX = e.clientX; thumbScrollStart = thumbStrip.scrollLeft;
    isThumbDragging = true; wasThumbDrag = false;
    thumbStrip.style.cursor = 'grabbing'; e.preventDefault(); e.stopPropagation();
});
window.addEventListener('mousemove', e => {
    if (!isThumbDragging) return;
    const dx = e.clientX - thumbDragStartX;
    if (Math.abs(dx) > 5) wasThumbDrag = true;
    thumbStrip.scrollLeft = thumbScrollStart - dx;
});
window.addEventListener('mouseup', () => {
    if (!isThumbDragging) return;
    isThumbDragging = false; thumbStrip.style.cursor = '';
});
thumbStrip.addEventListener('click', e => {
    if (wasThumbDrag) { e.stopImmediatePropagation(); wasThumbDrag = false; }
}, true);

/* ── LIGHTBOX ── */
const lightbox        = document.getElementById('lightbox');
const lightboxImg     = document.getElementById('lightboxImg');
const lightboxCounter = document.getElementById('lightboxCounter');
let lbIndex = 0;

function openLightbox(idx) {
    lbIndex = idx;
    lightboxImg.src = photos[lbIndex];
    lightboxCounter.textContent = `${lbIndex + 1} / ${photos.length}`;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
}
function closeLightboxOutside(e) { if (e.target === lightbox) closeLightbox(); }
function lightboxPrev(e) {
    e.stopPropagation();
    lbIndex = (lbIndex - 1 + photos.length) % photos.length;
    lightboxImg.src = photos[lbIndex];
    lightboxCounter.textContent = `${lbIndex + 1} / ${photos.length}`;
}
function lightboxNext(e) {
    e.stopPropagation();
    lbIndex = (lbIndex + 1) % photos.length;
    lightboxImg.src = photos[lbIndex];
    lightboxCounter.textContent = `${lbIndex + 1} / ${photos.length}`;
}
document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'ArrowLeft')  lightboxPrev(e);
    if (e.key === 'ArrowRight') lightboxNext(e);
    if (e.key === 'Escape')     closeLightbox();
});

/* ── TECH DETAILS TOGGLE ── */
function toggleTechDetails() {
    document.getElementById('techDetailsContent').classList.toggle('open');
    document.getElementById('toggleIcon').classList.toggle('open');
}
