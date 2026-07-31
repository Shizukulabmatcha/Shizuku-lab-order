/* Shizuku Lab — customer ordering flow (wired to real Supabase schema) */

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
];
const DEMO_STORE = {
  store_name: "Shizuku Lab", instagram: "shizukulab.matcha", paynow_name: "Shizuku Lab", paynow_number: "+65 9454 0513",
  collection_address: "Blk 130A Toa Payoh Lorong 1 / Near Creamier, Toa Payoh",
  saturday_collection_time: "10:00 AM - 12:00 PM", sunday_collection_time: "10:00 AM - 1:00 PM",
};

const state = {
  loading: true,
  loadError: null,
  store: null,
  menu: [],
  optionGroups: [], // [{id,name,selection_type,required, options:[{id,name,price,is_available}]}]
  cart: [], // [{cartId, productId, name, image_url, unitPrice, qty, options:[{id,name,price}], signature}]
  screen: "menu",
  activeCategory: "All",
  slots: [],
  form: { name: "", phone: "", instagram: "", notes: "", slotId: "", promoCode: "" },
  promo: null, // {id, text, discount_type, discount_value, amount, used_account}
  promoMsg: "",
  activePromos: [],
  customizing: null, // {product, selections: {}}
  lastOrder: null,
};

function money(n) { return `$${Number(n).toFixed(2)}`; }
function uidCode() { return "SL-" + Math.random().toString(36).slice(2, 8).toUpperCase(); }
function uid() { return Math.random().toString(36).slice(2, 10); }

