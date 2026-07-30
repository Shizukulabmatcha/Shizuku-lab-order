/* Shizuku Lab — customer ordering flow */

const ICONS = {
  bag: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  back: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  clock: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4B5D3A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  check: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F3EEE3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  minus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/></svg>`,
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
};

const DEMO_MENU = [
  { id: "duo", category: "Bundle", name: "Shizuku Duo", description: "Signature Matcha Latte + Signature Dark Roasted Hojicha Latte", price: 10.5, image_url: "matcha-latte.jpg" },
  { id: "sig-matcha", category: "Signature", name: "Signature Matcha Latte", description: "Fresh whisked First Harvest matcha with oat milk", price: 5.9, image_url: "matcha-latte.jpg" },
  { id: "sig-hojicha", category: "Signature", name: "Signature Hojicha Latte", description: "Fresh whisked First Harvest dark roasted hojicha with oat milk", price: 5.9, image_url: "hojicha-latte.jpg" },
  { id: "craft", category: "Craft your own", name: "Matcha Lab", description: "Pick your grade, milk and sweetness", price: 5.9, image_url: "matcha-lab.jpg" },
];

const state = {
  menu: [],
  cart: {},
  screen: "menu",
  activeCategory: "All",
  slots: [],
  form: { name: "", phone: "", slotId: "", notes: "" },
  lastOrder: null,
  loading: true,
  loadError: null,
};

function money(n) { return `$${Number(n).toFixed(2)}`; }
function uidCode() { return "SL-" + Math.random().toString(36).slice(2, 8).toUpperCase(); }

function computeSlots() {
  const now = new Date();
  const targets = [
    { dow: 6, label: "Sat", time: "10:00 AM – 12:00 PM" },
    { dow: 0, label: "Sun", time: "11:00 AM – 1:00 PM" },
  ];
  return targets.map((t) => {
    const d = new Date(now);
    let diff = (t.dow - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(now.getDate() + diff);
    return {
      id: `${t.label}-${d.toISOString().slice(0, 10)}`,
      label: `${t.label}, ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      time: t.time,
    };
  });
}

async function init() {
  state.slots = computeSlots();
  if (IS_CONFIGURED) {
    try {
      const { data, error } = await db.from("products").select("*").eq("is_available", true).order("category");
      if (error) { state.loadError = error.message; state.menu = []; }
      else { state.menu = data || []; }
    } catch (e) {
      state.loadError = (e && e.message) || String(e);
      state.menu = [];
    }
  } else {
    state.menu = DEMO_MENU;
  }
  state.loading = false;
  render();
}

function cartLines() {
  return Object.entries(state.cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ item: state.menu.find((m) => String(m.id) === String(id)), qty }))
    .filter((l) => l.item);
}
function cartCount() { return cartLines().reduce((s, l) => s + l.qty, 0); }
function cartTotal() { return cartLines().reduce((s, l) => s + l.qty * l.item.price, 0); }

function addToCart(id, delta) {
  state.cart[id] = Math.max(0, (state.cart[id] || 0) + delta);
  render();
}
function setScreen(s) { state.screen = s; render(); }
function setCategory(c) { state.activeCategory = c; render(); }

async function submitOrder() {
  const code = uidCode();
  const slot = state.slots.find((s) => s.id === state.form.slotId);
  const order = {
    id: code,
    customer_name: state.form.name,
    phone: state.form.phone,
    pickup_label: slot ? slot.label : "",
    pickup_time: slot ? slot.time : "",
    notes: state.form.notes,
    items: cartLines().map((l) => ({ name: l.item.name, price: l.item.price, qty: l.qty })),
    total: cartTotal(),
    status: "awaiting_payment",
  };

  if (!IS_CONFIGURED) {
    alert("Demo mode: connect Supabase (see README.md) to actually accept orders. Your UI flow works though — try it!");
    state.lastOrder = { ...order, slot };
    state.screen = "payment";
    render();
    return;
  }

  const { error } = await db.from("orders").insert(order);
  if (error) {
    alert("Something went wrong submitting your order. Please try again.\n" + error.message);
    return;
  }
  state.lastOrder = { ...order, slot };
  state.screen = "payment";
  render();
}

async function markPaid() {
  state.lastOrder.status = "awaiting_confirmation";
  if (IS_CONFIGURED) {
    await db.from("orders").update({ status: "awaiting_confirmation" }).eq("id", state.lastOrder.id);
  }
  state.cart = {};
  state.screen = "confirmation";
  render();
}

/* ---------- rendering ---------- */

