/**
 * High Dose — navigation, mobile menu, scroll-triggered motion
 */
(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var toggle = document.getElementById("nav-toggle");
  var navWrap = document.querySelector(".nav-pill-wrap");
  var yearEl = document.getElementById("y");

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  function setMenuOpen(open) {
    if (!header || !toggle) return;
    header.classList.toggle("is-menu-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
  }

  if (toggle && navWrap) {
    toggle.addEventListener("click", function () {
      setMenuOpen(!header.classList.contains("is-menu-open"));
    });

    navWrap.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 768px)").matches) setMenuOpen(false);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenuOpen(false);
    });
  }

  function initHeroEntrance() {
    if (typeof gsap === "undefined") return;
    var hero = document.querySelector(".hero");
    if (!hero) return;

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    var blocks = hero.querySelectorAll("[data-reveal]");
    var staggerWrap = hero.querySelector("[data-reveal-stagger]");
    var cards = staggerWrap ? staggerWrap.children : [];

    var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (blocks.length) {
      tl.from(blocks, { y: 40, opacity: 0, duration: 0.9, stagger: 0.12 }, 0);
    }
    if (cards.length) {
      tl.from(
        cards,
        { y: 24, opacity: 0, duration: 0.65, stagger: 0.1, ease: "power2.out" },
        blocks.length ? "-=0.45" : 0
      );
    }
  }

  function initScrollAnimations() {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      gsap.set("[data-reveal], [data-reveal-stagger] > *", { clearProps: "all" });
      return;
    }

    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      if (el.closest(".hero")) return;
      gsap.from(el, {
        y: 36,
        opacity: 0,
        duration: 0.85,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      });
    });

    gsap.utils.toArray("[data-reveal-stagger]").forEach(function (wrap) {
      if (wrap.closest(".hero")) return;
      var kids = wrap.children;
      if (!kids.length) return;
      gsap.from(kids, {
        y: 28,
        opacity: 0,
        duration: 0.65,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: wrap,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      });
    });

    ScrollTrigger.refresh();
  }

  function onIntroDone() {
    requestAnimationFrame(function () {
      initHeroEntrance();
      initScrollAnimations();
    });
  }

  window.addEventListener("highdose:introdone", onIntroDone);

  var mainEl = document.getElementById("site-main");
  if (mainEl && mainEl.classList.contains("is-visible")) {
    onIntroDone();
  }
})();

