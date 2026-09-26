/*!
 * ConvoHatch chat widget loader.
 * Install: <script src="https://YOUR-CONVOHATCH-HOST/widget.js" data-client-id="your-client-id" async></script>
 * Optional attributes:
 *   data-position="left"               launcher on the bottom-left instead of bottom-right
 *   data-offset-bottom="24"            desktop distance from the bottom edge, in pixels
 *   data-mobile-offset-bottom="80"     phone distance from the bottom edge (e.g. above a sticky call bar)
 * Page API: window.ConvoHatch.open() and window.ConvoHatch.close()
 */
(function () {
  "use strict";

  window.__convohatchWidgets = window.__convohatchWidgets || {};

  // currentScript is null when the snippet is added by another script (for example a tag
  // manager); then use the first widget snippet that hasn't started yet.
  var script = document.currentScript;
  if (!script) {
    var candidates = document.querySelectorAll('script[src*="/widget.js"][data-client-id]');
    for (var index = 0; index < candidates.length && !script; index += 1) {
      if (!window.__convohatchWidgets[candidates[index].getAttribute("data-client-id")]) script = candidates[index];
    }
  }
  if (!script) return;

  var clientId = script.getAttribute("data-client-id") || "";
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(clientId)) {
    console.warn("[ConvoHatch] The widget script needs a valid data-client-id attribute.");
    return;
  }
  if (window.__convohatchWidgets[clientId]) return;
  window.__convohatchWidgets[clientId] = true;

  // The widget is served from wherever this script was loaded from.
  var widgetOrigin = new URL(script.src, window.location.href).origin;

  function pixels(name, fallback) {
    var value = parseInt(script.getAttribute(name) || "", 10);
    return isFinite(value) ? Math.max(0, Math.min(value, 400)) : fallback;
  }
  var side = script.getAttribute("data-position") === "left" ? "left" : "right";
  var offset = pixels("data-offset-bottom", 20);
  var mobileOffset = pixels("data-mobile-offset-bottom", offset);

  var host = document.createElement("div");
  host.setAttribute("data-convohatch-widget", clientId);
  // A shadow root keeps the host site's CSS away from the launcher and panel (and vice versa).
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var style = document.createElement("style");
  style.textContent = [
    ":host{all:initial}",
    ".launcher{position:fixed;" + side + ":20px;bottom:calc(" + offset + "px + env(safe-area-inset-bottom,0px));z-index:2147483000;",
    "display:none;align-items:center;gap:8px;min-height:52px;padding:0 20px 0 16px;border:0;border-radius:999px;",
    "font:600 15px/1.2 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;cursor:pointer;",
    "box-shadow:0 6px 20px rgba(0,0,0,.22);background:#1f2937;color:#fff}",
    ".launcher.ready{display:inline-flex}",
    ".launcher:hover{filter:brightness(1.08)}",
    ".launcher:focus-visible{outline:3px solid #111827;outline-offset:3px;box-shadow:0 0 0 6px #fff,0 6px 20px rgba(0,0,0,.22)}",
    ".launcher svg{width:24px;height:24px;flex:none}",
    ".panel{position:fixed;" + side + ":20px;bottom:calc(" + (offset + 64) + "px + env(safe-area-inset-bottom,0px));z-index:2147483001;",
    "width:380px;max-width:calc(100vw - 40px);height:min(640px,calc(100vh - " + (offset + 100) + "px));",
    "border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.28);display:none}",
    ".panel.open{display:block}",
    "iframe{display:block;width:100%;height:100%;border:0;color-scheme:light}",
    ".sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
    "@media (max-width:480px){",
    ".launcher{" + side + ":16px;bottom:calc(" + mobileOffset + "px + env(safe-area-inset-bottom,0px));padding:0;width:56px;min-height:56px;justify-content:center}",
    ".launcher .label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
    ".panel{inset:0;width:100%;max-width:none;height:100%;border-radius:0}",
    ".launcher.open{display:none}",
    "}",
  ].join("");

  var chatIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V16a2.5 2.5 0 0 1-2-2.5z"/></svg>';
  var closeIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "launcher";
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "convohatch-panel");

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.id = "convohatch-panel";

  var frame = document.createElement("iframe");
  frame.src = widgetOrigin + "/embed/" + encodeURIComponent(clientId);
  frame.title = "Chat";
  frame.setAttribute("allow", "clipboard-write");
  frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  panel.appendChild(frame);

  var businessName = "us";
  var label = "Chat with us";
  var isOpen = false;

  function render() {
    launcher.innerHTML =
      (isOpen ? closeIcon : chatIcon) + '<span class="label">' + (isOpen ? "Close" : escapeHtml(label)) + "</span>";
    launcher.setAttribute("aria-label", (isOpen ? "Close chat with " : "Open chat with ") + businessName);
    launcher.setAttribute("aria-expanded", String(isOpen));
    launcher.classList.toggle("open", isOpen);
    panel.classList.toggle("open", isOpen);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function open() {
    if (!launcher.classList.contains("ready") || isOpen) return;
    isOpen = true;
    render();
    frame.focus();
    frame.contentWindow.postMessage({ source: "convohatch-loader", type: "open" }, widgetOrigin);
  }

  function close(returnFocus) {
    if (!isOpen) return;
    isOpen = false;
    render();
    if (returnFocus !== false) launcher.focus();
  }

  launcher.addEventListener("click", function () {
    if (isOpen) close();
    else open();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen) close();
  });

  var loaded = false;
  window.addEventListener("message", function (event) {
    if (event.origin !== widgetOrigin || event.source !== frame.contentWindow) return;
    var data = event.data;
    if (!data || data.source !== "convohatch-widget") return;
    if (data.type === "ready") {
      loaded = true;
      if (typeof data.businessName === "string") businessName = data.businessName.slice(0, 120);
      if (typeof data.launcherLabel === "string" && data.launcherLabel) label = data.launcherLabel.slice(0, 30);
      if (/^#[0-9a-f]{6}$/i.test(data.color)) launcher.style.background = data.color;
      if (/^#[0-9a-f]{6}$/i.test(data.textColor)) launcher.style.color = data.textColor;
      frame.title = "Chat with " + businessName;
      launcher.classList.add("ready");
      render();
    } else if (data.type === "close") {
      close();
    }
  });

  // No launcher appears unless the widget page loads, which the browser only allows on this
  // client's approved websites.
  setTimeout(function () {
    if (!loaded) {
      console.warn(
        "[ConvoHatch] The chat widget didn't load. Check that " +
          window.location.origin +
          " is one of this client's allowed origins and that the client ID is correct.",
      );
    }
  }, 15000);

  render();
  root.appendChild(style);
  root.appendChild(panel);
  root.appendChild(launcher);

  function mount() {
    document.body.appendChild(host);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  window.ConvoHatch = window.ConvoHatch || {
    open: open,
    close: function () {
      close(false);
    },
  };
})();
