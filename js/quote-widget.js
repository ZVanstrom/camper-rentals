/* QuoteWidget — reusable per-camper quote builder
 *
 * Usage:
 *   new QuoteWidget({
 *     container: '#quote-widget',
 *     camper:   { name: '2025 Salem 32BHDS', weeknightRate: 130, weekendRate: 150, towInsurancePerDay: 20 },
 *     delivery: { ratePerMile: 5, minimum: 100, origin: 'Stanton, KY 40380' },
 *     addons:   [
 *       { id: 'starlink',  label: 'Starlink',        price: 60, per: 'rental' },
 *       { id: 'generator', label: 'Generator',        price: 10, per: 'night'  },
 *       { id: 'espresso',  label: 'Espresso machine', price: 10, per: 'night'  },
 *     ],
 *     emailjs:  { publicKey: '...', serviceId: '...', templateId: '...' }
 *   });
 *
 * Required EmailJS template variables:
 *   {{camper}} {{customer_email}} {{customer_name}} {{customer_phone}}
 *   {{check_in}} {{check_out}} {{total_nights}}
 *   {{nights_subtotal}} {{delivery_mode}} {{delivery_subtotal}}
 *   {{tow_insurance_subtotal}} {{addons_label}} {{addons_subtotal}}
 *   {{subtotal}} {{tax}} {{total}}
 *
 * Required globals on the page: flatpickr, emailjs, google.maps (Places + DistanceMatrix)
 */
class QuoteWidget {
    constructor(config) {
        this.config = config;
        this.state = { checkIn: null, checkOut: null, mode: 'delivery', address: null, miles: null, addons: {} };
        if (this.config.addons) {
            this.config.addons.forEach(a => { this.state.addons[a.id] = false; });
        }
        this.container = document.querySelector(config.container);
        if (!this.container) { console.error('QuoteWidget: container not found:', config.container); return; }
        this.render();
        this.$ = (sel) => this.container.querySelector(sel);
        this.bindEvents();
        this.initFlatpickr();
        this.initEmailJS();
        this.initGoogleMapsWhenReady();
        this.update();
    }