/* ---- PayNow SGQR generation (EMVCo / SGQR spec) ---- */
const CRC_TABLE = [0x0000,0x1021,0x2042,0x3063,0x4084,0x50a5,0x60c6,0x70e7,0x8108,0x9129,0xa14a,0xb16b,0xc18c,0xd1ad,0xe1ce,0xf1ef,0x1231,0x0210,0x3273,0x2252,0x52b5,0x4294,0x72f7,0x62d6,0x9339,0x8318,0xb37b,0xa35a,0xd3bd,0xc39c,0xf3ff,0xe3de,0x2462,0x3443,0x0420,0x1401,0x64e6,0x74c7,0x44a4,0x5485,0xa56a,0xb54b,0x8528,0x9509,0xe5ee,0xf5cf,0xc5ac,0xd58d,0x3653,0x2672,0x1611,0x0630,0x76d7,0x66f6,0x5695,0x46b4,0xb75b,0xa77a,0x9719,0x8738,0xf7df,0xe7fe,0xd79d,0xc7bc,0x48c4,0x58e5,0x6886,0x78a7,0x0840,0x1861,0x2802,0x3823,0xc9cc,0xd9ed,0xe98e,0xf9af,0x8948,0x9969,0xa90a,0xb92b,0x5af5,0x4ad4,0x7ab7,0x6a96,0x1a71,0x0a50,0x3a33,0x2a12,0xdbfd,0xcbdc,0xfbbf,0xeb9e,0x9b79,0x8b58,0xbb3b,0xab1a,0x6ca6,0x7c87,0x4ce4,0x5cc5,0x2c22,0x3c03,0x0c60,0x1c41,0xedae,0xfd8f,0xcdec,0xddcd,0xad2a,0xbd0b,0x8d68,0x9d49,0x7e97,0x6eb6,0x5ed5,0x4ef4,0x3e13,0x2e32,0x1e51,0x0e70,0xff9f,0xefbe,0xdfdd,0xcffc,0xbf1b,0xaf3a,0x9f59,0x8f78,0x9188,0x81a9,0xb1ca,0xa1eb,0xd10c,0xc12d,0xf14e,0xe16f,0x1080,0x00a1,0x30c2,0x20e3,0x5004,0x4025,0x7046,0x6067,0x83b9,0x9398,0xa3fb,0xb3da,0xc33d,0xd31c,0xe37f,0xf35e,0x02b1,0x1290,0x22f3,0x32d2,0x4235,0x5214,0x6277,0x7256,0xb5ea,0xa5cb,0x95a8,0x8589,0xf56e,0xe54f,0xd52c,0xc50d,0x34e2,0x24c3,0x14a0,0x0481,0x7466,0x6447,0x5424,0x4405,0xa7db,0xb7fa,0x8799,0x97b8,0xe75f,0xf77e,0xc71d,0xd73c,0x26d3,0x36f2,0x0691,0x16b0,0x6657,0x7676,0x4615,0x5634,0xd94c,0xc96d,0xf90e,0xe92f,0x99c8,0x89e9,0xb98a,0xa9ab,0x5844,0x4865,0x7806,0x6827,0x18c0,0x08e1,0x3882,0x28a3,0xcb7d,0xdb5c,0xeb3f,0xfb1e,0x8bf9,0x9bd8,0xabbb,0xbb9a,0x4a75,0x5a54,0x6a37,0x7a16,0x0af1,0x1ad0,0x2ab3,0x3a92,0xfd2e,0xed0f,0xdd6c,0xcd4d,0xbdaa,0xad8b,0x9de8,0x8dc9,0x7c26,0x6c07,0x5c64,0x4c45,0x3ca2,0x2c83,0x1ce0,0x0cc1,0xef1f,0xff3e,0xcf5d,0xdf7c,0xaf9b,0xbfba,0x8fd9,0x9ff8,0x6e17,0x7e36,0x4e55,0x5e74,0x2e93,0x3eb2,0x0ed1,0x1ef0];
function crc16(s) {
  let crc = 0xFFFF;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const j = (c ^ (crc >> 8)) & 0xFF;
    crc = CRC_TABLE[j] ^ (crc << 8);
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
}
function tlv(id, value) { return id + String(value.length).padStart(2, "0") + value; }
function buildPayNowPayload({ mobile, amount, refNumber, merchantName }) {
  const expiry = (() => {
    const d = new Date(Date.now() + 15 * 60 * 1000); // valid for 15 minutes
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  })();
  const merchantInfo = tlv("00", "SG.PAYNOW") + tlv("01", "0") + tlv("02", mobile) + tlv("03", "0") + tlv("04", expiry);
  const additional = tlv("01", (refNumber || "").slice(0, 25));
  let str = tlv("00", "01") + tlv("01", "12") + tlv("26", merchantInfo) + tlv("52", "0000") + tlv("53", "702") +
    tlv("54", Number(amount).toFixed(2)) + tlv("58", "SG") + tlv("59", (merchantName || "SHIZUKU LAB").slice(0, 25)) +
    tlv("60", "Singapore") + tlv("62", additional);
  str += "6304" + crc16(str + "6304");
  return str;
}
function payNowQrSvg(amount, refNumber) {
  try {
    const mobile = (state.store && state.store.paynow_number || "").replace(/\s+/g, "");
    const merchantName = (state.store && (state.store.paynow_name || state.store.store_name)) || "SHIZUKU LAB";
    if (!mobile) return `<div class="qr-placeholder"></div>`;
    const payload = buildPayNowPayload({ mobile, amount, refNumber, merchantName });
    const qr = qrcode(0, "M");
    qr.addData(payload);
    qr.make();
    return qr.createSvgTag({ cellSize: 5, margin: 2 });
  } catch (e) {
    return `<div class="qr-placeholder"></div>`;
  }
}