function header({ title = "Shizuku Lab", subtitle = "雫ラボ · crafted drop by drop", showCart = false } = {}) {
  return `
  <div class="header">
    <div class="header-row">
      <div>
        <div class="display brand-title">${title}</div>
        <div class="brand-sub">${subtitle}</div>
      </div>
      ${showCart ? `
      <button class="cart-btn" onclick="setScreen('cart')">
        ${ICONS.bag}
        ${cartCount() > 0 ? `<span class="cart-badge">${cartCount()}</span>` : ""}
      </button>` : ""}
    </div>
    <svg class="drip-row" viewBox="0 0 300 30">
      <g><circle class="drip" cx="40" cy="4" r="2.4" fill="#4B5D3A"/><ellipse class="ripple" cx="40" cy="26" rx="7" ry="2.4" fill="none" stroke="#8C9B6E" stroke-width="1"/></g>
      <g><circle class="drip drip2" cx="150" cy="4" r="2.4" fill="#4B5D3A"/><ellipse class="ripple drip2" cx="150" cy="26" rx="7" ry="2.4" fill="none" stroke="#8C9B6E" stroke-width="1"/></g>
      <g><circle class="drip drip3" cx="260" cy="4" r="2.4" fill="#4B5D3A"/><ellipse class="ripple drip3" cx="260" cy="26" rx="7" ry="2.4" fill="none" stroke="#8C9B6E" stroke-width="1"/></g>
      <line x1="0" y1="27" x2="300" y2="27" stroke="#E1D9C8" stroke-width="1"/>
    </svg>
  </div>`;
}

