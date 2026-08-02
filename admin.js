/* Shizuku Lab — shop dashboard (wired to real Supabase schema) */

const astate = {
  unlocked: false,
  pin: "",
  pinError: false,
  tab: "dashboard",
  orders: [],
  menu: [],
  productGroups: [],
  promos: [],
  customerNotes: {},
  loyaltySettings: null,
  loyaltyDraft: null,
  customerLoyalty: {},
  promoDraft: { code: "", discount_type: "fixed", discount_value: "", minimum_spend: "", usage_limit: "", valid_until: "" },
  selectedCustomerKey: null,
  settings: null,
  settingsDraft: null,
  openingOverrides: [],
  faq: [],
  selectedAvailabilityDate: null,
  availabilityDraft: null,
  calendarMonth: null,
  orderFilter: "all",
  orderSearch: "",
  loading: true,
  loadError: null,
  editing: null,
};

function money(n) { return `$${Number(n).toFixed(2)}`; }
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const PAY_LABEL = { awaiting_payment: "Awaiting payment", submitted: "Payment sent — pending confirmation", paid: "Paid" };
const PAY_COLOR = { awaiting_payment: "#B78A2E", submitted: "#B78A2E", paid: "#4B5D3A" };
const ORDER_LABEL = { pending: "Pending", awaiting_confirmation: "Awaiting confirmation", confirmed: "Confirmed", preparing: "Preparing", ready: "Ready for collection", collected: "Collected", cancelled: "Cancelled" };
const ORDER_COLOR = { cancelled: "#B33333", preparing: "#A36D1E", ready: "#267A47" };

function localDateText(date) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function weeklyAvailability(dateText) {
  const date = new Date(`${dateText}T12:00:00`);
  if (date.getDay() === 6) return { is_open: true, collection_time: astate.settingsDraft?.saturday_collection_time || "10:00 AM - 12:00 PM" };
  if (date.getDay() === 0) return { is_open: true, collection_time: astate.settingsDraft?.sunday_collection_time || "10:00 AM - 1:00 PM" };
  return { is_open: false, collection_time: "" };
}
function availabilityForDate(dateText) {
  const override = astate.openingOverrides.find((item) => item.collection_date === dateText);
  return override ? { is_open: !!override.is_open, collection_time: override.collection_time || "", override: true } : { ...weeklyAvailability(dateText), override: false };
}
function setAvailabilityDraft(dateText) {
  astate.selectedAvailabilityDate = dateText;
  const value = availabilityForDate(dateText);
  astate.availabilityDraft = { collection_date: dateText, is_open: value.is_open, collection_time: value.collection_time };
}
function selectAvailabilityDate(dateText) { setAvailabilityDraft(dateText); render(); }
function changeCalendarMonth(amount) {
  const current = new Date(`${astate.calendarMonth}T12:00:00`);
  current.setMonth(current.getMonth() + amount);
  astate.calendarMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-01`;
  render();
}
function onAvailabilityField(key, value) { astate.availabilityDraft[key] = value; }
async function saveAvailabilityOverride() {
  const entry = astate.availabilityDraft;
  if (!entry || !entry.collection_date) return;
  const button = document.getElementById("availability-save-btn");
  if (button) { button.textContent = "Saving…"; button.disabled = true; }
  const payload = { collection_date: entry.collection_date, is_open: !!entry.is_open, collection_time: entry.is_open ? String(entry.collection_time || "").trim() : null };
  const { data, error } = await db.from("store_opening_overrides").upsert(payload, { onConflict: "collection_date" }).select().single();
  if (button) { button.textContent = "Save day"; button.disabled = false; }
  if (error) { alert("Could not save this day: " + error.message); return; }
  astate.openingOverrides = [...astate.openingOverrides.filter((item) => item.collection_date !== data.collection_date), data];
  setAvailabilityDraft(data.collection_date);
  render();
}
async function clearAvailabilityOverride() {
  const dateText = astate.selectedAvailabilityDate;
  const existing = astate.openingOverrides.find((item) => item.collection_date === dateText);
  if (!existing) return;
  if (!confirm("Remove this special calendar setting and use the normal weekly hours again?")) return;
  const { error } = await db.from("store_opening_overrides").delete().eq("id", existing.id);
  if (error) { alert("Could not remove this day: " + error.message); return; }
  astate.openingOverrides = astate.openingOverrides.filter((item) => item.id !== existing.id);
  setAvailabilityDraft(dateText);
  render();
}

async function loadAll() {
  astate.loading = true; astate.loadError = null; render();
  if (IS_CONFIGURED) {
    try {
      // try the nested query first (needs FKs orders<-order_items<-order_item_options)
      let orders;
      const nested = await db.from("orders").select("*, order_items(*, order_item_options(*))").order("created_at", { ascending: false });
      if (nested.error) {
        // fall back to flat queries and stitch client-side
        const [{ data: oRows, error: oErr }, { data: iRows }, { data: optRows }] = await Promise.all([
          db.from("orders").select("*").order("created_at", { ascending: false }),
          db.from("order_items").select("*"),
          db.from("order_item_options").select("*"),
        ]);
        if (oErr) throw oErr;
        orders = (oRows || []).map((o) => ({
          ...o,
          order_items: (iRows || []).filter((it) => String(it.order_id) === String(o.id)).map((it) => ({
            ...it,
            order_item_options: (optRows || []).filter((op) => String(op.order_item_id) === String(it.id)),
          })),
        }));
      } else {
        orders = nested.data || [];
      }
      astate.orders = orders;

      const { data: menu, error: mErr } = await db.from("products").select("*").order("category");
      if (mErr) astate.loadError = mErr.message;
      astate.menu = menu || [];

      const { data: groups, error: groupError } = await db.from("product_groups").select("*").order("sort_order").order("name");
      if (groupError) console.warn("Could not load product groups:", groupError.message);
      astate.productGroups = groups || [];

      const { data: settingsRows } = await db.from("store_settings").select("*").limit(1);
      astate.settings = (settingsRows && settingsRows[0]) || null;
      astate.settingsDraft = astate.settings ? { ...astate.settings } : null;
      const { data: faq, error: faqError } = await db.from("store_faq").select("*").order("sort_order");
      if (faqError) console.warn("Could not load FAQ:", faqError.message);
      astate.faq = faq || [];
      const { data: overrides, error: availabilityError } = await db.from("store_opening_overrides").select("*").order("collection_date");
      if (availabilityError) console.warn("Could not load store availability:", availabilityError.message);
      astate.openingOverrides = overrides || [];
      const [{ data: promos, error: promoError }, { data: notes, error: notesError }, { data: loyaltySettings, error: loyaltySettingsError }, { data: loyaltyRows, error: loyaltyRowsError }] = await Promise.all([
        db.from("promo_codes").select("*").order("created_at", { ascending: false }),
        db.from("customer_notes").select("*"),
        db.from("loyalty_settings").select("*").eq("id", 1).maybeSingle(),
        db.from("customer_loyalty").select("*"),
      ]);
      if (promoError) console.warn("Could not load promo codes:", promoError.message);
      if (notesError) console.warn("Could not load customer notes:", notesError.message);
      if (loyaltySettingsError) console.warn("Could not load loyalty settings:", loyaltySettingsError.message);
      if (loyaltyRowsError) console.warn("Could not load loyalty balances:", loyaltyRowsError.message);
      astate.promos = promos || [];
      astate.customerNotes = Object.fromEntries((notes || []).map((note) => [note.customer_key, note.note || ""]));
      astate.loyaltySettings = loyaltySettings || { id: 1, enabled: false, reward_type: "stamps", stamps_required: 10, minimum_spend: 5, points_per_dollar: 1, points_required: 50, reward_description: "A free drink is on us." };
      astate.loyaltyDraft = { ...astate.loyaltySettings };
      astate.customerLoyalty = Object.fromEntries((loyaltyRows || []).map((row) => [row.customer_key, row]));
      if (!astate.selectedAvailabilityDate) astate.selectedAvailabilityDate = localDateText(new Date());
      if (!astate.calendarMonth) astate.calendarMonth = astate.selectedAvailabilityDate.slice(0, 7) + "-01";
      setAvailabilityDraft(astate.selectedAvailabilityDate);
    } catch (e) {
      astate.loadError = (e && e.message) || String(e);
      astate.orders = []; astate.menu = [];
    }
  } else {
    astate.orders = []; astate.menu = [];
  }
  astate.loading = false;
  render();
}

async function confirmPayment(id) {
  astate.orders = astate.orders.map((o) => (String(o.id) === String(id) ? { ...o, payment_status: "paid", order_status: "confirmed" } : o));
  render();
  if (IS_CONFIGURED) await db.from("orders").update({ payment_status: "paid", order_status: "confirmed" }).eq("id", id);
}

async function openPaymentProof(path) {
  if (!path) return;
  const proofWindow = window.open("", "_blank");
  if (!proofWindow) { alert("Please allow pop-ups to open the payment screenshot."); return; }
  if (/^https?:\/\//i.test(path)) { proofWindow.location.href = path; return; }
  if (!IS_CONFIGURED) { proofWindow.close(); return; }
  const { data, error } = await db.storage.from("payment-proofs").createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    proofWindow.close();
    alert("Could not open the payment screenshot.\n\n" + ((error && error.message) || "The screenshot link is missing."));
    return;
  }
  proofWindow.location.href = data.signedUrl;
}
async function updateOrderStatus(id, order_status) {
  astate.orders = astate.orders.map((o) => (String(o.id) === String(id) ? { ...o, order_status } : o));
  render();
  if (IS_CONFIGURED) await db.from("orders").update({ order_status }).eq("id", id);
}
async function cancelOrder(id) {
  if (!confirm("Cancel this order? This can't be undone from here.")) return;
  astate.orders = astate.orders.map((o) => (String(o.id) === String(id) ? { ...o, order_status: "cancelled" } : o));
  render();
  if (IS_CONFIGURED) {
    const { error } = await db.from("orders").update({ order_status: "cancelled" }).eq("id", id);
    if (error) alert("Could not cancel order: " + error.message);
  }
}

/* ---- menu (products) CRUD — unchanged from before ---- */
function newMenuItem() {
  const firstGroup = astate.productGroups[0];
  astate.editing = { id: null, group_id: firstGroup?.id || null, category: firstGroup?.name || "Signature", name: "", description: "", price: 0, image_url: "", is_available: true, is_bundle: false, bundle_product_ids: [], stock: 0 };
  render();
}
function editMenuItem(id) {
  astate.editing = { ...astate.menu.find((m) => String(m.id) === String(id)) };
  render();
}
function cancelEdit() { astate.editing = null; render(); }
function onEditField(key, value) {
  if (key === "price" || key === "stock") astate.editing[key] = parseFloat(value) || 0;
  else astate.editing[key] = value;
}
function onEditGroup(value) {
  const group = astate.productGroups.find((item) => String(item.id) === String(value));
  astate.editing.group_id = group ? group.id : null;
  astate.editing.category = group ? group.name : "Other";
}
function toggleBundleProduct(productId, checked) {
  const ids = Array.isArray(astate.editing.bundle_product_ids) ? astate.editing.bundle_product_ids.map(String) : [];
  astate.editing.bundle_product_ids = checked ? [...new Set([...ids, String(productId)])] : ids.filter((id) => id !== String(productId));
}
async function uploadStorefrontImage(input, target) {
  const file = input?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { alert("Please choose an image file."); return; }
  if (file.size > 8 * 1024 * 1024) { alert("Please use an image smaller than 8 MB."); return; }
  const extension = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "");
  const path = `${target}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await db.storage.from("storefront-images").upload(path, file, { upsert: false, contentType: file.type });
  if (error) { alert("Could not upload image: " + error.message); return; }
  const { data } = db.storage.from("storefront-images").getPublicUrl(path);
  if (target === "products") astate.editing.image_url = data.publicUrl;
  else { astate.settingsDraft[target] = data.publicUrl; }
  render();
}
async function saveMenuItem() {
  const item = astate.editing;
  if (!item.name.trim()) { alert("Name is required."); return; }
  if (!IS_CONFIGURED) { alert("Demo mode: connect Supabase to persist menu changes."); astate.editing = null; render(); return; }
  const btn = document.getElementById("save-btn");
  if (btn) { btn.textContent = "Saving…"; btn.disabled = true; }
  try {
    if (item.id) {
      const { id, ...fields } = item;
      const { error } = await db.from("products").update(fields).eq("id", id);
      if (error) throw error;
      astate.menu = astate.menu.map((m) => (String(m.id) === String(id) ? item : m));
    } else {
      const { id, ...fields } = item;
      const { data, error } = await db.from("products").insert(fields).select().single();
      if (error) throw error;
      astate.menu = [...astate.menu, data];
    }
    astate.editing = null;
    render();
  } catch (e) {
    alert("Could not save: " + ((e && e.message) || String(e)));
    if (btn) { btn.textContent = "Save"; btn.disabled = false; }
  }
}
async function deleteMenuItem(id) {
  if (!confirm("Delete this item?")) return;
  astate.menu = astate.menu.filter((m) => String(m.id) !== String(id));
  render();
  if (IS_CONFIGURED) await db.from("products").delete().eq("id", id);
}