/* ---- opening hours (free-text fields, parsed leniently) ---- */
function parseTimeRange(text) {
  if (!text) return null;
  const re = /(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])/g;
  const matches = [...text.matchAll(re)];
  if (matches.length < 2) return null;
  const toMin = (m) => { let h = parseInt(m[1], 10); const mm = m[2] ? parseInt(m[2], 10) : 0; const ap = m[3].toUpperCase(); if (ap === "PM" && h !== 12) h += 12; if (ap === "AM" && h === 12) h = 0; return h * 60 + mm; };
  return { openMin: toMin(matches[0]), closeMin: toMin(matches[1]) };
}
function computeSlots() {
  if (!state.store) return [];
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const days = [
    { day: 6, label: "Sat", text: state.store.saturday_collection_time },
    { day: 0, label: "Sun", text: state.store.sunday_collection_time },
  ].filter((d) => d.text);
  return days.map((t) => {
    const range = parseTimeRange(t.text);
    const d = new Date(now);
    let diff = (t.day - now.getDay() + 7) % 7;
    if (diff === 0 && range && nowM >= range.closeMin) diff = 7;
    d.setDate(now.getDate() + diff);
    return {
      id: `${t.label}-${d.toISOString().slice(0, 10)}`,
      date: d.toISOString().slice(0, 10),
      label: `${t.label}, ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      timeText: t.text,
    };
  });
}
function computeStoreStatus() {
  if (!state.store) return { isOpen: false, todayText: null, next: null };
  const now = new Date();
  const day = now.getDay();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const todayText = day === 6 ? state.store.saturday_collection_time : day === 0 ? state.store.sunday_collection_time : null;
  let isOpen = false;
  if (todayText) { const r = parseTimeRange(todayText); if (r) isOpen = nowM >= r.openMin && nowM < r.closeMin; }
  let next = null;
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (d === 6 && state.store.saturday_collection_time) { next = { label: "Saturday", text: state.store.saturday_collection_time }; break; }
    if (d === 0 && state.store.sunday_collection_time) { next = { label: "Sunday", text: state.store.sunday_collection_time }; break; }
  }
  return { isOpen, todayText, next };
}

/* ---------- data loading ---------- */
async function init() {
  if (IS_CONFIGURED) {
    try {
      const { data: storeRows, error: storeErr } = await db.from("store_settings").select("*").limit(1);
      if (storeErr) state.loadError = storeErr.message;
      state.store = (storeRows && storeRows[0]) || DEMO_STORE;
    } catch (e) { state.store = DEMO_STORE; }

    try {
      const { data, error } = await db.from("products").select("*").eq("is_available", true).order("category");
      if (error) { state.loadError = error.message; state.menu = []; }
      else {
        state.menu = (data || []).map((m) => ({
          ...m, category: m.category || "Other", name: m.name || "Untitled",
          description: m.description || "", price: m.price ?? 0,
        }));
      }
    } catch (e) { state.loadError = (e && e.message) || String(e); state.menu = []; }

    try {
      const [{ data: groups }, { data: options }] = await Promise.all([
        db.from("option_groups").select("*"),
        db.from("options").select("*").eq("is_available", true),
      ]);
      state.optionGroups = (groups || []).map((g) => ({
        ...g,
        options: (options || []).filter((o) => String(o.option_group) === String(g.id)),
      })).filter((g) => g.options.length > 0);
    } catch (e) { state.optionGroups = []; }

    try {
      const nowIso = new Date().toISOString();
      const { data: promos } = await db.from("promo_codes").select("*").eq("is_active", true)
        .or(`valid_until.is.null,valid_until.gt.${nowIso}`);
      state.activePromos = promos || [];
    } catch (e) { state.activePromos = []; }
  } else {
    state.store = DEMO_STORE;
    state.menu = DEMO_MENU;
  }

  state.slots = computeSlots();
  state.loading = false;
  render();
}

/* ---------- cart ---------- */
function cartTotal() { return state.cart.reduce((s, l) => s + l.qty * l.unitPrice, 0); }
function cartCount() { return state.cart.reduce((s, l) => s + l.qty, 0); }
function orderTotal() { return Math.max(0, cartTotal() - (state.promo ? state.promo.amount : 0)); }
function productQtyInCart(productId) { return state.cart.filter((l) => l.productId === productId).reduce((s, l) => s + l.qty, 0); }

function addSimple(productId, delta) {
  const product = state.menu.find((m) => String(m.id) === String(productId));
  const signature = productId + "|";
  let line = state.cart.find((l) => l.signature === signature);
  if (!line && delta > 0) {
    line = { cartId: uid(), productId, name: product.name, image_url: product.image_url, unitPrice: product.price, qty: 0, options: [], signature };
    state.cart.push(line);
  }
  if (line) {
    line.qty = Math.max(0, line.qty + delta);
    if (line.qty === 0) state.cart = state.cart.filter((l) => l !== line);
  }
  render();
}
function changeQty(cartId, delta) {
  const line = state.cart.find((l) => l.cartId === cartId);
  if (!line) return;
  line.qty = Math.max(0, line.qty + delta);
  if (line.qty === 0) state.cart = state.cart.filter((l) => l !== line);
  render();
}

/* ---------- customization modal ---------- */
function openCustomize(productId) {
  const product = state.menu.find((m) => String(m.id) === String(productId));
  state.customizing = { product, selections: {} };
  render();
}
function cancelCustomize() { state.customizing = null; render(); }
function toggleOption(groupId, optionId, type) {
  const sel = state.customizing.selections;
  if (type === "single") sel[groupId] = optionId;
  else { sel[groupId] = sel[groupId] || {}; sel[groupId][optionId] = !sel[groupId][optionId]; }
  render();
}
function confirmCustomize() {
  const { product, selections } = state.customizing;
  for (const g of state.optionGroups) {
    if (g.required) {
      const sel = selections[g.id];
      const has = g.selection_type === "single" ? !!sel : (sel && Object.values(sel).some(Boolean));
      if (!has) { alert(`Please choose an option for "${g.name}".`); return; }
    }
  }
  const chosen = [];
  for (const g of state.optionGroups) {
    const sel = selections[g.id];
    if (!sel) continue;
    if (g.selection_type === "single") {
      const opt = g.options.find((o) => String(o.id) === String(sel));
      if (opt) chosen.push(opt);
    } else {
      for (const optId of Object.keys(sel)) {
        if (sel[optId]) { const opt = g.options.find((o) => String(o.id) === String(optId)); if (opt) chosen.push(opt); }
      }
    }
  }
  const unitPrice = Number(product.price) + chosen.reduce((s, o) => s + Number(o.price || 0), 0);
  const signature = product.id + "|" + chosen.map((o) => o.id).sort().join(",");
  const existing = state.cart.find((l) => l.signature === signature);
  if (existing) existing.qty += 1;
  else state.cart.push({ cartId: uid(), productId: product.id, name: product.name, image_url: product.image_url, unitPrice, qty: 1, options: chosen, signature });
  state.customizing = null;
  render();
}

/* ---------- promo codes ---------- */
async function applyPromoCode() {
  const code = (state.form.promoCode || "").trim().toUpperCase();
  if (!code) return;
  if (!state.form.phone.trim()) { state.promoMsg = "Enter your phone number first, then apply the code."; render(); return; }
  if (!IS_CONFIGURED) { state.promoMsg = "Demo mode: connect Supabase to validate promo codes."; render(); return; }

  const { data: rows, error } = await db.from("promo_codes").select("*").ilike("text", code).eq("is_active", true).limit(1);
  if (error) { state.promoMsg = "Could not check code: " + error.message; render(); return; }
  const promo = rows && rows[0];
  if (!promo) { state.promoMsg = "That code isn't valid."; state.promo = null; render(); return; }
  const now = new Date();
  if (promo.valid_from && new Date(promo.valid_from) > now) { state.promoMsg = "That code isn't active yet."; state.promo = null; render(); return; }
  if (promo.valid_until && new Date(promo.valid_until) < now) { state.promoMsg = "That code has expired."; state.promo = null; render(); return; }
  if (promo.min_spend && cartTotal() < promo.min_spend) { state.promoMsg = `Minimum spend for this code is ${money(promo.min_spend)}.`; state.promo = null; render(); return; }
  if (promo.usage_limit != null && (promo.used_account || 0) >= promo.usage_limit) { state.promoMsg = "That code has reached its usage limit."; state.promo = null; render(); return; }

  try {
    const { count: usedByPhone } = await db.from("promo_redemptions").select("id", { count: "exact", head: true }).ilike("code", code).eq("phone", state.form.phone.trim());
    if ((usedByPhone || 0) > 0) { state.promoMsg = "You've already used this code."; state.promo = null; render(); return; }
  } catch (e) { /* redemptions table may not exist yet — skip this check */ }

  const rawAmount = promo.discount_type === "percent" ? cartTotal() * (Number(promo.discount_value) / 100) : Number(promo.discount_value);
  const amount = Math.min(cartTotal(), Math.max(0, rawAmount));
  state.promo = { id: promo.id, text: promo.text, discount_type: promo.discount_type, discount_value: promo.discount_value, used_account: promo.used_account, amount };
  state.promoMsg = `Applied — ${promo.discount_type === "percent" ? promo.discount_value + "% off" : money(promo.discount_value) + " off"}`;
  render();
}
function removePromoCode() { state.promo = null; state.promoMsg = ""; state.form.promoCode = ""; render(); }

/* ---------- checkout / orders ---------- */
function setScreen(s) { state.screen = s; render(); }
function setCategory(c) { state.activeCategory = c; render(); }
function onFormInput(key, value) {
  state.form[key] = value;
  if (state.screen === "checkout") {
    const canSubmit = state.form.name.trim() && state.form.phone.trim() && state.form.slotId;
    const btn = document.getElementById("checkout-btn");
    if (btn) { btn.toggleAttribute("disabled", !canSubmit); btn.textContent = `Continue to payment · ${money(orderTotal())}`; }
    if (key === "slotId") render();
  }
}

async function submitOrder() {
  const orderNumber = uidCode();
  const slot = state.slots.find((s) => s.id === state.form.slotId);
  const orderRow = {
    order_number: orderNumber,
    customer_name: state.form.name,
    customer_contact: state.form.phone,
    collection_date: slot ? slot.date : null,
    collection_time: slot ? slot.timeText : null,
    instagram: state.form.instagram || null,
    total: orderTotal(),
    payment_status: "unpaid",
    order_status: "pending",
    notes: state.form.notes || null,
    payment_method: "PayNow",
  };

  if (!IS_CONFIGURED) {
    alert("Demo mode: connect Supabase (see README.md) to actually accept orders. Your UI flow works though — try it!");
    state.lastOrder = { ...orderRow, id: orderNumber, slot };
    state.screen = "payment";
    render();
    return;
  }

  const { data: orderData, error } = await db.from("orders").insert(orderRow).select().single();
  if (error) { alert("Something went wrong submitting your order. Please try again.\n" + error.message); return; }

  for (const line of state.cart) {
    const { data: itemData, error: itemErr } = await db.from("order_items").insert({
      order_id: orderData.id, product_id: line.productId, product_name: line.name,
      quantity: line.qty, unit_price: line.unitPrice, subtotal: line.unitPrice * line.qty,
    }).select().single();
    if (!itemErr && itemData && line.options.length) {
      await db.from("order_item_options").insert(
        line.options.map((o) => ({ order_item_id: itemData.id, option_id: o.id, option_name: o.name, price: o.price || 0 }))
      );
    }
  }

  if (state.promo) {
    try {
      await db.from("promo_redemptions").insert({ code: state.promo.text, phone: state.form.phone.trim(), order_id: orderData.id });
      await db.from("promo_codes").update({ used_account: (state.promo.used_account || 0) + 1 }).eq("id", state.promo.id);
    } catch (e) { /* non-fatal */ }
  }

  state.lastOrder = { ...orderRow, id: orderData.id, order_number: orderNumber, slot };
  state.screen = "payment";
  render();
}

async function markPaid() {
  state.lastOrder.payment_status = "pending_confirmation";
  if (IS_CONFIGURED) {
    await db.from("orders").update({ payment_status: "pending_confirmation", payment_reference: state.lastOrder.order_number }).eq("id", state.lastOrder.id);
  }
  state.cart = [];
  state.screen = "confirmation";
  render();
}

/* ---------- rendering ---------- */
function storeInfoPanel() {
  const store = state.store || {};
  const status = computeStoreStatus();
  const hoursBlock = status.isOpen
    ? `<div class="hours-day">Open now</div>`
    : status.next
    ? `<div class="hours-day">${status.next.label}</div><div class="hours-time">${status.next.text}</div>`
    : `<div class="hours-time">Hours coming soon</div>`;
  return `
  <div class="store-panel">
    <div class="store-banner" style="background-image:url('matcha-latte.jpg')">
      <img src="logo.png" class="store-logo-overlap" alt="${store.store_name || "Shizuku Lab"} logo">
    </div>
    <div class="store-panel-body">
      ${store.instagram ? `<a class="store-insta" href="https://instagram.com/${store.instagram}" target="_blank" rel="noopener">@${store.instagram}</a>` : ""}
      ${store.collection_address ? `<div class="store-dropoff">${store.collection_address}</div>` : ""}
      <div class="hours-card-dark">
        <div class="hours-row">
          <span class="hours-label">${status.isOpen ? "OPEN NOW" : "NEXT OPENING"}</span>
          <span class="hours-status-dark ${status.isOpen ? "open" : "closed"}">${status.isOpen ? "● OPEN" : "● CLOSED"}</span>
        </div>
        ${hoursBlock}
      </div>
    </div>
  </div>`;
}

function faqSection() {
  return `
  <div class="faq-section">
    <div class="display faq-title">FAQ</div>
    ${STORE_FAQ.map((item) => `
      <details class="faq-item">
        <summary>${item.q}</summary>
        <div class="faq-answer">${(item.a || "").replace(/\n/g, "<br>")}</div>
      </details>
    `).join("")}
  </div>`;
}

function header({ title, subtitle = "雫ラボ · crafted drop by drop", showCart = false } = {}) {
  const storeName = (state.store && state.store.store_name) || "Shizuku Lab";
  return `
  <div class="header">
    <div class="header-row">
      <div>
        <div class="display brand-title">${title || storeName}</div>
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
    ${storeInfoPanel()}
    ${!IS_CONFIGURED ? `<div class="setup-banner">Demo mode — showing sample items. Connect Supabase in <code>config.js</code> to load your real menu and accept orders.</div>` : ""}
    ${state.loadError ? `<div class="setup-banner" style="border-color:#B33;background:#FBEAEA;color:#7a1f1f;">Could not load data from Supabase: <code>${state.loadError}</code></div>` : ""}
    <div class="cats">
      ${categories.map((c) => `<button class="pill ${c === state.activeCategory ? "active" : ""}" onclick="setCategory('${c.replace(/'/g, "\\'")}')">${c}</button>`).join("")}
    </div>
    <div class="menu-list">
      ${items.length === 0 ? `<div class="empty">No items yet — add some from the shop dashboard.</div>` : items.map((item) => {
        const qtyInCart = productQtyInCart(item.id);
        const hasOptions = state.optionGroups.length > 0;
        return `
        <div class="item-card">
          <img class="item-thumb" src="${item.image_url || "matcha-lab.jpg"}" alt="${item.name}">
          <div class="item-info">
            <div class="item-name">${item.name}</div>
            <div class="item-desc">${item.description || ""}</div>
            <div class="item-row">
              <div class="item-price">${money(item.price)}</div>
              ${hasOptions
                ? `<button class="add-btn" onclick="openCustomize('${item.id}')">Add${qtyInCart > 0 ? ` (${qtyInCart})` : ""}</button>`
                : (qtyInCart > 0
                    ? (() => { const line = state.cart.find((l) => l.productId === item.id); return stepperFor(line.cartId, line.qty); })()
                    : `<button class="add-btn" onclick="addSimple('${item.id}',1)">Add</button>`)
              }
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>
    ${faqSection()}
    ${state.customizing ? customizeModal() : ""}
    ${cartCount() > 0 ? `
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" onclick="setScreen('cart')">${ICONS.bag} View cart · ${money(cartTotal())}</button>
    </div></div>` : ""}
  `;
}

function customizeModal() {
  const { product, selections } = state.customizing;
  return `
  <div class="overlay">
    <div class="overlay-card" style="max-height:80vh;overflow-y:auto;">
      <div class="display overlay-title" style="font-size:18px;">${product.name}</div>
      <div class="overlay-sub">${money(product.price)}</div>
      ${state.optionGroups.map((g) => `
        <div class="field">
          <label>${g.name}${g.required ? ' <span style="color:#B33;">*</span>' : ""}</label>
          ${g.options.map((o) => {
            const sel = selections[g.id];
            const checked = g.selection_type === "single" ? String(sel) === String(o.id) : !!(sel && sel[o.id]);
            return `
            <button type="button" class="slot ${checked ? "active" : ""}" onclick="toggleOption('${g.id}','${o.id}','${g.selection_type}')" style="justify-content:space-between;">
              <span>${o.name}</span>
              <span>${o.price ? "+" + money(o.price) : ""}</span>
            </button>`;
          }).join("")}
        </div>
      `).join("")}
      <div class="btn-row" style="margin-top:14px;">
        <button class="btn-secondary" onclick="cancelCustomize()">Cancel</button>
        <button class="btn-primary" onclick="confirmCustomize()">Add to cart</button>
      </div>
    </div>
  </div>`;
}

function stepperFor(cartId, qty) {
  return `<div class="stepper">
    <button onclick="changeQty('${cartId}',-1)">${ICONS.minus}</button>
    <span>${qty}</span>
    <button onclick="changeQty('${cartId}',1)">${ICONS.plus}</button>
  </div>`;
}

function renderCart() {
  return `
    ${header({ showCart: true })}
    <div class="screen">
      <button class="back-link" onclick="setScreen('menu')">${ICONS.back} Continue browsing</button>
      ${state.cart.length === 0 ? `<div class="empty">Your cart is empty — the whisk is waiting.</div>` : state.cart.map((l) => `
        <div class="item-card">
          <img class="item-thumb" src="${l.image_url || "matcha-lab.jpg"}" alt="${l.name}">
          <div class="item-info">
            <div class="item-name">${l.name}</div>
            ${l.options.length ? `<div class="item-desc">${l.options.map((o) => o.name).join(", ")}</div>` : ""}
            <div class="item-desc">${money(l.unitPrice)}</div>
          </div>
          ${stepperFor(l.cartId, l.qty)}
        </div>
      `).join("")}
    </div>
    ${state.cart.length > 0 ? `
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
      <div class="field"><label>Instagram (optional)</label><input id="f-insta" value="${f.instagram}" placeholder="@yourhandle" oninput="onFormInput('instagram', this.value)"></div>
      <div class="field"><label>Pickup slot</label></div>
      ${state.slots.length === 0 ? `<div class="hint">No pickup slots configured yet.</div>` : state.slots.map((s) => `
        <button class="slot ${f.slotId === s.id ? "active" : ""}" onclick="onFormInput('slotId','${s.id}')">
          ${ICONS.clock}
          <div><div class="slot-day">${s.label}</div><div class="slot-time">${s.timeText}</div></div>
        </button>
      `).join("")}
      <div class="field"><label>Notes (optional)</label><textarea id="f-notes" rows="2" placeholder="Less ice, allergies, etc." oninput="onFormInput('notes', this.value)">${f.notes}</textarea></div>
      <div class="field">
        <label>Promo code (optional)</label>
        ${state.promo
          ? `<div class="slot active" style="justify-content:space-between;"><span><b>${state.promo.text}</b> applied</span><button class="link-btn" style="border:none;background:none;color:#B33;" onclick="removePromoCode()">Remove</button></div>`
          : `<div style="display:flex;gap:8px;">
              <input id="f-promo" value="${f.promoCode}" placeholder="e.g. WELCOME10" style="flex:1;" oninput="onFormInput('promoCode', this.value)">
              <button class="btn-primary" style="flex:none;padding:0 18px;" onclick="applyPromoCode()">Apply</button>
            </div>`
        }
        ${state.promoMsg ? `<div class="ref-note">${state.promoMsg}</div>` : ""}
      </div>
      <div class="summary-card">
        ${state.cart.map((l) => `<div class="row"><span class="label">${l.name}${l.options.length ? " (" + l.options.map((o) => o.name).join(", ") + ")" : ""} × ${l.qty}</span><span>${money(l.unitPrice * l.qty)}</span></div>`).join("")}
        ${state.promo ? `<div class="row"><span class="label">Discount (${state.promo.text})</span><span>-${money(state.promo.amount)}</span></div>` : ""}
        <div class="divider"></div>
        <div class="row bold"><span class="label">Total</span><span>${money(orderTotal())}</span></div>
      </div>
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" id="checkout-btn" ${canSubmit ? "" : "disabled"} onclick="submitOrder()">Continue to payment · ${money(orderTotal())}</button>
    </div></div>
  `;
}

function renderPayment() {
  const o = state.lastOrder;
  return `
    ${header({ title: "Pay via PayNow" })}
    <div class="screen">
      <div class="summary-card">
        <div class="qr-box">${payNowQrSvg(o.total, o.order_number)}</div>
        <div class="hint">Scan with your banking app, or PayNow to <b>${(state.store && state.store.paynow_number) || ""}</b></div>
        <div class="hint" style="color:#B78A2E;">This QR code is valid for 15 minutes — please pay promptly.</div>
        <div class="divider"></div>
        <div class="row"><span class="label">Order</span><span class="mono">${o.order_number}</span></div>
        <div class="row bold"><span class="label">Amount</span><span>${money(o.total)}</span></div>
        <div class="ref-note">Enter <b>${o.order_number}</b> as the payment reference so we can match it to your order.</div>
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
      <div class="hint" style="margin-bottom:20px;">We've received your payment and will confirm shortly. Show this order number at pickup.</div>
      <div class="code-box">
        <div class="mono code-text">${o.order_number}</div>
        <div class="divider"></div>
        <div class="row"><span class="label">Pickup</span><span>${o.slot ? o.slot.label : ""} · ${o.collection_time || ""}</span></div>
        <div class="row"><span class="label">Status</span><span>Payment sent — pending confirmation</span></div>
        <div class="row"><span class="label">Total</span><span>${money(o.total)}</span></div>
      </div>
      <button class="primary-btn" style="margin-top:22px;" onclick="setScreen('menu')">Back to menu</button>
    </div>
  `;
}

function promoTicker() {
  if (!state.activePromos || state.activePromos.length === 0) return "";
  const parts = state.activePromos.map((p) =>
    p.discount_type === "percent" ? `${p.text} — ${p.discount_value}% OFF` : `${p.text} — ${money(p.discount_value)} OFF`
  );
  const text = parts.join("   ·   ");
  return `<div class="promo-ticker"><div class="promo-ticker-track"><span>${text}</span><span>${text}</span></div></div>`;
}

function render() {
  const app = document.getElementById("app");
  if (state.loading) { app.innerHTML = `<div class="loading">Loading ${(state.store && state.store.store_name) || "Shizuku Lab"}…</div>`; return; }
  let html = promoTicker();
  if (state.screen === "menu") html += renderMenu();
  else if (state.screen === "cart") html += renderCart();
  else if (state.screen === "checkout") html += renderCheckout();
  else if (state.screen === "payment") html += renderPayment();
  else if (state.screen === "confirmation") html += renderConfirmation();
  html += `<div class="footer-link"><a href="admin.html"><button>Shop login</button></a></div>`;
  app.innerHTML = html;
}

init();
