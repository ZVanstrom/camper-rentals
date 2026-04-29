/* QuoteWidget — reusable per-camper quote builder
 *
 * Usage:
 *   new QuoteWidget({
 *     container: '#quote-widget',
 *     camper:   { name: '2025 Salem 32BHDS', weeknightRate: 130, weekendRate: 150, towInsurancePerDay: 20 },
 *     delivery: { ratePerMile: 5, minimum: 100, origin: 'Stanton, KY 40380' },
 *     emailjs:  { publicKey: '...', serviceId: '...', templateId: '...' }
 *   });
 *
 * Required EmailJS template variables (create a template with these):
 *   {{camper}} {{customer_email}} {{customer_name}} {{customer_phone}}
 *   {{check_in}} {{check_out}} {{total_nights}} {{weeknights}} {{weekend_nights}}
 *   {{nights_subtotal}} {{delivery_mode}} {{delivery_subtotal}}
 *   {{tow_insurance_subtotal}} {{total}}
 *
 * Required globals on the page: flatpickr, emailjs, google.maps (Places + DistanceMatrix)
 */
class QuoteWidget {
    constructor(config) {
        this.config = config;
        this.state = { checkIn: null, checkOut: null, mode: 'pickup', address: null, miles: null };
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
                            <button type="button" class="qw-toggle-btn active" data-mode="pickup">📍 Pickup in Slade</button>
                            <button type="button" class="qw-toggle-btn" data-mode="delivery">🚗 Delivery</button>
                        </div>
                    </div>
                    <div class="qw-field qw-address-field" hidden>
                        <label class="qw-label">Delivery Address</label>
                        <input type="text" class="qw-input qw-address" placeholder="Start typing an address...">
                        <div class="qw-helper qw-distance"></div>
                    </div>
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
                if (this.state.mode === 'pickup') { this.state.miles = null; this.state.address = null; this.$('.qw-distance').textContent = ''; }
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
            types: ['geocode'],
            componentRestrictions: { country: 'us' },
            fields: ['formatted_address', 'geometry']
        });
        this.distanceService = new google.maps.DistanceMatrixService();
        this.autocomplete.addListener('place_changed', () => {
            const place = this.autocomplete.getPlace();
            if (!place || !place.formatted_address) return;
            this.state.address = place.formatted_address;
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
            helper.textContent = `${this.state.miles.toFixed(0)} mi from ${this.config.delivery.origin.split(',')[0]} (${el.duration.text} drive)`;
            this.update();
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

    computeTotals() {
        const nights = this.calculateNights();
        if (!nights) return null;
        const { weeknightRate, weekendRate, towInsurancePerDay = 0 } = this.config.camper;
        const nightsSubtotal = nights.week * weeknightRate + nights.weekend * weekendRate;
        let deliverySubtotal = 0, deliveryDetail = null;
        let towInsuranceSubtotal = 0;
        if (this.state.mode === 'delivery') {
            if (this.state.miles == null) return { nights, nightsSubtotal, awaitingDelivery: true };
            const raw = this.state.miles * this.config.delivery.ratePerMile;
            const min = this.config.delivery.minimum;
            deliverySubtotal = Math.max(raw, min);
            deliveryDetail = { miles: this.state.miles, raw, appliedMinimum: raw < min };
        } else {
            towInsuranceSubtotal = towInsurancePerDay * nights.total;
        }
        return { nights, nightsSubtotal, deliverySubtotal, deliveryDetail, towInsuranceSubtotal, total: nightsSubtotal + deliverySubtotal + towInsuranceSubtotal };
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
        lines.push(`<div class="qw-line qw-total"><span>Total</span><span>$${Math.round(totals.total).toLocaleString()}</span></div>`);
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
        const params = {
            camper: this.config.camper.name,
            customer_email: email,
            customer_name:  this.$('.qw-name').value.trim()  || '(not provided)',
            customer_phone: this.$('.qw-phone').value.trim() || '(not provided)',
            check_in:  fmt(this.state.checkIn),
            check_out: fmt(this.state.checkOut),
            total_nights:    totals.nights.total,
            weeknights:      totals.nights.week,
            weekend_nights:  totals.nights.weekend,
            nights_subtotal: `$${totals.nightsSubtotal.toLocaleString()}`,
            delivery_mode:   this.state.mode === 'delivery'
                ? `Delivery to ${this.state.address} (${totals.deliveryDetail.miles.toFixed(0)} mi)`
                : 'Pickup in Slade',
            delivery_subtotal: this.state.mode === 'delivery' ? `$${Math.round(totals.deliverySubtotal).toLocaleString()}` : 'Free',
            tow_insurance_subtotal: this.state.mode === 'delivery' ? 'N/A' : `$${totals.towInsuranceSubtotal.toLocaleString()}`,
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