function addProductGroup() { astate.productGroups = [...astate.productGroups, { id: null, name: "", sort_order: astate.productGroups.length, is_visible: true }]; render(); }
function onGroupField(index, key, value) { astate.productGroups[index][key] = key === "sort_order" ? Number(value || 0) : value; }
async function saveProductGroups() {
  const rows = astate.productGroups.filter((group) => String(group.name || "").trim());
  for (let index = 0; index < rows.length; index++) {
    const group = rows[index];
    const fields = { name: String(group.name).trim(), sort_order: Number(group.sort_order ?? index), is_visible: !!group.is_visible };
    const query = group.id ? db.from("product_groups").update(fields).eq("id", group.id).select().single() : db.from("product_groups").insert(fields).select().single();
    const { data, error } = await query;
    if (error) { alert("Could not save group: " + error.message); return; }
    Object.assign(group, data);
  }
  astate.productGroups = rows.sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  alert("Product groups saved."); render();
}

/* ---- store settings ---- */
function onSettingsField(key, value) { astate.settingsDraft[key] = value; }
async function saveSettings() {
  if (!astate.settings) { alert("No store_settings row found — add one in Supabase first."); return; }
  const btn = document.getElementById("settings-save-btn");
  if (btn) { btn.textContent = "Saving…"; btn.disabled = true; }
  const { id, created_at, updated_at, ...fields } = astate.settingsDraft;
  const { error } = await db.from("store_settings").update(fields).eq("id", astate.settings.id);
  if (btn) { btn.textContent = "Save settings"; btn.disabled = false; }
  if (error) { alert("Could not save: " + error.message); return; }
  astate.settings = { ...astate.settingsDraft };
  alert("Saved.");
}

function tryUnlock() {
  if (astate.pin === SHOP_PIN) { astate.unlocked = true; astate.pinError = false; loadAll(); }
  else { astate.pinError = true; render(); }
}

function header(subtitle) {
  return `
  <div class="header">
    <div class="header-row">
      <div>
        <div class="display brand-title">${(astate.settings && astate.settings.store_name) || "Shizuku Lab"} — Shop</div>
        <div class="brand-sub">${subtitle}</div>
      </div>
    </div>
  </div>`;
}

function dashboardStyles() {
  return `<style>
    #app.wrap{width:100%;max-width:none!important;margin:0!important;padding:0!important}
    .shop-admin{min-height:100vh;background:#fffaf5;color:#292720;font-family:inherit;display:flex}
    .shop-admin *{box-sizing:border-box}.shop-admin .admin-side{width:248px;flex:0 0 248px;min-height:100vh;padding:28px 16px;border-right:1px solid #eadfd2;background:#fffdf9;position:sticky;top:0;height:100vh}
    .shop-admin .admin-logo{font-family:Georgia,serif;font-size:27px;font-weight:700;line-height:1.05}.shop-admin .admin-caption{margin:6px 8px 32px;color:#75845d;font-size:13px;letter-spacing:.06em}
    .shop-admin .admin-nav-label{margin:0 8px 10px;color:#877d70;font-size:11px;font-weight:800;letter-spacing:.12em}.shop-admin .admin-nav{display:grid;gap:6px}
    .shop-admin .admin-nav button{appearance:none;width:100%;border:0;border-radius:14px;background:transparent;padding:13px 14px;color:#504a42;font:600 15px/1.2 inherit;text-align:left;cursor:pointer}.shop-admin .admin-nav button:hover{background:#f5ede2}.shop-admin .admin-nav button.active{background:#263125;color:#fff;box-shadow:0 10px 24px rgba(47,63,36,.16)}
    .shop-admin .admin-nav .nav-icon{display:inline-block;width:27px;color:#fa7439;font-size:18px;text-align:center;margin-right:5px}.shop-admin .admin-nav button.active .nav-icon{color:#ffe4d8}
    .shop-admin .admin-side-bottom{margin:28px 8px 0;border-top:1px solid #eadfd2;padding:18px 0 0;color:#6b645b;font-size:13px}.shop-admin .admin-side-bottom a{color:#4d633d;text-decoration:none;font-weight:700}
    .shop-admin .admin-main{width:100%;max-width:1500px;margin:0 auto;padding:42px 54px 80px}.shop-admin .admin-top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;border-bottom:1px solid #eadfd2;padding-bottom:26px;margin-bottom:28px}.shop-admin .admin-eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#ef7138;text-transform:uppercase;margin-bottom:9px}.shop-admin .admin-title{font:700 40px/1.05 Georgia,serif;margin:0;letter-spacing:-.02em}.shop-admin .admin-subtitle{color:#6e6b63;margin:9px 0 0;font-size:16px}.shop-admin .open-shop{border:1px solid #e8d9ca;background:#fff;border-radius:13px;padding:12px 16px;color:#33492c;font:700 14px inherit;white-space:nowrap;cursor:pointer}
    .shop-admin .stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:22px}.shop-admin .stat{border:1px solid #eadfd2;border-radius:18px;padding:19px 20px;background:#fff;min-height:120px}.shop-admin .stat:nth-child(1){background:#f0f7e8;border-color:#d7e8c8}.shop-admin .stat:nth-child(2){background:#fff1e7;border-color:#f2d7c4}.shop-admin .stat:nth-child(3){background:#f3efff;border-color:#dfd6ff}.shop-admin .stat-label{display:flex;gap:8px;align-items:center;color:#69675f;font-weight:700;font-size:14px}.shop-admin .stat-icon{font-size:19px}.shop-admin .stat-value{font:700 30px/1 Georgia,serif;margin-top:18px}.shop-admin .stat-help{font-size:13px;color:#756e64;margin-top:7px}
    .shop-admin .dashboard-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:20px}.shop-admin .dashboard-card{border:1px solid #eadfd2;border-radius:18px;background:#fff;overflow:hidden}.shop-admin .dashboard-card-head{display:flex;justify-content:space-between;align-items:center;padding:19px 20px;border-bottom:1px solid #eee3d8}.shop-admin .dashboard-card-head h2{font:700 19px/1.1 Georgia,serif;margin:0}.shop-admin .dashboard-card-head span{color:#756e64;font-size:13px}.shop-admin .queue-row{padding:16px 20px;border-bottom:1px solid #f0e7de;cursor:pointer}.shop-admin .queue-row:last-child{border-bottom:0}.shop-admin .queue-row:hover{background:#fffaf6}.shop-admin .queue-top{display:flex;justify-content:space-between;gap:14px;align-items:center}.shop-admin .queue-number{font-family:ui-monospace,monospace;font-size:14px;font-weight:800}.shop-admin .queue-name{color:#6d665d;font-size:14px;margin-top:6px}.shop-admin .queue-amount{font-weight:800}.shop-admin .queue-status{font-size:12px;font-weight:800;padding:6px 9px;border-radius:99px;background:#f5efe7;color:#756950;white-space:nowrap}.shop-admin .dashboard-empty{padding:30px 20px;color:#756e64;text-align:center}.shop-admin .action-list{padding:8px 20px 12px}.shop-admin .action{display:flex;gap:12px;padding:17px 0;border-bottom:1px solid #f0e7de}.shop-admin .action:last-child{border:0}.shop-admin .action-icon{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#fff0e7;color:#ef7138}.shop-admin .action strong{font-size:14px}.shop-admin .action p{font-size:13px;color:#756e64;line-height:1.4;margin:4px 0 0}
    .shop-admin .tab-page-title{font:700 32px/1.1 Georgia,serif;margin:0 0 8px}.shop-admin .tab-page-subtitle{margin:0 0 24px;color:#6e6b63}.shop-admin .admin-content .tabs{margin-bottom:22px}.shop-admin .admin-content .screen{max-width:none}.shop-admin .admin-content .order-card{box-shadow:none}
    @media(max-width:800px){.shop-admin{display:block}.shop-admin .admin-side{position:static;width:auto;height:auto;min-height:0;padding:20px 16px;border-right:0;border-bottom:1px solid #eadfd2}.shop-admin .admin-caption{margin-bottom:16px}.shop-admin .admin-nav{grid-template-columns:repeat(5,minmax(max-content,1fr));overflow-x:auto;gap:7px;padding-bottom:2px}.shop-admin .admin-nav-label,.shop-admin .admin-side-bottom{display:none}.shop-admin .admin-nav button{padding:10px 11px;font-size:13px;text-align:center;white-space:nowrap}.shop-admin .admin-nav .nav-icon{display:none}.shop-admin .admin-main{padding:28px 16px 70px}.shop-admin .admin-top{margin-bottom:22px}.shop-admin .admin-title{font-size:32px}.shop-admin .open-shop{padding:10px;font-size:12px}.shop-admin .stat-grid,.shop-admin .dashboard-grid{grid-template-columns:1fr}.shop-admin .stat-grid{gap:10px}.shop-admin .stat{min-height:95px;padding:16px}.shop-admin .stat-value{font-size:26px;margin-top:12px}}
  </style>`;
}