function renderMenu() {
  const categories = ["All", ...Array.from(new Set(state.menu.map((m) => m.category)))];
  const items = state.activeCategory === "All" ? state.menu : state.menu.filter((m) => m.category === state.activeCategory);
  return `
    ${header({ showCart: true })}
    ${!IS_CONFIGURED ? `<div class="setup-banner">Demo mode — showing sample items. Connect Supabase in <code>js/config.js</code> to load your real menu and accept orders. See <code>README.md</code>.</div>` : ""}
    ${state.loadError ? `<div class="setup-banner" style="border-color:#B33;background:#FBEAEA;color:#7a1f1f;">Could not load products from Supabase: <code>${state.loadError}</code>. Check that the <code>product</code> table exists and its row-level security allows public read.</div>` : ""}
    <div class="cats">
      ${categories.map((c) => `<button class="pill ${c === state.activeCategory ? "active" : ""}" onclick="setCategory('${c.replace(/'/g, "\\'")}')">${c}</button>`).join("")}
    </div>
    <div class="menu-list">
      ${items.length === 0 ? `<div class="empty">No items yet — add some from the shop dashboard.</div>` : items.map((item) => `
        <div class="item-card">
          <img class="item-thumb" src="${item.image_url || "matcha-lab.jpg"}" alt="${item.name}">
          <div class="item-info">
            <div class="item-name">${item.name}</div>
            <div class="item-desc">${item.description || ""}</div>
            <div class="item-row">
              <div class="item-price">${money(item.price)}</div>
              ${(state.cart[item.id] || 0) > 0 ? stepper(item.id, state.cart[item.id]) : `<button class="add-btn" onclick="addToCart('${item.id}',1)">Add</button>`}
            </div>
          </div>
        </div>
      `).join("")}
    </div>
    ${cartCount() > 0 ? `
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" onclick="setScreen('cart')">${ICONS.bag} View cart · ${money(cartTotal())}</button>
    </div></div>` : ""}
  `;
}

function stepper(id, qty) {
  return `<div class="stepper">
    <button onclick="addToCart('${id}',-1)">${ICONS.minus}</button>
    <span>${qty}</span>
    <button onclick="addToCart('${id}',1)">${ICONS.plus}</button>
  </div>`;
}

function renderCart() {
  const lines = cartLines();
  return `
    ${header({ showCart: true })}
    <div class="screen">
      <button class="back-link" onclick="setScreen('menu')">${ICONS.back} Continue browsing</button>
      ${lines.length === 0 ? `<div class="empty">Your cart is empty — the whisk is waiting.</div>` : lines.map((l) => `
        <div class="item-card">
          <img class="item-thumb" src="${l.item.image_url || "matcha-lab.jpg"}" alt="${l.item.name}">
          <div class="item-info">
            <div class="item-name">${l.item.name}</div>
            <div class="item-desc">${money(l.item.price)}</div>
          </div>
          ${stepper(l.item.id, l.qty)}
        </div>
      `).join("")}
    </div>
    ${lines.length > 0 ? `
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" onclick="setScreen('checkout')">Checkout · ${money(cartTotal())}</button>
    </div></div>` : ""}
  `;
}

function renderCheckout() {
  const f = state.form;
  const canSubmit = f.name.trim() && f.phone.trim() && f.slotId;
  return `
    ${header({ title: "Checkout" })}
    <div class="screen">
      <button class="back-link" onclick="setScreen('cart')">${ICONS.back} Back to cart</button>
      <div class="field"><label>Name</label><input id="f-name" value="${f.name}" placeholder="Your name" oninput="onFormInput('name', this.value)"></div>
      <div class="field"><label>Phone</label><input id="f-phone" value="${f.phone}" placeholder="For pickup updates" oninput="onFormInput('phone', this.value)"></div>
      <div class="field"><label>Pickup slot</label></div>
      ${state.slots.map((s) => `
        <button class="slot ${f.slotId === s.id ? "active" : ""}" onclick="onFormInput('slotId','${s.id}')">
          ${ICONS.clock}
          <div><div class="slot-day">${s.label}</div><div class="slot-time">${s.time}</div></div>
        </button>
      `).join("")}
      <div class="field"><label>Notes (optional)</label><textarea id="f-notes" rows="2" placeholder="Less ice, allergies, etc." oninput="onFormInput('notes', this.value)">${f.notes}</textarea></div>
      <div class="summary-card">
        ${cartLines().map((l) => `<div class="row"><span class="label">${l.item.name} × ${l.qty}</span><span>${money(l.item.price * l.qty)}</span></div>`).join("")}
        <div class="divider"></div>
        <div class="row bold"><span class="label">Total</span><span>${money(cartTotal())}</span></div>
      </div>
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" id="checkout-btn" ${canSubmit ? "" : "disabled"} onclick="submitOrder()">Continue to payment · ${money(cartTotal())}</button>
    </div></div>
  `;
}

function onFormInput(key, value) {
  state.form[key] = value;
  // update just the submit button state, don't re-render (keeps input focus)
  if (state.screen === "checkout") {
    const canSubmit = state.form.name.trim() && state.form.phone.trim() && state.form.slotId;
    const btn = document.getElementById("checkout-btn");
    if (btn) {
      btn.toggleAttribute("disabled", !canSubmit);
      btn.textContent = `Continue to payment · ${money(cartTotal())}`;
    }
    if (key === "slotId") render(); // slot selection needs visual update
  }
}

function renderPayment() {
  const o = state.lastOrder;
  return `
    ${header({ title: "Pay via PayNow" })}
    <div class="screen">
      <div class="summary-card">
        <div class="qr-box"><div class="qr-placeholder"></div></div>
        <div class="hint">Scan with your banking app, or PayNow to <b>+65 8XXX XXXX</b></div>
        <div class="divider"></div>
        <div class="row"><span class="label">Order</span><span class="mono">${o.id}</span></div>
        <div class="row bold"><span class="label">Amount</span><span>${money(o.total)}</span></div>
        <div class="ref-note">Enter <b>${o.id}</b> as the payment reference so we can match it to your order.</div>
      </div>
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" onclick="markPaid()">I've sent payment</button>
      <div class="hint" style="margin-top:8px;margin-bottom:0;">We'll confirm your order once payment is verified.</div>
    </div></div>
  `;
}

function renderConfirmation() {
  const o = state.lastOrder;
  return `
    ${header({ title: "Order sent" })}
    <div class="screen center">
      <div class="check-circle">${ICONS.check}</div>
      <div class="display" style="font-size:20px;margin-bottom:4px;">Thanks, ${(o.customer_name || "there").split(" ")[0]}</div>
      <div class="hint" style="margin-bottom:20px;">We've received your payment and will confirm shortly. Show this code at pickup.</div>
      <div class="code-box">
        <div class="mono code-text">${o.id}</div>
        <div class="divider"></div>
        <div class="row"><span class="label">Pickup</span><span>${o.pickup_label} · ${o.pickup_time}</span></div>
        <div class="row"><span class="label">Status</span><span>Payment sent — pending confirmation</span></div>
        <div class="row"><span class="label">Total</span><span>${money(o.total)}</span></div>
      </div>
      <button class="primary-btn" style="margin-top:22px;" onclick="setScreen('menu')">Back to menu</button>
    </div>
  `;
}

function render() {
  const app = document.getElementById("app");
  if (state.loading) { app.innerHTML = `<div class="loading">Loading Shizuku Lab…</div>`; return; }
  let html = "";
  if (state.screen === "menu") html = renderMenu();
  else if (state.screen === "cart") html = renderCart();
  else if (state.screen === "checkout") html = renderCheckout();
  else if (state.screen === "payment") html = renderPayment();
  else if (state.screen === "confirmation") html = renderConfirmation();
  html += `<div class="footer-link"><a href="admin.html"><button>Shop login</button></a></div>`;
  app.innerHTML = html;
}

init();
