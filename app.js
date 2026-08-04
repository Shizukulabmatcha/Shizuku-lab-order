/* =========================================================
   SHIZUKU LAB — CUSTOMER ORDERING FLOW
   ========================================================= */

const ICONS = {
  bag: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  back: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  clock: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4B5D3A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  check: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F3EEE3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  minus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/></svg>`,
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
};

const CART_STORAGE_KEY = "shizuku-lab-cart-v1";
function loadSavedCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch (error) { return {}; }
}
function saveCart() {
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart)); } catch (error) { /* storage may be unavailable */ }
}
function clearSavedCart() {
  try { localStorage.removeItem(CART_STORAGE_KEY); } catch (error) { /* storage may be unavailable */ }
}

const state = {
  menu: [],
  cart: loadSavedCart(),
  screen: "menu",
  activeCategory: "All",
  productGroups: [],
  menuView: "list",
  optionGroups: [],
  options: [],
  selectedProduct: null,
  selectedOptions: {},
  bundle: { drink1: null, drink2: null, drink1Options: {}, drink2Options: {} },
  slots: [],
  openingOverrides: [],
  faq: [],
  store: {
    store_name: "Shizuku Lab",
    instagram: "shizukulab.matcha",
    paynow_name: "",
    paynow_number: "",
    paynow_url: "",
    collection_address: "Blk 130A drop off point, Near Creamier TPY, Toa Payoh Lorong 1, Singapore",
    saturday_collection_time: "10:00 AM - 12:00 PM",
    sunday_collection_time: "10:00 AM - 1:00 PM",
  },
  form: { name: "", phone: "", instagram: "", pickupDate: "", slotId: "", notes: "", promoCode: "" },
  promo: null,
  promoMsg: "",
  payment: { transactionReference: "", proofFile: null, expiresAt: null },
  customerId: null,
  tracking: { orderNumber: "", phone: "", order: null, message: "", loading: false },
  lastOrder: null,
  loading: true,
  loadError: null,
};
let paymentCountdownTimer = null;

/* ---------- helpers ---------- */
function money(n) { return `$${Number(n || 0).toFixed(2)}`; }
function originalPrice(item) { return Number(item?.price || 0); }
function salePrice(item) {
  const original = originalPrice(item);
  const discount = Number(item?.discount_price);
  return Number.isFinite(discount) && discount > 0 && discount < original ? discount : original;
}
function hasDiscount(item) { return salePrice(item) < originalPrice(item); }
function productPriceMarkup(item, className = "item-price") {
  return `<div class="${className}">${hasDiscount(item) ? `<span class="original-price">${money(originalPrice(item))}</span> ` : ""}<span class="discount-price">${money(salePrice(item))}</span></div>`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function uidCode() { return "SL-" + Math.random().toString(36).slice(2, 8).toUpperCase(); }
function cleanPhoneInput(value) { return String(value || "").replace(/[^0-9+\-\s]/g, ""); }
function normalisePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 && digits.startsWith("65") ? digits.slice(2) : digits;
}
function isValidPhone(value) { return /^[689]\d{7}$/.test(normalisePhone(value)); }
function normaliseTime(time) { return time ? String(time).replace(/\s+/g, " ").trim() : ""; }
function formatDateForDatabase(date) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function formatDateLabel(date) { return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }

/* ---------- product helpers ---------- */
function isBundle(product) {
  if (!product) return false;
  return product.is_bundle === true || String(product.name).toLowerCase().includes("shizuku duo") || String(product.category).toLowerCase().includes("bundle");
}
function productGroupName(product) {
  const group = state.productGroups.find((item) => String(item.id) === String(product.group_id));
  return group?.name || product.category || "Other";
}
function getBundleDrinkProducts(bundle = state.selectedProduct) {
  const allowedIds = Array.isArray(bundle?.bundle_product_ids) ? bundle.bundle_product_ids.map(String) : [];
  return state.menu.filter((product) => {
    if (!product.is_available) return false;
    if (isBundle(product)) return false;
    if (allowedIds.length) return allowedIds.includes(String(product.id));
    const name = String(product.name || "").toLowerCase();
    return name.includes("matcha latte") || name.includes("houjicha latte");
  });
}

/* ---------- store settings ---------- */
async function loadStoreSettings() {
  if (!IS_CONFIGURED) return;
  const { data, error } = await db.from("store_settings").select("*").limit(1).maybeSingle();
  if (error) { console.warn("Could not load store settings:", error.message); return; }
  if (data) state.store = { ...state.store, ...data };
}

// Invisible to customers: Supabase gives each browser a private visitor identity.
// It lets the database keep each person's order and payment screenshot separate.
async function ensureCustomerSession() {
  if (!IS_CONFIGURED || !db) return null;
  const { data: sessionData } = await db.auth.getSession();
  if (sessionData?.session?.user?.id) {
    state.customerId = sessionData.session.user.id;
    return state.customerId;
  }
  const { data, error } = await db.auth.signInAnonymously();
  if (error) {
    console.warn("Secure customer session is not enabled yet:", error.message);
    return null;
  }
  state.customerId = data?.user?.id || null;
  return state.customerId;
}

/* ---------- pickup slots ---------- */
function getWeekendConfig() {
  return [
    { day: 6, label: "Saturday", time: normaliseTime(state.store.saturday_collection_time) },
    { day: 0, label: "Sunday", time: normaliseTime(state.store.sunday_collection_time) },
  ];
}

async function loadOpeningOverrides() {
  if (!IS_CONFIGURED) return;
  const today = formatDateForDatabase(new Date());
  const until = new Date();
  until.setDate(until.getDate() + Math.max(7, Number(state.store.order_advance_days || 14)) + 7);
  const { data, error } = await db.from("store_opening_overrides")
    .select("*")
    .gte("collection_date", today)
    .lte("collection_date", formatDateForDatabase(until));
  if (error) { console.warn("Could not load store availability:", error.message); return; }
  state.openingOverrides = data || [];
}
async function loadFaq() {
  if (!IS_CONFIGURED) return;
  const { data, error } = await db.from("store_faq").select("*").eq("is_active", true).order("sort_order");
  if (error) { console.warn("Could not load FAQ:", error.message); return; }
  state.faq = data || [];
}

function pickupStartsAt(dateText, timeText) {
  const match = String(timeText || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hour = Number(match[1]);
  if (match[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (match[3].toUpperCase() === "AM" && hour === 12) hour = 0;
  return new Date(`${dateText}T${String(hour).padStart(2, "0")}:${match[2]}:00`);
}

function minutesFromTime(timeText) {
  const match = String(timeText || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hour = Number(match[1]);
  if (match[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (match[3].toUpperCase() === "AM" && hour === 12) hour = 0;
  return hour * 60 + Number(match[2]);
}
function formatPickupTime(minutes) {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}
function pickupMinutesFromToken(token, otherToken) {
  const text = String(token || "").trim();
  const amPm = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (amPm) {
    let hour = Number(amPm[1]);
    if (amPm[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (amPm[3].toUpperCase() === "AM" && hour === 12) hour = 0;
    return hour * 60 + Number(amPm[2] || 0);
  }
  const plain = text.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!plain) return null;
  let hour = Number(plain[1]);
  const minute = Number(plain[2] || 0);
  if (hour > 23 || minute > 59) return null;
  if (hour >= 13) return hour * 60 + minute;
  // Friendly shorthand in Admin: "10-12" means 10 AM–12 PM,
  // while "4-6" means 4 PM–6 PM. Full AM/PM always works too.
  const otherHasMeridiem = /\b(AM|PM)\b/i.test(String(otherToken || ""));
  if (!otherHasMeridiem && hour >= 1 && hour <= 6) hour += 12;
  return hour * 60 + minute;
}
function timesFromRange(rangeText) {
  return String(rangeText || "").split("|").map((range) => {
    const times = String(range || "").split(/\s*[–-]\s*/);
    const start = pickupMinutesFromToken(times[0], times[1]);
    const end = pickupMinutesFromToken(times[1], times[0]);
    const interval = Math.max(5, Math.min(120, Number(state.store.pickup_slot_interval_minutes || 30)));
    if (start == null) return [];
    if (end == null || end < start) return [formatPickupTime(start)];
    const values = [];
    for (let minute = start; minute <= end; minute += interval) values.push(formatPickupTime(minute));
    return values;
  }).flat();
}

function computeSlots() {
  const now = new Date();
  const weekly = new Map(getWeekendConfig().map((item) => [item.day, item]));
  const maxDays = Math.max(0, Math.min(60, Number(state.store.order_advance_days || 14)));
  const noticeHours = Math.max(0, Number(state.store.minimum_order_notice_hours || 0));
  const earliest = new Date(now.getTime() + noticeHours * 60 * 60 * 1000);
  const slots = [];
  for (let offset = 0; offset <= maxDays; offset++) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const dateText = formatDateForDatabase(date);
    const weeklyConfig = weekly.get(date.getDay());
    const override = state.openingOverrides.find((item) => item.collection_date === dateText);
    if (override && !override.is_open) continue;
    const time = normaliseTime((override && override.collection_time) || (weeklyConfig && weeklyConfig.time));
    if (!time) continue;
    timesFromRange(time).forEach((pickupTime) => {
      const startsAt = pickupStartsAt(dateText, pickupTime);
      if (startsAt && startsAt < earliest) return;
      slots.push({ id: `pickup-${dateText}-${pickupTime.replace(/\s+/g, "-")}`, label: formatDateLabel(date), date: dateText, time: pickupTime });
    });
  }
  return slots;
}

/* ---------- load products / options ---------- */
async function loadProducts() {
  const { data, error } = await db.from("products").select("*").eq("is_available", true).order("category").order("name");
  if (error) throw error;
  state.menu = (data || []).map((item) => ({
    ...item,
    category: item.category || "Other",
    name: item.name || "Untitled",
    description: item.description || "",
    price: Number(item.price || 0),
    discount_price: item.discount_price == null ? null : Number(item.discount_price),
    stock: item.stock == null ? null : Number(item.stock),
  }));
}
async function loadProductGroups() {
  const { data, error } = await db.from("product_groups").select("*").eq("is_visible", true).order("sort_order").order("name");
  // The old shop continues to work before the one-time SQL upgrade is run.
  if (error) { console.warn("Could not load product groups:", error.message); state.productGroups = []; return; }
  state.productGroups = data || [];
}
async function loadOptions() {
  const [groupsResult, optionsResult] = await Promise.all([
    db.from("option_groups").select("*").order("id"),
    db.from("options").select("*").eq("is_available", true).order("option_group_id").order("id"),
  ]);
  if (groupsResult.error) throw groupsResult.error;
  if (optionsResult.error) throw optionsResult.error;
  // Owners can hide a whole group (for example, Sweetness) from the dashboard.
  state.optionGroups = (groupsResult.data || []).filter((group) => group.is_visible !== false);
  state.options = optionsResult.data || [];
}

/* ---------- init ---------- */
async function init() {
  state.loading = true;
  state.loadError = null;
  state.slots = computeSlots();

  if (!IS_CONFIGURED) { state.loading = false; render(); return; }

  try {
    await ensureCustomerSession();
    await loadStoreSettings();
    await loadOpeningOverrides();
    await loadFaq();
    state.slots = computeSlots();
    await Promise.all([loadProducts(), loadOptions(), loadProductGroups()]);
  } catch (error) {
    console.error(error);
    state.loadError = error?.message || String(error);
    state.menu = [];
  }

  state.loading = false;
  render();
}

/* ---------- cart ---------- */
function cartLines() {
  return Object.entries(state.cart).filter(([, item]) => item && item.qty > 0).map(([key, item]) => ({ key, ...item }));
}
function cartCount() { return cartLines().reduce((sum, line) => sum + Number(line.qty || 0), 0); }
function cartTotal() { return cartLines().reduce((sum, line) => sum + Number(line.unitPrice || 0) * Number(line.qty || 0), 0); }
function orderTotal() {
  const discount = state.promo ? Number(state.promo.amount || 0) : 0;
  return Math.max(0, cartTotal() - discount);
}

/* ---------- options ---------- */
function getOptionsForGroup(groupId) {
  // Supabase column is option_group_id, not option_group
  return state.options.filter((option) => String(option.option_group_id) === String(groupId));
}
function selectOption(groupId, optionId) {
  const option = state.options.find((item) => String(item.id) === String(optionId));
  if (!option) return;
  state.selectedOptions[groupId] = { productId: state.selectedProduct.id, optionId: option.id, optionName: option.name, price: Number(option.price || 0) };
  render();
}
function validateRequiredOptions() {
  for (const group of state.optionGroups) {
    if (!group.required) continue;
    if (!state.selectedOptions[group.id]) { alert(`Please choose an option for "${group.name}".`); return false; }
  }
  return true;
}
function getSelectedOptionsForProduct(productId) {
  return Object.values(state.selectedOptions).filter((selected) => String(selected.productId) === String(productId));
}
function calculateProductPrice(product) {
  let price = salePrice(product);
  getSelectedOptionsForProduct(product.id).forEach((selected) => { price += Number(selected.price || 0); });
  return price;
}

/* ---------- normal product ---------- */
function openProductOptions(productId) {
  const product = state.menu.find((item) => String(item.id) === String(productId));
  if (!product) return;
  state.selectedProduct = product;
  state.selectedOptions = {};
  if (isBundle(product)) {
    state.bundle = { drink1: null, drink2: null, drink1Options: {}, drink2Options: {} };
    state.screen = "bundle";
  } else {
    state.screen = "options";
  }
  render();
}
function addConfiguredProductToCart() {
  const product = state.selectedProduct;
  if (!product) return;
  if (!validateRequiredOptions()) return;
  const selectedOptions = getSelectedOptionsForProduct(product.id);
  const optionsKey = selectedOptions.map((option) => String(option.optionId)).sort().join("-");
  const key = `${product.id}__${optionsKey}`;
  const unitPrice = calculateProductPrice(product);
  if (product.stock != null && product.stock >= 0) {
    const existingQty = state.cart[key]?.qty || 0;
    if (existingQty >= product.stock) { alert("Sorry, this item is sold out."); return; }
  }
  state.cart[key] = {
    productId: product.id, productName: product.name, imageUrl: product.image_url || "",
    unitPrice, basePrice: salePrice(product), qty: (state.cart[key]?.qty || 0) + 1, options: selectedOptions,
  };
  state.selectedProduct = null;
  state.selectedOptions = {};
  state.screen = "menu";
  saveCart();
  render();
}

/* ---------- bundle ---------- */
function selectBundleDrink(slot, productId) {
  const product = state.menu.find((item) => String(item.id) === String(productId));
  if (!product) return;
  if (slot === 1) { state.bundle.drink1 = product; state.bundle.drink1Options = {}; }
  else { state.bundle.drink2 = product; state.bundle.drink2Options = {}; }
  render();
}
function selectBundleOption(drinkNumber, groupId, optionId) {
  const option = state.options.find((item) => String(item.id) === String(optionId));
  if (!option) return;
  const value = {
    productId: drinkNumber === 1 ? state.bundle.drink1.id : state.bundle.drink2.id,
    optionId: option.id, optionName: option.name, price: Number(option.price || 0),
  };
  if (drinkNumber === 1) state.bundle.drink1Options[groupId] = value;
  else state.bundle.drink2Options[groupId] = value;
  render();
}
function validateBundleDrink(drink, selectedOptions) {
  if (!drink) return false;
  for (const group of state.optionGroups) {
    if (!group.required) continue;
    if (!selectedOptions[group.id]) return false;
  }
  return true;
}
function addBundleToCart() {
  const bundle = state.selectedProduct;
  if (!bundle) return;
  const drink1 = state.bundle.drink1, drink2 = state.bundle.drink2;
  if (!drink1) { alert("Please choose Drink 1."); return; }
  if (!drink2) { alert("Please choose Drink 2."); return; }
  if (!validateBundleDrink(drink1, state.bundle.drink1Options)) { alert("Please complete the options for Drink 1."); return; }
  if (!validateBundleDrink(drink2, state.bundle.drink2Options)) { alert("Please complete the options for Drink 2."); return; }
  const drink1Options = Object.values(state.bundle.drink1Options);
  const drink2Options = Object.values(state.bundle.drink2Options);
  const unitPrice = salePrice(bundle); // bundle stays at its listed price, including any active sale
  const bundleOptions = [
    { drinkNumber: 1, productId: drink1.id, productName: drink1.name, options: drink1Options },
    { drinkNumber: 2, productId: drink2.id, productName: drink2.name, options: drink2Options },
  ];
  const key = `${bundle.id}__${drink1.id}-${drink2.id}__${drink1Options.map((x) => x.optionId).sort().join("-")}__${drink2Options.map((x) => x.optionId).sort().join("-")}`;
  state.cart[key] = {
    productId: bundle.id, productName: bundle.name, imageUrl: bundle.image_url || "",
    unitPrice, basePrice: unitPrice, qty: (state.cart[key]?.qty || 0) + 1, options: bundleOptions,
  };
  state.selectedProduct = null;
  state.bundle = { drink1: null, drink2: null, drink1Options: {}, drink2Options: {} };
  state.screen = "menu";
  saveCart();
  render();
}

/* ---------- cart quantity ---------- */
function changeCartQty(key, delta) {
  const item = state.cart[key];
  if (!item) return;
  const product = state.menu.find((p) => String(p.id) === String(item.productId));
  if (!product) return;
  const nextQty = Number(item.qty || 0) + delta;
  if (product.stock != null && product.stock >= 0 && nextQty > product.stock) { alert("Sorry, this item is sold out."); return; }
  item.qty = Math.max(0, nextQty);
  if (item.qty === 0) delete state.cart[key];
  saveCart();
  render();
}

/* ---------- screen ---------- */
function setScreen(screen) { state.screen = screen; render(); }
function setCategory(category) { state.activeCategory = category; render(); }

/* ---------- promo ---------- */
async function applyPromoCode() {
  const code = (state.form.promoCode || "").trim().toUpperCase();
  if (!code) { state.promoMsg = "Please enter a promo code."; render(); return; }
  if (!isValidPhone(state.form.phone)) { state.promoMsg = "Enter a valid Singapore phone number first."; render(); return; }
  if (!IS_CONFIGURED) { state.promoMsg = "Connect Supabase to validate promo codes."; render(); return; }

  try {
    const { data, error } = await db.from("promo_codes").select("*").eq("code", code).eq("is_active", true).limit(1);
    if (error) throw error;
    const promo = data?.[0];
    if (!promo) { state.promo = null; state.promoMsg = "That promo code isn't valid."; render(); return; }

    const now = new Date();
    if (promo.valid_from && new Date(promo.valid_from) > now) { state.promo = null; state.promoMsg = "That promo code is not active yet."; render(); return; }
    if (promo.valid_until && new Date(promo.valid_until) < now) { state.promo = null; state.promoMsg = "That promo code has expired."; render(); return; }

    const minimumSpend = Number(promo.minimum_spend || 0);
    if (cartTotal() < minimumSpend) { state.promo = null; state.promoMsg = `Minimum spend is ${money(minimumSpend)}.`; render(); return; }

    if (promo.usage_limit != null && Number(promo.used_count || 0) >= Number(promo.usage_limit)) {
      state.promo = null; state.promoMsg = "That code has reached its usage limit."; render(); return;
    }

    try {
      const { count: usedByPhone } = await db.from("promo_redemptions").select("id", { count: "exact", head: true }).ilike("code", code).eq("phone", normalisePhone(state.form.phone));
      if ((usedByPhone || 0) > 0) { state.promo = null; state.promoMsg = "You've already used this code."; render(); return; }
    } catch (e) { /* best-effort — table may not exist */ }

    let amount = String(promo.discount_type).toLowerCase() === "percent"
      ? cartTotal() * (Number(promo.discount_value || 0) / 100)
      : Number(promo.discount_value || 0);
    amount = Math.min(cartTotal(), Math.max(0, amount));

    state.promo = { id: promo.id, code: promo.code, discount_type: promo.discount_type, discount_value: Number(promo.discount_value || 0), used_count: promo.used_count, amount };
    state.promoMsg = `Applied — ${String(promo.discount_type).toLowerCase() === "percent" ? `${promo.discount_value}% off` : `${money(promo.discount_value)} off`}`;
    render();
  } catch (e) {
    state.promoMsg = "Could not check code: " + ((e && e.message) || String(e));
    state.promo = null;
    render();
  }
}
function removePromoCode() { state.promo = null; state.promoMsg = ""; state.form.promoCode = ""; render(); }

/* ---------- submit order ---------- */
async function submitOrder() {
  const f = state.form;
  if (!f.name.trim()) { alert("Please enter your name."); return; }
  if (!isValidPhone(f.phone)) { alert("Please enter a valid Singapore phone number (for example, 91234567)."); return; }
  if (!f.slotId) { alert("Please select a pickup slot."); return; }
  if (cartLines().length === 0) { alert("Your cart is empty."); setScreen("menu"); return; }
  const slot = state.slots.find((item) => item.id === f.slotId);
  if (!slot) { alert("Please select a valid pickup slot."); return; }

  const orderNumber = uidCode();
  const total = orderTotal();
  // Each payment screen gets its own 15-minute PayNow request window.
  state.payment.expiresAt = Date.now() + 15 * 60 * 1000;

  // NOTE: your Supabase orders table column for phone is customer_phone.
  const orderPayload = {
    order_number: orderNumber,
    customer_name: f.name.trim(),
    customer_phone: normalisePhone(f.phone),
    collection_date: slot.date,
    collection_time: slot.time,
    instagram: f.instagram ? f.instagram.trim().replace(/^@/, "") : null,
    total,
    payment_status: "awaiting_payment",
    order_status: "pending",
    notes: f.notes.trim() || null,
    payment_method: "PayNow",
    payment_reference: orderNumber,
  };
  if (state.customerId) orderPayload.customer_id = state.customerId;

  if (!IS_CONFIGURED) {
    state.lastOrder = { ...orderPayload, id: null, items: cartLines().map((line) => ({ ...line })), slot };
    state.screen = "payment";
    render();
    return;
  }

  try {
    const { data: order, error: orderError } = await db.from("orders").insert(orderPayload).select("*").single();
    if (orderError) throw orderError;

    const orderItemsPayload = cartLines().map((line) => ({
      order_id: order.id, product_id: line.productId, product_name: line.productName,
      quantity: Number(line.qty), unit_price: Number(line.unitPrice), subtotal: Number(line.unitPrice) * Number(line.qty),
    }));
    const { data: orderItems, error: itemError } = await db.from("order_items").insert(orderItemsPayload).select("*");
    if (itemError) throw itemError;

    const optionRows = [];
    cartLines().forEach((line, index) => {
      const orderItem = orderItems[index];
      if (!orderItem) return;
      const product = state.menu.find((p) => String(p.id) === String(line.productId));
      if (!isBundle(product)) {
        (line.options || []).forEach((option) => {
          optionRows.push({ order_item_id: orderItem.id, option_id: option.optionId, option_name: option.optionName, price: Number(option.price || 0) });
        });
        return;
      }
      (line.options || []).forEach((drink) => {
        (drink.options || []).forEach((option) => {
          optionRows.push({
            order_item_id: orderItem.id, option_id: option.optionId,
            option_name: `Drink ${drink.drinkNumber} · ${drink.productName} · ${option.optionName}`, price: Number(option.price || 0),
          });
        });
      });
    });
    if (optionRows.length > 0) {
      const { error: optionError } = await db.from("order_item_options").insert(optionRows);
      if (optionError) throw optionError;
    }

    if (state.promo) {
      try {
        await db.from("promo_redemptions").insert({ code: state.promo.code, phone: normalisePhone(f.phone), order_id: order.id });
        await db.from("promo_codes").update({ used_count: (Number(state.promo.used_count) || 0) + 1 }).eq("id", state.promo.id);
      } catch (e) { /* non-fatal — order already placed */ }
    }

    state.lastOrder = { ...order, items: cartLines().map((line) => ({ ...line })), slot };
    state.screen = "payment";
    render();
  } catch (error) {
    console.error("Order submission error:", error);
    alert("Something went wrong submitting your order. Please try again.\n\n" + (error?.message || String(error)));
  }
}

/* ---------- mark paid ---------- */
function onPaymentReference(value) {
  state.payment.transactionReference = value;
}

function onPaymentProof(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  if (!String(file.type || "").startsWith("image/")) {
    alert("Please upload an image file for the payment screenshot.");
    input.value = "";
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    alert("Please choose an image smaller than 8 MB.");
    input.value = "";
    return;
  }
  state.payment.proofFile = file;
  render();
}

async function markPaid() {
  if (!state.lastOrder) return;
  const order = state.lastOrder;
  const proofFile = state.payment.proofFile;
  if (!proofFile) { alert("Please upload your payment screenshot before submitting."); return; }
  if (IS_CONFIGURED && order.id) {
    const safeFileName = String(proofFile.name || "payment-proof.jpg").replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${state.customerId || "legacy"}/${order.id}/${Date.now()}-${safeFileName}`;
    const { data: upload, error: uploadError } = await db.storage.from("payment-proofs").upload(filePath, proofFile, { contentType: proofFile.type, upsert: false });
    if (uploadError) { alert("Could not upload your payment screenshot. Please try again.\n\n" + uploadError.message); return; }
    const { error } = await db.rpc("submit_payment_proof", {
      p_order_id: order.id,
      p_transaction_reference: state.payment.transactionReference.trim() || null,
      p_screenshot_path: upload.path,
    });
    if (error) { alert("Could not update payment status.\n" + error.message); return; }
  }
  state.lastOrder = { ...order, payment_status: "submitted", order_status: "awaiting_confirmation" };
  state.cart = {};
  clearSavedCart();
  state.payment = { transactionReference: "", proofFile: null, expiresAt: null };
  state.screen = "confirmation";
  render();
}

