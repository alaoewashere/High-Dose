/**
 * High Dose café — GSAP intro preloader
 * Runs on every full page load. Respects prefers-reduced-motion.
 */
(function () {
  "use strict";

  var overlay = document.getElementById("intro-overlay");
  var steamWrap = document.querySelector(".intro-overlay__steam-wrap");
  var brand = document.querySelector(".intro-brand");
  var brandMain = brand ? brand.querySelector(".intro-brand__main") : null;
  var glowTarget = brandMain || brand;
  var siteMain = document.getElementById("site-main");
  var soundBtn = document.getElementById("intro-sound-btn");

  if (!overlay || !brand || !siteMain) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function showMain() {
    siteMain.classList.add("is-visible");
    siteMain.removeAttribute("aria-hidden");
    overlay.classList.add("is-skipped");
    overlay.setAttribute("aria-hidden", "true");
    window.dispatchEvent(new CustomEvent("highdose:introdone"));
  }

  function finishIntro() {
    stopAmbience();
    if (soundBtn) {
      soundBtn.classList.add("is-hidden");
    }
  }

  /* ——— Optional Web Audio ambience (muted by default; user enables) ——— */
  var audioCtx = null;
  var ambienceNodes = null;
  var ambienceGain = null;

  function ensureAudioContext() {
    if (audioCtx) return audioCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
  }

  function startAmbience() {
    var ctx = ensureAudioContext();
    if (!ctx || ambienceNodes) return;
    if (ctx.state === "suspended") ctx.resume();

    var master = ctx.createGain();
    master.gain.value = 0;

    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.7;

    var osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 58;

    var osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 87;

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(master);
    master.connect(ctx.destination);

    osc.start();
    osc2.start();

    ambienceGain = master;
    ambienceNodes = { osc: osc, osc2: osc2, filter: filter };
  }

  function setAmbienceVolume(v) {
    if (!ambienceGain || !audioCtx) return;
    var now = audioCtx.currentTime;
    ambienceGain.gain.cancelScheduledValues(now);
    ambienceGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(0.12, v)), now + 0.35);
  }

  function stopAmbience() {
    if (!ambienceNodes || !audioCtx) return;
    try {
      var now = audioCtx.currentTime;
      ambienceGain.gain.cancelScheduledValues(now);
      ambienceGain.gain.linearRampToValueAtTime(0, now + 0.4);
      setTimeout(function () {
        try {
          ambienceNodes.osc.stop();
          ambienceNodes.osc2.stop();
        } catch (e) {}
        ambienceNodes = null;
        ambienceGain = null;
      }, 500);
    } catch (e) {}
  }

  var soundOn = false;
  if (soundBtn) {
    soundBtn.addEventListener("click", function () {
      soundOn = !soundOn;
      soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
      soundBtn.classList.toggle("is-on", soundOn);
      soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
      if (soundOn) {
        startAmbience();
        setAmbienceVolume(0.06);
      } else {
        setAmbienceVolume(0);
      }
    });
  }

  siteMain.setAttribute("aria-hidden", "true");

  if (typeof gsap === "undefined") {
    showMain();
    finishIntro();
    return;
  }

  if (reducedMotion) {
    gsap.set(brand, { opacity: 1 });
    if (steamWrap) gsap.set(steamWrap, { opacity: 0.2 });
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.65,
      delay: 0.45,
      ease: "sine.inOut",
      onComplete: function () {
        showMain();
        finishIntro();
      },
    });
    return;
  }

  if (soundBtn) {
    gsap.to(soundBtn, { opacity: 1, duration: 0.85, delay: 0.35, ease: "sine.out" });
  }

  var fadeLayerTargets = steamWrap ? [overlay, steamWrap] : overlay;

  var tl = gsap.timeline({
    defaults: { ease: "sine.inOut" },
    onComplete: function () {
      showMain();
      finishIntro();
    },
  });

  tl.set(overlay, { opacity: 1 })
    .set(brand, {
      opacity: 0,
      scale: 0.965,
      y: 10,
      filter: "blur(5px)",
    })
    .set(glowTarget, {
      textShadow: "0 0 10px rgba(224, 224, 224, 0.08)",
    });

  if (steamWrap) {
    tl.to(steamWrap, { opacity: 1, duration: 1.25, ease: "sine.out" }, 0.08);
  }

  tl.to(
    brand,
    {
      opacity: 1,
      scale: 1,
      y: 0,
      filter: "blur(0px)",
      duration: 1.55,
      ease: "power2.out",
    },
    0.38
  ).to(
    glowTarget,
    {
      textShadow: "0 0 36px rgba(224, 224, 224, 0.52)",
      duration: 1.45,
      ease: "sine.inOut",
    },
    0.52
  ).to(
    brand,
    {
      y: -3.5,
      scale: 1.006,
      duration: 1.85,
      ease: "sine.inOut",
      yoyo: true,
      repeat: 1,
    },
    1.05
  );

  /* Softer glitch + grey echo layers */
  tl.addLabel("glitch", 3.72);
  tl.call(
    function () {
      if (brandMain) brandMain.classList.add("is-glitching");
    },
    null,
    "glitch"
  );
  tl.to(
    brand,
    { x: 1.8, skewX: 0.9, opacity: 0.97, duration: 0.1, ease: "sine.out" },
    "glitch"
  )
    .to(brand, {
      x: -2.2,
      skewX: -1.1,
      opacity: 1,
      duration: 0.12,
      ease: "sine.inOut",
    })
    .to(brand, {
      x: 0.9,
      skewX: 0.45,
      opacity: 0.98,
      duration: 0.1,
      ease: "sine.inOut",
    })
    .to(brand, {
      x: 0,
      skewX: 0,
      opacity: 1,
      duration: 0.16,
      ease: "power2.out",
    })
    .call(function () {
      if (brandMain) brandMain.classList.remove("is-glitching");
    });

  tl.to(
    fadeLayerTargets,
    {
      opacity: 0,
      duration: 1.08,
      ease: "power2.out",
    },
    4.22
  ).to(
    brand,
    {
      opacity: 0,
      scale: 1.03,
      filter: "blur(3px)",
      duration: 1,
      ease: "power2.out",
    },
    4.32
  );
})();
