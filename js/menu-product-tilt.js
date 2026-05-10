      (function () {
        function applyTilt(card) {
          if (card._tiltInit) return;
          if (card.classList && card.classList.contains("menu-product-card--ghost")) return;
          card._tiltInit = true;

          var shine = document.createElement("div");
          shine.className = "menu-product-card__shine";
          card.appendChild(shine);

          var raf = null;

          function onMove(e) {
            if (card.classList && card.classList.contains("menu-product-card--ghost")) return;
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(function () {
              raf = null;
              if (!card.isConnected) return;
              if (card.classList && card.classList.contains("menu-product-card--ghost")) return;

              var rect = card.getBoundingClientRect();
              var w = rect.width;
              var h = rect.height;
              if (w < 1 || h < 1) return;

              var dx = e.clientX - (rect.left + w / 2);
              var dy = e.clientY - (rect.top + h / 2);
              var rotY = (dx / (w / 2)) * 18;
              var rotX = -(dy / (h / 2)) * 18;
              var px = ((e.clientX - rect.left) / w) * 100;
              var py = ((e.clientY - rect.top) / h) * 100;

              card.style.transition = "transform 0.1s ease, box-shadow 0.1s ease";
              card.style.transform =
                "perspective(800px) rotateX(" +
                rotX +
                "deg) rotateY(" +
                rotY +
                "deg) scale(1.06)";
              card.style.boxShadow =
                -rotY * 1.2 + "px " + rotX * 1.2 + "px 48px rgba(0,0,0,0.6)";
              shine.style.opacity = "1";
              shine.style.background =
                "radial-gradient(circle at " +
                px +
                "% " +
                py +
                "%, rgba(255,255,255,0.18), transparent 65%)";
            });
          }

          function onLeave() {
            if (raf) {
              cancelAnimationFrame(raf);
              raf = null;
            }
            card.style.transition =
              "transform 0.5s cubic-bezier(0.23,1,0.32,1), box-shadow 0.5s ease";
            card.style.transform =
              "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)";
            card.style.boxShadow = "0 4px 24px rgba(0,0,0,0.35)";
            shine.style.opacity = "0";
          }

          card.addEventListener("mousemove", onMove);
          card.addEventListener("mouseleave", onLeave);
        }

        function initAllCards() {
          var menuRoot = document.getElementById("menu-app-root");
          if (!menuRoot) return;
          var nodes = menuRoot.querySelectorAll(".menu-product-card, .product-card");
          for (var i = 0; i < nodes.length; i++) {
            applyTilt(nodes[i]);
          }
        }

        function startTiltObservers() {
          function boot() {
            setTimeout(initAllCards, 200);
          }

          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", boot);
          } else {
            boot();
          }

          var root = document.getElementById("menu-app-root");
          if (root) {
            new MutationObserver(function () {
              initAllCards();
            }).observe(root, { childList: true, subtree: true });
          }
        }

        function scheduleTiltStart() {
          if (window.requestIdleCallback) {
            window.requestIdleCallback(startTiltObservers, { timeout: 1200 });
          } else {
            window.setTimeout(startTiltObservers, 0);
          }
        }

        if (document.readyState === "complete") {
          scheduleTiltStart();
        } else {
          window.addEventListener("load", function onTiltLoad() {
            window.removeEventListener("load", onTiltLoad);
            scheduleTiltStart();
          });
        }
      })();
