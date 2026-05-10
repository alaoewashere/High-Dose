      (function () {
        "use strict";
        var nav = document.getElementById("site-nav");
        var toggle = document.getElementById("site-nav-toggle");
        var drawer = document.getElementById("site-nav-drawer");
        var backdrop = document.getElementById("site-nav-backdrop");
        if (!nav || !toggle || !drawer || !backdrop) return;

        var mqWide = window.matchMedia("(min-width: 1025px)");

        function syncScrollState() {
          nav.classList.toggle("is-scrolled", window.scrollY > 12);
        }

        function closeMenu() {
          nav.classList.remove("is-menu-open");
          toggle.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.setAttribute("aria-label", "Open menu");
          drawer.setAttribute("aria-hidden", "true");
          backdrop.setAttribute("aria-hidden", "true");
        }

        function openMenu() {
          if (mqWide.matches) return;
          nav.classList.add("is-menu-open");
          toggle.classList.add("is-open");
          toggle.setAttribute("aria-expanded", "true");
          toggle.setAttribute("aria-label", "Close menu");
          drawer.setAttribute("aria-hidden", "false");
          backdrop.setAttribute("aria-hidden", "false");
        }

        function onToggleClick() {
          if (nav.classList.contains("is-menu-open")) closeMenu();
          else openMenu();
        }

        window.addEventListener("scroll", syncScrollState, { passive: true });
        syncScrollState();

        toggle.addEventListener("click", onToggleClick);
        backdrop.addEventListener("click", closeMenu);

        drawer.querySelectorAll("a").forEach(function (a) {
          a.addEventListener("click", closeMenu);
        });

        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape" && nav.classList.contains("is-menu-open")) closeMenu();
        });

        if (mqWide.addEventListener) {
          mqWide.addEventListener("change", function () {
            if (mqWide.matches) closeMenu();
          });
        } else if (mqWide.addListener) {
          mqWide.addListener(function () {
            if (mqWide.matches) closeMenu();
          });
        }
      })();
