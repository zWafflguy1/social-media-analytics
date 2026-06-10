/**
 * ai-seo-ranking-agent — embeddable optimizer widget
 *
 * Install on any website:
 *   <script src="https://YOUR-AGENT-HOST/embed.js" data-key="SITE_KEY" defer></script>
 *
 * On every page load it:
 *   1. Fetches the agent's latest optimizations for this page
 *   2. Injects JSON-LD structured data (LocalBusiness / Service / FAQPage)
 *   3. Applies improved <title> / meta description when the agent provides them
 *   4. Renders an FAQ block into <div data-seo-agent="faq"></div> if present
 *   5. Reports real-user Core Web Vitals (LCP/CLS/INP/TTFB) back to the agent
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;
  var siteKey = script.getAttribute("data-key");
  if (!siteKey) {
    console.warn("[seo-agent] missing data-key attribute");
    return;
  }
  var base = script.src.replace(/\/embed\.js.*$/, "");
  var page = location.pathname;

  // ── 1-4: fetch + apply optimizations ──────────────────────────────────────
  fetch(
    base +
      "/embed/v1/optimizations?key=" +
      encodeURIComponent(siteKey) +
      "&page=" +
      encodeURIComponent(page)
  )
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(applyOptimizations)
    .catch(function (err) {
      console.warn("[seo-agent] could not load optimizations:", err.message);
    });

  function applyOptimizations(opt) {
    // JSON-LD injection (skip blocks whose @type already exists on the page)
    var existingTypes = {};
    var existing = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < existing.length; i++) {
      try {
        var parsed = JSON.parse(existing[i].textContent);
        var items = Array.isArray(parsed) ? parsed : [parsed];
        items.forEach(function (item) {
          if (item["@type"]) existingTypes[String(item["@type"])] = true;
        });
      } catch (e) {}
    }
    (opt.jsonLd || []).forEach(function (block) {
      try {
        var data = JSON.parse(block);
        if (data["@type"] && existingTypes[String(data["@type"])]) return;
        var el = document.createElement("script");
        el.type = "application/ld+json";
        el.setAttribute("data-seo-agent", "1");
        el.textContent = JSON.stringify(data);
        document.head.appendChild(el);
      } catch (e) {}
    });

    // Title / meta description
    if (opt.title) document.title = opt.title;
    if (opt.metaDescription) {
      var meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", opt.metaDescription);
    }

    // FAQ block (only into an explicit opt-in container)
    var faqHost = document.querySelector('[data-seo-agent="faq"]');
    if (faqHost && opt.faq && opt.faq.length) {
      var frag = document.createDocumentFragment();
      var heading = document.createElement("h2");
      heading.textContent = "Frequently Asked Questions";
      frag.appendChild(heading);
      opt.faq.forEach(function (item) {
        var details = document.createElement("details");
        var summary = document.createElement("summary");
        summary.textContent = item.question;
        var p = document.createElement("p");
        p.textContent = item.answer;
        details.appendChild(summary);
        details.appendChild(p);
        frag.appendChild(details);
      });
      faqHost.textContent = "";
      faqHost.appendChild(frag);
    }
  }

  // ── 5: Core Web Vitals beacon ─────────────────────────────────────────────
  var vitals = { page: page };

  try {
    var nav = performance.getEntriesByType("navigation")[0];
    if (nav) vitals.ttfb = Math.round(nav.responseStart);
  } catch (e) {}

  try {
    new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      var last = entries[entries.length - 1];
      if (last) vitals.lcp = Math.round(last.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (e) {}

  try {
    var clsValue = 0;
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (entry) {
        if (!entry.hadRecentInput) clsValue += entry.value;
      });
      vitals.cls = Math.round(clsValue * 1000) / 1000;
    }).observe({ type: "layout-shift", buffered: true });
  } catch (e) {}

  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (entry) {
        var dur = Math.round(entry.processingEnd - entry.startTime);
        if (!vitals.inp || dur > vitals.inp) vitals.inp = dur;
      });
    }).observe({ type: "event", buffered: true, durationThreshold: 40 });
  } catch (e) {}

  function sendVitals() {
    if (vitals._sent) return;
    vitals._sent = true;
    var payload = JSON.stringify({
      page: vitals.page,
      lcp: vitals.lcp,
      cls: vitals.cls,
      inp: vitals.inp,
      ttfb: vitals.ttfb,
    });
    var url = base + "/embed/v1/vitals?key=" + encodeURIComponent(siteKey);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
    }
  }

  addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") sendVitals();
  });
  addEventListener("pagehide", sendVitals);
})();
