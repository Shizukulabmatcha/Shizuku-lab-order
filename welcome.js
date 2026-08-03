(async function () {
  if (typeof IS_CONFIGURED === "undefined" || !IS_CONFIGURED || typeof db === "undefined") return;
  try {
    const { data, error } = await db.from("store_settings").select("store_name,logo_url,website_url,welcome_title,welcome_subtitle,welcome_copy,welcome_order_button_text,welcome_website_button_text,welcome_logo_circle_size,welcome_logo_image_scale,logo_circle_size,logo_image_scale").limit(1).maybeSingle();
    if (error || !data) return;
    const app = document.getElementById("welcome-app");
    const logoFrame = app.querySelector(".welcome-logo-frame");
    const logo = app.querySelector(".welcome-logo");
    const title = app.querySelector(".welcome-title");
    const subtitle = app.querySelector(".welcome-sub");
    const copy = app.querySelector(".welcome-copy");
    const orderButton = app.querySelector(".welcome-enter");
    if (data.logo_url) logo.src = data.logo_url;
    const circleSize = Math.max(56, Math.min(220, Number(data.welcome_logo_circle_size || data.logo_circle_size || 100)));
    const imageScale = Math.max(0.55, Math.min(2.4, Number(data.welcome_logo_image_scale || data.logo_image_scale || 1)));
    logoFrame.style.width = `${circleSize}px`;
    logoFrame.style.height = `${circleSize}px`;
    logo.style.transform = `scale(${imageScale})`;
    if (data.welcome_title || data.store_name) { title.textContent = data.welcome_title || data.store_name; document.title = `Welcome · ${data.welcome_title || data.store_name}`; }
    if (data.welcome_subtitle) subtitle.textContent = data.welcome_subtitle;
    if (data.welcome_copy) copy.textContent = data.welcome_copy;
    if (data.welcome_order_button_text) orderButton.textContent = data.welcome_order_button_text;
    if (data.website_url) {
      const link = document.createElement("a");
      link.className = "welcome-website";
      link.href = data.website_url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = data.welcome_website_button_text || "Visit Shizuku Lab website ↗";
      app.querySelector(".welcome-actions").appendChild(link);
    }
  } catch (_) { /* The order button remains available even when settings are unavailable. */ }
})();
