/* Arvenna main site behaviour.
   Independent features, no dependencies, no build step.
   The .js class is added by an inline script in <head>, before first paint. */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* --- Theme switch, signal red or alpine green ------------------------- */

  function initTheme() {
    var toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    toggle.addEventListener('click', function () {
      var isForest = document.documentElement.getAttribute('data-theme') === 'forest';
      if (isForest) {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', 'forest');
      }
      try {
        localStorage.setItem('arvenna-theme', isForest ? 'signal' : 'forest');
      } catch (e) {
        // Private mode or blocked storage: the switch still works for this visit.
      }
    });
  }

  /* --- Photography, fade in once decoded -------------------------------- */

  function initPhotos() {
    document.querySelectorAll('.ph > img').forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add('is-loaded');
        return;
      }
      img.addEventListener('load', function () { img.classList.add('is-loaded'); });
      // A broken file must not leave a blurred placeholder sitting there forever.
      img.addEventListener('error', function () { img.classList.add('is-loaded'); });
    });
  }

  /* --- Mobile navigation ------------------------------------------------ */

  function initMobileNav() {
    var toggle = document.querySelector('.nav-toggle');
    var panel = document.getElementById('mobileNav');
    if (!toggle || !panel) return;

    function close() {
      toggle.setAttribute('aria-expanded', 'false');
      panel.classList.remove('is-open');
    }

    toggle.addEventListener('click', function () {
      var isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      panel.classList.toggle('is-open', !isOpen);
    });

    panel.addEventListener('click', function (event) {
      if (event.target.closest('a')) close();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });
  }

  /* --- Sticky header ----------------------------------------------------- */

  function initStickyHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    function update() { header.classList.toggle('is-stuck', window.scrollY > 8); }

    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* --- Reveal, stagger and wipe ----------------------------------------- */

  function initReveal() {
    var targets = document.querySelectorAll('.reveal, .stagger, .wipe');
    if (!targets.length) return;

    // Index each stagger child so CSS can offset its transition-delay.
    document.querySelectorAll('.stagger').forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.setProperty('--i', i);
      });
    });

    function showAll() {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
    }

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      showAll();
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    targets.forEach(function (el) { observer.observe(el); });

    // Safety net: if the observer never fires (some embedded contexts report
    // isIntersecting false forever), show everything rather than ship a blank page.
    setTimeout(function () {
      var stuck = document.querySelectorAll('.reveal:not(.is-visible), .stagger:not(.is-visible)');
      if (stuck.length === targets.length) showAll();
    }, 2500);
  }

  /* --- Parallax ---------------------------------------------------------- */

  function initParallax() {
    var items = document.querySelectorAll('.parallax');
    if (!items.length || reduceMotion.matches) return;

    var ticking = false;

    function update() {
      var mid = window.innerHeight / 2;
      items.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
        var offset = (rect.top + rect.height / 2 - mid) / mid;
        var strength = parseFloat(el.dataset.parallax || '18');
        el.style.transform = 'translate3d(0,' + (offset * strength).toFixed(2) + 'px,0)';
      });
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  /* --- Branch selector and live demo preview ---------------------------- */

  var IS_EN = document.documentElement.lang.slice(0, 2) === 'en';

  var DEMOS = {
    coiffeur: {
      branch: IS_EN ? 'Hair salon' : 'Coiffeur',
      name: 'Salon Aurea',
      desc: IS_EN
        ? 'Price list, appointment requests and a gallery. Calm and high end, the way the salon wants to feel.'
        : 'Preisliste, Terminanfrage und Galerie. Ruhig und hochwertig, so wie der Salon wirken soll.',
      url: 'demos/coiffeur/index.html'
    },
    gastro: {
      branch: IS_EN ? 'Restaurant' : 'Gastronomie',
      name: 'Restaurant Sonnenhof',
      desc: IS_EN
        ? 'Menu, weekly lunch and table reservations. Warm and inviting, the guest pictures the room.'
        : 'Speisekarte, Mittagsmenü und Reservation. Warm und einladend, der Gast sieht den Raum vor sich.',
      url: 'demos/gastro/index.html'
    },
    baufirma: {
      branch: IS_EN ? 'Construction' : 'Bau und Handwerk',
      name: 'Steinmann Bau AG',
      desc: IS_EN
        ? 'Projects, a quote form and a large click to call button. Grounded and direct.'
        : 'Referenzen, Offertformular und ein grosser Anruf-Knopf. Bodenständig und direkt.',
      url: 'demos/baufirma/index.html'
    },
    robotik: {
      branch: IS_EN ? 'Industry and B2B' : 'Industrie und B2B',
      name: 'Voltra Robotics AG',
      desc: IS_EN
        ? 'Services that need explaining, made understandable, with a technical enquiry form.'
        : 'Erklärungsbedürftige Leistungen verständlich gemacht, mit technischer Anfrage.',
      url: 'demos/robotik/index.html'
    }
  };

  function initStage() {
    var frame = document.getElementById('stageFrame');
    var viewport = document.getElementById('stageViewport');
    if (!frame || !viewport) return;

    var loading = document.getElementById('stageLoading');
    var link = document.getElementById('stageLink');
    var urlLabel = document.getElementById('stageUrl');
    var branchLabel = document.getElementById('stageBranch');
    var nameLabel = document.getElementById('stageName');
    var descLabel = document.getElementById('stageDesc');
    var chips = document.querySelectorAll('.branch-chip[data-demo]');
    var thumbs = document.querySelectorAll('.demo-thumb[data-demo]');
    var current = 'coiffeur';
    var loaded = false;
    // The English page sits one level deeper, so demo paths need a prefix.
    var wrap = document.querySelector('.stage-wrap');
    var base = (wrap && wrap.dataset.base) || '';

    // The iframe renders at a fixed desktop width, then scales to fit.
    var FRAME_W = 1440;

    function rescale() {
      var scale = viewport.clientWidth / FRAME_W;
      frame.style.transform = 'scale(' + scale + ')';
      frame.style.height = (viewport.clientHeight / scale) + 'px';
    }

    function select(key, loadNow) {
      var demo = DEMOS[key];
      if (!demo) return;
      current = key;

      chips.forEach(function (c) { c.setAttribute('aria-selected', String(c.dataset.demo === key)); });
      thumbs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.demo === key)); });

      branchLabel.textContent = demo.branch;
      nameLabel.textContent = demo.name;
      descLabel.textContent = demo.desc;
      urlLabel.textContent = 'arvenna.ch/' + demo.url.replace('/index.html', '');
      link.href = base + demo.url;
      link.setAttribute('aria-label', (IS_EN ? 'Open the ' : 'Demoprojekt ') + demo.name +
        (IS_EN ? ' demo at full size' : ' in voller Grösse öffnen'));

      if (!loadNow) return;
      frame.classList.remove('is-ready');
      if (loading) loading.classList.remove('is-hidden');
      frame.src = base + demo.url;
      loaded = true;
    }

    frame.addEventListener('load', function () {
      if (!frame.src) return;
      rescale();
      frame.classList.add('is-ready');
      if (loading) loading.classList.add('is-hidden');
    });

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () { select(chip.dataset.demo, true); });
    });

    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () { select(thumb.dataset.demo, true); });
      thumb.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select(thumb.dataset.demo, true);
        }
      });
    });

    window.addEventListener('resize', rescale);
    select(current, false);

    // Hold the iframe back until the section is actually approached, so four
    // full demo pages never compete with the hero for bandwidth.
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !loaded) {
            select(current, true);
            io.disconnect();
          }
        });
      }, { rootMargin: '300px' });
      io.observe(viewport);
    } else {
      select(current, true);
    }
  }

  /* --- "Meine Branche fehlt" preselects the contact form ---------------- */

  function initBranchMissing() {
    var trigger = document.getElementById('branchMissing');
    var select = document.getElementById('branche');
    if (!trigger || !select) return;

    trigger.addEventListener('click', function () {
      select.value = IS_EN ? 'Other industry' : 'Andere Branche';
      // Give focus after the smooth scroll has had a moment to run.
      setTimeout(function () {
        var message = document.getElementById('nachricht');
        if (message) message.focus({ preventScroll: true });
      }, 700);
    });
  }

  /* --- FAQ accordion ----------------------------------------------------- */

  function initFaq() {
    var questions = document.querySelectorAll('.faq-q');

    questions.forEach(function (button) {
      button.addEventListener('click', function () {
        var item = button.closest('.faq-item');
        var isOpen = button.getAttribute('aria-expanded') === 'true';

        // One panel open at a time keeps the section short enough to scan.
        questions.forEach(function (other) {
          other.setAttribute('aria-expanded', 'false');
          other.closest('.faq-item').classList.remove('is-open');
        });

        if (!isOpen) {
          button.setAttribute('aria-expanded', 'true');
          item.classList.add('is-open');
        }
      });
    });
  }

  /* --- Contact form ------------------------------------------------------ */

  function initForm() {
    var form = document.getElementById('kontaktForm');
    if (!form) return;

    var status = form.querySelector('.form-status');
    var copy = {
      de: {
        required: 'Bitte füllen Sie dieses Feld aus.',
        email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
        sending: 'Wird gesendet',
        ok: 'Vielen Dank, Ihre Anfrage ist angekommen. Wir melden uns innerhalb eines Arbeitstages.',
        err: 'Das hat leider nicht geklappt. Schreiben Sie uns bitte direkt an info@arvenna.ch.'
      },
      en: {
        required: 'Please fill in this field.',
        email: 'Please enter a valid email address.',
        sending: 'Sending',
        ok: 'Thank you, we have received your enquiry and will reply within one working day.',
        err: 'Something went wrong. Please email us directly at info@arvenna.ch.'
      }
    };
    var t = copy[document.documentElement.lang.slice(0, 2) === 'en' ? 'en' : 'de'];

    function setError(field, message) {
      var box = form.querySelector('#' + field.id + '-error');
      field.setAttribute('aria-invalid', 'true');
      if (box) {
        box.textContent = message;
        box.classList.add('is-visible');
      }
    }

    function clearError(field) {
      var box = form.querySelector('#' + field.id + '-error');
      field.removeAttribute('aria-invalid');
      if (box) box.classList.remove('is-visible');
    }

    function validate(field) {
      var value = field.value.trim();

      if (field.hasAttribute('required') && !value) {
        setError(field, t.required);
        return false;
      }
      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        setError(field, t.email);
        return false;
      }
      clearError(field);
      return true;
    }

    function showStatus(text, kind) {
      if (!status) return;
      status.textContent = text;
      status.className = 'form-status is-visible ' + kind;
    }

    form.querySelectorAll('input, select, textarea').forEach(function (field) {
      if (field.closest('.hp')) return;
      field.addEventListener('blur', function () { validate(field); });
      field.addEventListener('input', function () {
        if (field.getAttribute('aria-invalid') === 'true') validate(field);
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var fields = Array.prototype.slice.call(form.querySelectorAll('[required]'));
      var firstInvalid = null;

      fields.forEach(function (field) {
        if (!validate(field) && !firstInvalid) firstInvalid = field;
      });

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      var submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      showStatus(t.sending, 'is-ok');

      // The header tells contact.php to answer with JSON instead of an HTML page,
      // so the same endpoint still works if JavaScript is unavailable.
      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (data) {
          if (!data || data.ok !== true) throw new Error('rejected');
          showStatus(t.ok, 'is-ok');
          form.reset();
        })
        .catch(function () {
          showStatus(t.err, 'is-err');
        })
        .finally(function () {
          if (submitButton) submitButton.disabled = false;
        });
    });
  }

  /* --- Boot -------------------------------------------------------------- */

  initTheme();
  initPhotos();
  initMobileNav();
  initStickyHeader();
  initReveal();
  initParallax();
  initStage();
  initBranchMissing();
  initFaq();
  initForm();
})();