/* ---------- PayNow SGQR generation (EMVCo / SGQR spec) ---------- */
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
function buildPayNowPayload({ mobile, amount, refNumber, merchantName, expiresAt }) {
  const expiry = (() => {
    const d = new Date(expiresAt || Date.now() + 15 * 60 * 1000);
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
function payNowQrSvg(amount, refNumber, expiresAt) {
  const mobile = (state.store.paynow_number || "").replace(/\s+/g, "");
  if (!mobile) throw new Error("no paynow number configured");
  const merchantName = state.store.paynow_name || state.store.store_name || "SHIZUKU LAB";
  const payload = buildPayNowPayload({ mobile, amount, refNumber, merchantName, expiresAt });
  const qr = qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  return qr.createSvgTag({ cellSize: 5, margin: 2 });
}

/* ---------- store info ---------- */
function storeInfoPanel() {
  const igHandle = String(state.store.instagram || "shizukulab.matcha").replace(/^@/, "");
  const whatsappNumber = String(state.store.whatsapp_number || "").replace(/\D/g, "");
  const whatsappLink = state.store.show_whatsapp && whatsappNumber
    ? `<a class="store-insta" style="display:inline-block;margin-left:10px;" href="https://wa.me/${encodeURIComponent(whatsappNumber)}" target="_blank" rel="noopener">WhatsApp us</a>`
    : "";
  const bannerImage = state.store.hero_image_url || state.menu.find((item) => item.image_url)?.image_url || "matcha-latte.jpg";
  const logoUrl = state.store.logo_url || "logo.png";
  const logoCircleSize = Math.max(56, Math.min(150, Number(state.store.logo_circle_size || 68)));
  const logoImageScale = Math.max(0.55, Math.min(2.4, Number(state.store.logo_image_scale || 1)));
  const logoImageX = Math.max(-45, Math.min(45, Number(state.store.logo_image_x || 0)));
  const logoImageY = Math.max(-45, Math.min(45, Number(state.store.logo_image_y || 0)));
  const bannerX = Math.max(0, Math.min(100, Number(state.store.hero_image_x ?? 50)));
  const bannerY = Math.max(0, Math.min(100, Number(state.store.hero_image_y ?? state.store.hero_image_position ?? 68)));
  const bannerHeight = Math.max(130, Math.min(320, Number(state.store.hero_banner_height || 190)));
  const tickerText = escapeHtml(state.store.ticker_text || "PRE-ORDER ONLY · FRESHLY WHISKED · SHIZUKU LAB");
  const storeDescription = escapeHtml(state.store.store_description || "Little cups, big comfort. Freshly whisked matcha made with care — one cup at a time.");
  return `
    ${state.store.show_ticker === false ? "" : `<div class="promo-ticker"><div class="promo-ticker-track"><span>${tickerText}</span><span>${tickerText}</span><span>${tickerText}</span></div></div>`}
    <div class="store-panel">
      <div class="store-banner" style="--banner-height:${bannerHeight}px;background-position:${bannerX}% ${bannerY}%;background-image:linear-gradient(90deg,rgba(52,69,39,.14),rgba(52,69,39,.05)),url('${escapeHtml(bannerImage)}');"><span class="store-logo-overlap" style="--logo-circle-size:${logoCircleSize}px;"><img src="${escapeHtml(logoUrl)}" style="transform:translate(${logoImageX}%,${logoImageY}%) scale(${logoImageScale});" alt="${escapeHtml(state.store.store_name)} logo"></span></div>
      <div class="store-panel-body" style="padding-top:${Math.round(logoCircleSize / 2 + 12)}px;">
        <a class="store-insta" href="https://instagram.com/${encodeURIComponent(igHandle)}" target="_blank" rel="noopener">@${escapeHtml(igHandle)}</a>${whatsappLink}
        <div class="store-dropoff">${escapeHtml(state.store.collection_address || "")}</div>
        <p class="store-desc">${storeDescription}</p>
        <div class="hours-card-dark">
          <div class="hours-row"><span class="hours-label">NEXT COLLECTION</span><span class="hours-status-dark open">PRE-ORDER</span></div>
          <div class="hours-day">Saturday</div><div class="hours-time">${escapeHtml(state.store.saturday_collection_time || "10:00 AM - 12:00 PM")}</div>
          <div class="hours-day" style="margin-top:8px;">Sunday</div><div class="hours-time">${escapeHtml(state.store.sunday_collection_time || "10:00 AM - 1:00 PM")}</div>
        </div>
      </div>
    </div>
  `;
}

/* ---------- header ---------- */
function header({ showCart = false } = {}) {
  return `
    <div class="header">
      <div class="header-row">
        <div>
          <div class="display brand-title">Shizuku Lab</div>
          <div class="brand-sub">雫ラボ · crafted drop by drop</div>
        </div>
        <div style="display:flex;align-items:center;gap:9px;">
          <button onclick="setScreen('track')" style="border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--matcha);font:600 13px 'Work Sans',sans-serif;padding:11px 15px;white-space:nowrap;">注文を追跡 · Track order</button>
          ${showCart ? `
            <button class="cart-btn" onclick="setScreen('cart')" aria-label="Cart">
              ${ICONS.bag}
              ${cartCount() > 0 ? `<span class="cart-badge">${cartCount()}</span>` : ""}
            </button>` : ""}
        </div>
      </div>
      <svg class="drip-row" viewBox="0 0 300 30" aria-hidden="true">
        <g><circle class="drip" cx="40" cy="4" r="2.4" fill="#4B5D3A"/><ellipse class="ripple" cx="40" cy="26" rx="7" ry="2.4" fill="none" stroke="#8C9B6E" stroke-width="1"/></g>
        <g><circle class="drip drip2" cx="150" cy="4" r="2.4" fill="#4B5D3A"/><ellipse class="ripple drip2" cx="150" cy="26" rx="7" ry="2.4" fill="none" stroke="#8C9B6E" stroke-width="1"/></g>
        <g><circle class="drip drip3" cx="260" cy="4" r="2.4" fill="#4B5D3A"/><ellipse class="ripple drip3" cx="260" cy="26" rx="7" ry="2.4" fill="none" stroke="#8C9B6E" stroke-width="1"/></g>
        <line x1="0" y1="27" x2="300" y2="27" stroke="#E1D9C8" stroke-width="1"/>
      </svg>
    </div>
  `;
}

/* ---------- menu ---------- */
function renderMenuCard(item) {
  if (state.menuView === "gallery") return `
    <div style="background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;min-width:0;">
      <img src="${escapeHtml(item.image_url || "matcha-lab.jpg")}" alt="${escapeHtml(item.name)}" style="width:100%;aspect-ratio:1/1;object-fit:cover;background:var(--matcha-bg);">
      <div style="padding:11px 11px 12px;display:flex;flex:1;flex-direction:column;">
        <button type="button" style="font:600 13px/1.25 'Work Sans',sans-serif;cursor:pointer;border:0;background:none;padding:0;text-align:left;color:var(--ink);" onclick="openProductOptions('${escapeHtml(item.id)}')">${escapeHtml(item.name)} <span style="color:var(--ink);">→</span></button>
        <div style="font-size:10.5px;color:var(--ink);line-height:1.4;margin:5px 0 10px;">${escapeHtml(item.description)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:7px;margin-top:auto;">${productPriceMarkup(item, "item-price gallery-price")}${state.cart[`${item.id}__`]?.qty > 0 ? stepper(`${item.id}__`, state.cart[`${item.id}__`].qty) : `<button class="add-btn" style="padding:6px 10px;font-size:11px;" onclick="openProductOptions('${escapeHtml(item.id)}')">Add</button>`}</div>
      </div>
    </div>`;
  return `
    <div class="item-card">
      <img class="item-thumb" src="${escapeHtml(item.image_url || "matcha-lab.jpg")}" alt="${escapeHtml(item.name)}">
      <div class="item-info"><button class="item-name" type="button" style="cursor:pointer;border:0;background:none;padding:0;text-align:left;font:inherit;width:100%;color:var(--ink);" onclick="openProductOptions('${escapeHtml(item.id)}')">${escapeHtml(item.name)} <span style="color:var(--ink);">→</span></button><div class="item-desc" style="color:var(--ink);">${escapeHtml(item.description)}</div><div class="item-row">${productPriceMarkup(item)}${state.cart[`${item.id}__`]?.qty > 0 ? stepper(`${item.id}__`, state.cart[`${item.id}__`].qty) : `<button class="add-btn" onclick="openProductOptions('${escapeHtml(item.id)}')">Add</button>`}</div></div>
    </div>`;
}
function renderMenu() {
  const productGroupNames = state.productGroups.map((group) => group.name);
  const extraNames = state.menu.map(productGroupName).filter((name) => !productGroupNames.includes(name));
  const categories = ["All", ...productGroupNames, ...Array.from(new Set(extraNames))];
  const items = state.activeCategory === "All" ? state.menu : state.menu.filter((item) => productGroupName(item) === state.activeCategory);
  const groups = state.activeCategory === "All" ? categories.slice(1) : [state.activeCategory];
  return `
    ${header({ showCart: true })}
    ${storeInfoPanel()}
    ${state.loadError ? `<div class="setup-banner" style="border-color:#B33;background:#FBEAEA;color:#7a1f1f;">Could not load products: <code>${escapeHtml(state.loadError)}</code></div>` : ""}
    <div class="cats">
      ${categories.map((category) => `<button class="pill ${category === state.activeCategory ? "active" : ""}" onclick="setCategory('${escapeHtml(category)}')">${escapeHtml(category)}</button>`).join("")}
    </div>
    <div style="display:flex;justify-content:flex-end;gap:7px;padding:2px 20px 3px;">
      <button class="pill ${state.menuView === "list" ? "active" : ""}" style="padding:6px 11px;font-size:11px;" onclick="state.menuView='list';render();">☷ List</button>
      <button class="pill ${state.menuView === "gallery" ? "active" : ""}" style="padding:6px 11px;font-size:11px;" onclick="state.menuView='gallery';render();">▦ Gallery</button>
    </div>
    <div class="menu-list" style="padding-top:10px;"><div class="menu-kana">メニュー · DRINK MENU</div>
      ${items.length === 0 ? `<div class="empty">No items available yet.</div>` : groups.map((group) => { const groupItems = items.filter((item) => productGroupName(item) === group); if (!groupItems.length) return ""; return `<section class="product-group"><h2 class="product-group-title">${escapeHtml(group)}</h2><div class="product-group-items" style="${state.menuView === "gallery" ? "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;" : ""}">${groupItems.map(renderMenuCard).join("")}</div></section>`; }).join("")}
    </div>
    ${cartCount() > 0 ? `
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" onclick="setScreen('cart')">${ICONS.bag} View cart · ${money(cartTotal())}</button>
    </div></div>` : ""}
    ${renderFAQ()}
  `;
}

/* ---------- FAQ ---------- */
function renderFAQ() {
  return `
    <section class="faq-section">
      <div class="faq-title"><span>よくある質問</span> · FAQ</div>
      ${(state.faq.length ? state.faq.map((item) => ({ q: item.question, a: item.answer })) : (STORE_FAQ || [])).map((item) => `<details class="faq-item"><summary onclick="openFaq(this.parentElement); return false;">${escapeHtml(item.q)}</summary><div class="faq-answer">${escapeHtml(item.a).replace(/\n/g, "<br>")}</div></details>`).join("")}
    </section>
  `;
}

function openFaq(selectedItem) {
  const shouldOpen = !selectedItem.open;
  document.querySelectorAll(".faq-item").forEach((item) => { item.open = false; });
  if (shouldOpen) selectedItem.open = true;
}

/* ---------- options screen ---------- */
function renderOptions() {
  const product = state.selectedProduct;
  if (!product) return renderMenu();
  const price = calculateProductPrice(product);
  return `
    ${header()}
    <div class="screen">
      <button class="back-link" onclick="setScreen('menu')">${ICONS.back} Back to menu</button>
      <div class="product-detail-card">
        <img class="product-detail-image" src="${escapeHtml(product.image_url || "matcha-lab.jpg")}" alt="${escapeHtml(product.name)}">
        <div class="item-info product-detail-copy">
          <div class="item-name">${escapeHtml(product.name)}</div>
          <div class="item-desc">${escapeHtml(product.description)}</div>
        </div>
      </div>
      ${state.optionGroups.length === 0 ? `<div class="hint">No customisation options available.</div>` : state.optionGroups.map((group) => {
        const options = getOptionsForGroup(group.id);
        const selected = state.selectedOptions[group.id];
        return `
          <div class="field" style="margin-top:20px;">
            <label><span class="option-kana">カスタマイズ</span>${escapeHtml(group.name)}${group.required ? " *" : " (optional)"}</label>
            <div>
              ${options.map((option) => `
                <button type="button" class="slot ${selected && String(selected.optionId) === String(option.id) ? "active" : ""}" onclick="selectOption('${escapeHtml(group.id)}','${escapeHtml(option.id)}')">
                  <div>
                    <div class="slot-day">${escapeHtml(option.name)}</div>
                    <div class="slot-time">${Number(option.price || 0) > 0 ? `+${money(option.price)}` : "Included"}</div>
                  </div>
                </button>
              `).join("")}
            </div>
          </div>
        `;
      }).join("")}
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" onclick="addConfiguredProductToCart()">Add to cart · ${money(price)}</button>
    </div></div>
  `;
}

/* ---------- bundle screen ---------- */
function renderBundle() {
  const bundle = state.selectedProduct;
  if (!bundle) return renderMenu();
  const drinks = getBundleDrinkProducts();
  const drink1 = state.bundle.drink1, drink2 = state.bundle.drink2;
  return `
    ${header()}
    <div class="screen">
      <button class="back-link" onclick="setScreen('menu')">${ICONS.back} Back to menu</button>
      <div class="product-detail-card">
        <img class="product-detail-image" src="${escapeHtml(bundle.image_url || "matcha-lab.jpg")}" alt="${escapeHtml(bundle.name)}">
        <div class="item-info product-detail-copy">
          <div class="item-name">${escapeHtml(bundle.name)}</div>
          <div class="item-desc">${escapeHtml(bundle.description || "Choose any two drinks from the selections below.")}</div>
          ${productPriceMarkup(bundle)}
        </div>
      </div>
      <div class="bundle-section">
        <div class="bundle-heading">Drink 1</div>
        <div class="bundle-subheading">Choose your drink</div>
        <div class="bundle-drinks">
          ${drinks.map((drink) => `
            <button type="button" class="slot ${drink1 && String(drink1.id) === String(drink.id) ? "active" : ""}" onclick="selectBundleDrink(1,'${escapeHtml(drink.id)}')">
              <div><div class="slot-day">${escapeHtml(drink.name)}</div><div class="slot-time">${hasDiscount(drink) ? `${money(salePrice(drink))} <span class="original-price">${money(originalPrice(drink))}</span>` : money(salePrice(drink))}</div></div>
            </button>
          `).join("")}
        </div>
        ${drink1 ? renderBundleDrinkOptions(1, drink1, state.bundle.drink1Options) : ""}
      </div>
      <div class="bundle-section">
        <div class="bundle-heading">Drink 2</div>
        <div class="bundle-subheading">Choose your drink</div>
        <div class="bundle-drinks">
          ${drinks.map((drink) => `
            <button type="button" class="slot ${drink2 && String(drink2.id) === String(drink.id) ? "active" : ""}" onclick="selectBundleDrink(2,'${escapeHtml(drink.id)}')">
              <div><div class="slot-day">${escapeHtml(drink.name)}</div><div class="slot-time">${hasDiscount(drink) ? `${money(salePrice(drink))} <span class="original-price">${money(originalPrice(drink))}</span>` : money(salePrice(drink))}</div></div>
            </button>
          `).join("")}
        </div>
        ${drink2 ? renderBundleDrinkOptions(2, drink2, state.bundle.drink2Options) : ""}
      </div>
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" onclick="addBundleToCart()">Add bundle to cart · ${money(salePrice(bundle))}</button>
    </div></div>
  `;
}
function renderBundleDrinkOptions(drinkNumber, drink, selectedOptions) {
  return `
    <div class="bundle-customisation" style="margin-top:18px;">
      <div class="bundle-selected">${escapeHtml(drink.name)}</div>
      ${state.optionGroups.map((group) => {
        const options = getOptionsForGroup(group.id);
        const selected = selectedOptions[group.id];
        return `
          <div class="field" style="margin-top:16px;">
            <label><span class="option-kana">カスタマイズ</span>${escapeHtml(group.name)}${group.required ? " *" : ""}</label>
            <div>
              ${options.map((option) => `
                <button type="button" class="slot ${selected && String(selected.optionId) === String(option.id) ? "active" : ""}" onclick="selectBundleOption(${drinkNumber},'${escapeHtml(group.id)}','${escapeHtml(option.id)}')">
                  <div>
                    <div class="slot-day">${escapeHtml(option.name)}</div>
                    <div class="slot-time">${Number(option.price || 0) > 0 ? `+${money(option.price)}` : "Included"}</div>
                  </div>
                </button>
              `).join("")}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* ---------- stepper ---------- */
function stepper(key, qty) {
  return `
    <div class="stepper">
      <button onclick="changeCartQty('${escapeHtml(key)}',-1)">${ICONS.minus}</button>
      <span>${qty}</span>
      <button onclick="changeCartQty('${escapeHtml(key)}',1)">${ICONS.plus}</button>
    </div>
  `;
}

/* ---------- cart ---------- */
function renderCart() {
  const lines = cartLines();
  return `
    ${header({ showCart: true })}
    <div class="screen">
      <button class="back-link" onclick="setScreen('menu')">${ICONS.back} Continue browsing</button>
      ${lines.length === 0 ? `<div class="empty">Your cart is empty — the whisk is waiting.</div>` : lines.map((line) => `
        <div class="item-card">
          <img class="item-thumb" src="${escapeHtml(line.imageUrl || "matcha-lab.jpg")}" alt="${escapeHtml(line.productName)}">
          <div class="item-info">
            <div class="item-name">${escapeHtml(line.productName)}</div>
            ${line.options?.length ? `<div class="item-desc">${
              isBundle(state.menu.find((p) => String(p.id) === String(line.productId)))
                ? line.options.map((drink) => `<div>Drink ${drink.drinkNumber}: ${escapeHtml(drink.productName)}${drink.options?.length ? ` · ${drink.options.map((o) => escapeHtml(o.optionName)).join(" · ")}` : ""}</div>`).join("")
                : line.options.map((option) => escapeHtml(option.optionName)).join(" · ")
            }</div>` : ""}
            <div class="item-price">${money(line.unitPrice)}</div>
          </div>
          ${stepper(line.key, line.qty)}
        </div>
      `).join("")}
    </div>
    ${lines.length > 0 ? `
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" onclick="setScreen('checkout')">Checkout · ${money(cartTotal())}</button>
    </div></div>` : ""}
  `;
}

/* ---------- checkout ---------- */
function renderCheckout() {
  const f = state.form;
  const canSubmit = f.name.trim() && isValidPhone(f.phone) && f.slotId;
  const pickupDates = Array.from(new Map(state.slots.map((slot) => [slot.date, slot.label])).entries());
  const availableTimes = state.slots.filter((slot) => slot.date === f.pickupDate);
  return `
    ${header()}
    <div class="screen">
      <button class="back-link" onclick="setScreen('cart')">${ICONS.back} Back to cart</button>
      <div class="field"><label>Name</label><input id="f-name" value="${escapeHtml(f.name)}" placeholder="Your name" oninput="onFormInput('name', this.value)"></div>
      <div class="field"><label>Phone</label><input id="f-phone" value="${escapeHtml(f.phone)}" placeholder="e.g. 91234567" inputmode="tel" autocomplete="tel" oninput="this.value=cleanPhoneInput(this.value);onFormInput('phone', this.value)"></div>
      <div class="field"><label>Instagram (optional)</label><input id="f-instagram" value="${escapeHtml(f.instagram)}" placeholder="@yourhandle" oninput="onFormInput('instagram', this.value)"></div>
      <div class="field"><label>Collection date</label>
        <select style="width:100%;min-height:74px;padding:14px 18px;border-radius:14px;border:1px solid var(--line);background:#fff;color:var(--ink);font:inherit;font-size:18px;" onchange="onPickupDateChange(this.value)">
          <option value="">Select a date</option>
          ${pickupDates.map(([date, label]) => `<option value="${escapeHtml(date)}" ${f.pickupDate === date ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>Collection time</label>
        <select style="width:100%;min-height:74px;padding:14px 18px;border-radius:14px;border:1px solid var(--line);background:#fff;color:var(--ink);font:inherit;font-size:18px;" ${f.pickupDate ? "" : "disabled"} onchange="onFormInput('slotId', this.value)">
          <option value="">${f.pickupDate ? "Select a time" : "Select a date first"}</option>
          ${availableTimes.map((slot) => `<option value="${escapeHtml(slot.id)}" ${f.slotId === slot.id ? "selected" : ""}>${escapeHtml(slot.time)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>Notes (optional)</label><textarea id="f-notes" rows="2" placeholder="Less ice, allergies, etc." oninput="onFormInput('notes', this.value)">${escapeHtml(f.notes)}</textarea></div>
      <div class="field">
        <label>Promo code (optional)</label>
        ${state.promo
          ? `<div class="slot active" style="justify-content:space-between;"><span><b>${escapeHtml(state.promo.code)}</b> applied</span><button class="link-btn" style="border:none;background:none;color:#B33;" onclick="removePromoCode()">Remove</button></div>`
          : `<div style="display:flex;gap:8px;">
              <input id="f-promo" value="${escapeHtml(f.promoCode)}" placeholder="e.g. WELCOME10" style="flex:1;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase();onFormInput('promoCode', this.value)">
              <button class="btn-primary" style="flex:none;padding:0 18px;" onclick="applyPromoCode()">Apply</button>
            </div>`}
        ${state.promoMsg ? `<div class="ref-note">${escapeHtml(state.promoMsg)}</div>` : ""}
      </div>
      <div class="summary-card">
        ${cartLines().map((line) => `
          <div class="row"><span class="label">${escapeHtml(line.productName)} × ${line.qty}</span><span>${money(line.unitPrice * line.qty)}</span></div>
          ${line.options?.length ? `<div class="hint" style="margin-top:-4px;margin-bottom:8px;">${
            isBundle(state.menu.find((p) => String(p.id) === String(line.productId)))
              ? line.options.map((drink) => `Drink ${drink.drinkNumber}: ${escapeHtml(drink.productName)}`).join("<br>")
              : line.options.map((option) => escapeHtml(option.optionName)).join(" · ")
          }</div>` : ""}
        `).join("")}
        ${state.promo ? `<div class="row"><span class="label">Discount (${escapeHtml(state.promo.code)})</span><span>-${money(state.promo.amount)}</span></div>` : ""}
        <div class="divider"></div>
        <div class="row bold"><span class="label">Total</span><span>${money(orderTotal())}</span></div>
      </div>
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" id="checkout-btn" ${canSubmit ? "" : "disabled"} onclick="submitOrder()">Continue to payment · ${money(orderTotal())}</button>
    </div></div>
  `;
}

/* ---------- form input ---------- */
function onFormInput(key, value) {
  state.form[key] = value;
  if (state.screen !== "checkout") return;
  const canSubmit = state.form.name.trim() && isValidPhone(state.form.phone) && state.form.slotId;
  const button = document.getElementById("checkout-btn");
  if (button) { button.toggleAttribute("disabled", !canSubmit); button.textContent = `Continue to payment · ${money(orderTotal())}`; }
  if (key === "slotId") render();
}
function onPickupDateChange(date) {
  state.form.pickupDate = date;
  state.form.slotId = "";
  render();
}

/* ---------- payment ---------- */
function paymentSecondsLeft() {
  return Math.max(0, Math.ceil((Number(state.payment.expiresAt || 0) - Date.now()) / 1000));
}
function paymentCountdownText() {
  const seconds = paymentSecondsLeft();
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
function refreshPayNowQr() {
  state.payment.expiresAt = Date.now() + 15 * 60 * 1000;
  render();
}
function startPaymentCountdown() {
  if (paymentCountdownTimer) clearInterval(paymentCountdownTimer);
  const countdown = document.getElementById("paynow-countdown");
  if (!countdown) return;
  const refreshButton = document.getElementById("refresh-paynow-qr");
  const update = () => {
    const seconds = paymentSecondsLeft();
    if (seconds > 0) {
      countdown.textContent = `Please complete payment within ${paymentCountdownText()}.`;
      if (refreshButton) refreshButton.hidden = true;
      return;
    }
    countdown.textContent = "This payment QR has expired. Please refresh it before paying.";
    if (refreshButton) refreshButton.hidden = false;
    if (paymentCountdownTimer) clearInterval(paymentCountdownTimer);
    paymentCountdownTimer = null;
  };
  update();
  if (paymentSecondsLeft() > 0) paymentCountdownTimer = setInterval(update, 1000);
}
function renderPayment() {
  const order = state.lastOrder;
  if (!order) return renderMenu();
  if (!state.payment.expiresAt) state.payment.expiresAt = Date.now() + 15 * 60 * 1000;
  const paymentExpired = paymentSecondsLeft() === 0;
  const paynowName = state.store.paynow_name || state.store.store_name || "Shizuku Lab";
  const paynowNumber = state.store.paynow_number || "";
  let qrHtml;
  try {
    qrHtml = paynowNumber ? `<div class="qr-box ${paymentExpired ? "qr-expired" : ""}">${payNowQrSvg(order.total, order.order_number, state.payment.expiresAt)}</div>` : null;
  } catch (e) { qrHtml = null; }
  if (!qrHtml) {
    qrHtml = state.store.paynow_url
      ? `<div class="qr-box"><img src="${escapeHtml(state.store.paynow_url)}" alt="PayNow QR" style="max-width:220px;width:100%;height:auto;"></div>`
      : `<div class="qr-box"><div class="qr-placeholder"></div></div>`;
  }
  return `
    ${header()}
    <div class="screen">
      <div class="summary-card">
        ${qrHtml}
        <div class="hint">Scan with your banking app, or PayNow to <b>${escapeHtml(paynowName)}</b>${paynowNumber ? `<br>${escapeHtml(paynowNumber)}` : ""}</div>
        <div class="payment-timer" id="paynow-countdown" aria-live="polite">Please complete payment within ${paymentCountdownText()}.</div>
        <button class="btn-secondary refresh-qr-btn" id="refresh-paynow-qr" ${paymentExpired ? "" : "hidden"} onclick="refreshPayNowQr()">Refresh QR · 15 minutes</button>
        <div class="divider"></div>
        <div class="row"><span class="label">Order</span><span class="mono">${escapeHtml(order.order_number || order.id || "")}</span></div>
        <div class="row bold"><span class="label">Amount</span><span>${money(order.total)}</span></div>
        <div class="ref-note">Enter <b>${escapeHtml(order.order_number || order.id || "")}</b> as the payment reference.</div>
      </div>
      <div class="summary-card" style="margin-top:16px;">
        <div class="field">
          <label>PayNow transaction reference <span class="hint">(optional)</span></label>
          <input value="${escapeHtml(state.payment.transactionReference)}" placeholder="e.g. 123456789" oninput="onPaymentReference(this.value)">
        </div>
        <div class="field" style="margin-bottom:0;">
          <label>Payment screenshot <span style="color:#B33;">*</span></label>
          <input type="file" accept="image/*" onchange="onPaymentProof(this)">
          <div class="hint" style="margin-top:8px;">${state.payment.proofFile ? `Selected: <b>${escapeHtml(state.payment.proofFile.name)}</b>` : "Upload a clear screenshot of your successful PayNow payment."}</div>
        </div>
      </div>
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" ${state.payment.proofFile ? "" : "disabled"} onclick="markPaid()">Submit payment proof</button>
      <div class="hint" style="margin-top:8px;margin-bottom:0;">We'll confirm your order once payment is verified.</div>
    </div></div>
  `;
}

/* ---------- confirmation ---------- */
function renderConfirmation() {
  const order = state.lastOrder;
  if (!order) return renderMenu();
  return `
    ${header()}
    <div class="screen center">
      <div class="check-circle">${ICONS.check}</div>
      <div class="display" style="font-size:20px;margin-bottom:4px;">Thanks, ${escapeHtml((order.customer_name || "there").split(" ")[0])}</div>
      <div class="hint" style="margin-bottom:20px;">We've received your payment submission and will confirm shortly.</div>
      <div class="code-box">
        <div class="mono code-text">${escapeHtml(order.order_number || order.id || "")}</div>
        <div class="divider"></div>
        <div class="row"><span class="label">Pickup</span><span>${escapeHtml(order.collection_date || "")} · ${escapeHtml(order.collection_time || "")}</span></div>
        <div class="row"><span class="label">Status</span><span>Payment sent — pending confirmation</span></div>
        <div class="row"><span class="label">Total</span><span>${money(order.total)}</span></div>
      </div>
      <button class="primary-btn" style="margin-top:22px;" onclick="setScreen('menu')">Back to menu</button>
    </div>
  `;
}

/* ---------- order tracking ---------- */
function trackingStatus(order) {
  if (!order) return { title: "", note: "", step: 0 };
  if (order.order_status === "cancelled") return { title: "Order cancelled", note: "Please contact us if you have any questions.", step: 0 };
  if (order.order_status === "collected") return { title: "Collected", note: "Thank you for collecting your Shizuku order. ✨", step: 4 };
  if (order.order_status === "ready") return { title: "Ready for collection", note: "Your order is ready — see you at your pickup time!", step: 3 };
  if (order.order_status === "preparing") return { title: "Preparing your order", note: "We’re freshly preparing your drinks now.", step: 2 };
  if (order.payment_status === "submitted" || order.order_status === "awaiting_confirmation") return { title: "Payment under review", note: "We’ll confirm your order once your payment proof is verified.", step: 0 };
  if (order.payment_status === "paid" || order.order_status === "confirmed") return { title: "Order confirmed", note: "Payment verified — we’ll prepare your order closer to pickup.", step: 1 };
  return { title: "Awaiting payment", note: "Please complete payment and submit your payment screenshot.", step: 0 };
}
async function findOrder() {
  const t = state.tracking;
  const number = String(t.orderNumber || "").trim().toUpperCase();
  const phone = normalisePhone(t.phone);
  if (!number || !phone) { t.message = "Enter both your order number and phone number."; t.order = null; render(); return; }
  t.loading = true; t.message = ""; t.order = null; render();
  const { data, error } = await db.rpc("track_shizuku_order", { p_order_number: number, p_phone: phone }).maybeSingle();
  t.loading = false;
  if (error) t.message = "We couldn’t check this order right now. Please try again shortly.";
  else if (!data) t.message = "We couldn’t find an order with those details. Please check and try again.";
  else t.order = data;
  render();
}
function renderTrackOrder() {
  const t = state.tracking;
  const status = trackingStatus(t.order);
  const stages = ["Payment review", "Confirmed", "Preparing", "Ready"];
  return `
    ${header()}
    <div class="screen">
      <button class="back-link" onclick="setScreen('menu')">${ICONS.back} Back to menu</button>
      <div class="display" style="font-size:23px;margin:4px 0 6px;">Track my order</div>
      <div class="hint" style="text-align:left;line-height:1.5;">Enter the order number and phone number you used at checkout.</div>
      <div class="summary-card" style="margin-top:16px;">
        <div class="field"><label>Order number</label><input value="${escapeHtml(t.orderNumber)}" placeholder="e.g. SL-ABC123" style="text-transform:uppercase;" oninput="state.tracking.orderNumber=this.value.toUpperCase()"></div>
        <div class="field" style="margin-bottom:0;"><label>Phone number</label><input value="${escapeHtml(t.phone)}" placeholder="The number used at checkout" inputmode="tel" oninput="this.value=cleanPhoneInput(this.value);state.tracking.phone=this.value"></div>
        <button class="primary-btn" style="margin-top:16px;" ${t.loading ? "disabled" : ""} onclick="findOrder()">${t.loading ? "Checking…" : "Track order"}</button>
        ${t.message ? `<div class="ref-note" style="color:#B33333;">${escapeHtml(t.message)}</div>` : ""}
      </div>
      ${t.order ? `<div class="summary-card" style="margin-top:16px;"><div class="row"><span class="label">Order</span><span class="mono">${escapeHtml(t.order.order_number)}</span></div><div class="row"><span class="label">Pickup</span><span>${escapeHtml(t.order.collection_date || "")} · ${escapeHtml(t.order.collection_time || "")}</span></div><div class="divider"></div><div class="center" style="padding:12px 0 8px;"><div style="display:inline-flex;width:54px;height:54px;align-items:center;justify-content:center;background:var(--matcha);color:var(--cream);border-radius:999px;font-size:24px;">✓</div><div class="display" style="font-size:20px;margin-top:12px;">${escapeHtml(status.title)}</div><div class="hint" style="margin:8px 0 14px;line-height:1.5;">${escapeHtml(status.note)}</div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:4px 0 2px;">${stages.map((stage, index) => `<div style="text-align:center;"><div style="height:6px;border-radius:99px;background:${index <= status.step ? "var(--matcha)" : "var(--line)"};"></div><div style="font-size:9px;color:var(--muted);line-height:1.25;margin-top:6px;">${stage}</div></div>`).join("")}</div></div>` : ""}
    </div>`;
}

/* ---------- main render ---------- */
function render() {
  const app = document.getElementById("app");
  if (!app) return;
  if (state.loading) { app.innerHTML = `<div class="loading">Loading Shizuku Lab…</div>`; return; }
  let html = "";
  if (state.screen === "menu") html = renderMenu();
  else if (state.screen === "options") html = renderOptions();
  else if (state.screen === "bundle") html = renderBundle();
  else if (state.screen === "cart") html = renderCart();
  else if (state.screen === "checkout") html = renderCheckout();
  else if (state.screen === "payment") html = renderPayment();
  else if (state.screen === "confirmation") html = renderConfirmation();
  else if (state.screen === "track") html = renderTrackOrder();
  else html = renderMenu();
  app.innerHTML = html;
  if (state.screen === "payment") startPaymentCountdown();
}

init();