function paidOrders() { return astate.orders.filter((order) => order.payment_status === "paid" && order.order_status !== "cancelled"); }
function dashboardStats() {
  const paid = paidOrders();
  const now = new Date();
  const monthly = paid.filter((order) => { const d = new Date(order.created_at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const customerKeys = new Set(astate.orders.map((order) => String(order.customer_phone || order.instagram || order.customer_name || "").trim()).filter(Boolean));
  return { revenue: monthly.reduce((sum, order) => sum + Number(order.total || 0), 0), orders: monthly.length, customers: customerKeys.size, paymentReview: astate.orders.filter((order) => order.payment_status === "submitted").length };
}
function salesPerformance() {
  const now = new Date();
  const paid = paidOrders();
  const monthly = paid.filter((order) => {
    const date = new Date(order.created_at);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  const products = new Map();
  monthly.forEach((order) => (order.order_items || []).forEach((item) => {
    const name = item.product_name || "Unnamed drink";
    const row = products.get(name) || { name, quantity: 0, revenue: 0 };
    row.quantity += Number(item.quantity || 0);
    row.revenue += Number(item.subtotal || 0);
    products.set(name, row);
  }));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - (6 - index));
    const total = paid.filter((order) => {
      const orderDate = new Date(order.created_at);
      return orderDate.getFullYear() === date.getFullYear() && orderDate.getMonth() === date.getMonth() && orderDate.getDate() === date.getDate();
    }).reduce((sum, order) => sum + Number(order.total || 0), 0);
    return { label: date.toLocaleDateString(undefined, { weekday: "short" }), total };
  });
  return { topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5), days };
}
function nextPickupProduction() {
  const active = paidOrders().filter((order) => ["confirmed", "preparing", "ready"].includes(order.order_status));
  const dates = [...new Set(active.map((order) => order.collection_date).filter(Boolean))].sort();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const date = dates.find((value) => value >= todayKey) || dates[0] || "";
  const orders = active.filter((order) => order.collection_date === date).sort((a, b) => String(a.collection_time || "").localeCompare(String(b.collection_time || "")));
  return { date, orders };
}
function customerInsights() {
  const list = customers();
  const top = [...list].sort((a, b) => b.spent - a.spent)[0] || null;
  const repeat = list.filter((customer) => customer.orders.length > 1);
  const now = new Date();
  const newThisMonth = list.filter((customer) => {
    const firstOrder = [...customer.orders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
    const date = new Date(firstOrder?.created_at);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  return { top, repeat, newThisMonth };
}
function setTab(tab) { astate.tab = tab; render(); }
function renderDashboardTab() {
  const stats = dashboardStats();
  const liveOrders = astate.orders.filter((order) => order.order_status !== "cancelled" && order.order_status !== "collected").slice(0, 6);
  const performance = salesPerformance();
  const production = nextPickupProduction();
  const insights = customerInsights();
  const highestDailySale = Math.max(...performance.days.map((day) => day.total), 1);
  return `
    <div class="admin-top"><div><div class="admin-eyebrow">Command center</div><h1 class="admin-title">Good day, ${(astate.settings && escapeHtml(astate.settings.store_name)) || "Shizuku Lab"}</h1><p class="admin-subtitle">Your orders, revenue and customers — all in one place.</p></div><a class="open-shop" href="order.html">Open customer shop ↗</a></div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label"><span class="stat-icon">✦</span>Revenue this month</div><div class="stat-value">${money(stats.revenue)}</div><div class="stat-help">Paid orders only</div></div>
      <div class="stat"><div class="stat-label"><span class="stat-icon">▣</span>Orders this month</div><div class="stat-value">${stats.orders}</div><div class="stat-help">${stats.paymentReview ? `${stats.paymentReview} need payment review` : "Everything is up to date"}</div></div>
      <div class="stat"><div class="stat-label"><span class="stat-icon">◉</span>Customers</div><div class="stat-value">${stats.customers}</div><div class="stat-help">Across all orders</div></div>
    </div>
    <div class="dashboard-grid"><section class="dashboard-card"><div class="dashboard-card-head"><h2>Order queue</h2><button class="link-btn" onclick="setTab('orders')">View all</button></div>${liveOrders.length ? liveOrders.map((order) => `<div class="queue-row" onclick="setTab('orders')"><div class="queue-top"><div class="queue-number">${escapeHtml(order.order_number || order.id)}</div><div class="queue-status">${escapeHtml(PAY_LABEL[order.payment_status] || order.payment_status || "Pending")}</div></div><div class="queue-top"><div class="queue-name">${escapeHtml(order.customer_name || "Customer")} · ${escapeHtml(order.collection_date || "Pickup date pending")}</div><div class="queue-amount">${money(order.total)}</div></div></div>`).join("") : `<div class="dashboard-empty">You’re all caught up — no active orders right now.</div>`}</section>
    <section class="dashboard-card"><div class="dashboard-card-head"><h2>Next steps</h2><span>Shop checklist</span></div><div class="action-list"><div class="action"><div class="action-icon">✓</div><div><strong>Review payment proofs</strong><p>${stats.paymentReview ? `${stats.paymentReview} customer payment${stats.paymentReview === 1 ? "" : "s"} waiting for confirmation.` : "No payment proof waiting right now."}</p></div></div><div class="action"><div class="action-icon">◷</div><div><strong>Set pickup availability</strong><p>Open or close special collection days in your calendar.</p></div></div><div class="action"><div class="action-icon">✦</div><div><strong>Keep your menu fresh</strong><p>Edit prices, availability and products whenever you need.</p></div></div></div></section></div>
    <div style="margin-top:28px"><div class="admin-eyebrow">Next pickup production</div><section class="dashboard-card"><div class="dashboard-card-head"><h2>${production.date ? escapeHtml(production.date) : "No upcoming paid orders"}</h2><span>${production.orders.length ? `${production.orders.length} drink order${production.orders.length === 1 ? "" : "s"}` : "Your paid pickup orders will appear here"}</span></div>${production.orders.length ? production.orders.map((order) => `<div class="queue-row" onclick="setTab('orders')"><div class="queue-top"><div><div class="queue-number">${escapeHtml(order.collection_time || "Time pending")} · ${escapeHtml(order.customer_name || "Customer")}</div><div class="queue-name">${(order.order_items || []).map((item) => `${escapeHtml(item.product_name)} × ${item.quantity}`).join(" · ") || "Order items loading"}</div></div><div class="queue-status">${escapeHtml(ORDER_LABEL[order.order_status] || order.order_status)}</div></div></div>`).join("") : `<div class="dashboard-empty">When you confirm payment, the order will show here for its collection day.</div>`}</section></div>
    <div style="margin-top:28px"><div class="admin-eyebrow">Sales performance</div><div class="dashboard-grid"><section class="dashboard-card"><div class="dashboard-card-head"><h2>Last 7 days</h2><span>Paid sales only</span></div><div style="height:210px;padding:24px 20px 15px;display:flex;align-items:flex-end;gap:12px">${performance.days.map((day) => `<div style="height:100%;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px"><div title="${money(day.total)}" style="width:min(44px,100%);height:${day.total ? Math.max(10, Math.round(day.total / highestDailySale * 145)) : 4}px;background:${day.total ? "#ef7138" : "#eee3d8"};border-radius:8px 8px 3px 3px"></div><div style="font-size:12px;font-weight:700;color:#756e64">${day.label}</div><div style="font-size:11px;color:#8a8177">${day.total ? money(day.total) : "—"}</div></div>`).join("")}</div></section>
    <section class="dashboard-card"><div class="dashboard-card-head"><h2>Top drinks this month</h2><span>By sales</span></div>${performance.topProducts.length ? performance.topProducts.map((product, index) => `<div class="queue-row"><div class="queue-top"><div><div class="queue-number">${index + 1}. ${escapeHtml(product.name)}</div><div class="queue-name">${product.quantity} cup${product.quantity === 1 ? "" : "s"} sold</div></div><div class="queue-amount">${money(product.revenue)}</div></div></div>`).join("") : `<div class="dashboard-empty">Your top drinks will appear here after paid orders come in.</div>`}</section></div></div>
    <div style="margin-top:28px"><div class="admin-eyebrow">Customer insights</div><div class="dashboard-grid"><section class="dashboard-card"><div class="dashboard-card-head"><h2>Customer snapshot</h2><button class="link-btn" onclick="setTab('customers')">View customers</button></div><div style="padding:20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px"><div style="padding:16px;border-radius:14px;background:#f3efff"><div style="font-size:12px;font-weight:800;color:#756e64">REPEAT CUSTOMERS</div><div style="font:700 30px/1 Georgia,serif;margin-top:12px">${insights.repeat.length}</div><div class="queue-name">Ordered more than once</div></div><div style="padding:16px;border-radius:14px;background:#f0f7e8"><div style="font-size:12px;font-weight:800;color:#756e64">NEW THIS MONTH</div><div style="font:700 30px/1 Georgia,serif;margin-top:12px">${insights.newThisMonth.length}</div><div class="queue-name">First-time customers</div></div></div></section><section class="dashboard-card"><div class="dashboard-card-head"><h2>Top customer</h2><span>All paid orders</span></div>${insights.top ? `<div style="padding:24px 20px"><div style="font:700 26px/1.1 Georgia,serif">${escapeHtml(insights.top.name)}</div><div class="queue-name" style="margin-top:8px">${insights.top.orders.length} order${insights.top.orders.length === 1 ? "" : "s"} · ${escapeHtml(insights.top.phone || (insights.top.instagram ? `@${insights.top.instagram}` : "No contact detail"))}</div><div style="font:700 31px/1 Georgia,serif;color:#4d633d;margin-top:24px">${money(insights.top.spent)}</div><div class="queue-name">Total paid spend</div></div>` : `<div class="dashboard-empty">Your highest-spending customer will appear here after paid orders come in.</div>`}</section></div></div>`;
}

function renderLogin() {
  return `
  <div class="overlay" style="position:relative;background:none;align-items:flex-start;padding:60px 16px;">
    <div class="overlay-card" style="max-width:340px;margin:0 auto;">
      <div class="display overlay-title">Shop access</div>
      <div class="overlay-sub">Enter the shop PIN to view and manage orders.</div>
      <input id="pin-input" type="text" inputmode="numeric" placeholder="PIN" value="${astate.pin}"
        oninput="astate.pin=this.value; astate.pinError=false;"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid ${astate.pinError ? "#B33" : "#E1D9C8"};margin-bottom:10px;font-size:15px;">
      ${astate.pinError ? `<div class="error-text">Incorrect PIN, try again.</div>` : ""}
      <div class="btn-row">
        <a href="index.html" style="flex:1;"><button class="btn-secondary" style="width:100%;">Cancel</button></a>
        <button class="btn-primary" onclick="tryUnlock()">Enter</button>
      </div>
    </div>
  </div>`;
}

function setOrderFilter(filter) { astate.orderFilter = filter; render(); }
function setOrderSearch(value) { astate.orderSearch = value; render(); }
function orderMatchesFilter(order, filter) {
  if (filter === "payment") return order.payment_status === "submitted";
  if (filter === "awaiting") return order.payment_status === "awaiting_payment";
  if (filter === "paid") return order.payment_status === "paid" && order.order_status === "confirmed";
  if (filter === "preparing") return order.order_status === "preparing";
  if (filter === "ready") return order.order_status === "ready";
  if (filter === "collected") return order.order_status === "collected";
  if (filter === "cancelled") return order.order_status === "cancelled";
  return true;
}
function renderOrders() {
  const search = String(astate.orderSearch || "").trim().toLowerCase();
  const orders = astate.orders.filter((order) => {
    const searchable = [order.order_number, order.customer_name, order.customer_phone, order.instagram, order.collection_date].join(" ").toLowerCase();
    return orderMatchesFilter(order, astate.orderFilter) && (!search || searchable.includes(search));
  });
  const filters = [
    ["all", "All orders"], ["payment", "Payment review"], ["awaiting", "Awaiting payment"],
    ["paid", "Paid"], ["preparing", "Preparing"], ["ready", "Ready"], ["collected", "Collected"], ["cancelled", "Cancelled"]
  ];
  const controls = `<section class="dashboard-card" style="padding:18px 20px;margin-bottom:18px;overflow:visible;">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <input aria-label="Search orders" placeholder="Search order, customer, phone or Instagram" value="${escapeHtml(astate.orderSearch)}" oninput="setOrderSearch(this.value)" style="flex:1 1 320px;margin:0;">
      <span class="hint" style="margin:0;white-space:nowrap;">${orders.length} shown</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:13px;">${filters.map(([key, label]) => `<button class="${astate.orderFilter === key ? "btn-primary" : "btn-secondary"}" style="padding:8px 11px;font-size:12px;" onclick="setOrderFilter('${key}')">${label}</button>`).join("")}</div>
  </section>`;
  if (astate.orders.length === 0) return controls + `<div class="empty">No orders yet.</div>`;
  if (orders.length === 0) return controls + `<div class="empty">No orders match this search or filter.</div>`;
  return controls + orders.map((o) => `
    <div class="order-card">
      <div class="order-top">
        <div class="mono">${o.order_number || o.id}</div>
        <div class="status-tag" style="color:${PAY_COLOR[o.payment_status] || "#8A8478"}">${PAY_LABEL[o.payment_status] || o.payment_status || "—"}</div>
      </div>
      <div class="order-meta">${o.customer_name || ""} · ${o.customer_phone || ""}${o.instagram ? " · @" + o.instagram : ""}</div>
      <div class="order-meta">Pickup: ${o.collection_date || ""} ${o.collection_time || ""}</div>
      <div class="order-meta">Order status: <b style="color:${ORDER_COLOR[o.order_status] || "inherit"}">${ORDER_LABEL[o.order_status] || o.order_status || "—"}</b></div>
      <div style="margin-top:8px;">
        ${(o.order_items || []).map((it) => `
          <div class="row"><span>${it.product_name} × ${it.quantity}</span><span>${money(it.subtotal)}</span></div>
          ${(it.order_item_options || []).length ? `<div class="hint" style="margin:0 0 4px;text-align:left;">${it.order_item_options.map((op) => op.option_name).join(", ")}</div>` : ""}
        `).join("")}
      </div>
      ${o.notes ? `<div class="ref-note">Note: ${o.notes}</div>` : ""}
      ${o.payment_transaction_reference ? `<div class="ref-note">PayNow transaction reference: <b>${escapeHtml(o.payment_transaction_reference)}</b></div>` : ""}
      ${o.payment_screenshot_url ? `<div style="margin-top:8px;"><button class="small-btn" onclick='openPaymentProof(${JSON.stringify(o.payment_screenshot_url)})'>View payment screenshot</button></div>` : ""}
      <div class="divider"></div>
      <div class="row bold"><span class="label">Total</span><span>${money(o.total)}</span></div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center;">
        ${o.payment_status === "submitted" ? `<button class="small-btn" onclick="confirmPayment('${o.id}')">Confirm payment</button>` : ""}
        ${o.payment_status === "awaiting_payment" ? `<span class="hint" style="margin:0;">Waiting on customer to pay</span>` : ""}
        ${o.payment_status === "paid" && o.order_status === "confirmed" ? `<button class="small-btn" onclick="updateOrderStatus('${o.id}','preparing')">Start preparing</button>` : ""}
        ${o.payment_status === "paid" && o.order_status === "preparing" ? `<button class="small-btn" onclick="updateOrderStatus('${o.id}','ready')">Mark ready for collection</button>` : ""}
        ${o.payment_status === "paid" && o.order_status === "ready" ? `<button class="small-btn" onclick="updateOrderStatus('${o.id}','collected')">Mark collected</button>` : ""}
        ${o.order_status !== "cancelled" && o.order_status !== "collected" ? `<button class="link-danger" onclick="cancelOrder('${o.id}')">Cancel order</button>` : ""}
      </div>
    </div>
  `).join("");
}

function renderMenuTab() {
  return `
    <section class="dashboard-card" style="padding:20px;margin-bottom:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Product groups</h2><span>These become the big headings on the ordering page</span></div>
      ${astate.productGroups.map((group, index) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 78px auto;gap:9px;align-items:center;margin:9px 0;"><input value="${escapeHtml(group.name || "")}" placeholder="e.g. Special" oninput="onGroupField(${index},'name',this.value)"><input type="number" value="${Number(group.sort_order || 0)}" title="Display order" oninput="onGroupField(${index},'sort_order',this.value)"><label style="font-size:12px;white-space:nowrap;"><input type="checkbox" style="width:auto;" ${group.is_visible ? "checked" : ""} onchange="onGroupField(${index},'is_visible',this.checked)"> Show</label></div>`).join("")}
      <div class="btn-row" style="margin-top:14px;"><button class="btn-secondary" onclick="addProductGroup()">+ Add group</button><button class="btn-primary" onclick="saveProductGroups()">Save groups</button></div>
    </section>
    ${astate.menu.map((item) => `
      <div class="order-card">
        <div class="order-top">
          <div>
            <div style="font-size:14px;font-weight:600;">${item.name}</div>
            <div class="order-meta">${item.category || "Other"} · ${item.is_bundle ? "Bundle · " : ""}${item.is_available ? "Visible" : "Hidden"} · ${money(item.price)}</div>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="link-btn" onclick="editMenuItem('${item.id}')">Edit</button>
            <button class="link-danger" onclick="deleteMenuItem('${item.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join("")}
    <button class="small-btn" style="width:100%;margin-top:4px;" onclick="newMenuItem()">+ Add menu item</button>
  `;
}

/* ---- promos ---- */
function onPromoField(key, value) { astate.promoDraft[key] = key === "code" ? String(value || "").toUpperCase().replace(/\s+/g, "") : value; }
function clearPromoDraft() { astate.promoDraft = { code: "", discount_type: "fixed", discount_value: "", minimum_spend: "", usage_limit: "", valid_until: "" }; render(); }
async function createPromo() {
  const draft = astate.promoDraft;
  const code = String(draft.code || "").trim().toUpperCase();
  const value = Number(draft.discount_value);
  if (!code) return alert("Enter a promo code.");
  if (!Number.isFinite(value) || value <= 0) return alert("Enter a valid discount amount.");
  const button = document.getElementById("create-promo-btn"); if (button) { button.textContent = "Saving…"; button.disabled = true; }
  const { data, error } = await db.from("promo_codes").insert({ code, discount_type: draft.discount_type === "percent" ? "percent" : "fixed", discount_value: value, minimum_spend: Number(draft.minimum_spend || 0), usage_limit: draft.usage_limit === "" ? null : Math.max(1, Number(draft.usage_limit)), valid_until: draft.valid_until || null, is_active: true }).select().single();
  if (button) { button.textContent = "Create promo"; button.disabled = false; }
  if (error) return alert("Could not create promo: " + error.message);
  astate.promos = [data, ...astate.promos]; clearPromoDraft(); alert("Promo created.");
}
async function setPromoActive(id, is_active) {
  const { error } = await db.from("promo_codes").update({ is_active }).eq("id", id);
  if (error) return alert("Could not update promo: " + error.message);
  astate.promos = astate.promos.map((promo) => String(promo.id) === String(id) ? { ...promo, is_active } : promo); render();
}
async function removePromo(id) {
  if (!confirm("Delete this promo code?")) return;
  const { error } = await db.from("promo_codes").delete().eq("id", id);
  if (error) return alert("Could not delete promo: " + error.message);
  astate.promos = astate.promos.filter((promo) => String(promo.id) !== String(id)); render();
}
function renderPromosTab() {
  const d = astate.promoDraft;
  return `<div class="dashboard-grid" style="grid-template-columns:minmax(290px,.72fr) minmax(400px,1.28fr);align-items:start;"><section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>New promo code</h2></div><div class="field"><label>Code</label><input value="${escapeHtml(d.code)}" placeholder="WELCOME10" style="text-transform:uppercase" oninput="onPromoField('code',this.value);this.value=this.value.toUpperCase()"></div><div class="field"><label>Discount type</label><select onchange="onPromoField('discount_type',this.value)"><option value="fixed" ${d.discount_type === "fixed" ? "selected" : ""}>Dollar off ($)</option><option value="percent" ${d.discount_type === "percent" ? "selected" : ""}>Percent off (%)</option></select></div><div class="field"><label>Discount value</label><input type="number" min="0.01" step="0.01" value="${escapeHtml(d.discount_value)}" placeholder="1.00" oninput="onPromoField('discount_value',this.value)"></div><div class="field"><label>Minimum spend (optional)</label><input type="number" min="0" step="0.01" value="${escapeHtml(d.minimum_spend)}" placeholder="0.00" oninput="onPromoField('minimum_spend',this.value)"></div><div class="field"><label>Usage limit (optional)</label><input type="number" min="1" value="${escapeHtml(d.usage_limit)}" placeholder="No limit" oninput="onPromoField('usage_limit',this.value)"></div><div class="field"><label>End date (optional)</label><input type="date" value="${escapeHtml(d.valid_until)}" oninput="onPromoField('valid_until',this.value)"></div><div class="btn-row"><button class="btn-secondary" onclick="clearPromoDraft()">Clear</button><button class="btn-primary" id="create-promo-btn" onclick="createPromo()">Create promo</button></div></section><section class="dashboard-card"><div class="dashboard-card-head"><h2>Promo codes</h2><span>${astate.promos.length} total</span></div>${astate.promos.length ? astate.promos.map((promo) => { const exhausted = promo.usage_limit != null && Number(promo.used_count || 0) >= Number(promo.usage_limit); const active = promo.is_active && !exhausted; return `<div class="queue-row"><div class="queue-top"><div><div class="queue-number">${escapeHtml(promo.code)}</div><div class="queue-name">${promo.discount_type === "percent" ? `${escapeHtml(promo.discount_value)}% off` : `${money(promo.discount_value)} off`} · min. ${money(promo.minimum_spend || 0)}</div></div><div class="queue-status" style="background:${active ? "#e6f5df" : "#f5e8e4"};color:${active ? "#28753a" : "#a33c28"};">${active ? "LIVE" : exhausted ? "USED UP" : "PAUSED"}</div></div><div style="display:flex;gap:12px;align-items:center;margin-top:12px;"><span class="hint" style="margin:0;text-align:left;">${Number(promo.used_count || 0)} used${promo.usage_limit != null ? ` / ${promo.usage_limit}` : ""}${promo.valid_until ? ` · ends ${escapeHtml(promo.valid_until)}` : ""}</span><span style="margin-left:auto;display:flex;gap:8px;"><button class="link-btn" onclick="setPromoActive('${promo.id}',${!promo.is_active})">${promo.is_active ? "Pause" : "Make live"}</button><button class="link-danger" onclick="removePromo('${promo.id}')">Delete</button></span></div></div>`; }).join("") : `<div class="dashboard-empty">No promo codes yet.</div>`}</section></div>`;
}

/* ---- customers ---- */
function customerKey(order) { return String(order.customer_phone || order.instagram || order.customer_name || "Unknown customer").trim(); }
function customers() { const result = new Map(); astate.orders.forEach((order) => { const key = customerKey(order); const customer = result.get(key) || { key, name: order.customer_name || "Customer", phone: order.customer_phone || "", instagram: order.instagram || "", orders: [], spent: 0 }; customer.orders.push(order); if (order.payment_status === "paid" && order.order_status !== "cancelled") customer.spent += Number(order.total || 0); result.set(key, customer); }); return [...result.values()].sort((a,b) => new Date(b.orders[0]?.created_at || 0) - new Date(a.orders[0]?.created_at || 0)); }
function chooseCustomer(key) { astate.selectedCustomerKey = key; render(); }
function setCustomerNote(value) { if (astate.selectedCustomerKey) astate.customerNotes[astate.selectedCustomerKey] = value; }
async function saveCustomerNote() { const key = astate.selectedCustomerKey; if (!key) return; const button = document.getElementById("save-customer-note"); if (button) { button.textContent = "Saving…"; button.disabled = true; } const { error } = await db.from("customer_notes").upsert({ customer_key: key, note: String(astate.customerNotes[key] || "").trim() }, { onConflict: "customer_key" }); if (button) { button.textContent = "Save remark"; button.disabled = false; } if (error) return alert("Could not save remark: " + error.message); alert("Remark saved."); }
function renderCustomersTab() { const list = customers(); const selected = list.find((item) => item.key === astate.selectedCustomerKey) || list[0]; if (selected && !astate.selectedCustomerKey) astate.selectedCustomerKey = selected.key; return `<div class="dashboard-grid" style="grid-template-columns:minmax(400px,1.1fr) minmax(300px,.9fr);align-items:start;"><section class="dashboard-card"><div class="dashboard-card-head"><h2>Customers</h2><span>${list.length} total</span></div>${list.length ? list.map((customer) => `<div class="queue-row" data-key="${escapeHtml(customer.key)}" onclick="chooseCustomer(this.dataset.key)" style="${customer.key === astate.selectedCustomerKey ? "background:#fffaf6;box-shadow:inset 4px 0 #ef7138;" : ""}"><div class="queue-top"><div><b>${escapeHtml(customer.name)}</b><div class="queue-name">${escapeHtml(customer.phone || (customer.instagram ? `@${customer.instagram}` : "No contact detail"))}</div></div><div style="text-align:right"><b>${money(customer.spent)}</b><div class="queue-name">${customer.orders.length} order${customer.orders.length === 1 ? "" : "s"}</div></div></div>${astate.customerNotes[customer.key] ? `<div class="queue-name" style="margin-top:7px;color:#9a5b35">📝 ${escapeHtml(astate.customerNotes[customer.key])}</div>` : ""}</div>`).join("") : `<div class="dashboard-empty">Customers appear after their first order.</div>`}</section><section class="dashboard-card">${selected ? `<div class="dashboard-card-head"><h2>${escapeHtml(selected.name)}</h2><span>${selected.orders.length} order${selected.orders.length === 1 ? "" : "s"}</span></div><div style="padding:20px"><div class="field"><label>Phone</label><input value="${escapeHtml(selected.phone)}" readonly></div>${selected.instagram ? `<div class="field"><label>Instagram</label><input value="@${escapeHtml(selected.instagram)}" readonly></div>` : ""}<div class="field"><label>Private remark</label><textarea rows="5" placeholder="e.g. Prefers less sweet…" oninput="setCustomerNote(this.value)">${escapeHtml(astate.customerNotes[selected.key] || "")}</textarea><div class="hint" style="text-align:left;margin-top:6px">Only you can see this.</div></div><button class="btn-primary" id="save-customer-note" style="width:100%" onclick="saveCustomerNote()">Save remark</button><div class="divider" style="margin:20px 0 12px"></div><b>Order history</b>${selected.orders.map((order) => `<div class="row" style="padding:10px 0;border-bottom:1px solid #f0e7de"><span>${escapeHtml(order.order_number || order.id)}<br><span class="hint" style="margin:0">${escapeHtml(order.collection_date || "")}</span></span><span>${money(order.total)}</span></div>`).join("")}</div>` : `<div class="dashboard-empty">Choose a customer.</div>`}</section></div>`; }

/* ---- rewards: choose stamps or points ---- */
function onLoyaltyField(key, value) { astate.loyaltyDraft[key] = value; }
async function saveLoyaltySettings() {
  const draft = astate.loyaltyDraft;
  const payload = { id: 1, enabled: !!draft.enabled, reward_type: draft.reward_type === "points" ? "points" : "stamps", stamps_required: Math.max(1, Number(draft.stamps_required || 10)), minimum_spend: Math.max(0, Number(draft.minimum_spend || 0)), points_per_dollar: Math.max(0.01, Number(draft.points_per_dollar || 1)), points_required: Math.max(1, Number(draft.points_required || 50)), reward_description: String(draft.reward_description || "A free drink is on us.").trim() };
  const button = document.getElementById("save-loyalty-settings"); if (button) { button.textContent = "Saving…"; button.disabled = true; }
  const { data, error } = await db.from("loyalty_settings").upsert(payload, { onConflict: "id" }).select().single();
  if (button) { button.textContent = "Save rewards"; button.disabled = false; }
  if (error) return alert("Could not save rewards: " + error.message);
  astate.loyaltySettings = data; astate.loyaltyDraft = { ...data }; alert("Rewards saved."); render();
}
async function adjustReward(customerKey, amount) {
  if (!customerKey) return;
  const current = astate.customerLoyalty[customerKey] || { customer_key: customerKey, stamps: 0, points: 0, rewards_available: 0 };
  const mode = astate.loyaltySettings?.reward_type === "points" ? "points" : "stamps";
  const field = mode === "points" ? "points" : "stamps";
  const goal = Math.max(1, Number(mode === "points" ? astate.loyaltySettings?.points_required : astate.loyaltySettings?.stamps_required));
  let value = Math.max(0, Number(current[field] || 0) + Number(amount || 0));
  let rewards = Math.max(0, Number(current.rewards_available || 0));
  if (amount > 0 && value >= goal) { rewards += Math.floor(value / goal); value %= goal; }
  const payload = { customer_key: customerKey, stamps: Number(current.stamps || 0), points: Number(current.points || 0), rewards_available: rewards, [field]: value };
  const { data, error } = await db.from("customer_loyalty").upsert(payload, { onConflict: "customer_key" }).select().single();
  if (error) return alert("Could not update reward balance: " + error.message);
  astate.customerLoyalty[customerKey] = data; render();
}
function renderRewardsTab() {
  const d = astate.loyaltyDraft || { enabled: false, reward_type: "stamps", stamps_required: 10, minimum_spend: 5, points_per_dollar: 1, points_required: 50, reward_description: "A free drink is on us." };
  const points = d.reward_type === "points";
  const goal = Math.max(1, Number(points ? d.points_required || 50 : d.stamps_required || 10));
  const customerRows = customers();
  const cardDots = Array.from({ length: Math.min(goal, 10) }, () => `<div style="aspect-ratio:1;border:2px solid rgba(241,247,234,.55);border-radius:50%;display:grid;place-items:center;color:#dcebd8;font-size:13px;">☆</div>`).join("");
  const preview = points
    ? `<div style="margin:20px 20px 4px;padding:22px;background:linear-gradient(135deg,#1e473e,#294c44 55%,#19362f);border-radius:17px;color:#f9f4e8;"><div style="font-size:10px;font-weight:800;letter-spacing:.15em;color:#b7d2bb;">SHIZUKU LAB · POINTS WALLET</div><div style="font:700 24px/1.1 Georgia,serif;margin-top:9px;">Shizuku Club</div><div style="font:700 48px/1 Georgia,serif;margin:22px 0 5px;">0 <span style="font:600 15px/1 inherit;color:#cce0ca;">points</span></div><div style="font-size:12px;color:#d6e4d4;">${goal} points to your next reward</div><div style="height:9px;background:rgba(255,255,255,.2);border-radius:99px;margin:18px 0 17px;overflow:hidden;"><div style="height:100%;width:0%;background:#cae4b3;border-radius:99px;"></div></div><div style="font-size:10px;font-weight:800;letter-spacing:.12em;color:#b7d2bb;">REDEEM</div><div style="font-size:14px;font-weight:700;margin-top:5px;">${escapeHtml(d.reward_description || "A free drink is on us.")}</div><div style="font-size:12px;color:#d6e4d4;margin-top:12px;">Earn ${escapeHtml(d.points_per_dollar || 1)} point${Number(d.points_per_dollar || 1) === 1 ? "" : "s"} for every $1 spent</div></div>`
    : `<div style="margin:20px 20px 4px;padding:22px;background:linear-gradient(135deg,#1e473e,#294c44 55%,#19362f);border-radius:17px;color:#f9f4e8;"><div style="font-size:10px;font-weight:800;letter-spacing:.15em;color:#b7d2bb;">SHIZUKU LAB · MEMBER</div><div style="font:700 24px/1.1 Georgia,serif;margin-top:9px;">Shizuku Club</div><div style="margin:20px 0 16px;display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">${cardDots}</div><div style="font-size:10px;font-weight:800;letter-spacing:.12em;color:#b7d2bb;">NEXT REWARD</div><div style="font-size:14px;font-weight:700;margin-top:5px;">${escapeHtml(d.reward_description || "A free drink is on us.")}</div><div style="font-size:12px;color:#d6e4d4;margin-top:12px;">${goal} stamps to complete a card</div></div>`;
  const settings = `<section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Rewards programme</h2><span>${d.enabled ? "LIVE" : "OFF"}</span></div><label class="slot" style="cursor:pointer;gap:10px;margin:0 0 16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${d.enabled ? "checked" : ""} onchange="onLoyaltyField('enabled',this.checked)"><span><b>Enable rewards</b><br><span class="hint">Choose one simple programme for customers.</span></span></label><div class="field"><label>Reward type</label><select onchange="onLoyaltyField('reward_type',this.value);render()"><option value="stamps" ${!points ? "selected" : ""}>Stamp card</option><option value="points" ${points ? "selected" : ""}>Points</option></select></div>${points ? `<div class="field"><label>Points earned per $1 spent</label><input type="number" min="0.01" step="0.1" value="${escapeHtml(d.points_per_dollar)}" oninput="onLoyaltyField('points_per_dollar',this.value)"></div><div class="field"><label>Points needed for a reward</label><input type="number" min="1" value="${escapeHtml(d.points_required)}" oninput="onLoyaltyField('points_required',this.value)"></div>` : `<div class="field"><label>Stamps to complete a card</label><input type="number" min="1" max="30" value="${escapeHtml(d.stamps_required)}" oninput="onLoyaltyField('stamps_required',this.value)"></div><div class="field"><label>Minimum spend per stamp ($)</label><input type="number" min="0" step="0.10" value="${escapeHtml(d.minimum_spend)}" oninput="onLoyaltyField('minimum_spend',this.value)"></div>`}<div class="field"><label>Reward message</label><textarea rows="3" oninput="onLoyaltyField('reward_description',this.value)">${escapeHtml(d.reward_description)}</textarea></div><button class="btn-primary" id="save-loyalty-settings" style="width:100%" onclick="saveLoyaltySettings()">Save rewards</button></section>`;
  const members = `<section class="dashboard-card">${preview}<div class="dashboard-card-head"><h2>${points ? "Points members" : "Stamp card members"}</h2><span>${customerRows.length} customers</span></div>${customerRows.length ? customerRows.map((customer) => { const balance = astate.customerLoyalty[customer.key] || {}; const value = Number(balance[points ? "points" : "stamps"] || 0); return `<div class="queue-row"><div class="queue-top"><div><b>${escapeHtml(customer.name)}</b><div class="queue-name">${value} / ${goal} ${points ? "points" : "stamps"} · ${Number(balance.rewards_available || 0)} reward${Number(balance.rewards_available || 0) === 1 ? "" : "s"} ready</div></div><div style="display:flex;gap:7px"><button class="btn-secondary" data-key="${escapeHtml(customer.key)}" onclick="adjustReward(this.dataset.key,-1)">−1</button><button class="btn-primary" data-key="${escapeHtml(customer.key)}" onclick="adjustReward(this.dataset.key,1)">+1</button></div></div></div>`; }).join("") : `<div class="dashboard-empty">Customers appear after their first order.</div>`}</section>`;
  return `<div class="dashboard-grid" style="grid-template-columns:minmax(300px,.88fr) minmax(360px,1.12fr);align-items:start;">${settings}${members}</div>`;
}

function addFaq() {
  astate.faq.push({ id: null, question: "", answer: "", sort_order: astate.faq.length, is_active: true });
  render();
}
function onFaqField(index, key, value) { astate.faq[index][key] = value; }
async function saveFaq() {
  const valid = astate.faq.filter((item) => String(item.question || "").trim() && String(item.answer || "").trim());
  for (let index = 0; index < valid.length; index++) {
    const item = valid[index];
    const fields = { question: item.question.trim(), answer: item.answer.trim(), sort_order: index, is_active: true };
    const query = item.id ? db.from("store_faq").update(fields).eq("id", item.id).select().single() : db.from("store_faq").insert(fields).select().single();
    const { data, error } = await query;
    if (error) { alert("Could not save FAQ: " + error.message); return; }
    Object.assign(item, data);
  }
  astate.faq = valid;
  alert("FAQ saved.");
  render();
}
async function deleteFaq(index) {
  const item = astate.faq[index];
  if (!confirm("Delete this FAQ?")) return;
  if (item.id) {
    const { error } = await db.from("store_faq").delete().eq("id", item.id);
    if (error) { alert("Could not delete FAQ: " + error.message); return; }
  }
  astate.faq.splice(index, 1);
  render();
}

function renderSettingsTab() {
  if (!astate.settingsDraft) return `<div class="empty">No store_settings row found. Add one in Supabase, then refresh.</div>`;
  const s = astate.settingsDraft;
  const field = (label, key, placeholder = "") => `
    <div class="field"><label>${label}</label><input value="${s[key] || ""}" placeholder="${placeholder}" oninput="onSettingsField('${key}', this.value)"></div>`;
  return `
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Store details</div>
    ${field("Store name", "store_name")}
    ${field("Instagram (without @)", "instagram")}
    ${field("Shizuku Lab website link (optional)", "website_url", "https://your-brand-website.com")}
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Storefront images</div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 16px;"><div style="border:1px solid #E1D9C8;border-radius:13px;padding:12px;background:#fff;"><b style="display:block;margin-bottom:4px;">Logo frame · 1 : 1</b><span class="hint" style="margin:0;text-align:left;">Best upload: square, at least 1000 × 1000 px.</span></div><div style="border:1px solid #E1D9C8;border-radius:13px;padding:12px;background:#fff;"><b style="display:block;margin-bottom:4px;">Banner frame · 2 : 1</b><span class="hint" style="margin:0;text-align:left;">Best upload: landscape, at least 1600 × 800 px.</span></div></div>
    <div class="field"><label>Logo</label><input value="${escapeHtml(s.logo_url || "")}" placeholder="Upload below or paste image URL" oninput="onSettingsField('logo_url', this.value)"><input type="file" accept="image/*" style="margin-top:8px;" onchange="uploadStorefrontImage(this,'logo_url')">${s.logo_url ? `<div style="width:112px;height:112px;border:1px solid #E1D9C8;border-radius:50%;overflow:hidden;margin-top:10px;background:#fff;display:grid;place-items:center;"><img src="${escapeHtml(s.logo_url)}" alt="Logo preview" style="width:100%;height:100%;object-fit:contain;transform:scale(${Number(s.logo_image_scale || 1)});"></div>` : ""}</div>
    <div class="field"><label>Logo circle size <span style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.logo_circle_size || 68)} px</span></label><input type="range" min="56" max="150" step="1" value="${Number(s.logo_circle_size || 68)}" oninput="onSettingsField('logo_circle_size',Number(this.value));this.previousElementSibling.querySelector('span').textContent=this.value+' px'"><div class="hint" style="text-align:left;margin-top:5px;">Adjust the white circle around the logo.</div></div>
    <div class="field"><label>Logo image size <span style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.logo_image_scale || 1).toFixed(2)}×</span></label><input type="range" min="0.55" max="2" step="0.05" value="${Number(s.logo_image_scale || 1)}" oninput="onSettingsField('logo_image_scale',Number(this.value));this.previousElementSibling.querySelector('span').textContent=Number(this.value).toFixed(2)+'×'"><div class="hint" style="text-align:left;margin-top:5px;">Zoom the logo inside the circle without changing the circle itself.</div></div>
    <div class="field"><label>Top banner image</label><input value="${escapeHtml(s.hero_image_url || "")}" placeholder="Upload below or paste image URL" oninput="onSettingsField('hero_image_url', this.value)"><input type="file" accept="image/*" style="margin-top:8px;" onchange="uploadStorefrontImage(this,'hero_image_url')">${s.hero_image_url ? `<img src="${escapeHtml(s.hero_image_url)}" alt="Banner preview" style="display:block;width:100%;aspect-ratio:2/1;object-fit:cover;object-position:center ${Number(s.hero_image_position ?? 68)}%;border:1px solid #E1D9C8;border-radius:12px;margin-top:10px;">` : ""}</div>
    <div class="field"><label>Banner crop position <span style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.hero_image_position ?? 68)}%</span></label><input type="range" min="0" max="100" step="1" value="${Number(s.hero_image_position ?? 68)}" oninput="onSettingsField('hero_image_position',Number(this.value));this.previousElementSibling.querySelector('span').textContent=this.value+'%'"><div class="hint" style="text-align:left;margin-top:5px;">This is your crop control: move it until the matcha and hojicha layers show nicely in the preview.</div></div>
    <div class="field"><label>Banner height <span style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.hero_banner_height || 190)} px</span></label><input type="range" min="130" max="320" step="5" value="${Number(s.hero_banner_height || 190)}" oninput="onSettingsField('hero_banner_height',Number(this.value));this.previousElementSibling.querySelector('span').textContent=this.value+' px'"><div class="hint" style="text-align:left;margin-top:5px;">Make the banner taller or shorter.</div></div>
    <div class="field"><label>Store introduction</label><textarea rows="4" placeholder="A short introduction customers see below your collection address." oninput="onSettingsField('store_description', this.value)">${escapeHtml(s.store_description || "")}</textarea><div class="hint" style="text-align:left;margin-top:5px;">Shown on the customer ordering page.</div></div>
    ${field("Top rolling message", "ticker_text", "e.g. PRE-ORDER ONLY · FRESHLY WHISKED · SHIZUKU LAB")}
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_ticker !== false ? "checked" : ""} onchange="onSettingsField('show_ticker', this.checked)"><span><b>Show rolling message</b><br><span class="hint">Untick to hide it from the ordering page.</span></span></label>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Contact</div>
    ${field("WhatsApp number", "whatsapp_number", "+65 9XXX XXXX")}
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;">
      <input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_whatsapp ? "checked" : ""} onchange="onSettingsField('show_whatsapp', this.checked)">
      <span><b>Show WhatsApp on website</b><br><span class="hint">Keep this unticked if you only want to save the number for later.</span></span>
    </label>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Payment & collection</div>
    ${field("PayNow name", "paynow_name")}
    ${field("PayNow number", "paynow_number", "+65 9XXX XXXX")}
    ${field("PayNow URL (optional)", "paynow_url")}
    ${field("Collection address", "collection_address")}
    ${field("Saturday collection time", "saturday_collection_time", "10:00 AM - 12:00 PM")}
    ${field("Sunday collection time", "sunday_collection_time", "10:00 AM - 1:00 PM")}
    <button class="btn-primary" id="settings-save-btn" style="width:100%;margin-top:8px;" onclick="saveSettings()">Save settings</button>
  `;
}

function renderFaqTab() {
  return `<section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Customer FAQ</h2><span>Shown at the bottom of the ordering page</span></div><div class="hint" style="text-align:left;margin-bottom:14px;">Use emoji in the question if you want the tone to feel friendly and casual.</div>${astate.faq.map((item, index) => `<div class="order-card" style="margin-bottom:12px;"><div class="field"><label>Question</label><input value="${escapeHtml(item.question || "")}" placeholder="e.g. 🍵 How do I pay?" oninput="onFaqField(${index}, 'question', this.value)"></div><div class="field"><label>Answer</label><textarea rows="4" oninput="onFaqField(${index}, 'answer', this.value)">${escapeHtml(item.answer || "")}</textarea></div><button class="link-danger" onclick="deleteFaq(${index})">Delete FAQ</button></div>`).join("")}<div class="btn-row"><button class="btn-secondary" onclick="addFaq()">+ Add FAQ</button><button class="btn-primary" onclick="saveFaq()">Save FAQ</button></div></section>`;
}

function renderAvailabilityTab() {
  if (!astate.settingsDraft || !astate.availabilityDraft) return `<div class="empty">Loading availability…</div>`;
  const s = astate.settingsDraft;
  const selected = astate.availabilityDraft;
  const month = new Date(`${astate.calendarMonth}T12:00:00`);
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(`<div></div>`);
  for (let day = 1; day <= days; day++) {
    const dateText = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const status = availabilityForDate(dateText);
    const isSelected = dateText === astate.selectedAvailabilityDate;
    const label = status.is_open ? (status.override ? "Special open" : "Open") : (status.override ? "Closed" : "—");
    const color = status.is_open ? "#4B5D3A" : status.override ? "#B33333" : "#8A8478";
    cells.push(`<button class="slot" style="min-height:70px;padding:8px;text-align:left;display:block;border-color:${isSelected ? "#4B5D3A" : "#E1D9C8"};background:${isSelected ? "#F1F5EA" : "#fff"};" onclick="selectAvailabilityDate('${dateText}')"><b>${day}</b><br><span style="font-size:11px;color:${color};">${label}</span></button>`);
  }
  const existing = astate.openingOverrides.find((item) => item.collection_date === selected.collection_date);
  return `
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Ordering window</div>
    <div class="field"><label>How many days ahead can customers order?</label><input type="number" min="0" max="60" value="${s.order_advance_days ?? 14}" oninput="onSettingsField('order_advance_days', Number(this.value))"><div class="hint">Example: 14 lets customers order up to 2 weeks ahead.</div></div>
    <div class="field"><label>Minimum notice before pickup (hours)</label><input type="number" min="0" max="168" value="${s.minimum_order_notice_hours ?? 0}" oninput="onSettingsField('minimum_order_notice_hours', Number(this.value))"><div class="hint">Example: 24 means customers must order at least 24 hours before pickup.</div></div>
    <div class="field"><label>Pickup time interval (minutes)</label><select onchange="onSettingsField('pickup_slot_interval_minutes', Number(this.value))"><option value="15" ${Number(s.pickup_slot_interval_minutes) === 15 ? "selected" : ""}>Every 15 minutes</option><option value="30" ${Number(s.pickup_slot_interval_minutes || 30) === 30 ? "selected" : ""}>Every 30 minutes</option><option value="60" ${Number(s.pickup_slot_interval_minutes) === 60 ? "selected" : ""}>Every 60 minutes</option></select><div class="hint">Customers choose a date first, then see times based on this interval.</div></div>
    <button class="btn-primary" id="settings-save-btn" style="width:100%;margin:2px 0 20px;" onclick="saveSettings()">Save ordering window</button>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:16px 0 8px;">Opening calendar</div>
    <div class="hint" style="text-align:left;margin:0 0 10px;">Weekend hours stay as your normal schedule. Click a date to close it, open an extra day, or change that day's collection time.</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 10px;"><button class="link-btn" onclick="changeCalendarMonth(-1)">←</button><b>${month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</b><button class="link-btn" onclick="changeCalendarMonth(1)">→</button></div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center;margin-bottom:6px;color:#777064;font-size:12px;"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">${cells.join("")}</div>
    <div class="order-card" style="margin-top:16px;">
      <div class="order-top"><b>${escapeHtml(selected.collection_date)}</b><span class="hint">${existing ? "Special calendar setting" : "Normal weekly schedule"}</span></div>
      <label class="slot" style="cursor:pointer;gap:10px;margin:12px 0;">
        <input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${selected.is_open ? "checked" : ""} onchange="onAvailabilityField('is_open', this.checked)">
        <span><b>Open for pickup</b><br><span class="hint">Untick to close this date.</span></span>
      </label>
      <div class="field"><label>Collection time for this date</label><input value="${escapeHtml(selected.collection_time)}" placeholder="10:00 AM - 12:00 PM" oninput="onAvailabilityField('collection_time', this.value)"></div>
      <div class="btn-row"><button class="btn-primary" id="availability-save-btn" onclick="saveAvailabilityOverride()">Save day</button>${existing ? `<button class="btn-secondary" onclick="clearAvailabilityOverride()">Use weekly schedule</button>` : ""}</div>
    </div>
  `;
}

function renderEditOverlay() {
  if (!astate.editing) return "";
  const item = astate.editing;
  return `
  <div class="overlay">
    <div class="overlay-card" style="max-height:80vh;overflow-y:auto;">
      <div class="display overlay-title" style="font-size:18px;">${astate.menu.some(m => String(m.id) === String(item.id)) ? "Edit item" : "New item"}</div>
      <div class="field"><label>Name</label><input value="${item.name}" oninput="onEditField('name', this.value)"></div>
      <div class="field"><label>Product group</label><select onchange="onEditGroup(this.value)"><option value="">Other</option>${astate.productGroups.map((group) => `<option value="${group.id}" ${String(item.group_id) === String(group.id) ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}</select><div class="hint" style="text-align:left;margin-top:5px;">Shown as a large group heading on the ordering page.</div></div>
      <div class="field"><label>Description</label><textarea rows="2" oninput="onEditField('description', this.value)">${item.description || ""}</textarea></div>
      <div class="field"><label>Price (SGD)</label><input type="number" step="0.1" value="${item.price}" oninput="onEditField('price', this.value)"></div>
      <div class="field"><label>Product image</label><input value="${item.image_url || ""}" placeholder="Upload below or paste image URL" oninput="onEditField('image_url', this.value)"><input type="file" accept="image/*" style="margin-top:8px;" onchange="uploadStorefrontImage(this,'products')">${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="Product preview" style="display:block;width:100%;height:150px;object-fit:cover;border:1px solid #E1D9C8;border-radius:12px;margin-top:8px;">` : ""}</div>
      <div class="field"><label>Stock</label><input type="number" value="${item.stock || 0}" oninput="onEditField('stock', this.value)"></div>
      <div class="field" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="bundle-check" ${item.is_bundle ? "checked" : ""} onchange="onEditField('is_bundle', this.checked);render()" style="width:auto;"><label style="margin:0;" for="bundle-check">This is a Bundle of Two</label></div>
      ${item.is_bundle ? `<div class="field"><label>Drinks customers can choose in this bundle</label><div class="hint" style="text-align:left;margin:0 0 7px;">Tick the drinks you want to allow. Leave all unticked to use the normal latte choices.</div>${astate.menu.filter((product) => String(product.id) !== String(item.id) && !product.is_bundle).map((product) => `<label class="slot" style="cursor:pointer;gap:10px;margin:7px 0;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${Array.isArray(item.bundle_product_ids) && item.bundle_product_ids.map(String).includes(String(product.id)) ? "checked" : ""} onchange="toggleBundleProduct('${product.id}',this.checked)"><span>${escapeHtml(product.name)}</span></label>`).join("")}</div>` : ""}
      <div class="field" style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="avail-check" ${item.is_available ? "checked" : ""} onchange="onEditField('is_available', this.checked)" style="width:auto;">
        <label style="margin:0;" for="avail-check">Available on menu</label>
      </div>
      <div class="hint" style="text-align:left;margin-bottom:0;">Visible items show on the customer ordering page. Hidden items stay saved in your catalogue.</div>
      <div class="btn-row" style="margin-top:14px;">
        <button class="btn-secondary" onclick="cancelEdit()">Cancel</button>
        <button class="btn-primary" id="save-btn" onclick="saveMenuItem()">Save</button>
      </div>
    </div>
  </div>`;
}

function render() {
  const app = document.getElementById("app");
  if (!astate.unlocked) { app.innerHTML = renderLogin(); return; }
  if (astate.loading) { app.innerHTML = header("") + `<div class="loading">Loading…</div>`; return; }
  const nav = [
    ["dashboard", "▦", "Dashboard"],
    ["orders", "▣", "Orders"],
    ["menu", "◇", "Products"],
    ["promos", "✦", "Promos"],
    ["rewards", "♧", "Rewards"],
    ["customers", "◉", "Customers"],
    ["availability", "◷", "Availability"],
    ["faq", "?", "FAQ"],
    ["settings", "⚙", "Store settings"],
  ];
  const tabTitle = { orders: "Orders", menu: "Products", promos: "Promos", rewards: "Rewards", customers: "Customers", availability: "Availability", faq: "FAQ", settings: "Store settings" };
  const tabSubtitle = { orders: "Review payments and manage every customer order.", menu: "Keep your drinks, prices and availability up to date.", promos: "Create discounts customers can use at checkout.", rewards: "Choose a stamp card or points programme for repeat customers.", customers: "See every customer and save private remarks.", availability: "Choose your pickup window and collection calendar.", faq: "Edit the answers customers see on your ordering page.", settings: "Manage your store details, images, contact information and payment details." };
  const page = astate.tab === "dashboard" ? renderDashboardTab() : `
    <div class="admin-top"><div><div class="admin-eyebrow">Shizuku Lab admin</div><h1 class="tab-page-title">${tabTitle[astate.tab] || "Dashboard"}</h1><p class="tab-page-subtitle">${tabSubtitle[astate.tab] || ""}</p></div><a class="open-shop" href="order.html">Open customer shop ↗</a></div>
    <div class="admin-content">
      ${astate.tab === "orders" ? renderOrders() : astate.tab === "menu" ? renderMenuTab() : astate.tab === "promos" ? renderPromosTab() : astate.tab === "rewards" ? renderRewardsTab() : astate.tab === "customers" ? renderCustomersTab() : astate.tab === "availability" ? renderAvailabilityTab() : astate.tab === "faq" ? renderFaqTab() : renderSettingsTab()}
    </div>`;
  app.innerHTML = `
    ${dashboardStyles()}
    <div class="shop-admin">
      <aside class="admin-side"><div class="admin-logo">${(astate.settings && escapeHtml(astate.settings.store_name)) || "Shizuku Lab"}</div><div class="admin-caption">SHOP ADMIN</div><div class="admin-nav-label">MAIN</div><nav class="admin-nav">${nav.map(([tab, icon, label]) => `<button class="${astate.tab === tab ? "active" : ""}" onclick="setTab('${tab}')"><span class="nav-icon">${icon}</span>${label}</button>`).join("")}</nav></aside>
      <main class="admin-main">${!IS_CONFIGURED ? `<div class="setup-banner">Demo mode — connect Supabase in <code>config.js</code> to see real orders and save changes.</div>` : ""}${astate.loadError ? `<div class="setup-banner" style="border-color:#B33;background:#FBEAEA;color:#7a1f1f;">Could not load data: <code>${astate.loadError}</code></div>` : ""}${page}</main>
    </div>
    ${renderEditOverlay()}
  `;
}

render();