    render() {
        const addonsHtml = this.config.addons?.length ? `
                    <div class="qw-field">
                        <label class="qw-label">Add-ons <span style="font-weight:400;color:#94a3b8;font-size:0.85em;">(optional)</span></label>
                        <div class="qw-addons">
                            ${this.config.addons.map(a =>
                                `<button type="button" class="qw-addon-btn" data-addon="${a.id}">${a.label} <small style="opacity:0.7">+$${a.price}${a.per === 'night' ? '/night' : '/trip'}</small></button>`
                            ).join('')}
                        </div>
                    </div>` : '';

        this.container.innerHTML = `
            <div class="qw">
                <div class="qw-header">
                    <h2>Get an Instant Quote</h2>
                    <p>Pick your dates and choose pickup or delivery — your total updates instantly.</p>
                </div>
                <div class="qw-form">
                    <div class="qw-field">
                        <label class="qw-label">Trip Dates</label>
                        <input type="text" class="qw-input qw-dates" placeholder="Select check-in → check-out" readonly>
                        <div class="qw-helper qw-night-count"></div>
                    </div>
                    <div class="qw-field">
                        <label class="qw-label">Pickup or Delivery</label>
                        <div class="qw-toggle">
                            <button type="button" class="qw-toggle-btn active" data-mode="delivery">🚗 Delivery</button>
                            <button type="button" class="qw-toggle-btn" data-mode="pickup">📍 Pickup in Slade</button>
                        </div>
                    </div>
                    <div class="qw-field qw-address-field">
                        <label class="qw-label">Delivery Address</label>
                        <input type="text" class="qw-input qw-address" placeholder="Start typing an address...">
                        <div class="qw-helper qw-distance"></div>
                        <div class="qw-map" hidden></div>
                    </div>
                    ${addonsHtml}
                </div>
                <div class="qw-quote">
                    <div class="qw-line-items"></div>
                    <p class="qw-prompt">Select your dates to see a quote.</p>
                </div>
                <div class="qw-customer" hidden>
                    <h3>Want this quote in your inbox?</h3>
                    <p class="qw-customer-sub">Drop your email and we'll send the full breakdown — and follow up to lock in your dates.</p>
                    <div class="qw-customer-fields">
                        <input type="email" class="qw-input qw-email" placeholder="Email (required)" required>
                        <input type="text"  class="qw-input qw-name"  placeholder="Name (optional)">
                        <input type="tel"   class="qw-input qw-phone" placeholder="Phone (optional)">
                    </div>
                    <button type="button" class="qw-send-btn">Send Me This Quote →</button>
                    <p class="qw-status"></p>
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.container.querySelectorAll('.qw-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.container.querySelectorAll('.qw-toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.mode = btn.dataset.mode;
                this.$('.qw-address-field').hidden = this.state.mode !== 'delivery';
                if (this.state.mode === 'pickup') { this.state.miles = null; this.state.address = null; this.$('.qw-distance').textContent = ''; this.$('.qw-map').hidden = true; }
                this.update();
            });
        });
        this.container.querySelectorAll('.qw-addon-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.addon;
                this.state.addons[id] = !this.state.addons[id];
                btn.classList.toggle('active', this.state.addons[id]);
                this.update();
            });
        });
        this.$('.qw-send-btn').addEventListener('click', () => this.sendEmail());
    }

    initFlatpickr() {
        if (typeof flatpickr === 'undefined') { console.error('QuoteWidget: flatpickr not loaded'); return; }
        flatpickr(this.$('.qw-dates'), {
            mode: 'range',
            minDate: 'today',
            dateFormat: 'M j, Y',
            showMonths: window.innerWidth > 768 ? 2 : 1,
            onChange: (dates) => {
                if (dates.length === 2) { this.state.checkIn = dates[0]; this.state.checkOut = dates[1]; }
                else { this.state.checkIn = null; this.state.checkOut = null; }
                this.update();
            }
        });
    }

    initEmailJS() {
        if (window.emailjs && this.config.emailjs?.publicKey) {
            emailjs.init({ publicKey: this.config.emailjs.publicKey });
        }
    }

    initGoogleMapsWhenReady() {
        const tryInit = () => {
            if (window.google?.maps?.places) this.initGoogleMaps();
            else setTimeout(tryInit, 200);
        };
        tryInit();
    }

    initGoogleMaps() {
        const input = this.$('.qw-address');
        this.autocomplete = new google.maps.places.Autocomplete(input, {
            componentRestrictions: { country: 'us' },
            fields: ['formatted_address', 'name', 'geometry']
        });
        this.distanceService = new google.maps.DistanceMatrixService();
        this.autocomplete.addListener('place_changed', () => {
            const place = this.autocomplete.getPlace();
            if (!place || !place.formatted_address) return;
            this.state.address = place.name && place.name !== place.formatted_address
                ? `${place.name}, ${place.formatted_address}`
                : place.formatted_address;
            this.lookupDistance(place.formatted_address);
        });
    }

    lookupDistance(address) {
        const helper = this.$('.qw-distance');
        helper.textContent = 'Calculating distance…';
        this.distanceService.getDistanceMatrix({
            origins: [this.config.delivery.origin],
            destinations: [address],
            travelMode: 'DRIVING',
            unitSystem: google.maps.UnitSystem.IMPERIAL,
        }, (response, status) => {
            if (status !== 'OK') { helper.textContent = 'Could not calculate distance for that address.'; return; }
            const el = response.rows[0].elements[0];
            if (el.status !== 'OK') { helper.textContent = 'No driving route found to that address.'; return; }
            this.state.miles = el.distance.value / 1609.344;
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(this.config.delivery.origin)}&destination=${encodeURIComponent(address)}`;
            helper.innerHTML = `${this.state.miles.toFixed(0)} mi from ${this.config.delivery.origin.split(',')[0]} (${el.duration.text} drive) · <a href="${mapsUrl}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none;font-weight:600;">View route ↗</a>`;
            this.showRouteMap(this.config.delivery.origin, address);
            this.update();
        });
    }

    showRouteMap(origin, destination) {
        const mapEl = this.$('.qw-map');
        mapEl.hidden = false;
        const map = new google.maps.Map(mapEl, {
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'cooperative',
        });
        new google.maps.DirectionsService().route({
            origin,
            destination,
            travelMode: google.maps.TravelMode.DRIVING,
        }, (result, status) => {
            if (status === 'OK') {
                new google.maps.DirectionsRenderer({ map, suppressMarkers: false }).setDirections(result);
            }
        });
    }

    calculateNights() {
        if (!this.state.checkIn || !this.state.checkOut) return null;
        let week = 0, weekend = 0;
        const cur = new Date(this.state.checkIn); cur.setHours(0, 0, 0, 0);
        const end = new Date(this.state.checkOut); end.setHours(0, 0, 0, 0);
        while (cur < end) {
            const d = cur.getDay(); // 0=Sun, 5=Fri, 6=Sat
            if (d === 0 || d === 5 || d === 6) weekend++; else week++;
            cur.setDate(cur.getDate() + 1);
        }
        return { week, weekend, total: week + weekend };
    }

    computeAddonLines(nights) {
        const lines = [];
        if (!this.config.addons || !nights) return lines;
        for (const a of this.config.addons) {
            if (this.state.addons[a.id]) {
                const cost = a.per === 'night' ? a.price * nights.total : a.price;
                lines.push({ ...a, cost });
            }
        }
        return lines;
    }

    computeTotals() {
        const nights = this.calculateNights();
        if (!nights) return null;
        const { weeknightRate, weekendRate, towInsurancePerDay = 0 } = this.config.camper;
        const nightsSubtotalFull = nights.week * weeknightRate + nights.weekend * weekendRate;
        let discountRate = 0, discountLabel = null;
        if (nights.total >= 14)      { discountRate = 0.15; discountLabel = '15% extended stay discount'; }
        else if (nights.total === 7) { discountRate = 0.10; discountLabel = '10% weekly discount'; }
        const discountAmount = Math.round(nightsSubtotalFull * discountRate);
        const nightsSubtotal = nightsSubtotalFull - discountAmount;
        let deliverySubtotal = 0, deliveryDetail = null;
        let towInsuranceSubtotal = 0;
        if (this.state.mode === 'delivery') {
            if (this.state.miles == null) return { nights, nightsSubtotalFull, nightsSubtotal, discountRate, discountLabel, discountAmount, awaitingDelivery: true };
            const raw = this.state.miles * this.config.delivery.ratePerMile;
            const min = this.config.delivery.minimum;
            deliverySubtotal = Math.round(Math.max(raw, min));
            deliveryDetail = { miles: this.state.miles, raw, appliedMinimum: raw < min };
        } else {
            towInsuranceSubtotal = towInsurancePerDay * nights.total;
        }
        const addonLines = this.computeAddonLines(nights);
        const addonsSubtotal = addonLines.reduce((sum, a) => sum + a.cost, 0);
        const subtotal = Math.round(nightsSubtotal + deliverySubtotal + towInsuranceSubtotal + addonsSubtotal);
        const tax = Math.round(subtotal * 0.06);
        const total = Math.round(subtotal + tax);
        return { nights, nightsSubtotalFull, nightsSubtotal, discountRate, discountLabel, discountAmount, deliverySubtotal, deliveryDetail, towInsuranceSubtotal, addonLines, addonsSubtotal, subtotal, tax, total };
    }

    update() {
        const lineItems = this.$('.qw-line-items');
        const prompt = this.$('.qw-prompt');
        const customer = this.$('.qw-customer');
        const nightCount = this.$('.qw-night-count');

        const nights = this.calculateNights();
        if (nights) {
            const parts = [];
            if (nights.week > 0)    parts.push(`${nights.week} weeknight${nights.week !== 1 ? 's' : ''}`);
            if (nights.weekend > 0) parts.push(`${nights.weekend} weekend night${nights.weekend !== 1 ? 's' : ''}`);
            nightCount.textContent = `${nights.total} night${nights.total !== 1 ? 's' : ''} (${parts.join(', ')})`;
        } else {
            nightCount.textContent = '';
        }

        const totals = this.computeTotals();
        if (!totals) {
            lineItems.innerHTML = ''; prompt.textContent = 'Select your dates to see a quote.'; prompt.style.display = ''; customer.hidden = true; return;
        }
        if (totals.awaitingDelivery) {
            lineItems.innerHTML = ''; prompt.textContent = 'Enter a delivery address to complete your quote.'; prompt.style.display = ''; customer.hidden = true; return;
        }

        prompt.style.display = 'none';
        const { weeknightRate, weekendRate } = this.config.camper;
        const lines = [];
        if (totals.nights.week > 0)    lines.push(`<div class="qw-line"><span>${totals.nights.week} weeknight${totals.nights.week !== 1 ? 's' : ''} × $${weeknightRate}</span><span>$${(totals.nights.week * weeknightRate).toLocaleString()}</span></div>`);
        if (totals.nights.weekend > 0) lines.push(`<div class="qw-line"><span>${totals.nights.weekend} weekend night${totals.nights.weekend !== 1 ? 's' : ''} × $${weekendRate}</span><span>$${(totals.nights.weekend * weekendRate).toLocaleString()}</span></div>`);
        if (totals.discountAmount > 0) lines.push(`<div class="qw-line qw-discount"><span>${totals.discountLabel}</span><span>-$${totals.discountAmount.toLocaleString()}</span></div>`);
        if (this.state.mode === 'delivery') {
            const dd = totals.deliveryDetail;
            const detail = dd.appliedMinimum
                ? `${dd.miles.toFixed(0)} mi × $${this.config.delivery.ratePerMile}/mi · $${this.config.delivery.minimum} min`
                : `${dd.miles.toFixed(0)} mi × $${this.config.delivery.ratePerMile}/mi`;
            lines.push(`<div class="qw-line"><span>Delivery <small>(${detail})</small></span><span>$${Math.round(totals.deliverySubtotal).toLocaleString()}</span></div>`);
        } else {
            lines.push(`<div class="qw-line"><span>Pickup in Slade</span><span class="qw-free">Free</span></div>`);
            const towRate = this.config.camper.towInsurancePerDay || 0;
            if (towRate > 0) {
                lines.push(`<div class="qw-line"><span>Towing insurance <small>(${totals.nights.total} day${totals.nights.total !== 1 ? 's' : ''} × $${towRate})</small></span><span>$${totals.towInsuranceSubtotal.toLocaleString()}</span></div>`);
            }
        }
        for (const a of totals.addonLines) {
            const detail = a.per === 'night' ? ` <small>(${totals.nights.total} night${totals.nights.total !== 1 ? 's' : ''} × $${a.price})</small>` : '';
            lines.push(`<div class="qw-line"><span>${a.label}${detail}</span><span>$${a.cost.toLocaleString()}</span></div>`);
        }
        lines.push(`<div class="qw-line qw-subtotal"><span>Subtotal</span><span>$${totals.subtotal.toLocaleString()}</span></div>`);
        lines.push(`<div class="qw-line"><span>Tax <small>(6%)</small></span><span>$${totals.tax.toLocaleString()}</span></div>`);
        lines.push(`<div class="qw-line qw-total"><span>Total</span><span>$${totals.total.toLocaleString()}</span></div>`);
        lineItems.innerHTML = lines.join('');
        customer.hidden = false;
    }

    async sendEmail() {
        const status = this.$('.qw-status');
        const email = this.$('.qw-email').value.trim();
        if (!email) { status.textContent = 'Email is required.'; status.className = 'qw-status qw-error'; return; }
        const totals = this.computeTotals();
        if (!totals || totals.awaitingDelivery) return;

        const fmt = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const addonLines = totals.addonLines;
        const addonsLabel = addonLines.length
            ? 'Add-ons: ' + addonLines.map(a => {
                const detail = a.per === 'night' ? ` (${totals.nights.total} nights x $${a.price})` : '';
                return `${a.label}${detail}`;
              }).join(', ')
            : 'Add-ons';
        const addonsSubtotal = addonLines.length ? `$${totals.addonsSubtotal.toLocaleString()}` : 'None';

        const params = {
            subject: `Quote Request - ${this.config.camper.name} - ${fmt(this.state.checkIn)} to ${fmt(this.state.checkOut)}`,
            camper: this.config.camper.name,
            customer_email: email,
            customer_name:  this.$('.qw-name').value.trim(),
            customer_phone: this.$('.qw-phone').value.trim(),
            name:  this.$('.qw-name').value.trim(),
            email: email,
            check_in:  fmt(this.state.checkIn),
            check_out: fmt(this.state.checkOut),
            total_nights:    String(totals.nights.total),
            nights_subtotal: `$${totals.nightsSubtotal.toLocaleString()}`,
            delivery_mode:   this.state.mode === 'delivery'
                ? `Delivery to ${this.state.address} (${totals.deliveryDetail.miles.toFixed(0)} mi)`
                : 'Pickup in Slade',
            delivery_subtotal: this.state.mode === 'delivery' ? `$${Math.round(totals.deliverySubtotal).toLocaleString()}` : 'Free',
            tow_insurance_subtotal: this.state.mode === 'delivery' ? 'N/A' : `$${totals.towInsuranceSubtotal.toLocaleString()}`,
            addons_label:    addonsLabel,
            addons_subtotal: addonsSubtotal,
            subtotal: `$${totals.subtotal.toLocaleString()}`,
            tax: `$${totals.tax.toLocaleString()}`,
            total: `$${Math.round(totals.total).toLocaleString()}`,
        };

        status.textContent = 'Sending…';
        status.className = 'qw-status';
        try {
            await emailjs.send(this.config.emailjs.serviceId, this.config.emailjs.templateId, params);
            status.textContent = '✓ Quote sent! Check your inbox — we\'ll be in touch shortly.';
            status.className = 'qw-status qw-success';
        } catch (err) {
            console.error('EmailJS error:', err);
            status.textContent = 'Couldn\'t send. Please email booking@red-river-campers.com directly.';
            status.className = 'qw-status qw-error';
        }
    }
}
