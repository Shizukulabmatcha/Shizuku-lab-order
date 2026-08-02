(async function () {
  if (typeof IS_CONFIGURED === "undefined" || !IS_CONFIGURED || typeof db === "undefined") return;
  try {
    const { data, error } = await db.from("store_settings").select("store_name,logo_url,website_url").limit(1).maybeSingle();
    if (error || !data) return;
    const app = document.getElementById("welcome-app");
    const logo = app.querySelector(".welcome-logo");
    const title = app.querySelector(".welcome-title");
    if (data.logo_url) logo.src = data.logo_url;
    if (data.store_name) { title.textContent = data.store_name; document.title = `Welcome · ${data.store_name}`; }
    if (data.website_url) {
      const link = document.createElement("a");
      link.className = "welcome-website";
      link.href = data.website_url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Visit Shizuku Lab website ↗";
      app.querySelector(".welcome-actions").appendChild(link);
    }
  } catch (_) { /* The order button remains available even when settings are unavailable. */ }
})();
