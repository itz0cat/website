/* ============================================================
   Mômentum — Kinetic scroll choreography
   ============================================================ */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Kinetic animation is opt-in; without JS the page is fully readable.
  document.documentElement.classList.add('js');

  /* ---------- Reveal on scroll ---------- */
  var revealItems = document.querySelectorAll('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    revealItems.forEach(function (el) { el.classList.add('in-view'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          // Stagger: honor explicit data-delay, else neighbor index.
          var delay = entry.target.getAttribute('data-delay');
          if (delay === null) {
            var peers = Array.prototype.slice.call(
              entry.target.parentElement.children
            );
            delay = peers.indexOf(entry.target);
          }
          entry.target.style.transitionDelay = Number(delay) * 0.11 + 's';
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

    revealItems.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- Count-up stats ---------- */
  var valueEls = document.querySelectorAll('.stat-value');

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-target'), 10) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var pad = parseInt(el.getAttribute('data-pad'), 10) || String(target).length;
    var duration = 1500;
    var start = null;

    function setValue(n) {
      var digits = String(Math.round(n));
      while (digits.length < pad && suffix === '') {
        digits = '0' + digits;
      }
      el.textContent = digits + suffix;
    }

    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min((ts - start) / duration, 1);
      setValue(target * easeOutCubic(t));
      if (t < 1) requestAnimationFrame(step);
    }

    if (reduced) {
      setValue(target);
      return;
    }
    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window) {
    var statObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          statObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    valueEls.forEach(function (el) { statObserver.observe(el); });
  } else {
    valueEls.forEach(runCounter);
  }

  /* ---------- Scroll-driven pieces ---------- */
  var progress = document.querySelector('.progress');
  var nav = document.getElementById('nav');
  var statement = document.getElementById('manifestoStatement');
  var methodSection = document.getElementById('method');
  var methodProgress = document.getElementById('methodProgress');
  var methodSteps = document.querySelector('.method-steps');
  var firstNum = methodSteps ? methodSteps.querySelector('.step-num') : null;
  var timeline = document.querySelector('.method-timeline');

  var ticking = false;
  var lastY = window.pageYOffset;
  var velocity = 0;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // Pin the timeline overlay exactly over the step numbers.
  function alignMethodTimeline() {
    if (!methodSteps || !timeline || !methodSection) return;
    var sectionRect = methodSection.getBoundingClientRect();
    var stepsRect = methodSteps.getBoundingClientRect();
    var centerX = firstNum
      ? firstNum.getBoundingClientRect().left + firstNum.getBoundingClientRect().width / 2
      : stepsRect.left;
    timeline.style.left = centerX - sectionRect.left + 'px';
    timeline.style.top = stepsRect.top - sectionRect.top + 'px';
    timeline.style.height = stepsRect.height + 'px';
  }

  function updateMethodFill() {
    if (!methodProgress || !methodSteps) return;
    var stepsRect = methodSteps.getBoundingClientRect();
    var total = stepsRect.height - window.innerHeight;
    var frac = clamp(-stepsRect.top / Math.max(total, 1), 0, 1);
    methodProgress.style.height = frac * 100 + '%';
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset;
      var doc = document.documentElement;
      var max = Math.max(doc.scrollHeight - window.innerHeight, 1);

      // Progress bar
      if (progress) progress.style.width = (y / max) * 100 + '%';

      // Nav state
      if (nav) nav.classList.toggle('scrolled', y > 24);

      // Manifesto velocity skew — the statement leans into your scroll speed.
      if (statement && !reduced) {
        var rect = statement.getBoundingClientRect();
        var fullyVisible =
          rect.top < window.innerHeight * 0.75 && rect.bottom > 0;
        if (fullyVisible) {
          velocity = velocity * 0.82 + (y - lastY) * 0.18;
          var skew = clamp(velocity * 0.08, -6, 6);
          statement.style.transform = 'skewX(' + skew.toFixed(2) + 'deg)';
        }
      }

      // Method progress line — drawn as the steps travel through the viewport.
      updateMethodFill();

      lastY = y;
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', alignMethodTimeline, { passive: true });
  alignMethodTimeline();
  onScroll();

  // Web fonts may finish loading after first paint — realign once they do.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(alignMethodTimeline);
  }
})();