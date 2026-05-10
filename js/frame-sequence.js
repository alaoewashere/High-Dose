      (function () {
        "use strict";

        // Frames are discovered dynamically from ./frames/ (no hard-coded start index).
        var FRAME_URLS = [];
        var IMG_CACHE = [];
        var preloader = document.getElementById("preloader");
        var mainContent = document.getElementById("main-content");
        var skipBtn = document.getElementById("skip-preloader");
        var smokeContainer = document.getElementById("smoke-container");
        var glow = document.getElementById("preloader-glow");
        var logoContainer = document.getElementById("logo-container");
        var logoText = document.getElementById("logo-text");
        var frameLoading = document.getElementById("frame-loading");
        var frameLoadingFill = document.getElementById("frame-loading-fill");
        var canvas = document.getElementById("frame-canvas");
        var ctx = canvas ? canvas.getContext("2d") : null;
        var videoSection = document.querySelector(".video-scroll-section");
        var progressFill = document.getElementById("video-progress-fill");
        var overlays = [
          document.getElementById("scroll-ch1"),
          document.getElementById("scroll-ch2"),
          document.getElementById("scroll-ch3"),
        ];
        var dots = document.querySelectorAll(".chapter-dot");

        var preloaderTl = null;
        var launched = false;
        var scrollSeqDone = false;
        var currentFrameIndex = 0;
        var lastGoodFrameIndex = 0;
        var scrollScheduled = false;
        var imagesReady = false;
        var loadedCount = 0;
        var lastScrollProgress = 0;

        function extractNumberFromPath(p) {
          var name = String(p).split("/").pop() || "";
          var match = name.match(/(\d+)(?!.*\d)/);
          return match ? parseInt(match[1], 10) : Number.NaN;
        }

        function sortNumerically(paths) {
          return paths
            .slice()
            .sort(function (a, b) {
              var an = extractNumberFromPath(a);
              var bn = extractNumberFromPath(b);
              if (isNaN(an) && isNaN(bn)) return String(a).localeCompare(String(b));
              if (isNaN(an)) return 1;
              if (isNaN(bn)) return -1;
              if (an === bn) return String(a).localeCompare(String(b));
              return an - bn;
            });
        }

        function urlsFromManifestCount(json) {
          var count = Math.floor(Number(json.count));
          if (!count || count < 1) return [];
          var padLen = json.pad != null ? Math.max(1, Math.floor(Number(json.pad))) : 3;
          if (isNaN(padLen)) padLen = 3;
          var pattern = String(json.pattern || "ezgif-frame-{n}.png");
          var base = json.base != null ? String(json.base) : "./frames/";
          if (base.slice(-1) !== "/") base += "/";
          var urls = [];
          for (var k = 1; k <= count; k++) {
            var n = String(k).padStart(padLen, "0");
            urls.push(base + pattern.replace(/\{n\}/g, n));
          }
          return urls;
        }

        function probeFrameUrlExistsViaImage(url) {
          return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () {
              resolve(true);
            };
            img.onerror = function () {
              resolve(false);
            };
            img.src = url;
          });
        }

        function probeFrameUrlExists(url) {
          return fetch(url, { method: "HEAD", cache: "no-store" })
            .then(function (res) {
              if (res.ok) return true;
              if (res.status === 405 || res.status === 501) return probeFrameUrlExistsViaImage(url);
              return false;
            })
            .catch(function () {
              return probeFrameUrlExistsViaImage(url);
            });
        }

        async function discoverFrameUrls() {
          // Strategy A: manifest.json first — avoids probing frame N+1 (which causes a 404 in DevTools).
          try {
            var resM = await fetch("./frames/manifest.json", { cache: "no-store" });
            if (resM.ok) {
              var jsonM = await resM.json();
              if (jsonM && typeof jsonM.count === "number" && jsonM.count > 0) {
                var fromCount = urlsFromManifestCount(jsonM);
                if (fromCount.length) return fromCount;
              }
              if (Array.isArray(jsonM) && jsonM.length) {
                return sortNumerically(
                  jsonM.map(function (p) {
                    return p.startsWith("./frames/") ? p : "./frames/" + String(p).replace(/^\.\//, "");
                  })
                );
              }
            }
          } catch (eM) {}

          // Strategy B: directory listing (Apache / Live Server when /frames/ is browsable)
          try {
            var res = await fetch("./frames/", { cache: "no-store" });
            if (res.ok) {
              var html = await res.text();
              var re = /href="([^"]+\.(?:jpe?g|png|webp))"/gi;
              var found = [];
              var m;
              while ((m = re.exec(html))) {
                var href = m[1];
                if (href.startsWith("?")) continue;
                if (href.startsWith("/")) continue;
                if (href.includes("../")) continue;
                found.push("./frames/" + href.replace(/^\.\//, ""));
              }
              if (found.length) return sortNumerically(Array.from(new Set(found)));
            }
          } catch (e) {}

          // Strategy C: sequential probe until first missing file (HEAD first, image fallback)
          var seqUrls = [];
          var i = 1;
          var safetyCap = 5000;
          while (i <= safetyCap) {
            var padded = String(i).padStart(3, "0");
            var url = "./frames/ezgif-frame-" + padded + ".png";
            var ok = await probeFrameUrlExists(url);
            if (!ok) break;
            seqUrls.push(url);
            i++;
          }
          if (seqUrls.length) return seqUrls;

          return [];
        }

        function preloadDiscoveredFrames(urls) {
          FRAME_URLS = urls.slice();
          IMG_CACHE = new Array(FRAME_URLS.length);
          loadedCount = 0;
          imagesReady = false;

          if (!FRAME_URLS.length) {
            console.warn(
              "[High Dose] No frames discovered. Use http (XAMPP/Live Server), add ./frames/manifest.json as an array of paths, or as { \"count\": N, \"pad\": 3, \"pattern\": \"ezgif-frame-{n}.png\" } to avoid probing missing files."
            );
            if (frameLoadingFill) frameLoadingFill.style.width = "0%";
            if (frameLoading) frameLoading.classList.add("is-hidden");
            return;
          }

          FRAME_URLS.forEach(function (url, index) {
            var img = new Image();
            img.decoding = "async";
            img.onload = function () {
              IMG_CACHE[index] = img;
              bump();
            };
            img.onerror = function () {
              IMG_CACHE[index] = null;
              bump();
            };
            img.src = url;
          });

          function bump() {
            loadedCount++;
            var total = FRAME_URLS.length;
            var pct = total ? (loadedCount / total) * 100 : 0;
            if (frameLoadingFill) frameLoadingFill.style.width = pct + "%";
            if (loadedCount >= total) {
              imagesReady = true;
              if (frameLoading) frameLoading.classList.add("is-hidden");
              // Draw the first available frame
              var firstIdx = IMG_CACHE.findIndex(function (x) {
                return !!x;
              });
              if (firstIdx >= 0) {
                lastGoodFrameIndex = firstIdx;
                currentFrameIndex = firstIdx;
                drawFrame(firstIdx, lastScrollProgress);
              }
              if (scrollSeqDone) requestScrollUpdate();
            }
          }
        }

        function resizeCanvas() {
          if (!canvas || !ctx) return;
          var dpr = Math.min(window.devicePixelRatio || 1, 2);
          var w = canvas.clientWidth;
          var h = canvas.clientHeight;
          if (w < 1 || h < 1) return;
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawFrame(currentFrameIndex, lastScrollProgress);
        }

        function drawFrame(idx, scrollProgress) {
          if (!ctx || !canvas) return;
          var img = IMG_CACHE[idx] || IMG_CACHE[lastGoodFrameIndex];
          if (!img || !img.complete || !img.naturalWidth) return;
          var cw = canvas.clientWidth;
          var ch = canvas.clientHeight;
          if (cw < 1 || ch < 1) return;
          var iw = img.naturalWidth;
          var ih = img.naturalHeight;
          var canvasRatio = cw / ch;
          var imageRatio = iw / ih;

          var dw;
          var dh;
          if (imageRatio > canvasRatio) {
            dw = cw;
            dh = cw / imageRatio;
          } else {
            dh = ch;
            dw = ch * imageRatio;
          }

          // Mobile-only smooth zoom (1 → 1.15), centered. Desktop unchanged.
          var p = typeof scrollProgress === "number" ? scrollProgress : lastScrollProgress;
          if (window.innerWidth < 768) {
            var zoom = 1 + Math.max(0, Math.min(1, p)) * 0.15;
            zoom = Math.min(1.15, zoom);
            dw *= zoom;
            dh *= zoom;
          }

          var dx = (cw - dw) / 2;
          var dy = (ch - dh) / 2;
          ctx.clearRect(0, 0, cw, ch);
          ctx.drawImage(img, dx, dy, dw, dh);
        }

        function clamp01(v) {
          return Math.max(0, Math.min(1, v));
        }

        function getScrollProgress() {
          if (!videoSection) return 0;
          var rect = videoSection.getBoundingClientRect();
          var h = rect.height - window.innerHeight;
          if (h <= 0) return 0;
          return clamp01(-rect.top / h);
        }

        function setChapterVisibility(progress) {
          var ch = progress < 1 / 3 ? 0 : progress < 2 / 3 ? 1 : 2;
          for (var i = 0; i < overlays.length; i++) {
            if (!overlays[i]) continue;
            overlays[i].classList.remove("visible");
          }
          if (overlays[ch]) overlays[ch].classList.add("visible");
          dots.forEach(function (d, i) {
            d.classList.toggle("active", i === ch);
          });
        }

        function onScrollUpdate() {
          scrollScheduled = false;
          if (!imagesReady || !IMG_CACHE.length) return;
          var progress = getScrollProgress();
          lastScrollProgress = progress;
          var idx = Math.floor(progress * (IMG_CACHE.length - 1));
          idx = Math.max(0, Math.min(IMG_CACHE.length - 1, idx));

          // If this exact frame is missing, hold the last valid frame (prevents flicker/breaks).
          if (!IMG_CACHE[idx]) idx = lastGoodFrameIndex;

          currentFrameIndex = idx;
          if (IMG_CACHE[idx]) lastGoodFrameIndex = idx;
          // Always redraw so zoom animates smoothly with scroll.
          drawFrame(currentFrameIndex, progress);
          if (progressFill) progressFill.style.width = progress * 100 + "%";
          setChapterVisibility(progress);
        }

        function requestScrollUpdate() {
          if (scrollScheduled) return;
          scrollScheduled = true;
          requestAnimationFrame(onScrollUpdate);
        }

        function initScrollSequence() {
          if (scrollSeqDone) return;
          scrollSeqDone = true;
          resizeCanvas();
          requestAnimationFrame(resizeCanvas);

          var resizeRaf = null;
          function scheduleResize() {
            if (resizeRaf) return;
            resizeRaf = requestAnimationFrame(function () {
              resizeRaf = null;
              resizeCanvas();
            });
          }
          window.addEventListener("resize", scheduleResize);
          window.addEventListener("orientationchange", scheduleResize);
          if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", scheduleResize);
          }

          window.addEventListener(
            "scroll",
            function () {
              requestScrollUpdate();
            },
            { passive: true }
          );
          requestScrollUpdate();
          dots.forEach(function (dot) {
            dot.addEventListener("click", function () {
              var ch = parseInt(dot.getAttribute("data-ch"), 10);
              if (!videoSection || isNaN(ch)) return;
              var maxScroll =
                videoSection.offsetTop + (videoSection.offsetHeight - window.innerHeight);
              var minScroll = videoSection.offsetTop;
              var target = minScroll + (ch / 3) * (maxScroll - minScroll);
              window.scrollTo({ top: target, behavior: "smooth" });
            });
          });
        }

        function launchMain() {
          if (launched) return;
          launched = true;
          if (preloaderTl) {
            preloaderTl.kill();
            preloaderTl = null;
          }
          if (preloader) preloader.classList.add("fade-out");
          if (skipBtn) skipBtn.classList.add("is-hidden");
          if (logoText) logoText.classList.remove("active");
          if (preloader) preloader.setAttribute("aria-busy", "false");
          setTimeout(function () {
            if (preloader) {
              preloader.style.display = "none";
              preloader.setAttribute("aria-hidden", "true");
            }
            if (mainContent) {
              mainContent.style.display = "block";
              void mainContent.offsetWidth;
              mainContent.classList.add("is-visible");
            }
            initScrollSequence();
          }, 1000);
        }

        function runPreloaderTimeline() {
          if (typeof gsap === "undefined") {
            launchMain();
            return;
          }
          gsap.set([smokeContainer, glow, logoContainer].filter(Boolean), { opacity: 0 });
          if (logoText) gsap.set(logoText, { scale: 1 });

          preloaderTl = gsap.timeline({
            onComplete: launchMain,
          });

          preloaderTl
            .to(smokeContainer, { opacity: 1, duration: 0.5, ease: "power2.out" })
            .to(glow, { opacity: 1, duration: 1, ease: "power2.out" }, "-=0.3")
            .to(logoContainer, { opacity: 1, duration: 1.2, ease: "power2.out" }, "-=0.5");

          if (logoText) {
            preloaderTl
              .to(
                logoText,
                {
                  scale: 1.05,
                  duration: 0.8,
                  ease: "sine.inOut",
                  yoyo: true,
                  repeat: 1,
                },
                "-=0.8"
              )
              .call(function () {
                logoText.classList.add("active");
              })
              .to(logoText, { opacity: 1, duration: 0.3 })
              .call(function () {
                logoText.classList.remove("active");
              });
          }

          preloaderTl.to(
            logoContainer,
            { scale: 1.08, opacity: 0.9, duration: 0.5, ease: "power2.inOut" },
            "-=0.1"
          );
        }

        function scheduleFramePreload() {
          function runDiscover() {
            discoverFrameUrls().then(function (urls) {
              preloadDiscoveredFrames(urls);
            });
          }
          function queueDiscover() {
            if (window.requestIdleCallback) {
              window.requestIdleCallback(runDiscover, { timeout: 3500 });
            } else {
              window.setTimeout(runDiscover, 0);
            }
          }
          if (document.readyState === "complete") {
            queueDiscover();
          } else {
            window.addEventListener("load", function onWinLoad() {
              window.removeEventListener("load", onWinLoad);
              queueDiscover();
            });
          }
        }

        function init() {
          scheduleFramePreload();
          if (skipBtn) skipBtn.addEventListener("click", launchMain);

          function startIntro() {
            function runIntroAnimations() {
              if (typeof gsap !== "undefined" && skipBtn) {
                gsap.to(skipBtn, { opacity: 1, duration: 0.6, delay: 1, ease: "power2.out" });
              } else if (skipBtn) {
                skipBtn.style.opacity = "1";
              }
              runPreloaderTimeline();
            }
            if (window.requestIdleCallback) {
              window.requestIdleCallback(runIntroAnimations, { timeout: 600 });
            } else {
              requestAnimationFrame(function () {
                requestAnimationFrame(runIntroAnimations);
              });
            }
          }

          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(startIntro).catch(startIntro);
          } else {
            startIntro();
          }
        }

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", init);
        } else {
          init();
        }
      })();
