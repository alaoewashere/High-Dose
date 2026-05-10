/**
 * Menu: load products from CSV + category filters + card grid.
 * Mount: #menu-app-root
 * CSV: tries highdose-products.csv then "highdose products.csv" (close file in editor if locked).
 */
(function () {
  "use strict";

  var CATEGORIES = [
    "All",
    "Craft Coffee",
    "Energy Infusions",
    "Signature Drinks",
    "Sweet Pairings",
  ];

  var IMG_FALLBACK = "images/10.jpeg";

  var products = [];
  var activeCategory = "All";

  var PLACEHOLDER_SRC =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">' +
        '<rect width="800" height="800" fill="#0a0a0a"/>' +
        '<circle cx="400" cy="400" r="120" fill="none" stroke="#b8956a" stroke-width="2" opacity="0.35"/>' +
        '<rect x="280" y="520" width="240" height="3" rx="1.5" fill="#ffffff" opacity="0.08"/>' +
        "</svg>"
    );

  function imageWebpSrc(rasterPath) {
    return String(rasterPath || "").replace(/\.(jpe?g|png)$/i, ".webp");
  }

  function parsePrice(raw) {
    var n = parseFloat(String(raw || "").replace(/[^\d.]/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }

  /** Simple CSV row: id,name,price,image,category,description (description may contain commas) */
  function parseProductLine(line) {
    var trimmed = line.trim();
    if (!trimmed) return null;
    var parts = trimmed.split(",");
    if (parts.length < 5) return null;

    var idRaw = parts[0].trim();
    var name = parts[1].trim();
    var price = parsePrice(parts[2]);
    var image = parts[3].trim();
    var category = parts[4].trim();
    var desc = parts.slice(5).join(",").trim();

    var id = parseInt(idRaw, 10);
    if (isNaN(id) || id < 1) {
      id = products.length ? products[products.length - 1].id + 1 : 1;
    }

    if (!image) {
      var imgNum = 10 + ((id - 1) % 31);
      image = "images/" + imgNum + ".jpeg";
    }

    return {
      id: id,
      name: name,
      price: price,
      image: image,
      category: category,
      desc: desc || "",
    };
  }

  function parseProductsCSV(text) {
    var lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    var out = [];
    for (var i = 1; i < lines.length; i++) {
      var row = parseProductLine(lines[i]);
      if (row && row.name) out.push(row);
    }
    return out;
  }

  function filteredProducts() {
    return activeCategory === "All"
      ? products.slice()
      : products.filter(function (p) {
          return p.category === activeCategory;
        });
  }

  var root = document.getElementById("menu-app-root");
  if (!root) return;

  var wrap;
  var nav;
  var grid;
  var catButtons = [];

  function syncCategoryButtons() {
    for (var i = 0; i < catButtons.length; i++) {
      var b = catButtons[i];
      var on = b.getAttribute("data-category") === activeCategory;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function renderProducts() {
    var list = filteredProducts();
    grid.innerHTML = "";

    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var card = document.createElement("article");
      card.className = "menu-product-card product-card";
      card.setAttribute("role", "listitem");

      var media = document.createElement("div");
      media.className = "menu-product-card__media";

      var picture = document.createElement("picture");
      var source = document.createElement("source");
      source.type = "image/webp";
      source.srcset = imageWebpSrc(p.image);
      picture.appendChild(source);

      var img = document.createElement("img");
      img.src = p.image;
      img.alt = p.desc ? p.name + " — product photo: " + p.desc : p.name + " — product photo";
      img.setAttribute("data-product-name", p.name);
      img.width = 800;
      img.height = 800;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", function onImgErr(ev) {
        var el = ev.currentTarget;
        el.removeEventListener("error", onImgErr);
        if (el.src.indexOf(IMG_FALLBACK) === -1) {
          el.src = IMG_FALLBACK;
          var pic = el.closest && el.closest("picture");
          if (pic) {
            var s = pic.querySelector("source[type='image/webp']");
            if (s) s.srcset = imageWebpSrc(IMG_FALLBACK);
          }
          return;
        }
        el.src = PLACEHOLDER_SRC;
      });

      picture.appendChild(img);
      media.appendChild(picture);

      var meta = document.createElement("div");
      meta.className = "menu-product-card__meta";

      var nameEl = document.createElement("h3");
      nameEl.className = "menu-product-card__name";
      nameEl.textContent = p.name;

      var priceEl = document.createElement("p");
      priceEl.className = "menu-product-card__price";
      priceEl.textContent = "₺" + p.price;

      meta.appendChild(nameEl);
      meta.appendChild(priceEl);

      if (p.desc) {
        var descEl = document.createElement("p");
        descEl.className = "menu-product-card__desc";
        descEl.textContent = p.desc;
        meta.appendChild(descEl);
      }

      card.appendChild(media);
      card.appendChild(meta);
      grid.appendChild(card);
    }

    grid.classList.remove("menu-product-grid--enter");
    void grid.offsetWidth;
    grid.classList.add("menu-product-grid--enter");
  }

  function setCategory(cat) {
    activeCategory = cat;
    syncCategoryButtons();
    renderProducts();
  }

  function buildChrome() {
    root.innerHTML = "";
    root.className = "menu-app-root menu-app-root--ready";

    wrap = document.createElement("div");
    wrap.className = "menu-app";

    nav = document.createElement("nav");
    nav.className = "menu-categories";
    nav.setAttribute("aria-label", "Menu categories");

    var stage = document.createElement("div");
    stage.className = "menu-products-stage";

    grid = document.createElement("div");
    grid.className = "menu-product-grid";
    grid.setAttribute("role", "list");

    wrap.appendChild(nav);
    stage.appendChild(grid);
    wrap.appendChild(stage);
    root.appendChild(wrap);

    catButtons = [];
    for (var c = 0; c < CATEGORIES.length; c++) {
      var cat = CATEGORIES[c];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu-cat-btn";
      btn.setAttribute("data-category", cat);
      btn.setAttribute("aria-pressed", cat === activeCategory ? "true" : "false");
      if (cat === activeCategory) btn.classList.add("is-active");
      btn.textContent = cat;
      btn.addEventListener(
        "click",
        (function (value) {
          return function () {
            setCategory(value);
          };
        })(cat)
      );
      nav.appendChild(btn);
      catButtons.push(btn);
    }

    initMenuProductDrag();
  }

  function initMenuProductDrag() {
    if (!grid || grid.dataset.menuDragInit) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    if (window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
      return;
    }
    grid.dataset.menuDragInit = "1";

    var THRESH = 8;
    var THRESH2 = THRESH * THRESH;
    var LERP = 0.15;
    var phase = null;
    var dragCtx = null;

    function removeDocListeners() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onBlur);
    }

    function onBlur() {
      onUp();
    }

    function dragLoop() {
      if (phase !== "dragging" || !dragCtx || !dragCtx.clone) {
        if (dragCtx) dragCtx.rafId = null;
        return;
      }
      var c = dragCtx;
      c.posX += (c.targetX - c.posX) * LERP;
      c.posY += (c.targetY - c.posY) * LERP;
      var tilt = Math.max(-8, Math.min(8, c.velSmooth * 55));
      var rot = 2 + tilt;
      c.clone.style.left = c.posX + "px";
      c.clone.style.top = c.posY + "px";
      c.clone.style.transform = "scale(1.05) rotate(" + rot + "deg)";
      c.rafId = requestAnimationFrame(dragLoop);
    }

    function beginDrag(e) {
      var card = dragCtx.card;
      var rect = card.getBoundingClientRect();
      var clone = card.cloneNode(true);
      clone.classList.add("menu-product-card--drag-clone");
      clone.style.width = rect.width + "px";
      clone.style.height = rect.height + "px";
      clone.style.transition = "none";
      clone.style.margin = "0";
      document.body.appendChild(clone);
      card.classList.add("menu-product-card--ghost");
      document.body.classList.add("menu-drag-active");

      dragCtx.clone = clone;
      dragCtx.cardW = rect.width;
      dragCtx.cardH = rect.height;
      dragCtx.targetX = e.clientX - dragCtx.cardW / 2;
      dragCtx.targetY = e.clientY - dragCtx.cardH / 2;
      dragCtx.posX = dragCtx.targetX;
      dragCtx.posY = dragCtx.targetY;
      clone.style.left = dragCtx.posX + "px";
      clone.style.top = dragCtx.posY + "px";
      dragCtx.lastX = e.clientX;
      dragCtx.lastT = typeof performance !== "undefined" ? performance.now() : Date.now();
      dragCtx.velSmooth = 0;
      phase = "dragging";
      dragCtx.rafId = requestAnimationFrame(dragLoop);
    }

    function finishSnap() {
      if (!dragCtx || !dragCtx.clone) return;
      phase = "snapping";
      removeDocListeners();
      var clone = dragCtx.clone;
      var card = dragCtx.card;
      if (dragCtx.rafId) {
        cancelAnimationFrame(dragCtx.rafId);
        dragCtx.rafId = null;
      }
      var rect = card.getBoundingClientRect();
      window.__menuDragSuppressClickUntil = Date.now() + 220;
      clone.style.transition = "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
      clone.style.left = rect.left + "px";
      clone.style.top = rect.top + "px";
      clone.style.transform = "scale(1) rotate(0deg)";
      clone.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.35)";

      var cleaned = false;
      function done() {
        if (cleaned) return;
        cleaned = true;
        clone.removeEventListener("transitionend", onEnd);
        if (clone.parentNode) clone.remove();
        card.classList.remove("menu-product-card--ghost");
        document.body.classList.remove("menu-drag-active");
        phase = null;
        dragCtx = null;
      }

      function onEnd(ev) {
        if (ev.target !== clone) return;
        if (ev.propertyName !== "left" && ev.propertyName !== "transform") return;
        done();
      }

      clone.addEventListener("transitionend", onEnd);
      window.setTimeout(done, 480);
    }

    function onMove(e) {
      if (!dragCtx) return;
      if (phase === "pending") {
        var dx = e.clientX - dragCtx.startX;
        var dy = e.clientY - dragCtx.startY;
        if (dx * dx + dy * dy > THRESH2) {
          beginDrag(e);
        }
        return;
      }
      if (phase === "dragging") {
        dragCtx.targetX = e.clientX - dragCtx.cardW / 2;
        dragCtx.targetY = e.clientY - dragCtx.cardH / 2;
        var now = typeof performance !== "undefined" ? performance.now() : Date.now();
        var dt = Math.max(1, now - dragCtx.lastT);
        var rawVel = (e.clientX - dragCtx.lastX) / dt;
        dragCtx.velSmooth = dragCtx.velSmooth * 0.82 + rawVel * 0.18;
        dragCtx.lastX = e.clientX;
        dragCtx.lastT = now;
      }
    }

    function onUp() {
      if (!dragCtx) return;
      if (phase === "pending") {
        removeDocListeners();
        phase = null;
        dragCtx = null;
        return;
      }
      if (phase === "dragging") {
        finishSnap();
      }
    }

    function onLeave() {
      onUp();
    }

    function onDown(e) {
      var card = e.target.closest && e.target.closest(".menu-product-card");
      if (!card || !grid.contains(card)) return;
      if (e.button !== 0) return;
      e.preventDefault();
      phase = "pending";
      dragCtx = {
        card: card,
        startX: e.clientX,
        startY: e.clientY,
        clone: null,
        rafId: null,
        targetX: 0,
        targetY: 0,
        posX: 0,
        posY: 0,
        cardW: 0,
        cardH: 0,
        lastX: e.clientX,
        lastT: typeof performance !== "undefined" ? performance.now() : Date.now(),
        velSmooth: 0,
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.documentElement.addEventListener("mouseleave", onLeave);
      window.addEventListener("blur", onBlur);
    }

    grid.addEventListener("mousedown", onDown);
  }

  function showLoadError(msg) {
    root.innerHTML = "";
    root.className = "menu-app-root menu-app-root--error";
    var p = document.createElement("p");
    p.className = "menu-load-error";
    p.textContent = msg || "Menu could not be loaded. Serve the site over http (Live Server / XAMPP), not file://.";
    root.appendChild(p);
  }

  var CSV_CANDIDATES = ["highdose-products.csv", "highdose%20products.csv"];

  function initMenuImageLightbox() {
    var modal = document.getElementById("imageModal");
    var modalImg = document.getElementById("modalImage");
    var modalCaption = document.getElementById("modalCaption");
    if (!modal || !modalImg || !modalCaption) return;

    var closeBtn = modal.querySelector(".modal-close");

    function closeModal() {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      modalImg.onerror = null;
      modalImg.onload = null;
      modalImg.removeAttribute("src");
      modalImg.alt = "";
      modalCaption.textContent = "";
    }

    function openModal(src, name) {
      var tryWebp = imageWebpSrc(src);
      modalImg.onload = function () {
        modalImg.onload = null;
        modalImg.onerror = null;
      };
      if (tryWebp !== src) {
        modalImg.onerror = function () {
          modalImg.onerror = null;
          modalImg.onload = null;
          modalImg.src = src;
        };
        modalImg.src = tryWebp;
      } else {
        modalImg.onerror = null;
        modalImg.src = src;
      }
      modalImg.alt = name ? "Enlarged view: " + name : "Enlarged product image";
      modalCaption.textContent = name || "";
      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    document.addEventListener("click", function (e) {
      if (Date.now() < (window.__menuDragSuppressClickUntil || 0)) return;
      var t = e.target;
      if (!t || t.tagName !== "IMG") return;
      if (!t.closest || !t.closest(".menu-product-card__media")) return;
      openModal(t.currentSrc || t.src, t.getAttribute("data-product-name") || "");
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        closeModal();
      });
    }

    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!modal.classList.contains("active")) return;
      closeModal();
      e.stopPropagation();
    });
  }

  initMenuImageLightbox();

  function tryFetchCSV(index) {
    if (index >= CSV_CANDIDATES.length) {
      showLoadError();
      return;
    }
    var url = CSV_CANDIDATES[index];
    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        products = parseProductsCSV(text);
        if (!products.length) throw new Error("No rows");
        buildChrome();
        renderProducts();
      })
      .catch(function () {
        tryFetchCSV(index + 1);
      });
  }

  tryFetchCSV(0);
})();
