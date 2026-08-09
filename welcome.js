(async function () {
  const fontStacks = {
    fraunces: "'Fraunces','Noto Serif JP',Georgia,serif",
    noto_serif_jp: "'Noto Serif JP','Fraunces',Georgia,serif",
    work_sans: "'Work Sans','Noto Sans JP',Arial,sans-serif",
    noto_sans_jp: "'Noto Sans JP','Work Sans',Arial,sans-serif",
    georgia: "Georgia,'Noto Serif JP','Times New Roman',serif",
  };
  if (typeof IS_CONFIGURED === "undefined" || !IS_CONFIGURED || typeof db === "undefined") return;
  try {
    const { data, error } = await db.from("store_settings").select("*").limit(1).maybeSingle();
    if (error || !data) return;
    const app = document.getElementById("welcome-app");
    const logoFrame = app.querySelector(".welcome-logo-frame");
    const logo = app.querySelector(".welcome-logo");
    const title = app.querySelector(".welcome-title");
    const subtitle = app.querySelector(".welcome-sub");
    const copy = app.querySelector(".welcome-copy");
    const orderButton = app.querySelector(".welcome-enter");
    const trackButton = app.querySelector(".welcome-track");
    const loyaltyButton = app.querySelector(".welcome-loyalty");
    const poweredBy = app.querySelector("#welcome-powered-by");
    app.style.fontFamily = fontStacks[data.welcome_body_font] || fontStacks.work_sans;
    title.style.fontFamily = fontStacks[data.welcome_title_font] || fontStacks.fraunces;
    if (data.logo_url) logo.src = data.logo_url;
    const circleSize = Math.max(56, Math.min(220, Number(data.welcome_logo_circle_size || data.logo_circle_size || 100)));
    const imageScale = Math.max(0.55, Math.min(2.4, Number(data.welcome_logo_image_scale || data.logo_image_scale || 1)));
    const imageX = Math.max(-45, Math.min(45, Number(data.welcome_logo_image_x || 0)));
    const imageY = Math.max(-45, Math.min(45, Number(data.welcome_logo_image_y || 0)));
    logoFrame.style.width = `${circleSize}px`;
    logoFrame.style.height = `${circleSize}px`;
    logo.style.transform = `translate(${imageX}%, ${imageY}%) scale(${imageScale})`;
    logoFrame.dataset.position = ["left", "center", "right"].includes(data.welcome_logo_position) ? data.welcome_logo_position : "center";
    if (data.welcome_title || data.store_name) { title.textContent = data.welcome_title || data.store_name; document.title = `Welcome · ${data.welcome_title || data.store_name}`; }
    if (data.welcome_subtitle) subtitle.textContent = data.welcome_subtitle;
    if (data.welcome_copy) copy.textContent = data.welcome_copy;
    if (data.welcome_order_button_text) orderButton.textContent = data.welcome_order_button_text;
    if (data.welcome_track_button_text && trackButton) trackButton.textContent = data.welcome_track_button_text;
    if (data.welcome_loyalty_button_text && loyaltyButton) loyaltyButton.textContent = data.welcome_loyalty_button_text;
    if (poweredBy) {
      if (data.show_powered_by === false) poweredBy.hidden = true;
      else {
        const poweredText = data.powered_by_text || "Powered by Slow Studio";
        const poweredUrl = /^https?:\/\//i.test(String(data.powered_by_url || "").trim()) ? String(data.powered_by_url).trim() : "";
        poweredBy.innerHTML = "";
        const element = document.createElement(poweredUrl ? "a" : "span");
        element.textContent = poweredText;
        if (poweredUrl) { element.href = poweredUrl; element.target = "_blank"; element.rel = "noopener noreferrer"; }
        poweredBy.appendChild(element);
      }
    }
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
