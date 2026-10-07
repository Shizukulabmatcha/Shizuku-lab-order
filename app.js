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

const ORDERING_MARKET = new URLSearchParams(window.location.search).get("market") === "MY" || /(?:\/shop\/shizuku-lab-my|^\/my)(?:\/|$)/i.test(window.location.pathname) ? "MY" : "SG";
const LEGACY_CART_STORAGE_KEY = "shizuku-lab-cart-v1";
const LEGACY_PENDING_PAYMENT_STORAGE_KEY = "shizuku-lab-pending-payment-v1";
const PARTNER_SESSION_KEY = "shizuku-lab-partner-session-v1";
const PARTNER_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const cartStorageKey = (market = ORDERING_MARKET) => `shizuku-lab-cart-v1-${String(market || "SG").toLowerCase()}`;
const pendingPaymentStorageKey = (market = ORDERING_MARKET) => `shizuku-lab-pending-payment-v1-${String(market || "SG").toLowerCase()}`;
function loadSavedCart() {
  try {
    let raw = localStorage.getItem(cartStorageKey());
    if (!raw) {
      raw = localStorage.getItem(LEGACY_CART_STORAGE_KEY);
      if (raw) {
        localStorage.setItem(cartStorageKey(), raw);
        localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
      }
    }
    const saved = JSON.parse(raw || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch (error) { return {}; }
}
function saveCart() {
  try { localStorage.setItem(cartStorageKey(state.market), JSON.stringify(state.cart)); } catch (error) { /* storage may be unavailable */ }
}
function clearSavedCart() {
  try { localStorage.removeItem(cartStorageKey(state.market)); } catch (error) { /* storage may be unavailable */ }
}
function loadPendingPayment() {
  try {
    let raw = localStorage.getItem(pendingPaymentStorageKey());
    if (!raw) {
      const legacyRaw = localStorage.getItem(LEGACY_PENDING_PAYMENT_STORAGE_KEY);
      const legacy = JSON.parse(legacyRaw || "null");
      if (legacy?.order && String(legacy.order.market_code || "SG") === ORDERING_MARKET) {
        raw = legacyRaw;
        localStorage.setItem(pendingPaymentStorageKey(), legacyRaw);
        localStorage.removeItem(LEGACY_PENDING_PAYMENT_STORAGE_KEY);
      }
    }
    const saved = JSON.parse(raw || "null");
    if (!saved?.order) return null;
    if (Date.now() - Number(saved.savedAt || 0) > 48 * 60 * 60 * 1000) {
      localStorage.removeItem(pendingPaymentStorageKey());
      return null;
    }
    return saved;
  } catch (error) { return null; }
}
function savePendingPayment() {
  if (!state.lastOrder) return;
  try { localStorage.setItem(pendingPaymentStorageKey(state.market), JSON.stringify({ market: state.market, order: state.lastOrder, expiresAt: state.payment.expiresAt, transactionReference: state.payment.transactionReference, savedAt: Date.now() })); }
  catch (error) { /* storage may be unavailable */ }
}
function clearPendingPayment() { try { localStorage.removeItem(pendingPaymentStorageKey(state.market)); } catch (error) { /* storage may be unavailable */ } }

const STORE_LANGUAGE_KEY = "shizuku-lab-my-language-v1";
function savedStoreLanguage() {
  if (ORDERING_MARKET !== "MY") return "en";
  try { const value = localStorage.getItem(STORE_LANGUAGE_KEY); return ["en","ms","zh"].includes(value) ? value : "en"; }
  catch (_) { return "en"; }
}

const state = {
  menu: [],
  allMenu: [],
  market: ORDERING_MARKET,
  language: savedStoreLanguage(),
  stockLevels: {},
  cart: loadSavedCart(),
  cartNotice: "",
  screen: "menu",
  activeCategory: "All",
  productGroups: [],
  menuView: "list",
  optionGroups: [],
  options: [],
  productOptionGroups: [],
  selectedProduct: null,
  selectedOptions: {},
  expandedOptionSteps: { product: null, bundle1: null, bundle2: null },
  bundle: { drink1: null, drink2: null, drink1Options: {}, drink2Options: {} },
  slots: [],
  openingOverrides: [],
  faq: [],
  reviews: [],
  store: {
    store_name: "Shizuku Lab",
    store_tagline: "雫ラボ · crafted drop by drop",
    instagram: "shizukulab.matcha",
    paynow_name: "",
    paynow_number: "",
    paynow_url: "",
    payment_qr_mode: "dynamic",
    show_paynow_name: true,
    show_paynow_number: true,
    show_touchngo_name: true,
    show_touchngo_number: true,
    collection_address: "Blk 130A drop off point, Near Creamier TPY, Toa Payoh Lorong 1, Singapore",
    collection_area_label: "Near Creamier · Toa Payoh",
    google_maps_url: "",
    show_collection_map_home: true,
    show_collection_map_payment: true,
    saturday_collection_time: "10:00 AM - 12:00 PM",
    sunday_collection_time: "10:00 AM - 1:00 PM",
    collection_points: ["Blk 130A", "Near Creamier"],
    collection_point_details: [],
    theme_primary_color: "#4B5D3A",
    theme_background_color: "#F3EEE3",
    theme_card_color: "#FFFFFF",
    theme_text_color: "#2A2A22",
    theme_heading_font: "fraunces",
    theme_body_font: "work_sans",
    theme_heading_size: 25,
    theme_body_size: 14,
    theme_product_name_size: 15,
    theme_price_size: 14,
    theme_button_size: 14,
    system_theme: "zen",
    ordering_theme: "zen",
    default_menu_view: "list",
    show_menu_view_switch: true,
    product_detail_image_height: 180,
    product_detail_image_fit: "cover",
    product_option_text_size: 15,
    product_option_compact: true,
    menu_heading: "Menu",
    reviews_heading: "お客様の声 · REVIEWS",
    track_order_heading: "Track my order",
    track_intro_text: "Enter either your order number or the phone number used at checkout.",
    track_order_number_label: "Order number",
    track_phone_label: "Phone number",
    track_or_text: "OR",
    track_button_text: "Track order",
    track_live_updates_text: "LIVE UPDATES",
    track_refresh_text: "Refresh now",
    track_order_label: "Order",
    track_pickup_label: "Pickup",
    track_stage_payment: "Payment review",
    track_stage_confirmed: "Confirmed",
    track_stage_preparing: "Preparing",
    track_stage_ready: "Ready",
    track_awaiting_title: "Awaiting payment",
    track_awaiting_note: "Please complete payment and submit your payment screenshot.",
    track_review_title: "Payment under review",
    track_review_note: "We’ll confirm your order once your payment proof is verified.",
    track_confirmed_title: "Order confirmed",
    track_confirmed_note: "Payment verified — we’ll prepare your order closer to pickup.",
    track_preparing_title: "Preparing your order",
    track_preparing_note: "We’re freshly preparing your drinks now.",
    track_ready_title: "Ready for collection",
    track_ready_note: "Your order is ready — see you at your pickup time!",
    track_collected_title: "Collected with care ✨",
    track_collected_note: "We hope you enjoyed every sip. Looking forward to making your next Shizuku drink.",
    track_cancelled_title: "Order cancelled",
    track_cancelled_note: "This order can no longer accept payment. Please place a new order.",
    track_rejected_title: "Payment proof needs attention",
    track_rejected_note: "Please upload a new payment screenshot.",
    loyalty_heading: "Shizuku Club",
    loyalty_card_background: "#1E473E",
    loyalty_card_text_color: "#F9F4E8",
    loyalty_card_accent_color: "#CAE4B3",
    show_checkout_instagram: true,
    show_checkout_notes: true,
    show_checkout_email: true,
    payment_instructions: "Scan with your banking app, or PayNow to the account below.",
    payment_qr_size: 220,
    payment_compact_layout: false,
    show_payment_order_details: true,
    show_payment_transaction_reference: true,
    show_instagram_payment_help: true,
    payment_submit_button_text: "Submit payment proof",
    show_customer_receipt: true,
    receipt_button_text: "View receipt",
    chat_enabled: true,
    chat_heading: "Message us",
    chat_auto_reply: "Thanks for your message. We will reply as soon as possible.",
    chat_business_hours: "",
    reviews_enabled: true,
    review_cta_label: "Share your Shizuku moment",
    review_cta_font: "work_sans",
    review_cta_size: 14,
    review_cta_color: "#4B5D3A",
    review_portal_title: "Share your Shizuku experience",
    review_portal_title_font: "fraunces",
    review_portal_title_size: 27,
    review_portal_title_color: "#2A2A22",
    review_portal_intro: "Enter either your order number or phone number. We will show the drinks you collected — your order number will never be shown publicly.",
    review_lookup_label: "Order number or phone number",
    review_lookup_placeholder: "SL-XXXXXX or 91234567",
    review_find_button_text: "Find my orders",
    review_choose_order_text: "Choose the drinks to review",
    review_name_label: "Name shown with review",
    review_rating_label: "Rating",
    review_experience_label: "Your experience",
    review_submit_button_text: "Send my review",
    review_back_button_text: "Back to menu",
    marketing_opt_in_enabled: true,
    marketing_email_enabled: true,
    marketing_whatsapp_enabled: false,
    marketing_checkout_heading: "Shizuku updates",
    marketing_opt_in_label: "Keep me in the loop about monthly opening dates, new drinks and special offers.",
    marketing_opt_in_help_text: "Occasional Shizuku Lab updates by email. You can opt out anytime.",
    business_country: "Singapore",
    store_currency: "SGD",
    store_language: "English",
    malaysia_enabled: false,
    touchngo_name: "",
    touchngo_number: "",
    touchngo_qr_url: "",
    malaysia_collection_points: [],
    malaysia_collection_point_details: [],
    malaysia_collection_address: "",
    malaysia_collection_area_label: "",
    malaysia_google_maps_url: "",
    malaysia_self_delivery_enabled: false,
    malaysia_self_delivery_fee: 0,
    malaysia_delivery_areas: "",
    malaysia_delivery_instructions: "",
  },
  form: { name: "", phone: "", email: "", instagram: "", pickupDate: "", slotId: "", collectionPoint: "", fulfilmentMethod: "collection", deliveryAddress: {}, notes: "", promoCode: "", marketingOptIn: false },
  promo: null,
  promoMsg: "",
  payment: { transactionReference: "", proofFile: null, expiresAt: null },
  customerId: null,
  tracking: { orderNumber: "", phone: "", order: null, message: "", loading: false, live: false, lastCheckedAt: null },
  reviewDraft: { name: "", rating: 5, text: "", submitting: false, message: "", submitted: false },
  reviewPortal: { lookup: "", orders: [], selected: null, name: "", rating: 5, text: "", loading: false, message: "", submitted: false },
  orderChat: { messages: [], text: "", loading: false, sending: false, message: "" },
  loyalty: { phone: "", account: null, message: "", loading: false },
  ritual: { phone: "", passes: [], message: "", loading: false, selectedPassId: null, redemptionMode: false, savedCart: null, idempotencyKey: "", pickupDate: "", slotId: "", collectionPoint: "" },
  partner: null,
  lastOrder: null,
  pendingPaymentAvailable: false,
  loading: true,
  loadError: null,
};
let paymentCountdownTimer = null;
let stockRefreshTimer = null;
let orderTrackingTimer = null;
let customerChatChannel = null;
let lastRenderedScreen = null;

/* ---------- helpers ---------- */
function money(n) {
  const currency = state.market === "MY" ? "MYR" : "SGD";
  const locale = currency === "MYR" ? "en-MY" : currency === "CNY" ? "zh-CN" : "en-SG";
  try { return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(n || 0)); }
  catch (_) { return `${currency} ${Number(n || 0).toFixed(2)}`; }
}
const STORE_TRANSLATIONS = {
  en: { back_home:"Back home", store:"Store", skip:"Skip", change:"Change", optional:"optional", name:"Name", phone:"Phone", email:"Email (for order confirmation)", instagram:"Instagram (optional)", collection:"Collection", self_delivery:"Self delivery", collection_date:"Collection date", delivery_date:"Delivery date", collection_time:"Collection time", delivery_time:"Delivery time", collection_point:"Collection point", fulfilment:"Fulfilment", select_date:"Select a date", select_time:"Select a time", select_date_first:"Select a date first", select_point:"Select a collection point", address:"Delivery address", postcode:"Postcode", city:"City / town", state:"State", delivery_notes:"Delivery notes (optional)", notes:"Notes (optional)", promo:"Promo code (optional)", total:"Total", delivery_fee:"Delivery fee", continue_payment:"Continue to payment", back_cart:"Back to cart", back_menu:"Back to menu", add_cart:"Add to cart", customisation:"Customisation", no_options:"No customisation options for this item.", order:"Order", amount:"Amount", payment_scan_tng:"Scan with Touch 'n Go and enter the exact order amount shown below.", pay_exact:"Pay exactly {amount}.", payment_exact_tng:"Please enter this exact amount in Touch 'n Go before confirming.", payment_reference:"Enter {order} as the payment reference.", transaction_reference:"Touch 'n Go transaction reference", payment_screenshot:"Payment screenshot", payment_proof_required:"Required — upload a clear screenshot of your successful Touch 'n Go payment.", need_help:"Need a hand? Chat with us on Instagram", submit_payment_proof:"Submit payment proof", after_payment_submit:"After submitting, please send us your order number on Instagram so we can verify your payment promptly." },
  ms: { back_home:"Kembali", store:"Kedai", skip:"Langkau", change:"Ubah", optional:"pilihan", name:"Nama", phone:"Telefon", email:"E-mel (untuk pengesahan pesanan)", instagram:"Instagram (pilihan)", collection:"Ambil sendiri", self_delivery:"Penghantaran sendiri", collection_date:"Tarikh pengambilan", delivery_date:"Tarikh penghantaran", collection_time:"Masa pengambilan", delivery_time:"Masa penghantaran", collection_point:"Tempat pengambilan", fulfilment:"Kaedah penerimaan", select_date:"Pilih tarikh", select_time:"Pilih masa", select_date_first:"Pilih tarikh dahulu", select_point:"Pilih tempat pengambilan", address:"Alamat penghantaran", postcode:"Poskod", city:"Bandar", state:"Negeri", delivery_notes:"Nota penghantaran (pilihan)", notes:"Nota (pilihan)", promo:"Kod promosi (pilihan)", total:"Jumlah", delivery_fee:"Caj penghantaran", continue_payment:"Teruskan ke pembayaran", back_cart:"Kembali ke troli", back_menu:"Kembali ke menu", add_cart:"Tambah ke troli", customisation:"Pilihan", no_options:"Tiada pilihan tambahan untuk item ini.", order:"Pesanan", amount:"Jumlah", payment_scan_tng:"Imbas dengan Touch 'n Go dan masukkan jumlah pesanan tepat yang tertera di bawah.", pay_exact:"Bayar tepat {amount}.", payment_exact_tng:"Sila masukkan jumlah tepat ini dalam Touch 'n Go sebelum mengesahkan.", payment_reference:"Masukkan {order} sebagai rujukan pembayaran.", transaction_reference:"Rujukan transaksi Touch 'n Go", payment_screenshot:"Tangkapan skrin pembayaran", payment_proof_required:"Wajib — muat naik tangkapan skrin pembayaran Touch 'n Go yang berjaya dengan jelas.", need_help:"Perlukan bantuan? Hubungi kami di Instagram", submit_payment_proof:"Hantar bukti pembayaran", after_payment_submit:"Selepas menghantar, sila hantarkan nombor pesanan anda kepada kami di Instagram supaya kami dapat menyemak pembayaran dengan segera." },
  zh: { back_home:"返回首页", store:"商店", skip:"跳过", change:"更改", optional:"可选", name:"姓名", phone:"手机号码", email:"电邮（接收订单通知）", instagram:"Instagram（可选）", collection:"自取", self_delivery:"店家配送", collection_date:"自取日期", delivery_date:"配送日期", collection_time:"自取时间", delivery_time:"配送时间", collection_point:"自取地点", fulfilment:"取货方式", select_date:"选择日期", select_time:"选择时间", select_date_first:"请先选择日期", select_point:"选择自取地点", address:"配送地址", postcode:"邮政编码", city:"城市", state:"州属", delivery_notes:"配送备注（可选）", notes:"备注（可选）", promo:"优惠码（可选）", total:"总计", delivery_fee:"配送费", continue_payment:"继续付款", back_cart:"返回购物车", back_menu:"返回菜单", add_cart:"加入购物车", customisation:"客制选项", no_options:"此商品没有客制选项。", order:"订单", amount:"金额", payment_scan_tng:"使用 Touch 'n Go 扫描，并输入下方显示的准确订单金额。", pay_exact:"请准确支付 {amount}。", payment_exact_tng:"请在确认前，于 Touch 'n Go 输入这笔准确金额。", payment_reference:"请使用 {order} 作为付款备注。", transaction_reference:"Touch 'n Go 交易编号", payment_screenshot:"付款截图", payment_proof_required:"必填 — 请上传清晰的 Touch 'n Go 成功付款截图。", need_help:"需要帮助？在 Instagram 联系我们", submit_payment_proof:"提交付款证明", after_payment_submit:"提交后，请在 Instagram 把订单编号发给我们，以便我们尽快核对付款。" },
};
function tr(key) { return STORE_TRANSLATIONS[state.language]?.[key] || STORE_TRANSLATIONS.en[key] || key; }
function trFormat(key, values = {}) {
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), tr(key));
}
function setStoreLanguage(language) {
  if (!["en","ms","zh"].includes(language)) return;
  state.language = language;
  try { localStorage.setItem(STORE_LANGUAGE_KEY, language); } catch (_) {}
  render();
}
function optionPriceLabel(value) {
  const amount = Number(value || 0);
  if (amount > 0) return `+${money(amount)}`;
  if (amount < 0) return `−${money(Math.abs(amount))}`;
  return "Included";
}
function themeFont(value, fallback) {
  return ({ fraunces: "'Fraunces',serif", noto_serif_jp: "'Noto Serif JP',serif", work_sans: "'Work Sans',sans-serif", noto_sans_jp: "'Noto Sans JP',sans-serif", georgia: "Georgia,serif" })[value] || fallback;
}
function storefrontThemeStyle() {
  const s = state.store;
  return `<style>:root{--matcha:${escapeHtml(s.theme_primary_color || "#4B5D3A")};--cream:${escapeHtml(s.theme_background_color || "#F3EEE3")};--card:${escapeHtml(s.theme_card_color || "#FFFFFF")};--ink:${escapeHtml(s.theme_text_color || "#2A2A22")};--loyalty-card-bg:${escapeHtml(s.loyalty_card_background || "#1E473E")};--loyalty-card-text:${escapeHtml(s.loyalty_card_text_color || "#F9F4E8")};--loyalty-card-accent:${escapeHtml(s.loyalty_card_accent_color || "#CAE4B3")};--cms-body-size:${Math.max(12,Math.min(22,Number(s.theme_body_size||14)))}px;--cms-product-size:${Math.max(12,Math.min(26,Number(s.theme_product_name_size||15)))}px;--cms-price-size:${Math.max(12,Math.min(24,Number(s.theme_price_size||14)))}px;--cms-button-size:${Math.max(12,Math.min(22,Number(s.theme_button_size||14)))}px;--review-cta-size:${Math.max(10,Math.min(32,Number(s.review_cta_size||14)))}px;--review-cta-color:${escapeHtml(s.review_cta_color||s.theme_primary_color||"#4B5D3A")};--review-title-size:${Math.max(16,Math.min(56,Number(s.review_portal_title_size||27)))}px;--review-title-color:${escapeHtml(s.review_portal_title_color||s.theme_text_color||"#2A2A22")};}body{font-family:${themeFont(s.theme_body_font,"'Work Sans',sans-serif")};font-size:var(--cms-body-size)}.display{font-family:${themeFont(s.theme_heading_font,"'Fraunces',serif")}}.item-name{font-size:var(--cms-product-size)!important}.item-price,.discount-price{font-size:var(--cms-price-size)!important}.primary-btn,.pill{font-size:var(--cms-button-size)!important}.write-review-link{font-family:${themeFont(s.review_cta_font,"'Work Sans',sans-serif")}!important;font-size:var(--review-cta-size)!important;color:var(--review-cta-color)!important}.review-portal-title{font-family:${themeFont(s.review_portal_title_font,"'Fraunces',serif")}!important;font-size:var(--review-title-size)!important;color:var(--review-title-color)!important}.screen>div[style*="linear-gradient(135deg,#1e473e"]{background:var(--loyalty-card-bg)!important;color:var(--loyalty-card-text)!important}.screen>div[style*="linear-gradient(135deg,#1e473e"] [style*="background:#cae4b3"]{background:var(--loyalty-card-accent)!important}</style>`;
}
function applyStorefrontThemeVariables() {
  const root = document.documentElement;
  const s = state.store || {};
  root.style.setProperty("--matcha", s.theme_primary_color || "#4B5D3A");
  root.style.setProperty("--cream", s.theme_background_color || "#F3EEE3");
  root.style.setProperty("--card", s.theme_card_color || "#FFFFFF");
  root.style.setProperty("--ink", s.theme_text_color || "#2A2A22");
  document.body.style.backgroundColor = s.theme_background_color || "#F3EEE3";
  document.body.style.color = s.theme_text_color || "#2A2A22";
}
function originalPrice(item) {
  if (state.market === "MY") return item?.myr_price == null ? 0 : Number(item.myr_price || 0);
  return Number(item?.price || 0);
}
function marketStoreSetting(key) {
  const marketKey = state.market === "MY" ? `malaysia_${key}` : key;
  return state.store[marketKey];
}
function storewideSaleApplies(item) {
  if (!marketStoreSetting("storewide_sale_enabled")) return false;
  const scope = String(marketStoreSetting("storewide_sale_scope") || "all");
  if (scope !== "selected") return true;
  const savedIds = marketStoreSetting("storewide_sale_product_ids");
  const selectedIds = Array.isArray(savedIds) ? savedIds.map(String) : [];
  return selectedIds.includes(String(item?.id));
}
function salePrice(item) {
  const original = originalPrice(item);
  const discount = Number(state.market === "MY" ? item?.myr_discount_price : item?.discount_price);
  const productPrice = Number.isFinite(discount) && discount > 0 && discount < original ? discount : original;
  const percent = storewideSaleApplies(item) ? Math.max(0, Math.min(100, Number(marketStoreSetting("storewide_sale_percent") || 0))) : 0;
  const storewidePrice = percent > 0 ? Math.round(original * (1 - percent / 100) * 100) / 100 : original;
  return Math.min(productPrice, storewidePrice);
}
function hasDiscount(item) { return salePrice(item) < originalPrice(item); }
function partnerModeActive() { return state.market === "SG" && Boolean(state.partner?.id); }
function partnerFeatureEnabled(key) {
  if (!partnerModeActive()) return true;
  const features = state.store.partner_store_features;
  return Boolean(features && typeof features === "object" && features[key] === true);
}
function partnerEligibleProduct(item) {
  if (!partnerModeActive() || !item || isRitualProduct(item)) return false;
  const ids = Array.isArray(state.partner?.eligible_product_ids) ? state.partner.eligible_product_ids.map(String) : [];
  return ids.includes(String(item.id));
}
function partnerVisibleProduct(item) {
  return !partnerModeActive() || partnerEligibleProduct(item);
}
function partnerDiscountForAmount(amount) {
  const base = Math.max(0, Number(amount || 0));
  if (!partnerModeActive()) return 0;
  const value = Math.max(0, Number(state.partner.discount_value || 0));
  const discount = String(state.partner.discount_type || "percent") === "fixed" ? value : base * Math.min(100, value) / 100;
  return Math.min(base, Math.round(discount * 100) / 100);
}
function partnerMemberPriceOverride(item) {
  const prices = state.partner?.member_prices;
  if (!prices || typeof prices !== "object" || !Object.prototype.hasOwnProperty.call(prices, String(item?.id))) return null;
  const value = Number(prices[String(item.id)]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
function roundPartnerPrice(amount) { return Math.max(0, Math.round((Number(amount || 0) + Number.EPSILON) * 10) / 10); }
function partnerAdjustedUnitPrice(item, regularUnitPrice) {
  const normal = Math.max(0, Number(regularUnitPrice || 0));
  if (!partnerEligibleProduct(item)) return Math.round(normal * 100) / 100;
  const discountBase = isBundle(item) ? normal : salePrice(item);
  const override = partnerMemberPriceOverride(item);
  if (override != null) return Math.max(0, Math.round((Math.min(override, discountBase) + (normal - discountBase)) * 100) / 100);
  return roundPartnerPrice(normal - partnerDiscountForAmount(discountBase));
}
function partnerMemberBasePrice(item) { return partnerAdjustedUnitPrice(item, salePrice(item)); }
function productPriceMarkup(item, className = "item-price") {
  if (item?.show_price_on_menu === false) return `<div class="${className} menu-price-hidden" aria-hidden="true"></div>`;
  if (isRitualRedemptionMode() && ritualEligibleProduct(item)) { const topUp=ritualDrinkTopUp(item); return `<div class="${className}"><span class="discount-price">${topUp ? `+${money(topUp)} with Matcha Pass` : "Included with Matcha Pass"}</span></div>`; }
  if (partnerEligibleProduct(item) && !isDynamicBundle(item)) return `<div class="${className} partner-price"><span class="discount-price">${money(partnerMemberBasePrice(item))}</span><small>Member Price</small></div>`;
  if (isDynamicBundle(item)) return `<div class="${className} ${partnerEligibleProduct(item) ? "partner-price" : ""}"><span class="discount-price">From ${money(bundleDisplayFromPrice(item))}</span>${partnerEligibleProduct(item) ? `<small>Member Price</small>` : ""}</div>`;
  return `<div class="${className}">${hasDiscount(item) ? `<span class="original-price">${money(originalPrice(item))}</span> ` : ""}<span class="discount-price">${money(salePrice(item))}</span></div>`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function safeExternalUrl(value) {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) ? text : "";
}
function marketCollectionSettings() {
  const malaysia = state.market === "MY";
  const configuredPoints = malaysia ? state.store.malaysia_collection_points : state.store.collection_points;
  const details = malaysia ? state.store.malaysia_collection_point_details : state.store.collection_point_details;
  const pointList = Array.isArray(configuredPoints) ? configuredPoints : [];
  const detailList = Array.isArray(details) ? details : [];
  const visibilityKey = state.market === "SG" && Boolean(state.partner?.id) ? "show_in_partner_referral" : malaysia ? "show_in_malaysia" : "show_in_singapore";
  const visiblePoints = pointList.filter((point) => {
    const match = detailList.find((item) => String(item?.name || "").trim().toLowerCase() === String(point || "").trim().toLowerCase());
    return !match || (match.is_visible !== false && match[visibilityKey] !== false);
  });
  return {
    points: visiblePoints,
    details: detailList,
    hasConfiguredPoints: pointList.length > 0,
    area: String(malaysia ? state.store.malaysia_collection_area_label || "" : state.store.collection_area_label || "").trim(),
    address: String(malaysia ? state.store.malaysia_collection_address || "" : state.store.collection_address || "").trim(),
    mapsUrl: String(malaysia ? state.store.malaysia_google_maps_url || "" : state.store.google_maps_url || "").trim(),
  };
}
function defaultCollectionPoint() {
  const settings = marketCollectionSettings();
  if (settings.points.length) return settings.points[0];
  if (settings.hasConfiguredPoints) return "";
  return state.market === "MY" ? "Malaysia collection point" : "Blk 130A";
}
function collectionPointInfo(pointName) {
  const point = String(pointName || "").trim();
  const settings = marketCollectionSettings();
  const details = settings.details;
  const match = details.find((item) => String(item?.name || "").trim().toLowerCase() === point.toLowerCase()) || {};
  return {
    name: point || String(match.name || "Collection point"),
    area: String(match.area || point || settings.area || "").trim(),
    address: String(match.address || settings.address || "").trim(),
    mapsUrl: String(match.google_maps_url || settings.mapsUrl || "").trim()
  };
}
function collectionMapsUrl(info = collectionPointInfo("")) {
  const saved = safeExternalUrl(info.mapsUrl);
  if (saved) return saved;
  const address = String(info.address || "").trim();
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "";
}
function collectionMapEmbedUrl(info) {
  const address = String(info?.address || "").trim();
  return address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed` : "";
}
function homeCollectionMapCard() {
  if (!partnerFeatureEnabled("collection_area")) return "";
  if (state.store.show_collection_map_home === false) return "";
  const settings = marketCollectionSettings();
  const points = settings.points.length ? settings.points : (settings.hasConfiguredPoints ? [] : [settings.area].filter(Boolean));
  if (!points.length) return "";
  return `<div class="collection-area-card"><div class="collection-area-list"><span class="collection-map-kicker">COLLECTION AREAS</span>${points.map((point) => { const info = collectionPointInfo(point); const url = collectionMapsUrl(info); return `<div class="collection-area-row"><strong>${escapeHtml(info.area || info.name)}</strong>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">View map ↗</a>` : ""}</div>`; }).join("")}<span>Exact pickup details are shown with your order.</span></div></div>`;
}
function nextCollectionCard(collections) {
  const [nearest, ...upcoming] = collections;
  if (!nearest) return `<section class="next-collection-card" aria-label="Next collection"><div class="next-collection-top"><span class="next-collection-label">NEXT COLLECTION</span><span class="next-collection-status">DATES SOON</span></div><p class="next-collection-empty">The next collection opening will be announced here.</p></section>`;
  return `<details class="next-collection-card">
    <summary>
      <span class="next-collection-top"><span class="next-collection-label">NEXT COLLECTION</span><span class="next-collection-status">PRE-ORDER</span></span>
      <span class="next-collection-summary"><span class="next-collection-date">${escapeHtml(nearest.label)}</span><span class="next-collection-time"><span aria-hidden="true">◷</span>${escapeHtml(nearest.time)}</span><span class="next-collection-chevron" aria-hidden="true">⌄</span></span>
    </summary>
    <div class="next-collection-more"><span>UPCOMING COLLECTIONS</span>${upcoming.length ? upcoming.map((item) => `<div class="next-collection-option"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.time)}</span></div>`).join("") : `<p>More collection dates will appear here when available.</p>`}</div>
  </details>`;
}

function customerStoreActions() {
  const actions = [
    partnerFeatureEnabled("track_order") ? `<button type="button" class="customer-store-action" onclick="setScreen('track')"><span><strong>Track order</strong><small>Phone number or order number</small></span><span aria-hidden="true">→</span></button>` : "",
    partnerFeatureEnabled("rewards") ? `<button type="button" class="customer-store-action" onclick="setScreen('loyalty')"><span><strong>Rewards</strong><small>Use phone number</small></span><span aria-hidden="true">→</span></button>` : "",
  ].filter(Boolean);
  return actions.length ? `<nav class="customer-store-actions" aria-label="Customer tools">${actions.join("")}</nav>` : "";
}

function ritualPassBanner() {
  const pass = ritualProduct();
  if (!pass || state.market !== "SG" || isRitualRedemptionMode()) return "";
  if (partnerModeActive() && state.store.show_matcha_pass_in_partner_referral !== true) return "";
  const r = state.ritual;
  const selectedPass = (r.passes || []).find((item) => String(item.id) === String(r.selectedPassId));
  const eligibleIds = Array.isArray(pass.bundle_product_ids) ? pass.bundle_product_ids.map(String) : [];
  const eligibleDrinks = state.menu.filter((item) => !isBundle(item) && item.is_available !== false && (!eligibleIds.length || eligibleIds.includes(String(item.id))));
  const pickupDates = Array.from(new Map(state.slots.map((slot) => [slot.date, slot.label])).entries());
  const availableTimes = state.slots.filter((slot) => slot.date === r.pickupDate);
  const points = marketCollectionSettings().points;
  const portalVisible = r.message || r.loading || r.passes.length || r.selectedPassId || r.phone;
  const purchasesEnabled = !isSoldOut(pass);
  return `<style>
    .ritual-pass-banner{margin-top:11px;border:1px solid color-mix(in srgb,var(--matcha) 24%,var(--line));border-radius:18px;overflow:hidden;background:var(--card);display:grid;grid-template-columns:112px minmax(0,1fr);box-shadow:0 8px 22px rgba(42,42,34,.06)}.ritual-pass-banner.is-access-only{grid-template-columns:1fr}.ritual-pass-banner.is-access-only .ritual-pass-copy{padding:16px}
    .ritual-pass-banner>img{width:100%;height:100%;min-height:148px;max-height:168px;object-fit:cover}.ritual-pass-copy{padding:14px 17px;align-self:center}.ritual-pass-kicker{display:block;color:var(--matcha);font-size:8px;font-weight:850;letter-spacing:.15em}.ritual-pass-copy h2{font:700 clamp(21px,3.5vw,27px)/1.04 var(--heading-font,Georgia,serif);margin:5px 0 6px}.ritual-pass-copy p{margin:0;color:var(--muted);font-size:11px;line-height:1.4;max-width:52ch;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.ritual-pass-meta{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;color:var(--matcha);font-size:10px}.ritual-pass-actions{display:flex;gap:7px;flex-wrap:nowrap}.ritual-pass-actions .primary-btn,.ritual-pass-actions .btn-secondary{width:auto;min-height:34px;padding:0 11px;font-size:10px;white-space:nowrap}.ritual-pass-portal{grid-column:1/-1;border-top:1px solid var(--line);padding:16px;background:color-mix(in srgb,var(--cream) 55%,var(--card))}.ritual-pass-lookup{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.ritual-pass-wallet{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px;padding:13px 14px;border:1px solid var(--line);border-radius:14px;background:var(--card);color:var(--ink);text-align:left}.ritual-pass-wallet.active{border-color:var(--matcha);background:color-mix(in srgb,var(--matcha) 8%,var(--card))}.ritual-pass-wallet span{display:grid;gap:3px}.ritual-pass-wallet small{color:var(--muted)}.ritual-redeem-card{margin-top:12px;padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--card)}.ritual-redeem-card h3{margin:0 0 13px;font-size:18px}
    @media(max-width:620px){.ritual-pass-banner{grid-template-columns:84px minmax(0,1fr);border-radius:16px}.ritual-pass-banner.is-access-only{grid-template-columns:1fr}.ritual-pass-banner>img{min-height:142px;max-height:160px}.ritual-pass-copy{padding:11px 10px}.ritual-pass-copy h2{font-size:20px}.ritual-pass-copy p{font-size:10px;-webkit-line-clamp:2}.ritual-pass-meta{font-size:9px;margin:7px 0}.ritual-pass-actions{gap:5px}.ritual-pass-actions .primary-btn,.ritual-pass-actions .btn-secondary{min-height:32px;padding:0 7px;font-size:9px}.ritual-pass-portal{padding:13px}.ritual-pass-lookup{grid-template-columns:1fr}.ritual-pass-wallet{align-items:flex-start}}
  </style><section class="ritual-pass-banner ${purchasesEnabled ? "" : "is-access-only"}" aria-label="Matcha Pass">
    ${purchasesEnabled ? `<img src="${escapeHtml(pass.image_url || "matcha-latte.jpg")}" alt="${escapeHtml(pass.name)}">` : ""}
    <div class="ritual-pass-copy"><span class="ritual-pass-kicker">${purchasesEnabled ? "WEEKLY RITUAL" : "EXISTING PASSHOLDERS"}</span><h2>${escapeHtml(pass.name || "Matcha Pass")}</h2>${purchasesEnabled ? `<p>${escapeHtml(pass.description || "Four drinks to enjoy across three weeks.")}</p><div class="ritual-pass-meta"><b>${bundleSelectionCount(pass)} drinks</b><span>·</span><b>${Number(pass.ritual_validity_weeks || 3)} weeks</b><span>·</span><b>${money(salePrice(pass))}</b></div>` : `<p>New purchases are paused. Existing customers can still view and redeem their remaining drinks.</p>`}<div class="ritual-pass-actions">${purchasesEnabled ? `<button class="primary-btn" onclick="purchaseRitualPass('${escapeHtml(pass.id)}')">Purchase pass</button>` : ""}<button class="btn-secondary" onclick="toggleRitualLookup()">${r.passes.length || r.selectedPassId ? "My pass" : purchasesEnabled ? "Already have a pass?" : "Open My Pass"}</button></div></div>
    ${portalVisible ? `<div class="ritual-pass-portal">
      <div class="ritual-pass-lookup"><input inputmode="tel" autocomplete="tel" placeholder="Phone number used at checkout" value="${escapeHtml(r.phone)}" oninput="state.ritual.phone=cleanPhoneInput(this.value)"><button class="btn-secondary" ${r.loading ? "disabled" : ""} onclick="lookupRitualPasses()">${r.loading ? "Checking…" : "Find my pass"}</button></div>
      ${r.message ? `<div class="ref-note">${escapeHtml(r.message)}</div>` : ""}
      ${(r.passes || []).map((item) => `<button class="ritual-pass-wallet ${String(item.id) === String(r.selectedPassId) ? "active" : ""}" onclick="selectRitualPass('${escapeHtml(item.id)}')"><span><b>${escapeHtml(item.product_name || pass.name)}</b><small>${escapeHtml(item.expires_at ? `Valid until ${new Date(item.expires_at).toLocaleDateString("en-SG", { day:"numeric", month:"short", year:"numeric" })}` : "Active pass")} · ${escapeHtml(item.status || "active")}${ritualReserved(item) ? ` · ${ritualReserved(item)} reserved` : ""}</small></span><strong>${ritualRemaining(item)} / ${Number(item.total_drinks||4)}</strong></button>`).join("")}
      ${selectedPass ? `<div class="ritual-redeem-card"><h3>Your Matcha Pass</h3><div class="ref-note"><b>${ritualRemaining(selectedPass)} of ${Number(selectedPass.total_drinks||4)} drinks remaining</b>${ritualReserved(selectedPass) ? `<br>${ritualReserved(selectedPass)} reserved · credit is deducted after collection` : ""}<br>Valid until ${escapeHtml(new Date(selectedPass.expires_at).toLocaleDateString("en-SG",{day:"numeric",month:"short",year:"numeric"}))}</div><div style="display:grid;gap:7px;margin:12px 0">${Array.from({length:Number(selectedPass.total_drinks||4)},(_,index)=>{const position=index+1;const redemption=ritualRedemptionAt(selectedPass,position);const claimed=ritualPositionClaimed(selectedPass,position);const reserved=redemption&&!claimed&&["reserved","ready"].includes(String(redemption.status||"reserved"));const detail=redemption?`${escapeHtml(redemption.product_name||"Drink")} · ${escapeHtml(redemption.collection_date||'')} ${escapeHtml(redemption.collection_time||'')}`:claimed?"Claimed":"Available";const badge=claimed?(redemption&&Number(redemption.pass_top_up||0)>0?`✓ Claimed · +${money(redemption.pass_top_up)}`:"✓ Claimed"):reserved?"Reserved":'○';return `<div class="row" style="padding:9px 0"><span><b>${position}${index===0?'st':index===1?'nd':index===2?'rd':'th'} drink</b><br><small>${detail}</small></span><b>${badge}</b></div>`}).join('')}</div>${selectedPass.status==='active'&&ritualAvailable(selectedPass)>0?`<button class="primary-btn" onclick="beginRitualRedemption('${escapeHtml(selectedPass.id)}')">Redeem drinks</button>`:`<div class="ref-note">${selectedPass.status==='expired'?'This Matcha Pass has expired.':ritualRemaining(selectedPass)>0?'All remaining drinks are currently reserved.':'This Matcha Pass is complete.'}</div>`}</div>` : ""}
    </div>` : ""}
  </section>`;
}
function toggleRitualLookup() { state.ritual.message = "Enter the phone number used to purchase your pass."; render(); }
function selectRitualPass(passId){state.ritual.selectedPassId=passId;render();}
function ritualRedemptionAt(pass, position) {
  return (pass?.redemptions || []).find((item) => Number(item.credit_position || item.redemption_number) === Number(position)) || null;
}
function ritualPositionClaimed(pass, position) {
  const redemption = ritualRedemptionAt(pass, position);
  return String(redemption?.status || "") === "collected" || Number(position) <= Math.max(0, Number(pass?.redeemed_drinks || 0));
}
function purchaseRitualPass(productId) {
  const pass = state.menu.find((item) => String(item.id) === String(productId));
  if (!pass || isSoldOut(pass)) return alert("Sorry, this pass is not available right now.");
  if (cartLines().some((line) => !isRitualProduct(state.menu.find((item) => String(item.id) === String(line.productId))))) return alert("Matcha Pass is purchased separately. Please finish or clear your current drink order first.");
  const key = `${pass.id}__matcha-pass`;
  state.cart = { [key]: { productId: pass.id, productName: pass.name, imageUrl: pass.image_url || "", unitPrice: salePrice(pass), basePrice: salePrice(pass), qty: 1, options: [], isRitualPass: true } };
  saveCart(); state.screen = "cart"; render();
}
async function lookupRitualPasses() {
  const r = state.ritual;
  if (!isValidPhone(r.phone)) { r.message = "Enter a valid Singapore phone number."; render(); return; }
  if (!IS_CONFIGURED) { r.message = "Connect Supabase to retrieve a Matcha Pass."; render(); return; }
  r.loading = true; r.message = ""; render();
  const { data, error } = await db.rpc("get_shizuku_ritual_passes", { p_phone: normalisePhone(r.phone) });
  r.loading = false;
  if (error) { r.message = "Could not load your pass. Please try again."; r.passes = []; render(); return; }
  r.passes = Array.isArray(data) ? data : [];
  const active = r.passes.filter((pass)=>pass.status==="active"&&ritualAvailable(pass)>0);
  if (active.length) {
    r.message = "Your Matcha Pass is ready below.";
  } else if (r.passes.some((pass)=>pass.status==="expired")) {
    r.message = "This Matcha Pass has expired.";
  } else if (r.passes.some((pass)=>pass.status==="cancelled")) {
    r.message = "This Matcha Pass purchase was cancelled.";
  } else {
    const { data: purchaseStatus, error: statusError } = await db.rpc("get_shizuku_matcha_pass_purchase_status", { p_phone: normalisePhone(r.phone) });
    const status = statusError ? "not_found" : String(purchaseStatus?.status || purchaseStatus || "not_found");
    r.message = status === "payment_review"
      ? "Your Matcha Pass payment is under review. Your 4 credits will appear here after payment is confirmed."
      : status === "awaiting_payment"
        ? "Your Matcha Pass order is awaiting payment."
        : status === "cancelled"
          ? "This Matcha Pass purchase was cancelled."
          : status === "processing"
            ? "Your payment is confirmed. Your Matcha Pass is being prepared; please check again shortly."
            : "We couldn't find an active Matcha Pass for this phone number.";
  }
  render();
}
function beginRitualRedemption(passId) {
  const pass=(state.ritual.passes||[]).find((item)=>String(item.id)===String(passId));
  if(!pass||pass.status!=="active"||ritualAvailable(pass)<=0)return alert(pass?.status==="expired"?"This Matcha Pass has expired.":"This Matcha Pass has no unreserved drinks available.");
  state.ritual.selectedPassId=passId;
  state.ritual.savedCart={...state.cart};
  state.cart={}; saveCart();
  state.ritual.redemptionMode=true;
  state.ritual.idempotencyKey=(crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`);
  state.form.pickupDate="";state.form.slotId="";
  state.form.collectionPoint=defaultCollectionPoint();
  state.activeCategory="All";state.screen="menu";render();
}
function exitRitualRedemption(){state.cart={...(state.ritual.savedCart||{})};saveCart();state.ritual.redemptionMode=false;state.ritual.savedCart=null;state.ritual.idempotencyKey="";state.screen="menu";render();}
async function redeemRitualDrink() {
  const r = state.ritual, slot = state.slots.find((item) => String(item.id) === String(r.slotId));
  if (!r.selectedPassId || !r.selectedProductId || !slot || !r.collectionPoint) return alert("Please choose a drink, collection date, time and collection point.");
  const { data, error } = await db.rpc("redeem_shizuku_ritual_drink", { p_pass_id: r.selectedPassId, p_phone: normalisePhone(r.phone), p_product_id: String(r.selectedProductId), p_collection_date: slot.date, p_collection_time: slot.time, p_collection_point: r.collectionPoint });
  if (error) return alert(error.message || "Could not reserve this drink.");
  const redemptionNumber = Number(data?.redemption_number || 1);
  r.selectedPassId = null; r.selectedProductId = ""; r.pickupDate = ""; r.slotId = ""; r.collectionPoint = "";
  await lookupRitualPasses();
  state.ritual.message = `Drink ${redemptionNumber} reserved for ${slot.label}, ${slot.time}.`;
  render();
}
function paymentCollectionMapCard(order) {
  if(order?.is_b2b)return "";
  if (state.store.show_collection_map_payment === false) return "";
  const info = collectionPointInfo(order?.collection_point);
  const address = info.address;
  const mapsUrl = collectionMapsUrl(info);
  const embedUrl = collectionMapEmbedUrl(info);
  if (!address && !order?.collection_point) return "";
  return `<div class="payment-map-card">
    ${embedUrl ? `<iframe class="payment-map-frame" title="Collection point map" src="${escapeHtml(embedUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ""}
    <div class="payment-map-copy"><span class="collection-map-kicker">YOUR COLLECTION POINT</span><strong>${escapeHtml(order?.collection_point || "Collection point")}</strong>${address ? `<span>${escapeHtml(address)}</span>` : ""}${mapsUrl ? `<a class="payment-map-button" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener">Open in Google Maps ↗</a>` : ""}</div>
  </div>`;
}
function isInstagramOrFacebookBrowser() { return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(navigator.userAgent || ""); }
function storefrontSessionKey(name) { return `shizuku-${name}-${state.market.toLowerCase()}`; }
function storeAnnouncementDetails() {
  const title = String(marketStoreSetting("announcement_title") || "").trim();
  const message = String(marketStoreSetting("announcement_message") || "").trim();
  const promoCode = String(marketStoreSetting("announcement_promo_code") || "").trim().toUpperCase();
  const imageUrl = String(marketStoreSetting("announcement_image_url") || "").trim();
  const configuredButton = String(marketStoreSetting("announcement_button_text") || "").trim();
  const promoButton = !configuredButton || /^continue$/i.test(configuredButton) ? "Copy promo code" : configuredButton;
  return { enabled: marketStoreSetting("show_announcement") === true, title, message, promoCode, imageUrl, promoButton,
    fingerprint: [title, message, promoCode, imageUrl, promoButton].join("|") };
}
function storefrontSessionValue(key) {
  try { return sessionStorage.getItem(key) || ""; }
  catch (_) { return ""; }
}
function setStorefrontSessionValue(key, value) {
  try { sessionStorage.setItem(key, value); }
  catch (_) { /* Private browser storage can be unavailable. */ }
}
function canonicalStoreUrl() { return `${window.location.origin}${state.market === "MY" ? "/my" : "/"}`; }
function activeStorefrontOverlay() {
  if (state.screen !== "menu") return "";
  const browserDismissed = storefrontSessionValue(storefrontSessionKey("inapp-notice-dismissed")) === "1";
  if (isInstagramOrFacebookBrowser() && state.store.show_instagram_browser_notice !== false && !browserDismissed) return "browser";
  // Partner Mode uses the quiet inline member-perk banner only. Do not layer
  // the general Store Announcement over a referral shopping journey.
  if (partnerModeActive()) return "";
  const announcement = storeAnnouncementDetails();
  const seenAnnouncement = storefrontSessionValue(storefrontSessionKey("announcement-seen"));
  if (announcement.enabled && (announcement.title || announcement.message || announcement.promoCode || announcement.imageUrl) && seenAnnouncement !== announcement.fingerprint) return "announcement";
  return "";
}
function renderStorefrontOverlay() {
  const active = activeStorefrontOverlay();
  if (active === "browser") return `<div class="inapp-browser-notice" role="dialog" aria-modal="true" aria-labelledby="inapp-browser-title">
    <div class="inapp-browser-card">
      <div class="inapp-browser-logo"><img src="${escapeHtml(state.store.logo_url || "logo.png")}" alt=""></div>
      <div class="inapp-browser-kicker">${escapeHtml(state.store.store_name || "Shizuku Lab")}</div>
      <h2 id="inapp-browser-title">Open in your browser</h2>
      <p>Instagram and Facebook can block payment screenshots and other store features. For the smoothest order, open this shop in Safari, Chrome or your usual browser.</p>
      <div class="inapp-browser-steps"><b>How to open it</b><span>Tap the menu in this browser, then choose <b>Open in external browser</b>. You can also copy the store link below.</span></div>
      <button type="button" class="inapp-browser-copy" onclick="copyCanonicalStoreLink(this)">Copy store link</button>
      <button type="button" class="inapp-browser-continue" onclick="dismissInAppBrowserNotice()">Continue here anyway</button>
    </div>
  </div>`;
  if (active !== "announcement") return "";
  const announcement = storeAnnouncementDetails();
  return `<div class="welcome-announcement" role="dialog" aria-modal="true" aria-labelledby="store-announcement-title">
    <article class="welcome-announcement-card">
      <button type="button" class="welcome-announcement-close" aria-label="Close announcement" onclick="dismissStoreAnnouncement()">×</button>
      ${announcement.imageUrl ? `<img class="store-announcement-image" src="${escapeHtml(announcement.imageUrl)}" alt="">` : ""}
      <div class="welcome-announcement-kicker">STORE ANNOUNCEMENT</div>
      <h2 class="welcome-announcement-title" id="store-announcement-title">${escapeHtml(announcement.title || "A little update")}</h2>
      ${announcement.message ? `<p class="welcome-announcement-message">${escapeHtml(announcement.message)}</p>` : ""}
      ${announcement.promoCode ? `<div class="welcome-announcement-promo"><span class="welcome-announcement-code">${escapeHtml(announcement.promoCode)}</span><button type="button" class="welcome-announcement-copy" onclick="copyAnnouncementPromo(this)">${escapeHtml(announcement.promoButton)}</button></div>` : ""}
    </article>
  </div>`;
}
async function copyCanonicalStoreLink(button) {
  const url = canonicalStoreUrl();
  try { await navigator.clipboard.writeText(url); button.textContent = "Link copied ✓"; }
  catch (_) { window.prompt("Copy this store link", url); }
}
function dismissInAppBrowserNotice() {
  setStorefrontSessionValue(storefrontSessionKey("inapp-notice-dismissed"), "1");
  render();
}
function dismissStoreAnnouncement() {
  setStorefrontSessionValue(storefrontSessionKey("announcement-seen"), storeAnnouncementDetails().fingerprint);
  render();
}
async function copyAnnouncementPromo(button) {
  const code = storeAnnouncementDetails().promoCode;
  if (!code) return;
  try { await navigator.clipboard.writeText(code); button.textContent = "Copied ✓"; }
  catch (_) { window.prompt("Copy promo code", code); }
}
function uidCode() { return "SL-" + Math.random().toString(36).slice(2, 8).toUpperCase(); }
function cleanPhoneInput(value) { return String(value || "").replace(/[^0-9+\-\s]/g, ""); }
function normalisePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (state.market === "MY") {
    if (digits.startsWith("60")) return digits;
    if (digits.startsWith("0")) return "60" + digits.slice(1);
    return "60" + digits;
  }
  return digits.length === 10 && digits.startsWith("65") ? digits.slice(2) : digits;
}
function isValidPhone(value) { return (state.market === "MY" ? /^601\d{8,9}$/ : /^[689]\d{7}$/).test(normalisePhone(value)); }
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
function isRitualProduct(product) { return state.market === "SG" && Number(product?.ritual_validity_weeks || 0) > 0; }
function ritualProduct() { return state.menu.find(isRitualProduct) || null; }
function selectedRitualPass() { return (state.ritual.passes || []).find((item) => String(item.id) === String(state.ritual.selectedPassId)) || null; }
function ritualRemaining(pass = selectedRitualPass()) { return Math.max(0, Number(pass?.remaining_credits ?? (Number(pass?.total_drinks || 4) - Number(pass?.redeemed_drinks || 0)))); }
function ritualReserved(pass = selectedRitualPass()) { return Math.max(0, Number(pass?.reserved_credits || 0)); }
function ritualAvailable(pass = selectedRitualPass()) { return Math.max(0, Number(pass?.available_credits ?? (ritualRemaining(pass) - ritualReserved(pass)))); }
function isRitualRedemptionMode() { return state.market === "SG" && state.ritual.redemptionMode === true && !!selectedRitualPass(); }
function ritualEligibleProduct(product) {
  if (!product || isBundle(product) || isRitualProduct(product) || product.is_b2b === true || product.is_available === false) return false;
  const allowed = Array.isArray(ritualProduct()?.bundle_product_ids) ? ritualProduct().bundle_product_ids.map(String) : [];
  return !allowed.length || allowed.includes(String(product.id));
}
function ritualDrinkTopUp(product) {
  if (!ritualEligibleProduct(product)) return null;
  const configured = ritualProduct()?.bundle_option_prices;
  const productId = String(product.id);
  if (configured && typeof configured === "object" && Object.prototype.hasOwnProperty.call(configured, productId)) {
    const override = Number(configured[productId]);
    if (Number.isFinite(override) && override >= 0) return Math.round(override * 100) / 100;
  }
  const name = String(product.name || "").trim().toLowerCase();
  if (name === "signature matcha latte" || name === "houjicha latte") return 0;
  const price = salePrice(product);
  if (price >= 8.9) return 2.5;
  if (price >= 7.9) return 2;
  if (price >= 6.9) return 1;
  return 0;
}
function ritualCreditsInCart() { return isRitualRedemptionMode() ? cartLines().reduce((sum,line)=>sum+Number(line.qty||0),0) : 0; }
function cartIsRitualPassOnly() {
  const lines = cartLines();
  return lines.length > 0 && lines.every((line) => isRitualProduct(state.menu.find((item) => String(item.id) === String(line.productId))));
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
function isDynamicBundle(bundle) {
  return isBundle(bundle) && String(bundle?.bundle_pricing_mode || "fixed") === "sum_selected";
}
function bundleOptionPrice(bundle, drink) {
  const source = state.market === "MY" ? bundle?.bundle_myr_option_prices : bundle?.bundle_option_prices;
  const prices = source && typeof source === "object" ? source : {};
  const override = Number(prices[String(drink?.id)]);
  return Number.isFinite(override) && override >= 0 ? override : salePrice(drink);
}
function bundleOptionExtras(options) {
  return Object.values(options || {}).reduce((sum, option) => sum + Number(option?.price || 0), 0);
}
function bundleSelectionCount(bundle = state.selectedProduct) { return Math.max(2, Math.min(8, Number(bundle?.bundle_selection_count || 2))); }
function bundleDrink(slot) { return state.bundle[`drink${slot}`] || null; }
function bundleDrinkOptions(slot) { return state.bundle[`drink${slot}Options`] || (state.bundle[`drink${slot}Options`] = {}); }
function resetBundleSelection(bundle = state.selectedProduct) {
  state.bundle = {};
  for (let slot=1;slot<=bundleSelectionCount(bundle);slot++) { state.bundle[`drink${slot}`]=null; state.bundle[`drink${slot}Options`] = {}; state.expandedOptionSteps[`bundle${slot}`]=null; }
}
function bundleStartingPrice(bundle) {
  if (!isDynamicBundle(bundle)) return partnerAdjustedUnitPrice(bundle, salePrice(bundle));
  const choices = getBundleDrinkProducts(bundle).map((drink) => bundleOptionPrice(bundle, drink));
  const minimum = choices.length ? Math.min(...choices) : 0;
  const normal = Math.round((salePrice(bundle) + minimum * bundleSelectionCount(bundle)) * 100) / 100;
  return partnerAdjustedUnitPrice(bundle, normal);
}
function bundleDisplayFromPrice(bundle) {
  const saved = Number(state.market === "MY" ? bundle?.bundle_myr_display_from_price : bundle?.bundle_display_from_price);
  return Number.isFinite(saved) && saved >= 0 ? saved : bundleStartingPrice(bundle);
}
function selectedBundlePrice(bundle, drinks, options) {
  if (!Array.isArray(drinks)) { drinks=[drinks,options]; options=[arguments[3]||{},arguments[4]||{}]; }
  if (!isDynamicBundle(bundle)) {
    const optionTotal=(options||[]).reduce((sum,set)=>sum+bundleOptionExtras(set),0);
    return partnerAdjustedUnitPrice(bundle, Math.max(0, Math.round((salePrice(bundle)+optionTotal)*100)/100));
  }
  let total = salePrice(bundle);
  (drinks || []).forEach((drink,index)=>{ if(drink) total += bundleOptionPrice(bundle, drink) + bundleOptionExtras(options?.[index] || {}); });
  return partnerAdjustedUnitPrice(bundle, Math.max(0, Math.round(total * 100) / 100));
}

function referralSlugFromPath() {
  if (state.market !== "SG") return "";
  const match = String(window.location.pathname || "").match(/^\/r\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/i);
  return match ? match[1].toLowerCase() : "";
}
function clearPartnerSession() {
  state.partner = null;
  try { sessionStorage.removeItem(PARTNER_SESSION_KEY); } catch (_) {}
}
function savePartnerSession(partner) {
  try { sessionStorage.setItem(PARTNER_SESSION_KEY, JSON.stringify({ partner, expiresAt: Date.now() + PARTNER_SESSION_TTL_MS })); } catch (_) {}
}
async function loadPartnerReferral() {
  const slug = referralSlugFromPath();
  const isDirectStorePath = state.market !== "SG" || /^(?:\/|\/index(?:\.html)?|\/shop\/shizuku-lab-sg(?:\.html)?)\/?$/i.test(window.location.pathname || "/");
  if (isDirectStorePath) { clearPartnerSession(); return; }
  if (!slug || !IS_CONFIGURED) { clearPartnerSession(); return; }
  const { data, error } = await db.rpc("get_shizuku_partner", { p_slug: slug, p_market_code: "SG" });
  if (error || !data?.id) { clearPartnerSession(); return; }
  state.partner = data;
  state.promo = null;
  state.form.promoCode = "";
  state.promoMsg = "";
  savePartnerSession(data);
}

function normalCartLinePrice(line, product) {
  if (!product) return Number(line?.regularUnitPrice ?? line?.unitPrice ?? 0);
  if (!isBundle(product)) {
    const extras = (line.options || []).reduce((sum, selected) => {
      const live = state.options.find((option) => String(option.id) === String(selected.optionId));
      return sum + Number(live?.price || 0);
    }, 0);
    return Math.max(0, Math.round((salePrice(product) + extras) * 100) / 100);
  }
  const components = (line.options || []).map((drink) => state.menu.find((item) => String(item.id) === String(drink.productId))).filter(Boolean);
  const optionSets = (line.options || []).map((drink) => Object.fromEntries((drink.options || []).map((selected) => {
    const live = state.options.find((option) => String(option.id) === String(selected.optionId));
    return [String(live?.option_group_id || selected.optionId), { ...selected, price: Number(live?.price || 0) }];
  })));
  if (!isDynamicBundle(product)) {
    const optionTotal = optionSets.reduce((sum, set) => sum + bundleOptionExtras(set), 0);
    return Math.max(0, Math.round((salePrice(product) + optionTotal) * 100) / 100);
  }
  let total = salePrice(product);
  components.forEach((drink, index) => { total += bundleOptionPrice(product, drink) + bundleOptionExtras(optionSets[index]); });
  return Math.max(0, Math.round(total * 100) / 100);
}
function allowedOptionIdsForProduct(product) {
  const visibleGroupIds = new Set(optionGroupsForProduct(product).map((group) => String(group.id)));
  return new Set(state.options
    .filter((option) => option.is_available !== false && visibleGroupIds.has(String(option.option_group_id)))
    .map((option) => String(option.id)));
}
function sanitizeOptionsForProduct(product, selectedOptions) {
  if (!product) return [];
  const allowed = allowedOptionIdsForProduct(product);
  return (selectedOptions || []).filter((selected) => selected?.optionId != null && allowed.has(String(selected.optionId)));
}
function sanitizeCartOptionsForStore() {
  let removedCount = 0;
  Object.values(state.cart).forEach((line) => {
    const product = state.menu.find((item) => String(item.id) === String(line?.productId));
    if (!product || line?.isRitualPass || line?.isRitualRedemption) return;
    if (isBundle(product)) {
      line.options = (line.options || []).map((drink) => {
        const drinkProduct = state.menu.find((item) => String(item.id) === String(drink?.productId));
        const before = Array.isArray(drink?.options) ? drink.options.length : 0;
        const options = sanitizeOptionsForProduct(drinkProduct, drink?.options);
        removedCount += before - options.length;
        return { ...drink, options };
      });
    } else {
      const before = Array.isArray(line.options) ? line.options.length : 0;
      line.options = sanitizeOptionsForProduct(product, line.options);
      removedCount += before - line.options.length;
    }
  });
  if (removedCount > 0) {
    state.promo = null;
    state.promoMsg = "";
    state.cartNotice = `${removedCount} hidden ${removedCount === 1 ? "option was" : "options were"} removed from your cart because ${removedCount === 1 ? "it is" : "they are"} not available in this store.`;
    saveCart();
  }
  return removedCount;
}
function repriceCartForPartner() {
  Object.values(state.cart).forEach((line) => {
    const product = state.menu.find((item) => String(item.id) === String(line?.productId));
    if (!product || line?.isRitualRedemption) return;
    const regular = normalCartLinePrice(line, product);
    line.regularUnitPrice = regular;
    line.unitPrice = partnerAdjustedUnitPrice(product, regular);
    line.partnerDiscount = Math.max(0, Math.round((regular - line.unitPrice) * 100) / 100);
  });
  saveCart();
}

function productStock(product) {
  if (!product) return null;
  const calculated = state.stockLevels[String(product.id)];
  if (Number.isFinite(calculated)) return Math.max(0, Math.floor(calculated));
  if (product.stock != null && Number.isFinite(Number(product.stock)) && Number(product.stock) >= 0) return Math.floor(Number(product.stock));
  return null;
}
function stockLabel(product) {
  if (product?.sold_out === true) return "Sold out";
  const stock = productStock(product);
  if (stock == null) return "";
  return stock <= 0 ? "Sold out" : `${stock} left`;
}
function stockMarkup(product) {
  if (partnerModeActive()) return "";
  const label = stockLabel(product);
  if (!label) return "";
  return `<span class="stock-badge ${isSoldOut(product) ? "sold-out" : ""}">${escapeHtml(label)}</span>`;
}
function isSoldOut(product) { return product?.sold_out === true || productStock(product) === 0; }
/* ---------- store settings ---------- */
async function loadStoreSettings() {
  if (!IS_CONFIGURED) return;
  const { data, error } = await db.from("store_settings").select("*").limit(1).maybeSingle();
  if (error) { console.warn("Could not load store settings:", error.message); return; }
  if (data) {
    state.store = { ...state.store, ...data };
    state.menuView = data.default_menu_view === "gallery" ? "gallery" : "list";
  }
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
function getWeeklyConfig() {
  const schedule = state.market === "MY" ? state.store.malaysia_weekly_pickup_schedule : state.store.weekly_pickup_schedule;
  if (Array.isArray(schedule)) {
    return schedule.map((item) => ({
      day: Number(item.day), label: String(item.label || "Collection"), is_open: item.is_open !== false,
      windows: (Array.isArray(item.windows) ? item.windows : []).filter((window) => String(window?.range || "").trim())
    }));
  }
  return [
    { day: 6, label: "Saturday", is_open: true, windows: [{ range: normaliseTime(state.store.saturday_collection_time), capacity: null }] },
    { day: 0, label: "Sunday", is_open: true, windows: [{ range: normaliseTime(state.store.sunday_collection_time), capacity: null }] },
  ];
}

async function loadOpeningOverrides() {
  if (!IS_CONFIGURED) return;
  const today = formatDateForDatabase(new Date());
  const until = new Date();
  // Load far enough ahead for the shop card to always show the true next open date,
  // even when several upcoming collection dates have been closed in Admin.
  until.setDate(until.getDate() + 180);
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
  const visibilityKey = partnerModeActive() ? "show_in_partner_referral" : state.market === "MY" ? "show_in_malaysia" : "show_in_singapore";
  state.faq = (data || []).filter((item) => visibilityKey === "show_in_partner_referral" ? item[visibilityKey] === true : item[visibilityKey] !== false);
}
async function loadReviews() {
  if (!IS_CONFIGURED) return;
  const { data, error } = await db.from("customer_reviews").select("id,customer_name,rating,review_text,product_summary,created_at").eq("status", "published").order("published_at", { ascending: false }).limit(12);
  if (error) { console.warn("Could not load reviews:", error.message); return; }
  state.reviews = data || [];
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
    const configuredInterval = state.market === "MY" ? state.store.malaysia_pickup_slot_interval_minutes : state.store.pickup_slot_interval_minutes;
    const interval = Math.max(5, Math.min(120, Number(configuredInterval || 30)));
    if (start == null) return [];
    if (end == null || end < start) return [formatPickupTime(start)];
    const values = [];
    for (let minute = start; minute <= end; minute += interval) values.push(formatPickupTime(minute));
    return values;
  }).flat();
}

function orderAdvanceDays() {
  const configuredAdvanceDays = state.market === "MY" ? state.store.malaysia_order_advance_days : state.store.order_advance_days;
  return Math.max(0, Math.min(60, Number(configuredAdvanceDays ?? 14)));
}

function computeSlots() {
  const now = new Date();
  const weekly = new Map(getWeeklyConfig().map((item) => [item.day, item]));
  const configuredNoticeHours = state.market === "MY" ? state.store.malaysia_minimum_order_notice_hours : state.store.minimum_order_notice_hours;
  const maxDays = orderAdvanceDays();
  const noticeHours = Math.max(0, Number(configuredNoticeHours ?? 0));
  const earliest = new Date(now.getTime() + noticeHours * 60 * 60 * 1000);
  const slots = [];
  for (let offset = 0; offset <= maxDays; offset++) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const dateText = formatDateForDatabase(date);
    const weeklyConfig = weekly.get(date.getDay());
    const override = state.openingOverrides.find((item) => item.collection_date === dateText && String(item.market_code || "SG") === state.market);
    if (override && !override.is_open) continue;
    if (!override && (!weeklyConfig || !weeklyConfig.is_open)) continue;
    const windows = override
      ? (Array.isArray(override.pickup_windows) && override.pickup_windows.length ? override.pickup_windows : [{ range: normaliseTime(override.collection_time), capacity: null }])
      : (weeklyConfig?.windows || []);
    windows.forEach((window) => timesFromRange(window.range).forEach((pickupTime) => {
      const startsAt = pickupStartsAt(dateText, pickupTime);
      if (startsAt && startsAt < earliest) return;
      slots.push({ id: `pickup-${dateText}-${pickupTime.replace(/\s+/g, "-")}`, label: formatDateLabel(date), date: dateText, time: pickupTime, capacity: window.capacity ?? null });
    }));
  }
  return slots;
}

function nextCollectionSchedule(limit = 2) {
  const weekly = new Map(getWeeklyConfig().map((item) => [item.day, item]));
  const maxDays = orderAdvanceDays();
  const dates = [];
  for (let offset = 0; offset <= maxDays && dates.length < limit; offset++) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const dateText = formatDateForDatabase(date);
    const override = state.openingOverrides.find((item) => item.collection_date === dateText && String(item.market_code || "SG") === state.market);
    const weeklyConfig = weekly.get(date.getDay());
    if (override && !override.is_open) continue;
    if (!override && (!weeklyConfig || !weeklyConfig.is_open)) continue;
    const windows = override
      ? (Array.isArray(override.pickup_windows) && override.pickup_windows.length ? override.pickup_windows : [{ range: override.collection_time }])
      : (weeklyConfig?.windows || []);
    const collectionTime = windows.map((item) => normaliseTime(item.range)).filter(Boolean).join(" | ");
    if (!collectionTime) continue;
    dates.push([dateText, collectionTime]);
  }
  return dates.map(([dateText, collectionTime]) => {
    const date = new Date(`${dateText}T12:00:00`);
    const label = date.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "short" });
    return { date: dateText, label, time: collectionTime.replace(/\s*\|\s*/g, " · ") };
  });
}

/* ---------- load products / options ---------- */
async function loadProducts() {
  let productQuery = db.from("products").select("*");
  productQuery = state.market === "MY" ? productQuery.eq("malaysia_available", true) : productQuery.eq("is_available", true);
  let productResult = await productQuery.order("sort_order").order("id");
  // Keep the shop working before the one-time product sorting SQL is installed.
  if (productResult.error && /sort_order/i.test(productResult.error.message || "")) {
    let fallbackQuery = db.from("products").select("*");
    fallbackQuery = state.market === "MY" ? fallbackQuery.eq("malaysia_available", true) : fallbackQuery.eq("is_available", true);
    productResult = await fallbackQuery.order("category").order("name");
  }
  const { data, error } = productResult;
  if (error) throw error;
  state.allMenu = (data || []).map((item) => ({
    ...item,
    category: item.category || "Other",
    name: item.name || "Untitled",
    description: item.description || "",
    price: Number(item.price || 0),
    discount_price: item.discount_price == null ? null : Number(item.discount_price),
    myr_discount_price: item.myr_discount_price == null ? null : Number(item.myr_discount_price),
    stock: item.stock == null ? null : Number(item.stock),
  }));
  applyMarketMenu();
}
function applyMarketMenu() {
  state.menu = state.allMenu.filter((item) => state.market !== "MY" || (item.malaysia_available === true && item.myr_price != null && Number.isFinite(Number(item.myr_price))));
}
function setMarket(market) {
  const next = market === "MY" && state.store.malaysia_enabled === true ? "MY" : "SG";
  if (next === state.market) return;
  state.market = next;
  try { localStorage.setItem("shizuku-market", next); } catch (_) {}
  state.cart = {};
  clearSavedCart();
  state.promo = null;
  state.form.collectionPoint = "";
  state.form.pickupDate = "";
  state.form.slotId = "";
  applyMarketMenu();
  render();
}
async function loadCustomerStockLevels() {
  const { data, error } = await db.rpc("get_shizuku_product_stock");
  if (error) {
    console.warn("Could not load calculated stock levels:", error.message);
    state.stockLevels = {};
    return;
  }
  state.stockLevels = Object.fromEntries((data || []).map((row) => [String(row.product_id), Number(row.available_quantity)]));
}
function startStockRefresh() {
  if (stockRefreshTimer || !IS_CONFIGURED) return;
  stockRefreshTimer = setInterval(async () => {
    if (document.visibilityState !== "visible") return;
    await loadCustomerStockLevels();
    if (state.screen === "menu" || state.screen === "options" || state.screen === "bundle" || state.screen === "cart") render();
  }, 30000);
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    await loadCustomerStockLevels();
    if (state.screen === "menu" || state.screen === "options" || state.screen === "bundle" || state.screen === "cart") render();
  });
}
async function loadProductGroups() {
  const { data, error } = await db.from("product_groups").select("*").eq("is_visible", true).order("sort_order").order("name");
  // The old shop continues to work before the one-time SQL upgrade is run.
  if (error) { console.warn("Could not load product groups:", error.message); state.productGroups = []; return; }
  state.productGroups = data || [];
}
async function loadOptions() {
  const [groupsResult, optionsResult, mappingsResult] = await Promise.all([
    db.from("option_groups").select("*").order("id"),
    db.from("options").select("*").eq("is_available", true).order("option_group_id").order("id"),
    db.from("product_option_groups").select("product_id, option_group_id"),
  ]);
  if (groupsResult.error) throw groupsResult.error;
  if (optionsResult.error) throw optionsResult.error;
  // Owners can hide a whole group (for example, Sweetness) from the dashboard.
  const optionVisibilityKey = partnerModeActive()
    ? "show_in_partner_referral"
    : state.market === "MY" ? "show_in_malaysia" : "show_in_singapore";
  state.optionGroups = (groupsResult.data || []).filter((group) => {
    if (group.is_visible === false) return false;
    if (optionVisibilityKey === "show_in_partner_referral") return group[optionVisibilityKey] === true;
    return group[optionVisibilityKey] !== false;
  });
  state.options = optionsResult.data || [];
  state.productOptionGroups = mappingsResult.error ? [] : (mappingsResult.data || []);
}

/* ---------- init ---------- */
async function init() {
  state.loading = true;
  state.loadError = null;
  state.slots = computeSlots();

  const requestedScreen = new URLSearchParams(window.location.search).get("screen");
  if (["track", "loyalty", "reviews"].includes(requestedScreen)) state.screen = requestedScreen;
  else {
    const pendingPayment = loadPendingPayment();
    if (pendingPayment) {
      state.lastOrder = pendingPayment.order;
      state.payment.expiresAt = Number(pendingPayment.expiresAt || 0);
      state.payment.transactionReference = String(pendingPayment.transactionReference || "");
      state.pendingPaymentAvailable = true;
      state.screen = "menu";
    } else if (pendingPayment) clearPendingPayment();
  }

  if (!IS_CONFIGURED) { state.loading = false; render(); return; }

  try {
    await ensureCustomerSession();
    await loadPartnerReferral();
    await loadStoreSettings();
    await reconcilePendingPayment();
    await loadOpeningOverrides();
    await Promise.all([loadFaq(), loadReviews()]);
    state.slots = computeSlots();
    await Promise.all([loadProducts(), loadOptions(), loadProductGroups(), loadCustomerStockLevels()]);
    sanitizeCartOptionsForStore();
    repriceCartForPartner();
    removeUnavailableCartItems();
    startStockRefresh();
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
function removeUnavailableCartItems(availableProductIds = null) {
  const available = availableProductIds || new Set(state.menu.map((product) => String(product.id)));
  const removedNames = [];
  Object.entries(state.cart).forEach(([key,item]) => {
    if (!item || available.has(String(item.productId))) return;
    removedNames.push(item.productName || "Unavailable item");
    delete state.cart[key];
  });
  if (removedNames.length) {
    saveCart();
    state.promo = null;
    state.cartNotice = `${removedNames.join(", ")} ${removedNames.length === 1 ? "was" : "were"} removed because ${removedNames.length === 1 ? "it is" : "they are"} no longer available.`;
  }
  return removedNames;
}
function cartNoticeMarkup() {
  return state.cartNotice ? `<div style="margin:0 20px 14px;padding:12px 14px;border:1px solid #d8c58e;border-radius:13px;background:#fff8df;color:#5b4b22;font-size:12px;line-height:1.45;">${escapeHtml(state.cartNotice)} <button type="button" style="float:right;border:0;background:none;font-weight:800;color:inherit;" onclick="state.cartNotice='';render()">×</button></div>` : "";
}
function pendingPaymentCanContinue(order) {
  if (!order) return false;
  const paymentStatus = String(order.payment_status || "awaiting_payment").toLowerCase();
  const orderStatus = String(order.order_status || "pending").toLowerCase();
  return paymentStatus === "awaiting_payment" && !["cancelled", "expired", "collected", "completed"].includes(orderStatus);
}
async function reconcilePendingPayment() {
  const snapshot = state.lastOrder;
  if (!state.pendingPaymentAvailable || !snapshot || !IS_CONFIGURED || !snapshot.order_number || !snapshot.customer_phone) return;
  const { data, error } = await db.rpc("track_shizuku_order", { p_order_number: snapshot.order_number, p_phone: snapshot.customer_phone }).maybeSingle();
  if (error || !data) return;
  if (!pendingPaymentCanContinue(data)) {
    state.pendingPaymentAvailable = false;
    state.lastOrder = null;
    clearPendingPayment();
    return;
  }
  state.lastOrder = { ...snapshot, ...data, items: Array.isArray(snapshot.items) ? snapshot.items : [] };
  savePendingPayment();
}
function resumePendingPayment() {
  if (!state.lastOrder) return;
  if (!Number(state.payment.expiresAt || 0) || Number(state.payment.expiresAt) <= Date.now()) {
    state.payment.expiresAt = Date.now() + 15 * 60 * 1000;
    savePendingPayment();
  }
  state.screen = "payment";
  render();
}
function dismissPendingPayment() { state.pendingPaymentAvailable = false; state.lastOrder = null; clearPendingPayment(); render(); }
function pendingPaymentMarkup() {
  if (!state.pendingPaymentAvailable || !state.lastOrder) return "";
  return `<section class="pending-payment-card" aria-label="Payment pending"><div class="pending-payment-label">PAYMENT PENDING</div><div class="pending-payment-row"><div><b>Order ${escapeHtml(state.lastOrder.order_number || state.lastOrder.id || "")}</b><div class="hint">${money(state.lastOrder.total)}</div></div><button class="btn-primary" onclick="resumePendingPayment()">Continue payment</button></div></section>`;
}
function cartCount() { return cartLines().reduce((sum, line) => sum + Number(line.qty || 0), 0); }
function cartTotal() { return cartLines().reduce((sum, line) => sum + Number(line.unitPrice || 0) * Number(line.qty || 0), 0); }
function partnerCartDiscountAmount() { return cartLines().reduce((sum, line) => sum + Math.max(0, Number(line.regularUnitPrice ?? line.unitPrice) - Number(line.unitPrice || 0)) * Number(line.qty || 0), 0); }
function partnerPricingIsUsed() { return partnerModeActive() && partnerCartDiscountAmount() > 0; }
function promoProductIds(promo) {
  const value = promo?.applicable_product_ids;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch (_) {} }
  return [];
}
function promoEligibleSubtotal(promo) {
  const ids = promoProductIds(promo);
  if (!ids.length) return cartTotal();
  return cartLines().reduce((sum, line) => ids.includes(String(line.productId)) ? sum + Number(line.unitPrice || 0) * Number(line.qty || 0) : sum, 0);
}
function promoDiscountAmount(promo) {
  if (!promo) return 0;
  const eligible = promoEligibleSubtotal(promo);
  const amount = String(promo.discount_type).toLowerCase() === "percent"
    ? eligible * (Number(promo.discount_value || 0) / 100)
    : Number(promo.discount_value || 0);
  return Math.min(eligible, Math.max(0, amount));
}
function orderTotal() {
  const discount = promoDiscountAmount(state.promo);
  return Math.max(0, cartTotal() - discount + selfDeliveryFee());
}
function isMalaysiaSelfDelivery() {
  return state.market === "MY" && state.store.malaysia_self_delivery_enabled === true && state.form.fulfilmentMethod === "delivery" && cartB2BType() === "drinks" && !cartIsRitualPassOnly();
}
function selfDeliveryFee() { return isMalaysiaSelfDelivery() ? Math.max(0, Number(state.store.malaysia_self_delivery_fee || 0)) : 0; }
function malaysiaDeliveryAddress() {
  const value = state.form.deliveryAddress || {};
  return { recipient_name: state.form.name.trim(), contact_number: normalisePhone(state.form.phone), address_line_1: String(value.address_line_1 || "").trim(), city: String(value.city || "").trim(), state: String(value.state || "").trim(), postal_code: String(value.postal_code || "").trim(), delivery_notes: String(value.delivery_notes || "").trim(), fulfilment_method: "self_delivery" };
}
function malaysiaDeliveryAddressValid() {
  const value = malaysiaDeliveryAddress();
  return Boolean(value.address_line_1 && value.city && value.state && /^\d{5}$/.test(value.postal_code));
}

/* ---------- options ---------- */
function getOptionsForGroup(groupId) {
  // Supabase column is option_group_id, not option_group
  return state.options.filter((option) => String(option.option_group_id) === String(groupId));
}
function optionGroupsForProduct(product) {
  if (!product) return [];
  const enabledIds = new Set(state.productOptionGroups.filter((row) => String(row.product_id) === String(product.id)).map((row) => String(row.option_group_id)));
  return state.optionGroups.filter((group) => enabledIds.has(String(group.id)));
}
function selectOption(groupId, optionId) {
  const option = state.options.find((item) => String(item.id) === String(optionId));
  if (!option) return;
  state.selectedOptions[groupId] = { productId: state.selectedProduct.id, optionId: option.id, optionName: option.name, price: Number(option.price || 0) };
  advanceOptionStep("product", groupId, optionGroupsForProduct(state.selectedProduct), state.selectedOptions);
}
function optionStepDomId(scope, groupId) {
  return `option-step-${String(scope).replace(/[^a-z0-9_-]/gi, "-")}-${String(groupId).replace(/[^a-z0-9_-]/gi, "-")}`;
}
function scrollToOptionStep(scope, groupId) {
  if (groupId == null) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.getElementById(optionStepDomId(scope, groupId))?.scrollIntoView({ behavior: "smooth", block: "center" });
  }));
}
function openOptionStep(scope, groupId) {
  state.expandedOptionSteps[scope] = String(groupId);
  render();
  scrollToOptionStep(scope, groupId);
}
function advanceOptionStep(scope, groupId, groups, selectedOptions) {
  state.expandedOptionSteps[scope] = null;
  const currentIndex = groups.findIndex((group) => String(group.id) === String(groupId));
  const nextGroup = groups.slice(Math.max(0, currentIndex + 1)).find((group) => !selectedOptions[group.id]);
  render();
  if (nextGroup) scrollToOptionStep(scope, nextGroup.id);
}
function skippedOption(product) {
  return { productId: product.id, optionId: null, optionName: tr("skip"), price: 0, skipped: true };
}
function defaultOptionSelections(product) {
  // Optional choices stay unanswered until the customer selects an option or
  // explicitly taps Skip. Do not silently choose Skip for Milk or Packaging.
  return {};
}
function skipOptionStep(scope, groupId, drinkNumber = null) {
  const group = state.optionGroups.find((item) => String(item.id) === String(groupId));
  if (!group || group.required) return;
  let selectedOptions = state.selectedOptions;
  let product = state.selectedProduct;
  if (drinkNumber != null) { selectedOptions = bundleDrinkOptions(drinkNumber); product = bundleDrink(drinkNumber); }
  if (!product) return;
  const groups = optionGroupsForProduct(product);
  selectedOptions[groupId] = skippedOption(product);
  advanceOptionStep(scope, groupId, groups, selectedOptions);
}
function renderProgressiveOptionGroups(product, selectedOptions, drinkNumber = null) {
  const groups = optionGroupsForProduct(product);
  if (!groups.length) return `<div class="hint">${tr("no_options")}</div>`;
  const scope = drinkNumber == null ? "product" : `bundle${drinkNumber}`;
  const requestedGroupId = state.expandedOptionSteps[scope];
  const requestedIndex = requestedGroupId == null ? -1 : groups.findIndex((group) => String(group.id) === String(requestedGroupId));
  const firstIncompleteIndex = groups.findIndex((group) => !selectedOptions[group.id]);
  const activeIndex = requestedIndex >= 0 ? requestedIndex : firstIncompleteIndex;

  return `<div class="progressive-options">${groups.map((group, index) => {
    const selected = selectedOptions[group.id];
    if (!selected && index !== activeIndex) return "";
    const stepNumber = index + 1;
    if (selected && index !== activeIndex) {
      return `<button type="button" class="option-step-summary" id="${optionStepDomId(scope, group.id)}" onclick="openOptionStep('${scope}','${escapeHtml(group.id)}')">
        <span class="option-step-number">${stepNumber}</span>
        <span class="option-step-summary-copy"><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(selected.optionName || "Selected")}</small></span>
        <span class="option-step-change">${tr("change")}</span>
      </button>`;
    }
    const options = getOptionsForGroup(group.id);
    const optionHandler = drinkNumber == null
      ? (optionId) => `selectOption('${escapeHtml(group.id)}','${escapeHtml(optionId)}')`
      : (optionId) => `selectBundleOption(${drinkNumber},'${escapeHtml(group.id)}','${escapeHtml(optionId)}')`;
    const mustChoose = group.required;
    return `<section class="field product-option-group option-step-open" id="${optionStepDomId(scope, group.id)}">
      <div class="option-step-heading">
        <span class="option-step-number">${stepNumber}</span>
        <label><span class="option-kana">${tr("customisation")}</span>${escapeHtml(group.name)}${mustChoose ? " *" : ` (${tr("optional")})`}</label>
      </div>
      <div>
        ${options.map((option) => `<button type="button" class="slot ${selected && String(selected.optionId) === String(option.id) ? "active" : ""}" onclick="${optionHandler(option.id)}">
          <div><div class="slot-day">${escapeHtml(option.name)}</div><div class="slot-time">${optionPriceLabel(option.price)}</div></div>
        </button>`).join("")}
        ${mustChoose ? "" : `<button type="button" class="option-skip ${selected?.skipped ? "active" : ""}" onclick="skipOptionStep('${scope}','${escapeHtml(group.id)}',${drinkNumber == null ? "null" : drinkNumber})">${tr("skip")}</button>`}
      </div>
    </section>`;
  }).join("")}</div>`;
}
function validateRequiredOptions() {
  const groups = optionGroupsForProduct(state.selectedProduct);
  for (const group of groups) {
    if (!group.required) continue;
    if (!state.selectedOptions[group.id]) { alert(`Please choose an option for "${group.name}".`); return false; }
  }
  return true;
}
function getSelectedOptionsForProduct(productId) {
  return Object.values(state.selectedOptions).filter((selected) => !selected.skipped && String(selected.productId) === String(productId));
}
function calculateProductPrice(product) {
  let price = partnerMemberBasePrice(product);
  getSelectedOptionsForProduct(product.id).forEach((selected) => { price += Number(selected.price || 0); });
  return Math.max(0, Math.round(price * 100) / 100);
}

/* ---------- normal product ---------- */
function openProductOptions(productId) {
  const product = state.menu.find((item) => String(item.id) === String(productId));
  if (!product) return;
  if (isSoldOut(product)) { alert("Sorry, this item is sold out."); return; }
  state.selectedProduct = product;
  state.selectedOptions = defaultOptionSelections(product);
  state.expandedOptionSteps = { product: null };
  if (isBundle(product)) {
    resetBundleSelection(product);
    state.screen = "bundle";
  } else {
    state.screen = "options";
  }
  render();
}
function addConfiguredProductToCart() {
  const product = state.selectedProduct;
  if (!product) return;
  if (isSoldOut(product)) { alert("Sorry, this item is sold out."); return; }
  if (!validateRequiredOptions()) return;
  if(isRitualRedemptionMode()&&!ritualEligibleProduct(product))return alert("This item is not eligible for Matcha Pass credits.");
  if(isRitualRedemptionMode()&&ritualCreditsInCart()>=ritualAvailable())return alert(`You only have ${ritualAvailable()} unreserved Matcha Pass drinks available.`);
  const selectedOptions = getSelectedOptionsForProduct(product.id);
  const optionsKey = selectedOptions.map((option) => String(option.optionId)).sort().join("-");
  const key = `${product.id}__${optionsKey}`;
  const unitPrice = isRitualRedemptionMode() ? Math.round((Number(ritualDrinkTopUp(product)||0)+selectedOptions.reduce((sum,option)=>sum+Number(option.price||0),0))*100)/100 : calculateProductPrice(product);
  const available = productStock(product);
  if (available != null) {
    const existingQty = state.cart[key]?.qty || 0;
    if (existingQty >= available) { alert("Sorry, this item is sold out."); return; }
  }
  state.cart[key] = {
    productId: product.id, productName: product.name, imageUrl: product.image_url || "",
    unitPrice, regularUnitPrice: isRitualRedemptionMode() ? unitPrice : Math.max(0, Math.round((salePrice(product) + selectedOptions.reduce((sum, option) => sum + Number(option.price || 0), 0)) * 100) / 100), basePrice: isRitualRedemptionMode()?Number(ritualDrinkTopUp(product)||0):salePrice(product), qty: (state.cart[key]?.qty || 0) + 1, options: selectedOptions, isRitualRedemption:isRitualRedemptionMode(),
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
  if (isSoldOut(product)) { alert("Sorry, this drink is sold out."); return; }
  state.bundle[`drink${slot}`] = product;
  state.bundle[`drink${slot}Options`] = defaultOptionSelections(product);
  state.expandedOptionSteps[`bundle${slot}`] = null;
  render();
}
function selectBundleOption(drinkNumber, groupId, optionId) {
  const option = state.options.find((item) => String(item.id) === String(optionId));
  if (!option) return;
  const value = {
    productId: bundleDrink(drinkNumber).id,
    optionId: option.id, optionName: option.name, price: Number(option.price || 0),
  };
  bundleDrinkOptions(drinkNumber)[groupId] = value;
  const drink = bundleDrink(drinkNumber);
  const selectedOptions = bundleDrinkOptions(drinkNumber);
  advanceOptionStep(`bundle${drinkNumber}`, groupId, optionGroupsForProduct(drink), selectedOptions);
}
function validateBundleDrink(drink, selectedOptions) {
  if (!drink) return false;
  const groups = optionGroupsForProduct(drink);
  for (const group of groups) {
    if (!group.required) continue;
    if (!selectedOptions[group.id]) return false;
  }
  return true;
}
function addBundleToCart() {
  const bundle = state.selectedProduct;
  if (!bundle) return;
  if (isSoldOut(bundle)) { alert("Sorry, this bundle is sold out."); return; }
  const count=bundleSelectionCount(bundle),drinks=Array.from({length:count},(_,i)=>bundleDrink(i+1)),optionSets=Array.from({length:count},(_,i)=>bundleDrinkOptions(i+1));
  const missing=drinks.findIndex((drink)=>!drink); if(missing>=0){alert(`Please choose Drink ${missing+1}.`);return;}
  if(drinks.some(isSoldOut)){alert("Sorry, one of the selected drinks is sold out.");return;}
  const requiredByProduct=new Map();drinks.forEach(drink=>requiredByProduct.set(String(drink.id),(requiredByProduct.get(String(drink.id))||0)+1));
  for(const drink of drinks){const needed=requiredByProduct.get(String(drink.id)),available=productStock(drink);if(available!=null&&available<needed){alert(`Only ${available} ${drink.name} left. Please choose another drink.`);return;}}
  for(let i=0;i<count;i++){if(!validateBundleDrink(drinks[i],optionSets[i])){alert(`Please complete the options for Drink ${i+1}.`);return;}}
  const cleanOptions=optionSets.map(set=>Object.values(set).filter(option=>!option.skipped));
  const unitPrice=selectedBundlePrice(bundle,drinks,optionSets);
  let regularUnitPrice=salePrice(bundle);
  if(isDynamicBundle(bundle))drinks.forEach((drink,index)=>{regularUnitPrice+=bundleOptionPrice(bundle,drink)+bundleOptionExtras(optionSets[index]);});
  regularUnitPrice=Math.max(0,Math.round(regularUnitPrice*100)/100);
  const bundleOptions=drinks.map((drink,index)=>({drinkNumber:index+1,productId:drink.id,productName:drink.name,options:cleanOptions[index]}));
  const key=`${bundle.id}__${drinks.map(d=>d.id).join("-")}__${cleanOptions.map(set=>set.map(x=>x.optionId).sort().join("-")).join("__")}`;
  state.cart[key] = {
    productId: bundle.id, productName: bundle.name, imageUrl: bundle.image_url || "",
    unitPrice, regularUnitPrice, basePrice: unitPrice, qty: (state.cart[key]?.qty || 0) + 1, options: bundleOptions,
  };
  state.selectedProduct = null;
  state.bundle = {};
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
  if(delta>0&&isRitualRedemptionMode()&&ritualCreditsInCart()>=ritualAvailable()){alert(`You only have ${ritualAvailable()} unreserved Matcha Pass drinks available.`);return;}
  if (delta > 0 && isSoldOut(product)) { alert("Sorry, this item is sold out."); return; }
  const available = productStock(product);
  if (available != null && nextQty > available) { alert("Sorry, this item is sold out."); return; }
  item.qty = Math.max(0, nextQty);
  if (item.qty === 0) delete state.cart[key];
  saveCart();
  render();
}

/* ---------- screen ---------- */
function setScreen(screen) { state.screen = screen; render(); }
function setCategory(category) {
  const pageY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  const categoryScroll = document.querySelector(".cats")?.scrollLeft || 0;
  state.activeCategory = category;
  render();
  const restoreMenuPosition = () => {
    const cats = document.querySelector(".cats");
    if (cats) cats.scrollLeft = categoryScroll;
    document.documentElement.scrollTop = pageY;
    document.body.scrollTop = pageY;
    window.scrollTo({ top: pageY, behavior: "auto" });
  };
  requestAnimationFrame(() => requestAnimationFrame(restoreMenuPosition));
  setTimeout(restoreMenuPosition, 80);
}

/* ---------- promo ---------- */
function promoStorageCode(code) {
  const visible = String(code || "").trim().toUpperCase().replace(/^MY:/, "");
  return state.market === "MY" ? `MY:${visible}` : visible;
}
async function applyPromoCode() {
  if (partnerModeActive()) { state.promo = null; state.promoMsg = "Partner member pricing cannot be combined with promo codes."; render(); return; }
  const code = (state.form.promoCode || "").trim().toUpperCase();
  if (!code) { state.promoMsg = "Please enter a promo code."; render(); return; }
  if (!isValidPhone(state.form.phone)) { state.promoMsg = state.market === "MY" ? "Enter a valid Malaysia mobile number, e.g. 0121234567." : "Enter a valid Singapore phone number first."; render(); return; }
  if (!IS_CONFIGURED) { state.promoMsg = "Connect Supabase to validate promo codes."; render(); return; }

  try {
    const storedCode = promoStorageCode(code);
    const { data, error } = await db.from("promo_codes").select("*").eq("code", storedCode).eq("market_code", state.market).eq("is_active", true).limit(1);
    if (error) throw error;
    const promo = data?.[0];
    if (!promo) { state.promo = null; state.promoMsg = "That promo code isn't valid."; render(); return; }

    const now = new Date();
    if (promo.valid_from && new Date(promo.valid_from) > now) { state.promo = null; state.promoMsg = "That promo code is not active yet."; render(); return; }
    if (promo.valid_until && new Date(promo.valid_until) < now) { state.promo = null; state.promoMsg = "That promo code has expired."; render(); return; }

    const minimumSpend = Number(promo.minimum_spend || 0);
    const eligibleSubtotal = promoEligibleSubtotal(promo);
    const applicableIds = promoProductIds(promo);
    if (applicableIds.length && eligibleSubtotal <= 0) {
      const names = applicableIds.map((id) => state.menu.find((item) => String(item.id) === id)?.name).filter(Boolean);
      state.promo = null;
      state.promoMsg = `This code only applies to: ${names.join(", ") || "selected products"}.`;
      render(); return;
    }
    if (eligibleSubtotal < minimumSpend) { state.promo = null; state.promoMsg = `Minimum eligible spend is ${money(minimumSpend)}.`; render(); return; }

    if (promo.usage_limit != null && Number(promo.used_count || 0) >= Number(promo.usage_limit)) {
      state.promo = null; state.promoMsg = "That code has reached its usage limit."; render(); return;
    }

    try {
      const { count: usedByPhone } = await db.from("promo_redemptions").select("id", { count: "exact", head: true }).eq("market_code", state.market).ilike("code", storedCode).eq("phone", normalisePhone(state.form.phone));
      if ((usedByPhone || 0) > 0) { state.promo = null; state.promoMsg = "You've already used this code."; render(); return; }
    } catch (e) { /* best-effort — table may not exist */ }

    state.promo = { id: promo.id, code: promo.code, discount_type: promo.discount_type, discount_value: Number(promo.discount_value || 0), minimum_spend: Number(promo.minimum_spend || 0), used_count: promo.used_count, applicable_product_ids: applicableIds };
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
function cartB2BType(){return ShizukuB2B.classify(cartLines(),state.menu);}
function b2bAddress(){return {...(state.form.deliveryAddress||{}),recipient_name:state.form.name.trim(),contact_number:normalisePhone(state.form.phone)};}
function checkoutReady(){
  if(isRitualRedemptionMode())return cartLines().length>0&&ritualCreditsInCart()<=ritualAvailable()&&Boolean(state.form.slotId);
  if (!state.form.name.trim() || !isValidPhone(state.form.phone)) return false;
  if (cartIsRitualPassOnly()) return /^\S+@\S+\.\S+$/.test(state.form.email.trim());
  if (cartB2BType()==='b2b') return !ShizukuB2B.addressError(b2bAddress(),state.market);
  if (cartB2BType()!=='drinks' || !state.form.slotId) return false;
  return isMalaysiaSelfDelivery() ? malaysiaDeliveryAddressValid() : Boolean(state.form.collectionPoint);
}
function b2bCheckoutFields(){const a=state.form.deliveryAddress||{};return '<div class="ref-note"><b>Fulfilment: Free Delivery</b><br>Delivery is included in the product price.</div>'+ShizukuB2B.fields.filter(([k])=>!['recipient_name','contact_number'].includes(k)).map(([k,label,required])=>`<div class="field"><label>${label}${required?' *':''}</label><input value="${escapeHtml(a[k]||'')}" ${k==='postal_code'?'inputmode="numeric"':''} oninput="state.form.deliveryAddress=state.form.deliveryAddress||{};state.form.deliveryAddress['${k}']=this.value;onFormInput('deliveryAddress',state.form.deliveryAddress)"></div>`).join('');}
function b2bOrderSummary(o){return `<div class="row"><span>Fulfilment</span><b>Free Delivery</b></div><p style="text-align:left;white-space:pre-line">${escapeHtml(ShizukuB2B.addressText(o.delivery_address))}</p>${o.courier?`<div class="row"><span>Courier</span><span>${escapeHtml(o.courier)}</span></div>`:''}${o.tracking_number?`<div class="row"><span>Tracking Number</span><span>${escapeHtml(o.tracking_number)}</span></div>`:''}`;}
function partnerOrderItemsPayload() {
  return cartLines().map((line) => {
    const product = state.menu.find((item) => String(item.id) === String(line.productId));
    if (isBundle(product)) return {
      product_id: String(line.productId), quantity: Number(line.qty || 1),
      option_ids: [],
      bundle_components: (line.options || []).map((drink, index) => ({
        drink_number: Number(drink.drinkNumber || index + 1), product_id: String(drink.productId),
        option_ids: sanitizeOptionsForProduct(
          state.menu.find((item) => String(item.id) === String(drink.productId)),
          drink.options
        ).map((option) => String(option.optionId)).filter(Boolean),
      })),
    };
    return { product_id: String(line.productId), quantity: Number(line.qty || 1), option_ids: sanitizeOptionsForProduct(product, line.options).map((option) => String(option.optionId)).filter(Boolean), bundle_components: [] };
  });
}
async function submitRitualRedemption(){
  const pass=selectedRitualPass(),slot=state.slots.find((item)=>String(item.id)===String(state.form.slotId));
  if(!pass||!slot||!state.form.collectionPoint||!cartLines().length)return alert("Choose your drinks, collection date, time and collection point.");
  if(ritualCreditsInCart()>ritualAvailable(pass))return alert(`You only have ${ritualAvailable(pass)} unreserved Matcha Pass drinks available.`);
  if(!IS_CONFIGURED)return alert("Connect Supabase to redeem a Matcha Pass.");
  const items=cartLines().map((line)=>({product_id:String(line.productId),quantity:Number(line.qty||1)}));
  const {data,error}=await db.rpc("create_shizuku_matcha_redemption",{p_pass_id:pass.id,p_phone:normalisePhone(state.ritual.phone),p_items:items,p_collection_date:slot.date,p_collection_time:slot.time,p_collection_point:state.form.collectionPoint||defaultCollectionPoint(),p_idempotency_key:state.ritual.idempotencyKey});
  if(error)return alert(error.message||"Could not confirm this Matcha Pass redemption.");
  state.lastOrder={...data,id:data.order_id,order_kind:"matcha_pass_redemption",total:Number(data.top_up_total||0),customer_name:data.customer_name,customer_phone:data.customer_phone,customer_email:data.customer_email,collection_date:data.collection_date,collection_time:data.collection_time,collection_point:data.collection_point,items:cartLines().map((line)=>({...line})),payment_status:data.payment_status,order_status:data.payment_status==="paid"?"confirmed":"pending",market_code:"SG",currency_code:"SGD",matcha_pass_credits_used:Number(data.credits_used||0),matcha_pass_remaining:Number(data.remaining||0)};
  state.cart={};saveCart();state.ritual.redemptionMode=false;state.ritual.savedCart=null;
  const current=(state.ritual.passes||[]).find((item)=>String(item.id)===String(pass.id));if(current){current.remaining_credits=Number(data.remaining??ritualRemaining(current));current.reserved_credits=Number(data.reserved_credits??(ritualReserved(current)+Number(data.credits_used||0)));current.available_credits=Number(data.available_credits??Math.max(0,current.remaining_credits-current.reserved_credits));}
  state.screen=Number(data.top_up_total||0)>0?"payment":"confirmation";
  if(Number(data.top_up_total||0)>0){state.payment.expiresAt=Date.now()+15*60*1000;savePendingPayment();}
  render();
}
async function submitOrder() {
  const f = state.form;
  if (!cartLines().length) { alert("Your cart is empty."); setScreen("menu"); return; }
  if(isRitualRedemptionMode())return submitRitualRedemption();
  if (IS_CONFIGURED) {
    try { await loadOptions(); }
    catch (error) { alert("Unable to check the latest store options. Please try again."); return; }
  }
  if (sanitizeCartOptionsForStore() > 0) {
    repriceCartForPartner();
    state.screen = "cart";
    render();
    alert("An option that is hidden for this store was removed. Please check your updated cart total before continuing.");
    return;
  }
  if (IS_CONFIGURED) {
    const ids = [...new Set(cartLines().map(line => line.productId))];
    const {data: products, error} = await db.from("products").select("id,is_available,is_b2b").in("id", ids);
    if (error) { alert("Unable to check the latest product availability. Please try again."); return; }
    const available = new Set((products || []).filter(p => p.is_available !== false).map(p => String(p.id)));
    if (removeUnavailableCartItems(available).length) { setScreen("cart"); alert("An unavailable item was removed. Please check your cart."); return; }
    const previousType = cartB2BType();
    state.menu.forEach(p => { const latest = (products || []).find(x => String(x.id) === String(p.id)); if (latest) p.is_b2b = latest.is_b2b === true; });
    if (previousType !== cartB2BType()) { render(); alert("The product fulfilment has been updated. Please review your checkout details before continuing."); return; }
  }
  const type=cartB2BType(),isB2B=type==='b2b',isRitualPass=cartIsRitualPassOnly();
  if(type==='mixed'){alert('B2B products need to be ordered separately from drinks.');return;}
  if(isB2B&&ShizukuB2B.addressError(b2bAddress(),state.market)){alert(ShizukuB2B.addressError(b2bAddress(),state.market));return;}
  if (!f.name.trim()) { alert("Please enter your name."); return; }
  if (!isValidPhone(f.phone)) { alert(state.market === "MY" ? "Please enter a valid Malaysia mobile number (for example, 0121234567 or +60121234567)." : "Please enter a valid Singapore phone number (for example, 91234567)."); return; }
  if (isRitualPass && !/^\S+@\S+\.\S+$/.test(f.email.trim())) { alert("Please enter the email address for your Matcha Pass."); return; }
  if (state.store.show_checkout_email !== false && f.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) { alert("Please enter a valid email address, or leave it blank."); return; }
  if (!isB2B && !isRitualPass && !f.slotId) { alert("Please select a pickup slot."); return; }
  const isSelfDelivery = isMalaysiaSelfDelivery();
  if (!isB2B && !isRitualPass && !isSelfDelivery && !f.collectionPoint) { alert("Please select a collection point."); return; }
  if (isSelfDelivery && !malaysiaDeliveryAddressValid()) { alert("Please complete the delivery address, city, state and 5-digit postcode."); return; }
  if (cartLines().length === 0) { alert("Your cart is empty."); setScreen("menu"); return; }
  if (state.promo) {
    const eligibleSubtotal = promoEligibleSubtotal(state.promo);
    if (eligibleSubtotal <= 0 || eligibleSubtotal < Number(state.promo.minimum_spend || 0)) {
      state.promo = null;
      state.promoMsg = "Your cart changed, so the promo code was removed. Please check your total.";
      render();
      return;
    }
  }
  const slot = state.slots.find((item) => item.id === f.slotId);
  if (!isB2B && !isRitualPass && !slot) { alert("Please select a valid pickup slot."); return; }

  const orderNumber = uidCode();
  const total = orderTotal();
  // Each payment screen gets its own 15-minute PayNow request window.
  state.payment.expiresAt = Date.now() + 15 * 60 * 1000;

  // NOTE: your Supabase orders table column for phone is customer_phone.
  const orderPayload = {
    order_number: orderNumber,
    customer_name: f.name.trim(),
    customer_phone: normalisePhone(f.phone),
    customer_email: state.store.show_checkout_email === false ? null : (f.email.trim() || null),
    collection_date: isB2B || isRitualPass ? null : slot.date,
    collection_time: isB2B || isRitualPass ? null : slot.time,
    collection_point: isB2B || isRitualPass ? null : (isSelfDelivery ? "Self delivery" : f.collectionPoint),
    is_b2b:isB2B,delivery_address:isB2B?b2bAddress():(isSelfDelivery?malaysiaDeliveryAddress():{}),
    instagram: f.instagram ? f.instagram.trim().replace(/^@/, "") : "",
    total,
    payment_status: "awaiting_payment",
    order_status: isB2B ? "preparing" : "pending",
    notes: f.notes.trim() || null,
    payment_method: state.market === "MY" ? "Touch 'n Go" : "PayNow",
    payment_reference: orderNumber,
    market_code: state.market,
    currency_code: state.market === "MY" ? "MYR" : "SGD",
    order_kind: isRitualPass ? "matcha_pass_purchase" : "retail",
    fulfilment_method: isB2B ? "b2b_delivery" : (isSelfDelivery ? "self_delivery" : "collection"),
    delivery_fee: isSelfDelivery ? selfDeliveryFee() : 0,
    marketing_email_opt_in: Boolean(f.marketingOptIn && state.store.marketing_email_enabled !== false && f.email.trim()),
    marketing_whatsapp_opt_in: Boolean(f.marketingOptIn && state.store.marketing_whatsapp_enabled === true),
    marketing_consent_text: f.marketingOptIn ? String(state.store.marketing_opt_in_label || "Keep me in the loop about monthly opening dates, new drinks and special offers.") : null,
    marketing_consent_at: f.marketingOptIn ? new Date().toISOString() : null,
  };
  if (state.customerId) orderPayload.customer_id = state.customerId;

  if (!IS_CONFIGURED) {
    state.lastOrder = { ...orderPayload, id: null, items: cartLines().map((line) => ({ ...line })), slot };
    state.screen = "payment";
    savePendingPayment();
    render();
    return;
  }

  if (partnerModeActive() && !isRitualPass) {
    try {
      const partnerOrderPayload = { ...orderPayload, customer_id: state.customerId || null };
      const { data: partnerOrder, error: partnerOrderError } = await db.rpc("create_shizuku_partner_order", {
        p_partner_slug: state.partner.slug,
        p_order: partnerOrderPayload,
        p_items: partnerOrderItemsPayload(),
      });
      if (partnerOrderError) throw partnerOrderError;
      state.lastOrder = { ...partnerOrder, items: cartLines().map((line) => ({ ...line })), slot };
      state.screen = "payment";
      savePendingPayment();
      render();
      return;
    } catch (error) {
      console.error("Partner order submission error:", error);
      if (/partner offer is no longer available/i.test(error?.message || "")) {
        clearPartnerSession();
        repriceCartForPartner();
        state.screen = "cart";
        render();
        alert("This Partner offer is no longer available. Your cart has returned to normal Shizuku prices.");
        return;
      }
      alert("Something went wrong submitting your Partner order. Please try again.\n\n" + (error?.message || String(error)));
      return;
    }
  }

  let createdOrderId = null;
  try {
    const { data: order, error: orderError } = await db.from("orders").insert(orderPayload).select("*").single();
    if (orderError) throw orderError;
    createdOrderId = order.id;

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
      const { error: redemptionError } = await db.from("promo_redemptions").insert({ market_code: state.market, code: state.promo.code, phone: normalisePhone(f.phone), order_id: order.id });
      if (redemptionError) {
        const fullTotal = cartTotal();
        const { error: totalError } = await db.from("orders").update({ total: fullTotal }).eq("id", order.id);
        if (totalError) throw totalError;
        order.total = fullTotal;
        state.promo = null;
        state.promoMsg = "This phone number has already used that promo code.";
        alert("This phone number has already used that promo code. The order total has been returned to the normal price.");
      } else {
        await db.from("promo_codes").update({ used_count: (Number(state.promo.used_count) || 0) + 1 }).eq("id", state.promo.id);
      }
    }

    state.lastOrder = { ...order, items: cartLines().map((line) => ({ ...line })), slot };
    state.screen = "payment";
    savePendingPayment();
    render();
  } catch (error) {
    console.error("Order submission error:", error);
    if (createdOrderId) await db.from("orders").delete().eq("id", createdOrderId);
    if (/only\s+\d+\s+item/i.test(error?.message || "")) {
      await loadCustomerStockLevels();
      render();
      alert("Sorry, there is not enough stock left for one of the items in your cart. Please update your cart and try again.");
      return;
    }
    if (/sold out|no longer available/i.test(error?.message || "")) {
      await loadProducts();
      await loadCustomerStockLevels();
      state.cart = {};
      clearSavedCart();
      state.screen = "menu";
      render();
      alert("Sorry, one of the items in your cart is now sold out. Your cart has been refreshed.");
      return;
    }
    if (/pickup window.*full|fully booked|capacity/i.test(error?.message || "")) {
      await loadOpeningOverrides();
      state.slots = computeSlots();
      state.form.slotId = "";
      render();
      alert("Sorry, that pickup window has just filled up. Please choose another time.");
      return;
    }
    alert("Something went wrong submitting your order. Please try again.\n\n" + (error?.message || String(error)));
  }
}

/* ---------- mark paid ---------- */
function onPaymentReference(value) {
  state.payment.transactionReference = value;
  savePendingPayment();
}

function onPaymentProof(input) {
  const file = input && input.files && input.files[0];
  if (!file) {
    state.payment.proofFile = null;
    render();
    return;
  }
  if (!String(file.type || "").startsWith("image/")) {
    alert("Please upload an image file for the payment screenshot.");
    input.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert("Please choose an image of 5 MB or smaller.");
    input.value = "";
    return;
  }
  state.payment.proofFile = file;
  render();
}

function openInstagramPaymentHelp() {
  const order = state.lastOrder;
  const instagramHandle = String(state.store.instagram || "shizukulab.matcha").replace(/^@/, "");
  const url = `https://ig.me/m/${encodeURIComponent(instagramHandle)}`;
  try { navigator.clipboard?.writeText(order?.order_number || order?.id || ""); } catch (error) { /* best effort */ }
  window.open(url, "_blank");
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
    if (uploadError) {
      alert("Could not upload your payment screenshot. Please try again.\n\n" + uploadError.message);
      return;
    }
    const { error } = await db.rpc("submit_payment_proof", {
      p_order_id: order.id,
      p_transaction_reference: state.payment.transactionReference.trim() || null,
      p_screenshot_path: upload.path,
    });
    if (error) {
      alert("Could not update payment status.\n" + error.message);
      return;
    }
  }
  state.lastOrder = { ...order, payment_status: "submitted", order_status: order.is_b2b?"preparing":"awaiting_confirmation" };
  state.cart = {};
  clearSavedCart();
  clearPendingPayment();
  state.form.collectionPoint = "";
  state.payment = { transactionReference: "", proofFile: null, expiresAt: null };
  state.pendingPaymentAvailable = false;
  state.screen = "receipt";
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
function partnerMemberBanner() {
  if (!partnerModeActive()) return "";
  const partner = state.partner;
  return `<section class="partner-member-banner" aria-label="Partner member perk">
    ${partner.logo_url ? `<img src="${escapeHtml(partner.logo_url)}" alt="${escapeHtml(partner.name)} logo">` : ""}
    <div class="partner-member-copy"><div class="partner-member-kicker">Shizuku Lab × ${escapeHtml(partner.name)}</div><b>Member Perk Applied <span aria-hidden="true">✓</span></b><p>${escapeHtml(partner.member_benefit_label || "Partner member pricing")}</p></div>
  </section>`;
}
function storeInfoPanel() {
  const igHandle = String(state.store.instagram || "shizukulab.matcha").replace(/^@/, "");
  const whatsappNumber = String(state.store.whatsapp_number || "").replace(/\D/g, "");
  const whatsappLink = partnerFeatureEnabled("whatsapp") && state.store.show_whatsapp && whatsappNumber
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
  const collectionAddress = escapeHtml(marketCollectionSettings().address);
  const nextCollections = nextCollectionSchedule(6);
  return `
    ${state.store.show_ticker === false || !partnerFeatureEnabled("ticker") ? "" : `<div class="promo-ticker"><div class="promo-ticker-track"><span>${tickerText}</span><span>${tickerText}</span><span>${tickerText}</span></div></div>`}
    <div class="store-panel">
      <div class="store-banner" style="--banner-height:${bannerHeight}px;background-position:${bannerX}% ${bannerY}%;background-image:linear-gradient(90deg,rgba(52,69,39,.14),rgba(52,69,39,.05)),url('${escapeHtml(bannerImage)}');"><span class="store-logo-overlap" style="--logo-circle-size:${logoCircleSize}px;"><img src="${escapeHtml(logoUrl)}" style="transform:translate(${logoImageX}%,${logoImageY}%) scale(${logoImageScale});" alt="${escapeHtml(state.store.store_name)} logo"></span></div>
      <div class="store-panel-body" style="padding-top:${Math.round(logoCircleSize / 2 + 12)}px;">
        <a class="store-insta" href="https://instagram.com/${encodeURIComponent(igHandle)}" target="_blank" rel="noopener">@${escapeHtml(igHandle)}</a>${whatsappLink}
        ${state.store.reviews_enabled === false || !partnerFeatureEnabled("reviews") ? "" : `<button type="button" class="write-review-link" onclick="setScreen('reviews')">${escapeHtml(state.store.review_cta_label || "Share your Shizuku moment")}</button>`}
        <div class="store-dropoff">${collectionAddress}</div>
        <p class="store-desc">${storeDescription}</p>
        ${homeCollectionMapCard()}
        ${pendingPaymentMarkup()}
        ${partnerFeatureEnabled("next_collection") ? nextCollectionCard(nextCollections) : ""}
        ${partnerMemberBanner()}
        ${ritualPassBanner()}
        ${customerStoreActions()}
      </div>
    </div>
  `;
}

/* ---------- header ---------- */
function header() {
  const storeName = escapeHtml(state.store.store_name || "Shizuku Lab");
  const storeTaglineRaw = String(state.store.store_tagline || "雫ラボ · crafted drop by drop");
  const storeTagline = escapeHtml(storeTaglineRaw);
  const partnerTaglineParts = storeTaglineRaw.split("·");
  const partnerKana = escapeHtml(partnerTaglineParts.shift()?.trim() || "雫ラボ");
  const partnerTagline = `<div class="brand-sub partner-brand-sub">${escapeHtml(partnerTaglineParts.join("·").trim() || "crafted drop by drop")}</div>`;
  const brandTitle = partnerModeActive()
    ? `<div class="partner-brand-lockup" aria-label="${storeName} and ${escapeHtml(state.partner.name)}"><span class="partner-brand-store-stack"><span class="partner-brand-store">${storeName}</span><span class="partner-brand-kana">${partnerKana} ·</span></span><span class="partner-brand-x">×</span><span class="partner-brand-name">${escapeHtml(state.partner.name)}</span></div>`
    : storeName;
  const headerControls = partnerModeActive() ? "" : `<div class="header-actions">
    ${state.market === "MY" ? `<label class="store-language-switch" aria-label="Language"><select onchange="setStoreLanguage(this.value)"><option value="en" ${state.language === "en" ? "selected" : ""}>English</option><option value="ms" ${state.language === "ms" ? "selected" : ""}>Bahasa Melayu</option><option value="zh" ${state.language === "zh" ? "selected" : ""}>中文</option></select></label>` : ""}
    <div class="header-market-switch" aria-label="Ordering workspace"><span>${tr("store")}</span><button type="button" class="active" disabled>${state.market === "MY" ? "Malaysia · MYR" : "Singapore · SGD"}</button></div>
  </div>`;
  return `
    <div class="header ${partnerModeActive() ? "partner-header" : ""}">
      <div class="header-row">
        <div>
          <div class="display brand-title ${partnerModeActive() ? "partner-brand-title" : ""}">${brandTitle}</div>
          ${partnerModeActive() ? partnerTagline : `<div class="brand-sub">${storeTagline}</div>`}
        </div>
        ${headerControls}
      </div>
      <svg class="drip-row" viewBox="0 0 300 30" aria-hidden="true">
        ${[0, .85, 1.7].map((delay, index) => {
          const cx = [40, 150, 260][index];
          return `<g class="native-drip">
            <circle cx="${cx}" cy="4" r="2.4" fill="var(--matcha)" opacity="0">
              <animate attributeName="cy" values="4;4;25;25" keyTimes="0;.08;.58;1" dur="2.6s" begin="${delay}s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.08;.52;.62;1" dur="2.6s" begin="${delay}s" repeatCount="indefinite"/>
            </circle>
            <ellipse cx="${cx}" cy="26" rx="2.5" ry=".7" fill="none" stroke="var(--matcha-lt)" stroke-width="1" opacity="0">
              <animate attributeName="rx" values="2.5;2.5;9" keyTimes="0;.55;1" dur="2.6s" begin="${delay}s" repeatCount="indefinite"/>
              <animate attributeName="ry" values=".7;.7;2.8" keyTimes="0;.55;1" dur="2.6s" begin="${delay}s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0;0;.58;0" keyTimes="0;.55;.66;1" dur="2.6s" begin="${delay}s" repeatCount="indefinite"/>
            </ellipse>
          </g>`;
        }).join("")}
        <line x1="0" y1="27" x2="300" y2="27" stroke="#E1D9C8" stroke-width="1"/>
      </svg>
    </div>
  `;
}

function poweredByFooter() {
  if (state.store.show_powered_by === false) return "";
  const text = escapeHtml(state.store.powered_by_text || "Powered by OneTouch Studio");
  const url = safeExternalUrl(state.store.powered_by_url);
  return `<footer class="powered-by-footer">${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${text}</a>` : `<span>${text}</span>`}</footer>`;
}

/* ---------- menu ---------- */
function renderMenuCard(item) {
  const soldOut = isSoldOut(item);
  const addButton = soldOut
    ? `<button class="add-btn" disabled>Sold out</button>`
    : `<button class="add-btn" onclick="openProductOptions('${escapeHtml(item.id)}')">Add</button>`;
  if (state.menuView === "gallery") return `
    <div style="background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;min-width:0;">
      <img src="${escapeHtml(item.image_url || "matcha-lab.jpg")}" alt="${escapeHtml(item.name)}" style="width:100%;aspect-ratio:1/1;object-fit:cover;background:var(--matcha-bg);">
      <div style="padding:11px 11px 12px;display:flex;flex:1;flex-direction:column;">
        <button type="button" ${soldOut ? "disabled" : ""} style="font:600 13px/1.25 'Work Sans',sans-serif;cursor:pointer;border:0;background:none;padding:0;text-align:left;color:var(--ink);" onclick="openProductOptions('${escapeHtml(item.id)}')">${escapeHtml(item.name)} ${soldOut ? "" : `<span style="color:var(--ink);">→</span>`}</button>
        <div style="font-size:10.5px;color:var(--ink);line-height:1.4;margin:5px 0 10px;">${escapeHtml(item.description)}</div>
        <div class="stock-line">${stockMarkup(item)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:7px;margin-top:auto;">${productPriceMarkup(item, "item-price gallery-price")}${state.cart[`${item.id}__`]?.qty > 0 ? stepper(`${item.id}__`, state.cart[`${item.id}__`].qty) : addButton}</div>
      </div>
    </div>`;
  return `
    <div class="item-card">
      <img class="item-thumb" src="${escapeHtml(item.image_url || "matcha-lab.jpg")}" alt="${escapeHtml(item.name)}">
      <div class="item-info"><button class="item-name" type="button" ${soldOut ? "disabled" : ""} style="cursor:pointer;border:0;background:none;padding:0;text-align:left;font:inherit;width:100%;color:var(--ink);" onclick="openProductOptions('${escapeHtml(item.id)}')">${escapeHtml(item.name)} ${soldOut ? "" : `<span style="color:var(--ink);">→</span>`}</button><div class="item-desc" style="color:var(--ink);">${escapeHtml(item.description)}</div><div class="stock-line">${stockMarkup(item)}</div><div class="item-row">${productPriceMarkup(item)}${state.cart[`${item.id}__`]?.qty > 0 ? stepper(`${item.id}__`, state.cart[`${item.id}__`].qty) : addButton}</div></div>
    </div>`;
}
function renderMenu() {
  const browseMenu = state.menu.filter((item) => (isRitualRedemptionMode() ? ritualEligibleProduct(item) : !isRitualProduct(item)) && partnerVisibleProduct(item));
  const productGroupNames = state.productGroups.map((group) => group.name);
  const extraNames = browseMenu.map(productGroupName).filter((name) => !productGroupNames.includes(name));
  const categories = ["All", ...productGroupNames, ...Array.from(new Set(extraNames))];
  const items = state.activeCategory === "All" ? browseMenu : browseMenu.filter((item) => productGroupName(item) === state.activeCategory);
  const groups = state.activeCategory === "All" ? categories.slice(1) : [state.activeCategory];
  const menuItemsMarkup = partnerModeActive()
    ? `<section class="product-group"><div class="product-group-items" style="${state.menuView === "gallery" ? "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;" : ""}">${items.map(renderMenuCard).join("")}</div></section>`
    : groups.map((group) => { const groupItems = items.filter((item) => productGroupName(item) === group); if (!groupItems.length) return ""; return `<section class="product-group"><h2 class="product-group-title">${escapeHtml(group)}</h2><div class="product-group-items" style="${state.menuView === "gallery" ? "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;" : ""}">${groupItems.map(renderMenuCard).join("")}</div></section>`; }).join("");
  return `
    ${header()}
    ${storeInfoPanel()}
    ${isRitualRedemptionMode()?`<div style="margin:14px 20px;padding:14px 16px;border-radius:15px;background:var(--matcha);color:var(--cream);display:flex;justify-content:space-between;gap:12px;align-items:center"><div><b>Using Matcha Pass</b><div style="font-size:11px;margin-top:3px">${ritualAvailable()} drink${ritualAvailable()===1?"":"s"} available · ${ritualRemaining()} remaining on Pass</div></div><button class="btn-secondary" style="width:auto;background:var(--card)" onclick="exitRitualRedemption()">Exit</button></div>`:""}
    ${cartNoticeMarkup()}
    ${state.loadError ? `<div class="setup-banner" style="border-color:#B33;background:#FBEAEA;color:#7a1f1f;">Could not load products: <code>${escapeHtml(state.loadError)}</code></div>` : ""}
    ${partnerModeActive() ? "" : `<div class="cats">
      ${categories.map((category) => `<button class="pill ${category === state.activeCategory ? "active" : ""}" onclick="setCategory('${escapeHtml(category)}')">${escapeHtml(category)}</button>`).join("")}
    </div>`}
    ${state.store.show_menu_view_switch === false || !partnerFeatureEnabled("menu_view_switch") ? "" : `<div style="display:flex;justify-content:flex-end;gap:7px;padding:2px 20px 3px;">
      <button class="pill ${state.menuView === "list" ? "active" : ""}" style="padding:6px 11px;font-size:11px;" onclick="state.menuView='list';render();">☷ List</button>
      <button class="pill ${state.menuView === "gallery" ? "active" : ""}" style="padding:6px 11px;font-size:11px;" onclick="state.menuView='gallery';render();">▦ Gallery</button>
    </div>`}
    <div class="menu-list" style="padding-top:10px;"><div class="menu-kana">${escapeHtml(state.store.menu_heading || "メニュー · DRINK MENU")}</div>
      ${items.length === 0 ? `<div class="empty">No items available yet.</div>` : menuItemsMarkup}
    </div>
    ${cartCount() > 0 ? `
    <div class="sticky-bar floating-cart-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" onclick="setScreen('cart')">${ICONS.bag} ${isRitualRedemptionMode()?`${ritualCreditsInCart()} Pass credit${ritualCreditsInCart()===1?"":"s"} · top-up ${money(cartTotal())}`:`View cart · ${money(cartTotal())}`}</button>
    </div></div>` : ""}
    ${renderReviews()}
    ${renderFAQ()}
  `;
}

function reviewStars(rating) { return "★".repeat(Math.max(0, Math.min(5, Number(rating) || 0))) + "☆".repeat(Math.max(0, 5 - (Number(rating) || 0))); }
function renderReviews() {
  if (state.store.reviews_enabled === false || !partnerFeatureEnabled("reviews") || !state.reviews.length) return "";
  const average = state.reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / state.reviews.length;
  return `<section class="faq-section review-section"><div class="faq-title">${escapeHtml(state.store.reviews_heading || "お客様の声 · REVIEWS")}</div><div style="display:flex;align-items:center;gap:9px;margin:0 0 14px;"><b style="font:700 25px/1 Georgia,serif;">${average.toFixed(1)}</b><span style="color:#a36d1e;letter-spacing:2px;">${reviewStars(Math.round(average))}</span><span class="hint" style="margin:0;">${state.reviews.length} review${state.reviews.length === 1 ? "" : "s"}</span></div>${state.reviews.map((item) => `<article class="summary-card" style="margin:10px 0;padding:16px;"><div style="display:flex;justify-content:space-between;gap:12px;"><b>${escapeHtml(item.customer_name)}</b><span style="color:#a36d1e;letter-spacing:1px;">${reviewStars(item.rating)}</span></div>${item.product_summary ? `<div class="review-product-summary">${escapeHtml(item.product_summary)}</div>` : ""}<p style="margin:10px 0 0;line-height:1.55;">${escapeHtml(item.review_text)}</p></article>`).join("")}</section>`;
}

async function findReviewableOrders() {
  const portal = state.reviewPortal;
  const lookup = String(portal.lookup || "").trim();
  if (!lookup) { portal.message = "Enter your order number or phone number."; render(); return; }
  portal.loading = true; portal.message = ""; portal.orders = []; portal.selected = null; render();
  const { data, error } = await db.rpc("find_reviewable_shizuku_orders", { p_lookup: lookup });
  portal.loading = false;
  if (error) portal.message = "We could not check your orders right now. Please try again.";
  else if (!(data || []).length) portal.message = "No paid and collected orders were found with those details.";
  else portal.orders = data || [];
  render();
}
function chooseReviewOrder(orderId) { state.reviewPortal.selected = state.reviewPortal.orders.find((item) => String(item.order_id) === String(orderId)) || null; state.reviewPortal.submitted = false; state.reviewPortal.message = ""; render(); }
async function submitReviewPortal() {
  const p = state.reviewPortal;
  if (!p.selected || !p.text.trim()) { p.message = "Please choose an order and write your review."; render(); return; }
  p.loading = true; p.message = ""; render();
  const { error } = await db.rpc("submit_shizuku_order_review", { p_lookup: p.lookup, p_order_id: String(p.selected.order_id), p_customer_name: p.name.trim(), p_rating: Number(p.rating || 5), p_review_text: p.text.trim() });
  p.loading = false;
  if (error) p.message = error.message || "Could not submit this review.";
  else { p.submitted = true; p.message = "Thank you — your review was sent to Shizuku Lab for approval."; p.text = ""; p.orders = p.orders.map((item) => String(item.order_id) === String(p.selected.order_id) ? { ...item, already_reviewed: true } : item); }
  render();
}
function renderReviewPortal() {
  const p = state.reviewPortal;
  return `${header()}<div class="screen review-portal"><button class="back-link" onclick="setScreen('menu')">${ICONS.back} ${escapeHtml(state.store.review_back_button_text || "Back to menu")}</button><div class="display review-portal-title">${escapeHtml(state.store.review_portal_title || "Share your Shizuku experience")}</div><p class="hint" style="text-align:left;line-height:1.55;">${escapeHtml(state.store.review_portal_intro || "Enter either your order number or phone number. We will show the drinks you collected — your order number will never be shown publicly.")}</p><div class="field"><label>${escapeHtml(state.store.review_lookup_label || "Order number or phone number")}</label><input value="${escapeHtml(p.lookup)}" oninput="state.reviewPortal.lookup=this.value" placeholder="${escapeHtml(state.store.review_lookup_placeholder || "SL-XXXXXX or 91234567")}"></div><button class="primary-btn" ${p.loading ? "disabled" : ""} onclick="findReviewableOrders()">${p.loading ? "Checking…" : escapeHtml(state.store.review_find_button_text || "Find my orders")}</button>${p.orders.length ? `<div class="review-order-list"><div class="bundle-heading">${escapeHtml(state.store.review_choose_order_text || "Choose the drinks to review")}</div>${p.orders.map((item) => `<button class="slot ${p.selected && String(p.selected.order_id) === String(item.order_id) ? "active" : ""}" ${item.already_reviewed ? "disabled" : ""} onclick="chooseReviewOrder('${escapeHtml(item.order_id)}')"><span><b>${escapeHtml(item.product_summary || "Shizuku drinks")}</b><br><span class="hint">Collected ${escapeHtml(item.collection_date || "")}${item.already_reviewed ? " · Review already submitted" : ""}</span></span></button>`).join("")}</div>` : ""}${p.selected && !p.selected.already_reviewed ? `<div class="summary-card review-write-card"><div class="field"><label>${escapeHtml(state.store.review_name_label || "Name shown with review")}</label><input value="${escapeHtml(p.name)}" placeholder="Your name" oninput="state.reviewPortal.name=this.value"></div><div class="field"><label>${escapeHtml(state.store.review_rating_label || "Rating")}</label><select onchange="state.reviewPortal.rating=Number(this.value)">${[5,4,3,2,1].map((rating) => `<option value="${rating}" ${p.rating===rating?"selected":""}>${rating} star${rating===1?"":"s"}</option>`).join("")}</select></div><div class="field"><label>${escapeHtml(state.store.review_experience_label || "Your experience")}</label><textarea rows="5" oninput="state.reviewPortal.text=this.value">${escapeHtml(p.text)}</textarea></div><button class="primary-btn" ${p.loading ? "disabled" : ""} onclick="submitReviewPortal()">${escapeHtml(state.store.review_submit_button_text || "Send my review")}</button></div>` : ""}${p.message ? `<div class="ref-note" role="status">${escapeHtml(p.message)}</div>` : ""}</div>`;
}

function decorateReviewPortalWithCommunity() {
  if (state.screen !== "reviews" || state.store.reviews_enabled === false || !state.reviews.length) return;
  const portal = document.querySelector(".review-portal");
  const firstField = portal?.querySelector(".field");
  if (!portal || !firstField || portal.querySelector(".review-community")) return;
  const community = document.createElement("div");
  community.className = "review-community";
  community.innerHTML = renderReviews();
  firstField.before(community);
}

/* ---------- FAQ ---------- */
function renderFAQ() {
  const faqItems = IS_CONFIGURED ? state.faq.map((item) => ({ q: item.question, a: item.answer })) : (STORE_FAQ || []);
  if (!faqItems.length) return "";
  return `
    <section class="faq-section">
      <div class="faq-title"><span>よくある質問</span> · FAQ</div>
      ${faqItems.map((item) => `<details class="faq-item"><summary onclick="openFaq(this.parentElement); return false;">${escapeHtml(item.q)}</summary><div class="faq-answer">${escapeHtml(item.a).replace(/\n/g, "<br>")}</div></details>`).join("")}
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
  const price = isRitualRedemptionMode()?Math.round((Number(ritualDrinkTopUp(product)||0)+getSelectedOptionsForProduct(product.id).reduce((sum,option)=>sum+Number(option.price||0),0))*100)/100:calculateProductPrice(product);
  return `
    ${header()}
    <div class="screen">
      <button class="back-link" onclick="setScreen('menu')">${ICONS.back} Back to menu</button>
      <div class="product-detail-card">
        <img class="product-detail-image" src="${escapeHtml(product.image_url || "matcha-lab.jpg")}" alt="${escapeHtml(product.name)}">
        <div class="item-info product-detail-copy">
          <div class="item-name">${escapeHtml(product.name)}</div>
          <div class="item-desc">${escapeHtml(product.description)}</div>
          <div class="stock-line">${stockMarkup(product)}</div>
        </div>
      </div>
      ${renderProgressiveOptionGroups(product, state.selectedOptions)}
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" ${isSoldOut(product) ? "disabled" : ""} onclick="addConfiguredProductToCart()">${isSoldOut(product) ? "Sold out" : isRitualRedemptionMode()?(price?`Add · +${money(price)}`:"Add · Included"):`Add to cart · ${money(price)}`}</button>
    </div></div>
  `;
}

/* ---------- bundle screen ---------- */
function renderBundle() {
  const bundle = state.selectedProduct;
  if (!bundle) return renderMenu();
  const drinks = getBundleDrinkProducts();
  const count=bundleSelectionCount(bundle),selectedDrinks=Array.from({length:count},(_,i)=>bundleDrink(i+1)),selectedOptions=Array.from({length:count},(_,i)=>bundleDrinkOptions(i+1));
  const bundleComplete=selectedDrinks.every(Boolean);
  const currentBundlePrice=bundleComplete?selectedBundlePrice(bundle,selectedDrinks,selectedOptions):bundleDisplayFromPrice(bundle);
  const showChoicePrices = bundle.bundle_show_choice_prices === true;
  const drinkSections=selectedDrinks.map((selectedDrink,index)=>{const slot=index+1;return `<div class="bundle-section"><div class="bundle-heading">Drink ${slot}</div><div class="bundle-subheading">Choose your drink</div><div class="bundle-drinks">${drinks.map((drink)=>`<button type="button" ${isSoldOut(drink)?"disabled":""} class="slot ${selectedDrink&&String(selectedDrink.id)===String(drink.id)?"active":""}" onclick="selectBundleDrink(${slot},'${escapeHtml(drink.id)}')"><div><div class="slot-day">${escapeHtml(drink.name)}</div><div class="slot-time">${showChoicePrices?(isDynamicBundle(bundle)?money(bundleOptionPrice(bundle,drink)):(hasDiscount(drink)?`${money(salePrice(drink))} <span class="original-price">${money(originalPrice(drink))}</span>`:money(salePrice(drink)))):""} ${stockMarkup(drink)}</div></div></button>`).join("")}</div>${selectedDrink?renderBundleDrinkOptions(slot,selectedDrink,selectedOptions[index]):""}</div>`;}).join("");
  return `
    ${header()}
    <div class="screen">
      <button class="back-link" onclick="setScreen('menu')">${ICONS.back} Back to menu</button>
      <div class="product-detail-card">
        <img class="product-detail-image" src="${escapeHtml(bundle.image_url || "matcha-lab.jpg")}" alt="${escapeHtml(bundle.name)}">
        <div class="item-info product-detail-copy">
          <div class="item-name">${escapeHtml(bundle.name)}</div>
          <div class="item-desc">${escapeHtml(bundle.description || `Choose ${count} drinks from the selections below.`)}</div>
          ${bundle.ritual_validity_weeks?`<div class="ref-note"><b>${count} drinks · ${Number(bundle.ritual_validity_weeks)} weeks</b><br>Choose all ${count} drinks now. Your order keeps the Weekly Ritual together as one purchase.</div>`:""}
          ${isDynamicBundle(bundle) ? `<div class="item-price"><span class="discount-price">${bundleComplete ? money(currentBundlePrice) : `From ${money(currentBundlePrice)}`}</span></div>` : productPriceMarkup(bundle)}
          <div class="stock-line">${stockMarkup(bundle)}</div>
        </div>
      </div>
      ${drinkSections}
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" ${isSoldOut(bundle) || !bundleComplete ? "disabled" : ""} onclick="addBundleToCart()">${isSoldOut(bundle) ? "Sold out" : !bundleComplete ? `Choose all ${count} drinks` : `${bundle.ritual_validity_weeks ? "Add Weekly Ritual" : isDynamicBundle(bundle) ? "Add Mix & Matcha" : "Add bundle to cart"} · ${money(currentBundlePrice)}`}</button>
    </div></div>
  `;
}
function renderBundleDrinkOptions(drinkNumber, drink, selectedOptions) {
  return `
    <div class="bundle-customisation" style="margin-top:18px;">
      <div class="bundle-selected">${escapeHtml(drink.name)}</div>
      ${renderProgressiveOptionGroups(drink, selectedOptions, drinkNumber)}
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
    ${header()}
    <div class="screen">
      <button class="back-link" onclick="setScreen('menu')">${ICONS.back} Continue browsing</button>
      ${cartNoticeMarkup()}
      ${isRitualRedemptionMode()?`<div class="ref-note"><b>Using Matcha Pass</b><br>${ritualCreditsInCart()} Pass credit${ritualCreditsInCart()===1?'':'s'} will be reserved · balance is deducted after collection · Top-up ${money(cartTotal())}</div>`:""}
      ${cartB2BType()==='mixed'?'<p class="hint" role="alert">B2B products need to be ordered separately from drinks.</p>':''}
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
            <div class="item-price">${isRitualRedemptionMode()?(line.unitPrice?`+${money(line.unitPrice)}`:"Included"):money(line.unitPrice)}</div>
          </div>
          ${stepper(line.key, line.qty)}
        </div>
      `).join("")}
    </div>
    ${lines.length > 0 ? `
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" onclick="setScreen('checkout')">${isRitualRedemptionMode()?`Continue · ${ritualCreditsInCart()} credit${ritualCreditsInCart()===1?'':'s'} · top-up ${money(cartTotal())}`:`Checkout · ${money(cartTotal())}`}</button>
    </div></div>` : ""}
  `;
}

/* ---------- checkout ---------- */
function renderCheckout() {
  const f = state.form;
  if(isRitualRedemptionMode())return renderRitualRedemptionCheckout();
  const isB2B=cartB2BType()==='b2b';
  const isRitualPass=cartIsRitualPassOnly();
  const isSelfDelivery=isMalaysiaSelfDelivery();
  const canSubmit=checkoutReady();
  const collectionSettings = marketCollectionSettings();
  const collectionPoints = collectionSettings.hasConfiguredPoints ? collectionSettings.points : (state.market === "MY" ? ["Malaysia collection point"] : ["Blk 130A", "Near Creamier"]);
  const pickupDates = Array.from(new Map(state.slots.map((slot) => [slot.date, slot.label])).entries());
  const availableTimes = state.slots.filter((slot) => slot.date === f.pickupDate);
  return `
    ${header()}
    <div class="screen">
      <button class="back-link" onclick="setScreen('cart')">${ICONS.back} ${tr("back_cart")}</button>
      <div class="field"><label>${isB2B?"Recipient Name *":tr("name")}</label><input id="f-name" value="${escapeHtml(f.name)}" placeholder="${tr("name")}" oninput="onFormInput('name', this.value)"></div>
      <div class="field"><label for="f-phone">${isB2B?"Contact Number *":tr("phone")} · ${state.market === "MY" ? "+60 Malaysia" : "+65 Singapore"}</label><input id="f-phone" value="${escapeHtml(f.phone)}" placeholder="${state.market === "MY" ? "e.g. 0121234567" : "e.g. 91234567"}" inputmode="tel" autocomplete="tel" oninput="this.value=cleanPhoneInput(this.value);onFormInput('phone', this.value)"></div>
      ${state.store.show_checkout_email === false ? "" : `<div class="field"><label>${tr("email")}</label><input id="f-email" type="email" value="${escapeHtml(f.email)}" placeholder="you@example.com" autocomplete="email" oninput="onFormInput('email', this.value)"></div>`}
      ${state.store.show_checkout_instagram === false ? "" : `<div class="field"><label>${tr("instagram")}</label><input id="f-instagram" value="${escapeHtml(f.instagram)}" placeholder="@yourhandle" oninput="onFormInput('instagram', this.value)"></div>`}
      ${state.market === "MY" && state.store.malaysia_self_delivery_enabled === true && !isB2B && !isRitualPass ? `<div class="field"><label>Fulfilment</label><div class="fulfilment-choice"><button type="button" class="slot ${!isSelfDelivery ? "active" : ""}" onclick="onFormInput('fulfilmentMethod','collection')">${tr("collection")}</button><button type="button" class="slot ${isSelfDelivery ? "active" : ""}" onclick="onFormInput('fulfilmentMethod','delivery')">${tr("self_delivery")}</button></div>${state.store.malaysia_delivery_instructions ? `<div class="hint" style="text-align:left;margin-top:6px">${escapeHtml(state.store.malaysia_delivery_instructions)}</div>` : ""}${state.store.malaysia_delivery_areas ? `<div class="hint" style="text-align:left;margin-top:4px">Delivery area: ${escapeHtml(state.store.malaysia_delivery_areas)}</div>` : ""}</div>` : ""}
      ${isRitualPass ? `<div class="ref-note"><b>Matcha Pass purchase</b><br>No collection booking is needed today. After payment is confirmed, return to the Matcha Pass banner and use this phone number to reserve each of your four drinks.</div>` : isB2B?b2bCheckoutFields():`      <div class="field"><label>${isSelfDelivery ? tr("delivery_date") : tr("collection_date")}</label>
        <select class="checkout-select" onchange="onPickupDateChange(this.value)">
          <option value="">${tr("select_date")}</option>
          ${pickupDates.map(([date, label]) => `<option value="${escapeHtml(date)}" ${f.pickupDate === date ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>${isSelfDelivery ? tr("delivery_time") : tr("collection_time")}</label>
        <select class="checkout-select" ${f.pickupDate ? "" : "disabled"} onchange="onFormInput('slotId', this.value)">
          <option value="">${f.pickupDate ? tr("select_time") : tr("select_date_first")}</option>
          ${availableTimes.map((slot) => `<option value="${escapeHtml(slot.id)}" ${f.slotId === slot.id ? "selected" : ""}>${escapeHtml(slot.time)}</option>`).join("")}
        </select>
      </div>
      ${isSelfDelivery ? `<div class="field"><label>${tr("address")} *</label><input value="${escapeHtml(f.deliveryAddress?.address_line_1 || "")}" oninput="state.form.deliveryAddress.address_line_1=this.value;renderCheckoutButtonState()"></div><div class="field"><label>${tr("city")} *</label><input value="${escapeHtml(f.deliveryAddress?.city || "")}" oninput="state.form.deliveryAddress.city=this.value;renderCheckoutButtonState()"></div><div class="field"><label>${tr("state")} *</label><input value="${escapeHtml(f.deliveryAddress?.state || "")}" oninput="state.form.deliveryAddress.state=this.value;renderCheckoutButtonState()"></div><div class="field"><label>${tr("postcode")} *</label><input inputmode="numeric" maxlength="5" value="${escapeHtml(f.deliveryAddress?.postal_code || "")}" oninput="state.form.deliveryAddress.postal_code=this.value.replace(/\\D/g,'').slice(0,5);this.value=state.form.deliveryAddress.postal_code;renderCheckoutButtonState()"></div><div class="field"><label>${tr("delivery_notes")}</label><textarea rows="2" oninput="state.form.deliveryAddress.delivery_notes=this.value">${escapeHtml(f.deliveryAddress?.delivery_notes || "")}</textarea></div>` : `<div class="field"><label>${tr("collection_point")} <span style="color:#B33;">*</span></label>
        <select class="checkout-select" required aria-required="true" onchange="onFormInput('collectionPoint', this.value)">
          <option value="">${tr("select_point")}</option>
          ${collectionPoints.map((point) => `<option value="${escapeHtml(point)}" ${f.collectionPoint === point ? "selected" : ""}>${escapeHtml(point)}</option>`).join("")}
        </select>
      </div>`}
`}
      ${state.store.show_checkout_notes === false ? "" : `<div class="field"><label>${tr("notes")}</label><textarea id="f-notes" rows="2" placeholder="Less ice, allergies, etc." oninput="onFormInput('notes', this.value)">${escapeHtml(f.notes)}</textarea></div>`}
      ${partnerModeActive() ? "" : `<div class="field">
        <label>${tr("promo")}</label>
        ${state.promo
          ? `<div class="slot active" style="justify-content:space-between;"><span><b>${escapeHtml(state.promo.code)}</b> applied</span><button class="link-btn" style="border:none;background:none;color:#B33;" onclick="removePromoCode()">Remove</button></div>`
          : `<div style="display:flex;gap:8px;">
              <input id="f-promo" value="${escapeHtml(f.promoCode)}" placeholder="e.g. WELCOME10" style="flex:1;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase();onFormInput('promoCode', this.value)">
              <button class="btn-primary" style="flex:none;padding:0 18px;" onclick="applyPromoCode()">Apply</button>
            </div>`}
        ${state.promoMsg ? `<div class="ref-note">${escapeHtml(state.promoMsg)}</div>` : ""}
      </div>`}
      ${state.store.marketing_opt_in_enabled === false ? "" : `<label class="slot" style="align-items:flex-start;cursor:pointer;margin:10px 0 16px;"><input type="checkbox" style="width:auto;margin-top:3px;accent-color:var(--matcha);" ${f.marketingOptIn ? "checked" : ""} onchange="onFormInput('marketingOptIn',this.checked)"><span><b>${escapeHtml(state.store.marketing_checkout_heading || "Shizuku updates")}</b><br>${escapeHtml(state.store.marketing_opt_in_label || "Keep me in the loop about monthly opening dates, new drinks and special offers.")}<br><span class="hint" style="text-align:left;margin-top:5px;display:block;">${escapeHtml(state.store.marketing_opt_in_help_text || "Occasional Shizuku Lab updates by email. You can opt out anytime.")}</span></span></label>`}
      <div class="summary-card">
        ${cartLines().map((line) => `
          <div class="row"><span class="label">${escapeHtml(line.productName)} × ${line.qty}</span><span>${money(line.unitPrice * line.qty)}</span></div>
          ${line.options?.length ? `<div class="hint" style="margin-top:-4px;margin-bottom:8px;">${
            isBundle(state.menu.find((p) => String(p.id) === String(line.productId)))
              ? line.options.map((drink) => `Drink ${drink.drinkNumber}: ${escapeHtml(drink.productName)}`).join("<br>")
              : line.options.map((option) => escapeHtml(option.optionName)).join(" · ")
          }</div>` : ""}
        `).join("")}
        ${state.promo ? `<div class="row"><span class="label">Discount (${escapeHtml(state.promo.code)})</span><span>-${money(promoDiscountAmount(state.promo))}</span></div>` : ""}
        ${partnerPricingIsUsed() ? `<div class="row"><span class="label">${escapeHtml(state.partner.name)} member perk</span><span>-${money(partnerCartDiscountAmount())}</span></div>` : ""}
        ${selfDeliveryFee() > 0 ? `<div class="row"><span class="label">${tr("delivery_fee")}</span><span>${money(selfDeliveryFee())}</span></div>` : ""}
        <div class="divider"></div>
        <div class="row bold"><span class="label">${tr("total")}</span><span>${money(orderTotal())}</span></div>
      </div>
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      ${cartB2BType()==='mixed'?'<p class="hint" role="alert">B2B products need to be ordered separately from drinks.</p>':''}
      <button class="primary-btn" id="checkout-btn" ${canSubmit ? "" : "disabled"} onclick="submitOrder()">${tr("continue_payment")} · ${money(orderTotal())}</button>
    </div></div>
  `;
}

function renderRitualRedemptionCheckout(){
  const f=state.form,pass=selectedRitualPass();
  const pickupDates=Array.from(new Map(state.slots.map((slot)=>[slot.date,slot.label])).entries());
  const availableTimes=state.slots.filter((slot)=>slot.date===f.pickupDate);
  const credits=ritualCreditsInCart(),availableAfter=Math.max(0,ritualAvailable(pass)-credits),topup=cartTotal();
  return `${header()}<div class="screen"><button class="back-link" onclick="setScreen('cart')">${ICONS.back} Back to cart</button><div class="display" style="font-size:24px;margin-bottom:6px">Matcha Pass redemption</div><div class="ref-note"><b>${credits} Pass credit${credits===1?'':'s'} will be reserved</b><br>${availableAfter} unreserved credit${availableAfter===1?'':'s'} available after this order. Your Pass balance is deducted only after collection.</div><div class="field"><label>Collection date</label><select class="checkout-select" onchange="onPickupDateChange(this.value)"><option value="">Select a date</option>${pickupDates.map(([date,label])=>`<option value="${escapeHtml(date)}" ${f.pickupDate===date?'selected':''}>${escapeHtml(label)}</option>`).join('')}</select></div><div class="field"><label>Collection time</label><select class="checkout-select" ${f.pickupDate?'':'disabled'} onchange="onFormInput('slotId',this.value)"><option value="">${f.pickupDate?'Select a time':'Select a date first'}</option>${availableTimes.map((slot)=>`<option value="${escapeHtml(slot.id)}" ${f.slotId===slot.id?'selected':''}>${escapeHtml(slot.time)}</option>`).join('')}</select></div><div class="summary-card">${cartLines().map((line)=>`<div class="row"><span>${escapeHtml(line.productName)} × ${line.qty}</span><b>${line.unitPrice?`+${money(line.unitPrice*line.qty)}`:'Included'}</b></div>`).join('')}<div class="divider"></div><div class="row bold"><span>Top-up total</span><span>${money(topup)}</span></div></div></div><div class="sticky-bar"><div class="sticky-bar-inner"><button class="primary-btn" ${checkoutReady()?'':'disabled'} onclick="submitOrder()">${topup>0?'Pay & reserve redemption':'Reserve redemption'}${topup>0?` · ${money(topup)}`:''}</button></div></div>`;
}

/* ---------- form input ---------- */
function renderCheckoutButtonState() {
  if (state.screen !== "checkout") return;
  const button = document.getElementById("checkout-btn");
  if (!button) return;
  button.toggleAttribute("disabled", !checkoutReady());
  button.textContent = `Continue to payment · ${money(orderTotal())}`;
}

function onFormInput(key, value) {
  state.form[key] = value;
  if (state.screen !== "checkout") return;
  if (key === "fulfilmentMethod") {
    // Collection and self delivery render different required fields. Re-render
    // immediately so the selected button, labels and address/collection fields
    // always agree with the customer's choice.
    state.form.pickupDate = "";
    state.form.slotId = "";
    if (value === "delivery") state.form.collectionPoint = "";
    render();
    return;
  }
  renderCheckoutButtonState();
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
  savePendingPayment();
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
function leavePaymentPage() {
  const trackedNumber = state.tracking.order?.order_number;
  const paymentNumber = state.lastOrder?.order_number;
  state.screen = trackedNumber && trackedNumber === paymentNumber ? "track" : "menu";
  render();
}
function renderPayment() {
  const order = state.lastOrder;
  if (!order) return renderMenu();
  if (order.order_status === "cancelled") {
    return `${header()}<div class="screen"><div class="summary-card" style="text-align:center;"><div class="display" style="font-size:22px;">This order was cancelled</div><div class="hint" style="margin:10px 0 18px;line-height:1.5;">Its stock reservation has been released, so it cannot accept payment.</div><button class="primary-btn" onclick="setScreen('menu')">Place a new order</button></div></div>`;
  }
  if (!state.payment.expiresAt) state.payment.expiresAt = Date.now() + 15 * 60 * 1000;
  const paymentExpired = paymentSecondsLeft() === 0;
  const malaysiaOrder = (order.market_code || state.market) === "MY";
  const paynowName = malaysiaOrder ? (state.store.touchngo_name || state.store.store_name || "Shizuku Lab") : (state.store.paynow_name || state.store.store_name || "Shizuku Lab");
  const paynowNumber = malaysiaOrder ? (state.store.touchngo_number || "") : (state.store.paynow_number || "");
  const uploadedQrMode = malaysiaOrder || state.store.payment_qr_mode === "uploaded";
  const paymentName = malaysiaOrder ? "Touch 'n Go" : "PayNow";
  const staticQrUrl = malaysiaOrder ? state.store.touchngo_qr_url : state.store.paynow_url;
  const isDelivery = order.fulfilment_method === "self_delivery";
  const fulfilmentValue = isDelivery ? tr("self_delivery") : (order.collection_point || "—");
  const submitButtonText = malaysiaOrder && (!state.store.payment_submit_button_text || state.store.payment_submit_button_text === "Submit payment proof")
    ? tr("submit_payment_proof")
    : (state.store.payment_submit_button_text || "Submit payment proof");
  const instagramHandle = String(state.store.instagram || "shizukulab.matcha").replace(/^@/, "");
  const inAppBrowser = isInstagramOrFacebookBrowser();
  let qrHtml;
  try {
    qrHtml = !uploadedQrMode && paynowNumber ? `<div class="qr-box ${paymentExpired ? "qr-expired" : ""}">${payNowQrSvg(order.total, order.order_number, state.payment.expiresAt)}</div>` : null;
  } catch (e) { qrHtml = null; }
  if (!qrHtml) {
    qrHtml = staticQrUrl
      ? `<div class="qr-box"><img src="${escapeHtml(staticQrUrl)}" alt="${escapeHtml(paymentName)} QR" style="max-width:220px;width:100%;height:auto;"></div>`
      : `<div class="qr-box"><div class="qr-placeholder"></div></div>`;
  }
  const paymentQrSize = Math.max(150, Math.min(300, Number(state.store.payment_qr_size || 220)));
  qrHtml = `<div class="payment-qr-size" style="--payment-qr-size:${paymentQrSize}px;">${qrHtml}</div>`;
  return `
    ${header()}
    <div class="screen ${state.store.payment_compact_layout ? "payment-compact" : ""}">
      <style>.payment-qr-size .qr-box{max-width:var(--payment-qr-size);margin-left:auto;margin-right:auto}.payment-qr-size .qr-box svg,.payment-qr-size .qr-box img{width:100%;height:auto}.payment-compact .summary-card{padding:14px}.payment-compact .qr-box{margin-bottom:8px}.payment-compact .divider{margin:12px 0}.payment-compact .row{padding:5px 0}</style>
      <button class="back-link" onclick="leavePaymentPage()">${ICONS.back} ${state.tracking.order?.order_number === order.order_number ? "Back to Track Order" : (malaysiaOrder ? tr("back_menu") : "Back to menu")}</button>
      <div class="summary-card">
        ${qrHtml}
        <div class="hint">${escapeHtml(malaysiaOrder ? tr("payment_scan_tng") : (state.store.payment_instructions || "Scan with your banking app, or PayNow to the account below."))}${(malaysiaOrder ? state.store.show_touchngo_name : state.store.show_paynow_name) === false ? "" : `<br><b>${escapeHtml(paynowName)}</b>`}${(malaysiaOrder ? state.store.show_touchngo_number : state.store.show_paynow_number) === false || !paynowNumber ? "" : `<br>${escapeHtml(paynowNumber)}`}</div>
        ${uploadedQrMode ? `<div class="ref-note" style="color:#A36D1E;"><b>${escapeHtml(malaysiaOrder ? trFormat("pay_exact", { amount: money(order.total) }) : `Pay exactly ${money(order.total)}.`)}</b><br>${escapeHtml(malaysiaOrder ? tr("payment_exact_tng") : `Please enter this exact amount in ${paymentName} before confirming.`)}</div>` : `<div class="payment-timer" id="paynow-countdown" aria-live="polite">Please complete payment within ${paymentCountdownText()}.</div><button class="btn-secondary refresh-qr-btn" id="refresh-paynow-qr" ${paymentExpired ? "" : "hidden"} onclick="refreshPayNowQr()">Refresh QR · 15 minutes</button>`}
        <div class="divider"></div>
        ${state.store.show_payment_order_details === false ? "" : `<div class="row"><span class="label">${escapeHtml(malaysiaOrder ? tr("order") : "Order")}</span><span class="mono">${escapeHtml(order.order_number || order.id || "")}</span></div><div class="row bold"><span class="label">${escapeHtml(malaysiaOrder ? tr("amount") : "Amount")}</span><span>${money(order.total)}</span></div>`}
        ${!uploadedQrMode && paynowNumber ? `<div class="ref-note" style="color:var(--matcha);"><b>Payment amount is pre-filled in the QR and cannot be edited.</b></div>` : ""}
        ${order.is_b2b?b2bOrderSummary(order):state.store.show_payment_order_details === false ? "" : `<div class="row"><span class="label">${escapeHtml(malaysiaOrder ? (isDelivery ? tr("fulfilment") : tr("collection_point")) : "Collection point")}</span><span>${escapeHtml(fulfilmentValue)}</span></div>`}
        ${state.store.show_payment_transaction_reference === false ? "" : `<div class="ref-note">${malaysiaOrder ? escapeHtml(trFormat("payment_reference", { order: order.order_number || order.id || "" })) : `Enter <b>${escapeHtml(order.order_number || order.id || "")}</b> as the payment reference.`}</div>`}
      </div>
      ${paymentCollectionMapCard(order)}
      <div class="summary-card" style="margin-top:16px;">
        ${inAppBrowser ? `<div style="padding:14px 16px;margin-bottom:16px;border:1px solid #d8c58e;border-radius:14px;background:#fff8df;color:#5b4b22;font-size:13px;line-height:1.5;"><b>Using Instagram or Facebook?</b><br>Photo access may be blocked by the in-app browser. Please choose <b>Allow all photos/media</b>. If it still fails, do not refresh—send the screenshot through Instagram below. Your order <b>${escapeHtml(order.order_number || order.id || "")}</b> will be restored if this page reloads.</div>` : ""}
        ${state.store.show_payment_transaction_reference === false ? "" : `<div class="field">
          <label>${escapeHtml(malaysiaOrder ? tr("transaction_reference") : `${paymentName} transaction reference`)} <span class="hint">(${escapeHtml(malaysiaOrder ? tr("optional") : "optional")})</span></label>
          <input value="${escapeHtml(state.payment.transactionReference)}" placeholder="e.g. 123456789" oninput="onPaymentReference(this.value)">
        </div>`}
        <div class="field" style="margin-bottom:0;">
          <label>${escapeHtml(malaysiaOrder ? tr("payment_screenshot") : "Payment screenshot")} <span style="color:#B33;">*</span></label>
          <input type="file" accept="image/jpeg,image/png,image/heic,image/heif" required aria-required="true" onchange="onPaymentProof(this)">
          <div class="hint" style="margin-top:8px;">${state.payment.proofFile ? `Selected: <b>${escapeHtml(state.payment.proofFile.name)}</b>` : (malaysiaOrder ? escapeHtml(tr("payment_proof_required")) : `Required — upload a clear screenshot of your successful ${escapeHtml(paymentName)} payment. If you opened this page inside Facebook or Instagram, please allow photo access when prompted.`)}</div>
        </div>
        ${state.store.show_instagram_payment_help === false ? "" : `<button type="button" class="btn-secondary" style="width:100%;margin-top:14px;" onclick="openInstagramPaymentHelp()">${escapeHtml(malaysiaOrder ? tr("need_help") : "Need a hand? Chat with us on Instagram")} @${escapeHtml(instagramHandle)} ↗</button>`}
      </div>
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" ${state.payment.proofFile ? "" : "disabled"} onclick="markPaid()">${escapeHtml(submitButtonText)}</button>
      ${state.store.show_instagram_payment_help === false ? "" : `<div class="hint" style="margin-top:8px;margin-bottom:0;">${escapeHtml(malaysiaOrder ? tr("after_payment_submit") : "After submitting, please send us your order number on Instagram so we can verify your payment promptly.")}</div>`}
    </div></div>
  `;
}

/* ---------- confirmation ---------- */
function renderConfirmation() {
  const order = state.lastOrder;
  if (!order) return renderMenu();
  if(order.order_kind==="matcha_pass_redemption")return `${header()}<div class="screen center"><div class="check-circle">${ICONS.check}</div><div class="display" style="font-size:23px;margin-bottom:6px">${Number(order.total||0)>0?"Top-up submitted":"Matcha Pass redemption confirmed"} 🍵</div><div class="hint" style="margin-bottom:18px">${Number(order.total||0)>0?"We’ll confirm your payment screenshot shortly.":"Your drinks are reserved for collection."}</div><div class="code-box"><div class="mono code-text">${escapeHtml(order.order_number||"")}</div><div class="divider"></div><div class="row"><span class="label">Credits used</span><b>${Number(order.matcha_pass_credits_used||0)}</b></div><div class="row"><span class="label">Pass remaining</span><b>${Number(order.matcha_pass_remaining||0)} / 4</b></div><div class="row"><span class="label">Top-up</span><b>${money(order.total||0)}</b></div><div class="row"><span class="label">Collection</span><span>${escapeHtml(order.collection_date||"")} · ${escapeHtml(order.collection_time||"")}</span></div></div><button class="primary-btn" style="margin-top:20px" onclick="state.ritual.phone=state.lastOrder.customer_phone||state.ritual.phone;setScreen('menu');lookupRitualPasses()">View my Matcha Pass</button><button class="btn-secondary" style="width:100%;margin-top:9px" onclick="setScreen('menu')">Back to store</button></div>`;
  return `
    ${header()}
    <div class="screen center">
      <div class="check-circle">${ICONS.check}</div>
      <div class="display" style="font-size:20px;margin-bottom:4px;">Thanks, ${escapeHtml(String(order.customer_name || "there").trim())}</div>
      <div class="hint" style="margin-bottom:20px;">${order.is_b2b?escapeHtml(trackingStatus(order).note):"We've received your payment submission and will confirm shortly."}</div>
      ${order.partner_name_snapshot ? `<div class="partner-order-note"><b>${escapeHtml(order.partner_name_snapshot)} × Shizuku Lab</b><br>Member Perk Applied ✓</div>` : ""}
      <div class="code-box">
        <div class="mono code-text">${escapeHtml(order.order_number || order.id || "")}</div>
        <div class="divider"></div>
        ${order.is_b2b?b2bOrderSummary(order):`        <div class="row"><span class="label">Pickup</span><span>${escapeHtml(order.collection_date || "")} · ${escapeHtml(order.collection_time || "")}</span></div>
        <div class="row"><span class="label">Collection point</span><span>${escapeHtml(order.collection_point || "—")}</span></div>
`}
        <div class="row"><span class="label">Status</span><span>${order.is_b2b?escapeHtml(trackingStatus(order).title):"Payment sent — pending confirmation"}</span></div>
        <div class="row"><span class="label">Total</span><span>${money(order.total)}</span></div>
      </div>
      ${state.store.show_customer_receipt === false ? "" : `<button class="primary-btn" style="margin-top:22px;" onclick="setScreen('receipt')">${escapeHtml(order.is_b2b?"Invoice":state.store.receipt_button_text || "View receipt")}</button>`}
      <button class="btn-secondary" style="width:100%;margin-top:10px;" onclick="setScreen('menu')">Back to menu</button>
    </div>
  `;
}

function renderReceipt() {
  const order = state.lastOrder;
  if (!order) return renderMenu();
  const items = Array.isArray(order.items) ? order.items : [];
  if(order.is_b2b)return `${header()}<div class="screen receipt-screen"><style>@media print{.header,.receipt-actions,.powered-by-footer{display:none!important}.wrap{max-width:none}}</style><button class="back-link receipt-actions" onclick="setScreen('${state.tracking.order?.order_number===order.order_number?'track':'confirmation'}')">Back</button>${ShizukuB2B.invoice(order,items,money)}<div class="receipt-actions"><button class="primary-btn" onclick="window.print()">Print / Download Invoice</button></div></div>`;
  return `${header()}<div class="screen receipt-screen"><style>@media print{body{background:#fff}.header,.receipt-actions,.powered-by-footer{display:none!important}.wrap{max-width:none;padding:0}.receipt-screen{padding:0}.receipt-card{border:0!important;box-shadow:none!important}}</style><button class="back-link receipt-actions" onclick="setScreen('confirmation')">${ICONS.back} Back</button><div class="summary-card receipt-card"><div class="center"><div class="display" style="font-size:25px;">${escapeHtml(state.store.store_name || "Shizuku Lab")}</div><div class="hint" style="margin-top:4px;">Payment submission receipt</div><div class="mono" style="margin-top:13px;font-weight:700;">${escapeHtml(order.order_number || order.id || "")}</div></div>${order.partner_name_snapshot ? `<div class="partner-order-note" style="margin-top:15px"><b>${escapeHtml(order.partner_name_snapshot)} × Shizuku Lab</b><br>Member Perk Applied ✓</div>` : ""}<div class="divider"></div><div class="row"><span class="label">Customer</span><span>${escapeHtml(order.customer_name || "—")}</span></div><div class="row"><span class="label">Pickup</span><span>${escapeHtml(order.collection_date || "")} · ${escapeHtml(order.collection_time || "")}</span></div><div class="row"><span class="label">Collection point</span><span>${escapeHtml(order.collection_point || "—")}</span></div><div class="divider"></div>${items.length ? items.map(receiptItemMarkup).join("") : `<div class="hint">Order items are available in Track Order.</div>`}<div class="divider"></div>${Number(order.partner_discount_amount || 0) > 0 ? `<div class="row"><span class="label">Partner member saving</span><span>-${money(order.partner_discount_amount)}</span></div>` : ""}<div class="row" style="font-size:17px;"><b>Total</b><b>${money(order.total)}</b></div><div class="hint" style="text-align:left;margin-top:13px;line-height:1.5;">Payment screenshot submitted. Final confirmation will appear in Track Order after verification.</div></div><div class="receipt-actions" style="display:grid;gap:9px;margin-top:14px;"><button class="primary-btn" onclick="window.print()">Print / Save receipt</button><button class="btn-secondary" onclick="setScreen('menu')">Back to menu</button></div></div>`;
}

function receiptOptionNames(options) {
  return (Array.isArray(options) ? options : []).map((option) => String(option?.optionName || option?.option_name || "").trim()).filter(Boolean);
}
function receiptItemMarkup(item) {
  const quantity = Number(item.qty || item.quantity || 1);
  const itemName = item.productName || item.product_name || "Item";
  const unitPrice = Number(item.unitPrice || item.unit_price || 0);
  const options = Array.isArray(item.options) ? item.options : [];
  const bundleDrinks = options.filter((option) => option && (option.productName || option.product_name) && Array.isArray(option.options));
  const normalOptions = bundleDrinks.length ? [] : receiptOptionNames(options);
  return `<div class="receipt-item"><div class="row"><span>${quantity} × ${escapeHtml(itemName)}</span><b>${money(unitPrice * quantity)}</b></div>${normalOptions.length ? `<div class="receipt-item-options">${normalOptions.map(escapeHtml).join(" · ")}</div>` : ""}${bundleDrinks.map((drink, index) => { const childOptions = receiptOptionNames(drink.options); return `<div class="receipt-bundle-drink"><b>Drink ${escapeHtml(drink.drinkNumber || index + 1)} · ${escapeHtml(drink.productName || drink.product_name)}</b>${quantity > 1 ? ` <span>× ${quantity}</span>` : ""}${childOptions.length ? `<small>${childOptions.map(escapeHtml).join(" · ")}</small>` : ""}</div>`; }).join("")}</div>`;
}

/* ---------- order tracking ---------- */
function trackingStatus(order) {
  const s = state.store;
  if (!order) return { title: "", note: "", step: 0 };
  if(order.is_b2b){if(order.payment_status==='rejected')return {title:'Payment proof needs attention',note:order.payment_rejection_reason||'Please upload a new payment screenshot.',step:0};if(order.payment_status!=='paid')return {title:order.payment_status==='submitted'?'Payment under review':'Awaiting payment',note:'Free Delivery is included. We will email you after confirmation and delivery.',step:0};return {title:ShizukuB2B.labels[order.order_status]||'Preparing',note:order.order_status==='delivered'||order.order_status==='completed'?'Your order has been delivered. Thank you for supporting Shizuku Lab.':'Your order includes Free Delivery.',step:Math.max(0,ShizukuB2B.statuses.indexOf(order.order_status))};}
  if (order.payment_status === "rejected") return { title: s.track_rejected_title || "Payment proof needs attention", note: order.payment_rejection_reason || s.track_rejected_note || "Please upload a new payment screenshot.", step: 0 };
  if (order.order_status === "cancelled") return { title: s.track_cancelled_title || "Order cancelled", note: order.payment_rejection_reason || s.track_cancelled_note || "This order can no longer accept payment. Please place a new order.", step: 0 };
  if (order.order_status === "collected") return { title: s.track_collected_title || "Collected with care ✨", note: s.track_collected_note || "We hope you enjoyed every sip. Looking forward to making your next Shizuku drink.", step: 4 };
  if (order.order_status === "ready") return { title: s.track_ready_title || "Ready for collection", note: s.track_ready_note || "Your order is ready — see you at your pickup time!", step: 3 };
  if (order.order_status === "preparing") return { title: s.track_preparing_title || "Preparing your order", note: s.track_preparing_note || "We’re freshly preparing your drinks now.", step: 2 };
  if (order.payment_status === "submitted" || order.order_status === "awaiting_confirmation") return { title: s.track_review_title || "Payment under review", note: s.track_review_note || "We’ll confirm your order once your payment proof is verified.", step: 0 };
  if (order.payment_status === "paid" || order.order_status === "confirmed") return { title: s.track_confirmed_title || "Order confirmed", note: s.track_confirmed_note || "Payment verified — we’ll prepare your order closer to pickup.", step: 1 };
  return { title: s.track_awaiting_title || "Awaiting payment", note: s.track_awaiting_note || "Please complete payment and submit your payment screenshot.", step: 0 };
}
function retryRejectedPayment() {
  const order = state.tracking.order;
  if (!order) return;
  state.lastOrder = { ...order };
  state.payment = { transactionReference: "", proofFile: null, expiresAt: Date.now() + 15 * 60 * 1000 };
  state.screen = "payment";
  render();
}
function continueTrackedPayment() { retryRejectedPayment(); }
async function findOrder() {
  const t = state.tracking;
  const number = String(t.orderNumber || "").trim().toUpperCase();
  const phone = normalisePhone(t.phone);
  if (!number && !phone) { t.message = "Enter your order number or phone number."; t.order = null; render(); return; }
  t.loading = true; t.message = ""; t.order = null; render();
  const { data, error } = await db.rpc("track_shizuku_order", { p_order_number: number, p_phone: phone }).maybeSingle();
  t.loading = false;
  if (error) t.message = "We couldn’t check this order right now. Please try again shortly.";
  else if (!data) t.message = "We couldn’t find an order with those details. Please check and try again.";
  else {
    t.order = data;
    if (!t.phone && data.customer_phone) t.phone = data.customer_phone;
    if (!t.orderNumber && data.order_number) t.orderNumber = data.order_number;
    t.lastCheckedAt = new Date();
    state.reviewDraft.name = state.reviewDraft.name || data.customer_name || "";
    await loadOrderMessages();
    startCustomerChatRealtime();
    startLiveOrderTracking();
  }
  render();
}

function startCustomerChatRealtime() {
  const order = state.tracking.order;
  if (!IS_CONFIGURED || !order?.id || customerChatChannel) return;
  customerChatChannel = db.channel(`customer-order-chat-${order.id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${order.id}` }, async () => {
      await loadOrderMessages();
      render();
    })
    .subscribe();
}

function startLiveOrderTracking() {
  if (orderTrackingTimer || !state.tracking.order || !IS_CONFIGURED) return;
  state.tracking.live = true;
  orderTrackingTimer = setInterval(refreshTrackedOrder, 15000);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.tracking.order) refreshTrackedOrder();
});
async function refreshTrackedOrder() {
  const t = state.tracking;
  if (!t.order || document.visibilityState !== "visible") return;
  const { data, error } = await db.rpc("track_shizuku_order", { p_order_number: t.order.order_number, p_phone: normalisePhone(t.phone) }).maybeSingle();
  if (!error && data) {
    const changed = data.order_status !== t.order.order_status || data.payment_status !== t.order.payment_status || data.collection_time !== t.order.collection_time || data.collection_date !== t.order.collection_date;
    t.order = data; t.lastCheckedAt = new Date(); t.live = true;
    const messagesBefore = JSON.stringify(state.orderChat.messages.map((item) => [item.id, item.message_text, item.created_at]));
    await loadOrderMessages();
    const messagesChanged = messagesBefore !== JSON.stringify(state.orderChat.messages.map((item) => [item.id, item.message_text, item.created_at]));
    if (changed || messagesChanged) render();
  }
}

async function loadOrderMessages() {
  const order = state.tracking.order, chat = state.orderChat;
  if (!order || !IS_CONFIGURED) return;
  chat.loading = true; chat.message = "";
  const { data, error } = await db.rpc("get_shizuku_messages", { p_order_number: order.order_number, p_phone: state.tracking.phone });
  chat.loading = false;
  if (error) chat.message = "Messaging is not ready yet. Please try again later.";
  else chat.messages = data || [];
}

async function sendOrderMessage() {
  const order = state.tracking.order, chat = state.orderChat;
  const text = String(chat.text || "").trim();
  if (!order || !text || chat.sending) return;
  chat.sending = true; chat.message = ""; render();
  const { error } = await db.rpc("send_shizuku_message", { p_order_number: order.order_number, p_phone: state.tracking.phone, p_message_text: text });
  chat.sending = false;
  if (error) chat.message = error.message || "We couldn’t send your message.";
  else { chat.text = ""; await loadOrderMessages(); }
  render();
}

function renderOrderChat() {
  if (state.store.chat_enabled === false) return "";
  const chat = state.orderChat;
  return `<div class="summary-card" style="margin-top:16px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;"><div><div class="display" style="font-size:19px;">Message Shizuku Lab</div><div class="hint" style="text-align:left;margin-top:4px;">Replies will appear here when you track this order.</div></div><button class="pill" style="padding:7px 10px;" onclick="loadOrderMessages().then(render)">Refresh</button></div><div style="display:flex;flex-direction:column;gap:9px;margin:16px 0;max-height:310px;overflow:auto;">${chat.loading ? `<div class="hint">Loading messages…</div>` : chat.messages.length ? chat.messages.map((item) => `<div style="max-width:86%;align-self:${item.sender === "customer" ? "flex-end" : "flex-start"};padding:10px 12px;border-radius:${item.sender === "customer" ? "14px 14px 3px 14px" : "14px 14px 14px 3px"};background:${item.sender === "customer" ? "#4B5D3A" : "#f2ebe1"};color:${item.sender === "customer" ? "#fff" : "var(--ink)"};"><div style="font-size:10px;font-weight:800;opacity:.72;margin-bottom:4px;">${item.sender === "customer" ? "YOU" : "SHIZUKU LAB"}</div><div style="white-space:pre-wrap;line-height:1.45;">${escapeHtml(item.message_text)}</div></div>`).join("") : `<div class="hint" style="text-align:left;">No messages yet. Ask us anything about this order.</div>`}</div><div class="field"><label>Your message</label><textarea maxlength="1000" rows="3" placeholder="Write to Shizuku Lab…" oninput="state.orderChat.text=this.value">${escapeHtml(chat.text)}</textarea></div><button class="primary-btn" ${chat.sending ? "disabled" : ""} onclick="sendOrderMessage()">${chat.sending ? "Sending…" : "Send message"}</button>${chat.message ? `<div class="ref-note" style="color:#B33333;">${escapeHtml(chat.message)}</div>` : ""}</div>`;
}

async function submitReview() {
  const draft = state.reviewDraft, order = state.tracking.order;
  if (!order || draft.submitting || draft.submitted) return;
  if (String(draft.text || "").trim().length < 3) { draft.message = "Please write a little more about your visit."; render(); return; }
  draft.submitting = true; draft.message = ""; render();
  const { error } = await db.rpc("submit_shizuku_review", {
    p_order_number: order.order_number,
    p_phone: state.tracking.phone,
    p_customer_name: String(draft.name || order.customer_name || "Customer").trim(),
    p_rating: Number(draft.rating),
    p_review_text: String(draft.text || "").trim(),
  });
  draft.submitting = false;
  if (error) draft.message = error.message || "We couldn’t submit your review.";
  else { draft.submitted = true; draft.message = "Thank you — your review was sent to Shizuku Lab for approval."; }
  render();
}

function renderReviewForm() {
  if (state.store.reviews_enabled === false || !partnerFeatureEnabled("reviews")) return "";
  const d = state.reviewDraft;
  if (d.submitted) return `<div class="summary-card" style="margin-top:16px;text-align:center;"><div style="font-size:30px;">♡</div><b>Thank you for your review</b><div class="hint" style="margin-top:7px;line-height:1.5;">${escapeHtml(d.message)}</div></div>`;
  return `<div class="summary-card" style="margin-top:16px;"><div class="display" style="font-size:19px;margin-bottom:6px;">How was your Shizuku?</div><div class="hint" style="text-align:left;line-height:1.5;">Your review will appear after approval.</div><div style="display:flex;gap:5px;margin:15px 0;">${[1,2,3,4,5].map((n) => `<button type="button" aria-label="${n} star${n === 1 ? "" : "s"}" onclick="state.reviewDraft.rating=${n};render();" style="border:0;background:none;padding:2px;font-size:29px;color:${n <= d.rating ? "#a36d1e" : "#d8d0c4"};cursor:pointer;">★</button>`).join("")}</div><div class="field"><label>Name shown publicly</label><input maxlength="80" value="${escapeHtml(d.name || state.tracking.order?.customer_name || "")}" oninput="state.reviewDraft.name=this.value"></div><div class="field"><label>Your review</label><textarea maxlength="600" rows="4" placeholder="Tell us what you enjoyed…" oninput="state.reviewDraft.text=this.value">${escapeHtml(d.text)}</textarea></div><button class="primary-btn" ${d.submitting ? "disabled" : ""} onclick="submitReview()">${d.submitting ? "Sending…" : "Submit review"}</button>${d.message ? `<div class="ref-note" style="color:#B33333;">${escapeHtml(d.message)}</div>` : ""}</div>`;
}
function renderTrackOrder() {
  const t = state.tracking;
  const status = trackingStatus(t.order);
  const stages = t.order?.is_b2b?ShizukuB2B.statuses.map(k=>ShizukuB2B.labels[k]):[state.store.track_stage_payment || "Order received", state.store.track_stage_confirmed || "Payment confirmed", state.store.track_stage_preparing || "Preparing", state.store.track_stage_ready || "Ready for collection", state.store.track_stage_collected || "Collected"];
  return `
    ${header()}
    <div class="screen">
      <button class="back-link" onclick="setScreen('menu')">${ICONS.back} Back to menu</button>
      <div class="display" style="font-size:23px;margin:4px 0 6px;">${escapeHtml(state.store.track_order_heading || "Track my order")}</div>
      <div class="hint" style="text-align:left;line-height:1.5;">${escapeHtml(state.store.track_intro_text || "Enter either your order number or the phone number used at checkout.")}</div>
      <div class="summary-card" style="margin-top:16px;">
        <div class="field"><label>${escapeHtml(state.store.track_order_number_label || "Order number")}</label><input value="${escapeHtml(t.orderNumber)}" placeholder="e.g. SL-ABC123" style="text-transform:uppercase;" oninput="state.tracking.orderNumber=this.value.toUpperCase()"></div>
        <div style="display:flex;align-items:center;gap:12px;margin:2px 0 14px;color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.12em;"><span style="height:1px;background:var(--line);flex:1;"></span>${escapeHtml(state.store.track_or_text || "OR")}<span style="height:1px;background:var(--line);flex:1;"></span></div>
        <div class="field" style="margin-bottom:0;"><label>${escapeHtml(state.store.track_phone_label || "Phone number")}</label><input value="${escapeHtml(t.phone)}" placeholder="The number used at checkout" inputmode="tel" oninput="this.value=cleanPhoneInput(this.value);state.tracking.phone=this.value"></div>
        <button class="primary-btn" style="margin-top:16px;" ${t.loading ? "disabled" : ""} onclick="findOrder()">${t.loading ? "Checking…" : escapeHtml(state.store.track_button_text || "Track order")}</button>
        ${t.message ? `<div class="ref-note" style="color:#B33333;">${escapeHtml(t.message)}</div>` : ""}
      </div>
      ${t.order ? `<div class="summary-card" style="margin-top:16px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;"><span style="font-size:11px;font-weight:800;letter-spacing:.08em;color:#4B5D3A;">● ${escapeHtml(state.store.track_live_updates_text || "LIVE UPDATES")}</span><span class="hint" style="margin:0;font-size:10px;">Updates automatically</span></div><div class="row"><span class="label">${escapeHtml(state.store.track_order_label || "Order")}</span><span class="mono">${escapeHtml(t.order.order_number)}</span></div>${t.order.is_b2b?b2bOrderSummary(t.order):`<div class="row"><span class="label">${escapeHtml(state.store.track_pickup_label || "Pickup")}</span><span>${escapeHtml(t.order.collection_date || "")} · ${escapeHtml(t.order.collection_time || "")}</span></div>`}<div class="divider"></div><div class="center" style="padding:12px 0 8px;"><div style="display:inline-flex;width:54px;height:54px;align-items:center;justify-content:center;background:var(--matcha);color:var(--cream);border-radius:999px;font-size:24px;">✓</div><div class="display" style="font-size:20px;margin-top:12px;">${escapeHtml(status.title)}</div><div class="hint" style="margin:8px 0 14px;line-height:1.5;">${escapeHtml(status.note)}</div></div><div style="display:grid;grid-template-columns:repeat(${stages.length},1fr);gap:5px;margin:4px 0 2px;">${stages.map((stage, index) => `<div style="text-align:center;"><div style="height:6px;border-radius:99px;background:${index <= status.step ? "var(--matcha)" : "var(--line)"};"></div><div style="font-size:8px;color:var(--muted);line-height:1.25;margin-top:6px;">${escapeHtml(stage)}</div></div>`).join("")}</div></div>${t.order.is_b2b?`<button class="primary-btn" onclick="openTrackedB2BInvoice()">Invoice</button>`:""}${renderOrderChat()}${t.order.order_status === "collected" && t.order.payment_status === "paid" ? renderReviewForm() : ""}` : ""}
    </div>`;
}

/* ---------- customer loyalty ---------- */
async function findLoyalty() {
  const loyalty = state.loyalty;
  const phone = normalisePhone(loyalty.phone);
  if (!isValidPhone(phone)) {
    loyalty.message = state.market === "MY" ? "Enter the Malaysia phone number used at checkout." : "Enter the Singapore phone number used at checkout.";
    loyalty.account = null;
    render();
    return;
  }
  loyalty.loading = true;
  loyalty.message = "";
  loyalty.account = null;
  render();
  const { data, error } = await db.rpc("check_shizuku_loyalty", { p_phone: phone, p_market_code: state.market });
  loyalty.loading = false;
  if (error) loyalty.message = "We couldn’t check your rewards right now. Please try again shortly.";
  else if (!data) loyalty.message = "We couldn’t find a rewards account for that phone number.";
  else if (data.enabled === false) loyalty.message = "The Shizuku rewards programme is currently unavailable.";
  else loyalty.account = data;
  render();
}

function renderLoyalty() {
  const loyalty = state.loyalty;
  const account = loyalty.account;
  const pointsMode = account?.reward_type === "points";
  const value = Number(pointsMode ? account?.points : account?.stamps) || 0;
  const goal = Math.max(1, Number(pointsMode ? account?.points_required : account?.stamps_required) || 1);
  const progress = Math.min(100, Math.max(0, (value / goal) * 100));
  const history = Array.isArray(account?.history) ? account.history : [];
  const dots = !pointsMode && account
    ? Array.from({ length: Math.min(goal, 20) }, (_, index) => `<div style="aspect-ratio:1;border:1px solid ${index < value ? "#dcebd8" : "rgba(241,247,234,.38)"};background:rgba(255,255,255,${index < value ? ".92" : ".18"});border-radius:50%;display:grid;place-items:center;padding:5px;"><img src="${escapeHtml(state.store.logo_url || "logo.png")}" alt="Shizuku Lab stamp" style="width:100%;height:100%;object-fit:contain;border-radius:50%;opacity:${index < value ? "1" : ".25"};"></div>`).join("")
    : "";
  return `
    ${header()}
    <div class="screen">
      <button class="back-link" onclick="setScreen('menu')">${ICONS.back} Back to menu</button>
      <div class="display" style="font-size:23px;margin:4px 0 6px;">Check my loyalty</div>
      <div class="hint" style="text-align:left;line-height:1.5;">Use the same phone number entered when you placed your order.</div>
      <div class="summary-card" style="margin-top:16px;">
        <div class="field" style="margin-bottom:0;"><label>Phone number</label><input value="${escapeHtml(loyalty.phone)}" placeholder="${state.market === "MY" ? "Malaysia" : "Singapore"} phone number" inputmode="tel" oninput="this.value=cleanPhoneInput(this.value);state.loyalty.phone=this.value"></div>
        <button class="primary-btn" style="margin-top:16px;" ${loyalty.loading ? "disabled" : ""} onclick="findLoyalty()">${loyalty.loading ? "Checking…" : "Check loyalty"}</button>
        ${loyalty.message ? `<div class="ref-note" style="color:#B33333;">${escapeHtml(loyalty.message)}</div>` : ""}
      </div>
      ${account ? `<div style="margin-top:16px;padding:24px;background:linear-gradient(135deg,#1e473e,#294c44 55%,#19362f);border-radius:20px;color:#f9f4e8;box-shadow:0 14px 30px rgba(30,71,62,.18);"><div style="font-size:10px;font-weight:800;letter-spacing:.15em;color:#b7d2bb;">SHIZUKU LAB · MEMBER</div><div class="display" style="font-size:25px;margin-top:9px;color:#f9f4e8;">Shizuku Club</div>${pointsMode ? `<div style="font:700 48px/1 Georgia,serif;margin:24px 0 8px;">${value} <span style="font:600 15px/1 inherit;color:#cce0ca;">points</span></div><div style="height:9px;background:rgba(255,255,255,.2);border-radius:99px;margin:18px 0;overflow:hidden;"><div style="height:100%;width:${progress}%;background:#cae4b3;border-radius:99px;"></div></div><div style="font-size:12px;color:#d6e4d4;">Current balance: <b>${value} points</b></div>` : `<div style="margin:22px 0 17px;display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">${dots}</div><div style="font-size:12px;color:#d6e4d4;">Current balance: <b>${value} stamps</b></div>`}<div style="border-top:1px solid rgba(255,255,255,.2);margin:20px 0 16px;"></div><div style="font-size:10px;font-weight:800;letter-spacing:.12em;color:#b7d2bb;">NEXT REWARD</div><div style="font-size:15px;font-weight:700;margin-top:6px;">${escapeHtml(account.reward_description || "A free drink is on us.")}</div><div style="margin-top:15px;font-size:13px;color:#d6e4d4;">Rewards ready: <b style="color:#fff;">${Number(account.rewards_available || 0)}</b></div>${history.length ? `<div style="border-top:1px solid rgba(255,255,255,.2);margin:20px 0 12px;"></div><div style="font-size:10px;font-weight:800;letter-spacing:.12em;color:#b7d2bb;margin-bottom:7px;">RECENT ACTIVITY</div>${history.slice(0,8).map((item) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;font-size:12px;color:#f9f4e8;"><span><b>+${escapeHtml(item.amount)}</b> — Order ${escapeHtml(item.order_number)}</span><span style="color:#b7d2bb;white-space:nowrap;">${new Date(item.created_at).toLocaleDateString("en-SG", { day:"numeric", month:"short" })}</span></div>`).join("")}` : ""}</div>` : ""}
    </div>`;
}

/* ---------- main render ---------- */
function applyCmsWording() {
  document.querySelectorAll(".display").forEach((element) => {
    const text = element.textContent.trim();
    if (text === "Message Shizuku Lab") element.textContent = state.store.chat_heading || `Message ${state.store.store_name || "us"}`;
    if (text === "Shizuku Club") element.textContent = state.store.loyalty_heading || "Shizuku Club";
  });
  document.querySelectorAll(".faq-title").forEach((element) => {
    if (element.textContent.includes("REVIEWS")) element.textContent = state.store.reviews_heading || "お客様の声 · REVIEWS";
  });
  const chatInput = document.querySelector('textarea[placeholder="Write to Shizuku Lab…"]');
  const chatCard = chatInput?.closest(".summary-card");
  if (chatCard && (state.store.chat_auto_reply || state.store.chat_business_hours)) {
    const info = document.createElement("div");
    info.className = "ref-note";
    info.style.marginBottom = "12px";
    info.textContent = [state.store.chat_auto_reply, state.store.chat_business_hours].filter(Boolean).join(" · ");
    chatInput.closest(".field")?.before(info);
  }
  const loyaltyCard = document.querySelector('.screen > div[style*="linear-gradient(135deg,#1e473e"]');
  const customerName = String(state.loyalty.account?.customer_name || "").trim();
  if (loyaltyCard && customerName) {
    const greeting = document.createElement("div");
    greeting.style.cssText = "font-size:13px;font-weight:600;margin:10px 0 2px;color:inherit;opacity:.9;";
    greeting.textContent = `Welcome back, ${customerName}`;
    const programmeTitle = Array.from(loyaltyCard.querySelectorAll(".display")).find((element) => element.textContent.trim() === (state.store.loyalty_heading || "Shizuku Club"));
    if (programmeTitle) programmeTitle.after(greeting);
    else loyaltyCard.prepend(greeting);
  }
  if (state.screen === "track" && state.tracking.order?.payment_status === "rejected") {
    const screen = document.querySelector(".screen");
    const box = document.createElement("div");
    box.className = "summary-card";
    box.style.marginTop = "16px";
    box.innerHTML = `<b>Payment screenshot was not accepted</b><div class="hint" style="text-align:left;margin:8px 0 14px;">${escapeHtml(state.tracking.order.payment_rejection_reason || "Please upload a clearer screenshot.")}</div><button class="primary-btn" onclick="retryRejectedPayment()">Upload a new screenshot</button>`;
    screen?.append(box);
  }
  if (state.screen === "track" && state.tracking.order?.payment_status === "awaiting_payment" && state.tracking.order?.order_status !== "cancelled") {
    const screen = document.querySelector(".screen");
    const box = document.createElement("div");
    box.className = "summary-card";
    box.style.marginTop = "16px";
    const trackedPaymentName = (state.tracking.order?.market_code || state.market) === "MY" ? "Touch 'n Go or bank transfer" : "PayNow";
    box.innerHTML = `<b>Payment is not completed yet</b><div class="hint" style="text-align:left;margin:8px 0 14px;">Continue to ${escapeHtml(trackedPaymentName)} and upload your payment screenshot.</div><button class="primary-btn" onclick="continueTrackedPayment()">Continue payment</button>`;
    screen?.append(box);
  }
  if (state.screen === "track" && state.tracking.order?.order_status === "cancelled") {
    const screen = document.querySelector(".screen");
    const box = document.createElement("div");
    box.className = "summary-card";
    box.style.marginTop = "16px";
    box.innerHTML = `<b>This order cannot be paid</b><div class="hint" style="text-align:left;margin:8px 0 14px;">Its stock reservation has already been released.</div><button class="primary-btn" onclick="setScreen('menu')">Place a new order</button>`;
    screen?.append(box);
  }
}
function render() {
  const app = document.getElementById("app");
  if (!app) return;
  if (!state.loading && partnerModeActive()) {
    if (state.screen === "track" && !partnerFeatureEnabled("track_order")) state.screen = "menu";
    if (state.screen === "loyalty" && !partnerFeatureEnabled("rewards")) state.screen = "menu";
    if (state.screen === "reviews" && !partnerFeatureEnabled("reviews")) state.screen = "menu";
  }
  const screenChanged = lastRenderedScreen !== null && lastRenderedScreen !== state.screen;
  lastRenderedScreen = state.screen;
  applyStorefrontThemeVariables();
  app.style.setProperty("--cms-heading-size", `${Math.max(18, Math.min(48, Number(state.store.theme_heading_size || 25)))}px`);
  app.style.setProperty("--product-detail-image-height", `${Math.max(100, Math.min(420, Number(state.store.product_detail_image_height || 180)))}px`);
  app.style.setProperty("--product-option-text-size", `${Math.max(12, Math.min(24, Number(state.store.product_option_text_size || 15)))}px`);
  app.classList.toggle("compact-product-options", state.store.product_option_compact !== false);
  app.classList.toggle("contain-product-image", state.store.product_detail_image_fit === "contain");
  app.classList.toggle("product-options-screen", state.screen === "options" || state.screen === "bundle");
  ["zen","korean","editorial","retro","threed","sakura","coastal","cocoa","matcha_modern","japanese_paper","strawberry_milk","midnight_studio","nordic_cafe","studio_grid"].forEach((name) => app.classList.toggle(`theme-${name}`, (state.store.ordering_theme || state.store.system_theme || "zen") === name));
  if (state.loading) { app.innerHTML = `<div class="loading">Loading Shizuku Lab…</div>`; return; }
  const websiteVisibility = state.market === "MY" ? state.store.malaysia_website_visibility : state.store.website_visibility;
  if (websiteVisibility === "hidden") {
    const hiddenTitle = state.market === "MY" ? state.store.malaysia_website_hidden_title : state.store.website_hidden_title;
    const hiddenMessage = state.market === "MY" ? state.store.malaysia_website_hidden_message : state.store.website_hidden_message;
    app.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:${escapeHtml(state.store.theme_primary_color || "#4B5D3A")};color:${escapeHtml(state.store.theme_background_color || "#F3EEE3")};text-align:center"><article style="max-width:580px"><div style="font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;opacity:.75">${escapeHtml(state.store.store_name || "Shizuku Lab")} · ${state.market === "MY" ? "Malaysia" : "Singapore"}</div><h1 class="display" style="font-size:clamp(42px,8vw,72px);line-height:1.05;margin:18px 0">${escapeHtml(hiddenTitle || (state.market === "MY" ? "Malaysia ordering is coming soon." : "We’ll be back soon."))}</h1><p style="font-size:17px;line-height:1.7;opacity:.82">${escapeHtml(hiddenMessage || "We’re preparing our next opening. Please check back again soon.")}</p><div style="margin-top:32px;font-size:11px;letter-spacing:.08em;opacity:.6">Powered by OneTouch Studio</div></article></main>`;
    return;
  }
  let html = "";
  if (state.screen === "menu") html = renderMenu();
  else if (state.screen === "options") html = renderOptions();
  else if (state.screen === "bundle") html = renderBundle();
  else if (state.screen === "cart") html = renderCart();
  else if (state.screen === "checkout") html = renderCheckout();
  else if (state.screen === "receipt") html = renderReceipt();
  else if (state.screen === "payment") html = renderPayment();
  else if (state.screen === "confirmation") html = renderConfirmation();
  else if (state.screen === "track") html = renderTrackOrder();
  else if (state.screen === "loyalty") html = renderLoyalty();
  else if (state.screen === "reviews") html = renderReviewPortal();
  else html = renderMenu();
  app.innerHTML = `${storefrontThemeStyle()}${html}${poweredByFooter()}${renderStorefrontOverlay()}`;
  applyCmsWording();
  decorateReviewPortalWithCommunity();
  if (screenChanged) requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  if (state.screen === "payment") startPaymentCountdown();
}

init();

async function openTrackedB2BInvoice(){const o=state.tracking.order;if(!o?.is_b2b)return;const {data,error}=await db.rpc('get_shizuku_b2b_details',{p_order_number:o.order_number,p_phone:normalisePhone(state.tracking.phone)});if(error||!data)return alert('Unable to open invoice. Please check your tracking details.');state.lastOrder={...o,...data};setScreen('receipt');}
