/* Shizuku Lab — shop dashboard (wired to real Supabase schema) */

const astate = {
  unlocked: false,
  welcomePending: false,
  welcomeTimer: null,
  navCollapsed: (() => { try { return localStorage.getItem("shizuku-admin-nav-collapsed") === "1"; } catch (_) { return false; } })(),
  navScrollTop: 0,
  loginEmail: "tinghuioh29@gmail.com",
  loginPassword: "",
  recoveryMode: false,
  recoveryPassword: "",
  recoveryPasswordConfirm: "",
  loginMessage: "",
  tab: "dashboard",
  orders: [],
  menu: [],
  productGroups: [],
  optionGroups: [],
  options: [],
  productOptionGroups: [],
  realtimeChannel: null,
  newOrderAlert: null,
  promos: [],
  promoRedemptions: [],
  expandedPromoCode: null,
  editingPromoId: null,
  customerNotes: {},
  loyaltySettings: null,
  loyaltyDraft: null,
  customerLoyalty: {},
  notificationSettings: null,
  notificationDraft: null,
  promoDraft: { code: "", discount_type: "fixed", discount_value: "", minimum_spend: "", usage_limit: "", valid_until: "", applicable_product_ids: [] },
  selectedCustomerKey: null,
  settings: null,
  settingsDraft: null,
  openingOverrides: [],
  faq: [],
  reviews: [],
  messages: [],
  messageDrafts: {},
  selectedAvailabilityDate: null,
  settingsSection: "welcome",
  availabilityDraft: null,
  calendarMonth: null,
  orderFilter: "all",
  orderSearch: "",
  inventory: [],
  recipes: [],
  inventoryReady: true,
  inventoryDraft: null,
  recipeProductId: null,
  recipeDraftProductId: null,
  recipeDraft: null,
  recipeDirty: false,
  editingOrder: null,
  loading: true,
  loadError: null,
  editing: null,
};

function money(n) { return `$${Number(n).toFixed(2)}`; }
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const PAY_LABEL = { awaiting_payment: "Awaiting payment", submitted: "Payment sent — pending confirmation", rejected: "Payment proof rejected", paid: "Paid" };
const PAY_COLOR = { awaiting_payment: "#B78A2E", submitted: "#B78A2E", rejected: "#B33333", paid: "#4B5D3A" };
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
function availabilityRanges(value) {
  const text = String(value || "");
  // Keep an empty final line while the owner is adding a second pickup window.
  // Filtering it out made the new input disappear immediately after clicking Add.
  if (!text.trim()) return [""];
  return text.split("|").map((item) => item.trim());
}
function setAvailabilityRange(index, value) {
  const ranges = availabilityRanges(astate.availabilityDraft.collection_time);
  ranges[index] = value;
  astate.availabilityDraft.collection_time = ranges.join(" | ");
}
function addAvailabilityRange() {
  const ranges = availabilityRanges(astate.availabilityDraft.collection_time);
  astate.availabilityDraft.collection_time = [...ranges, ""].join(" | ");
  render();
}
function removeAvailabilityRange(index) {
  const ranges = availabilityRanges(astate.availabilityDraft.collection_time);
  ranges.splice(index, 1);
  astate.availabilityDraft.collection_time = (ranges.length ? ranges : [""]).join(" | ");
  render();
}
async function saveAvailabilityOverride() {
  const entry = astate.availabilityDraft;
  if (!entry || !entry.collection_date) return;
  const button = document.getElementById("availability-save-btn");
  if (button) { button.textContent = "Saving…"; button.disabled = true; }
  const cleanWindows = availabilityRanges(entry.collection_time).filter(Boolean).join(" | ");
  const payload = { collection_date: entry.collection_date, is_open: !!entry.is_open, collection_time: entry.is_open ? cleanWindows : null };
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

      let menuResult = await db.from("products").select("*").order("sort_order").order("id");
      // Keep Admin usable until the one-time product sorting SQL is run.
      if (menuResult.error && /sort_order/i.test(menuResult.error.message || "")) {
        console.warn("products.sort_order is not installed yet; using the current product order temporarily.");
        menuResult = await db.from("products").select("*").order("category").order("id");
      }
      if (menuResult.error) astate.loadError = menuResult.error.message;
      astate.menu = menuResult.data || [];

      const { data: groups, error: groupError } = await db.from("product_groups").select("*").order("sort_order").order("name");
      if (groupError) console.warn("Could not load product groups:", groupError.message);
      astate.productGroups = groups || [];

      let optionGroupsResult = await db.from("option_groups").select("*").order("sort_order").order("id");
      // Keep Admin usable before the one-time drag-sort SQL is run.
      if (optionGroupsResult.error && /sort_order/i.test(optionGroupsResult.error.message || "")) {
        console.warn("option_groups.sort_order is not installed yet; using ID order temporarily.");
        optionGroupsResult = await db.from("option_groups").select("*").order("id");
      }
      const { data: options, error: optionsError } = await db.from("options").select("*").order("option_group_id").order("id");
      if (optionGroupsResult.error) console.warn("Could not load drink option groups:", optionGroupsResult.error.message);
      if (optionsError) console.warn("Could not load drink options:", optionsError.message);
      astate.optionGroups = optionGroupsResult.data || [];
      astate.options = options || [];
      const { data: productOptionGroups, error: productOptionGroupsError } = await db.from("product_option_groups").select("product_id, option_group_id");
      if (productOptionGroupsError) console.warn("Could not load product option mappings:", productOptionGroupsError.message);
      astate.productOptionGroups = productOptionGroups || [];

      const { data: settingsRows } = await db.from("store_settings").select("*").limit(1);
      astate.settings = (settingsRows && settingsRows[0]) || null;
      astate.settingsDraft = astate.settings ? { ...astate.settings } : null;
      const { data: faq, error: faqError } = await db.from("store_faq").select("*").order("sort_order");
      if (faqError) console.warn("Could not load FAQ:", faqError.message);
      astate.faq = faq || [];
      const [{ data: reviews, error: reviewsError }, { data: messages, error: messagesError }] = await Promise.all([
        db.from("customer_reviews").select("*").order("created_at", { ascending: false }),
        db.from("order_messages").select("*").order("created_at"),
      ]);
      if (reviewsError) console.warn("Could not load reviews:", reviewsError.message);
      if (messagesError) console.warn("Could not load messages:", messagesError.message);
      astate.reviews = reviews || [];
      astate.messages = messages || [];
      const { data: overrides, error: availabilityError } = await db.from("store_opening_overrides").select("*").order("collection_date");
      if (availabilityError) console.warn("Could not load store availability:", availabilityError.message);
      astate.openingOverrides = overrides || [];
      const [{ data: promos, error: promoError }, { data: redemptions, error: redemptionError }, { data: notes, error: notesError }, { data: loyaltySettings, error: loyaltySettingsError }, { data: loyaltyRows, error: loyaltyRowsError }, { data: notificationSettings, error: notificationError }] = await Promise.all([
        db.from("promo_codes").select("*").order("created_at", { ascending: false }),
        db.from("promo_redemptions").select("*"),
        db.from("customer_notes").select("*"),
        db.from("loyalty_settings").select("*").eq("id", 1).maybeSingle(),
        db.from("customer_loyalty").select("*"),
        db.from("notification_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (promoError) console.warn("Could not load promo codes:", promoError.message);
      if (redemptionError) console.warn("Could not load promo redemptions:", redemptionError.message);
      if (notesError) console.warn("Could not load customer notes:", notesError.message);
      if (loyaltySettingsError) console.warn("Could not load loyalty settings:", loyaltySettingsError.message);
      if (loyaltyRowsError) console.warn("Could not load loyalty balances:", loyaltyRowsError.message);
      if (notificationError) console.warn("Could not load notification settings:", notificationError.message);
      astate.promos = promos || [];
      astate.promoRedemptions = redemptions || [];
      astate.customerNotes = Object.fromEntries((notes || []).map((note) => [note.customer_key, note.note || ""]));
      astate.loyaltySettings = loyaltySettings || { id: 1, enabled: false, reward_type: "stamps", stamps_required: 10, minimum_spend: 5, points_per_dollar: 1, points_required: 50, reward_description: "A free drink is on us." };
      astate.loyaltyDraft = { ...astate.loyaltySettings };
      astate.customerLoyalty = Object.fromEntries((loyaltyRows || []).map((row) => [row.customer_key, row]));
      astate.notificationSettings = notificationSettings || { id: 1, recipient_email: "", webhook_url: "", enabled: false, alert_new_order: true, alert_payment_proof: true, alert_live_chat: true };
      astate.notificationDraft = { ...astate.notificationSettings };
      const [inventoryResult, recipeResult] = await Promise.all([
        db.from("inventory_items").select("*").order("name"),
        db.from("product_recipes").select("*").order("product_id"),
      ]);
      astate.inventoryReady = !inventoryResult.error && !recipeResult.error;
      astate.inventory = inventoryResult.data || [];
      astate.recipes = recipeResult.data || [];
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
  subscribeToOrderChanges();
}

async function confirmPayment(id) {
  const order = astate.orders.find((o) => String(o.id) === String(id));
  if (!order) return;
  if (!confirm(`Confirm payment received for ${order.order_number || order.id}?`)) return;

  const previousPaymentStatus = order.payment_status;
  const previousOrderStatus = order.order_status;
  astate.orders = astate.orders.map((o) => (String(o.id) === String(id) ? { ...o, payment_status: "paid", order_status: "confirmed" } : o));
  render();

  if (IS_CONFIGURED) {
    const { error } = await db.from("orders").update({ payment_status: "paid", order_status: "confirmed" }).eq("id", id);
    if (error) {
      astate.orders = astate.orders.map((o) => (String(o.id) === String(id) ? { ...o, payment_status: previousPaymentStatus, order_status: previousOrderStatus } : o));
      render();
      alert("Could not confirm payment: " + error.message);
      return;
    }
  }
}

async function rejectPayment(id) {
  const order = astate.orders.find((item) => String(item.id) === String(id));
  if (!order) return;
  const reason = prompt("Tell the customer why the screenshot was rejected:", "The screenshot is unclear. Please upload a clearer payment confirmation.");
  if (!reason?.trim()) return;
  const fields = { payment_status: "rejected", order_status: "pending", payment_rejection_reason: reason.trim() };
  const { error } = await db.from("orders").update(fields).eq("id", id);
  if (error) { alert("Could not reject payment: " + error.message); return; }
  astate.orders = astate.orders.map((item) => String(item.id) === String(id) ? { ...item, ...fields } : item);
  render();
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
  astate.editing = { id: null, enabled_option_group_ids: [], group_id: firstGroup?.id || null, category: firstGroup?.name || "Signature", name: "", description: "", price: 0, discount_price: null, image_url: "", is_available: true, is_bundle: false, bundle_product_ids: [], stock: 0, sort_order: astate.menu.length + 1 };
  render();
}
function editMenuItem(id) {
  const item = astate.menu.find((m) => String(m.id) === String(id));
  const enabled_option_group_ids = astate.productOptionGroups.filter((row) => String(row.product_id) === String(id)).map((row) => String(row.option_group_id));
  astate.editing = { ...item, enabled_option_group_ids };
  render();
}
function cancelEdit() { astate.editing = null; render(); }
function onEditField(key, value) {
  if (key === "discount_price") astate.editing[key] = value === "" ? null : (parseFloat(value) || 0);
  else if (key === "price" || key === "stock") astate.editing[key] = parseFloat(value) || 0;
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

function toggleProductOptionGroup(groupId, checked) {
  const ids = Array.isArray(astate.editing.enabled_option_group_ids) ? astate.editing.enabled_option_group_ids.map(String) : [];
  astate.editing.enabled_option_group_ids = checked ? [...new Set([...ids, String(groupId)])] : ids.filter((id) => id !== String(groupId));
}
async function saveProductOptionMappings(productId, groupIds) {
  const { error: deleteError } = await db.from("product_option_groups").delete().eq("product_id", productId);
  if (deleteError) throw deleteError;
  const rows = (groupIds || []).map((groupId) => ({ product_id: productId, option_group_id: groupId }));
  if (rows.length) {
    const { error: insertError } = await db.from("product_option_groups").insert(rows);
    if (insertError) throw insertError;
  }
  astate.productOptionGroups = [
    ...astate.productOptionGroups.filter((row) => String(row.product_id) !== String(productId)),
    ...rows,
  ];
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
    const enabledGroupIds = Array.isArray(item.enabled_option_group_ids) ? item.enabled_option_group_ids : [];
    const { enabled_option_group_ids, ...cleanItem } = item;
    let savedProductId;
    if (item.id) {
      const { id, ...fields } = cleanItem;
      const { error } = await db.from("products").update(fields).eq("id", id);
      if (error) throw error;
      savedProductId = id;
      astate.menu = astate.menu.map((m) => (String(m.id) === String(id) ? cleanItem : m));
    } else {
      const { id, ...fields } = cleanItem;
      const { data, error } = await db.from("products").insert(fields).select().single();
      if (error) throw error;
      savedProductId = data.id;
      astate.menu = [...astate.menu, data];
    }
    await saveProductOptionMappings(savedProductId, enabledGroupIds);
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


let adminDragState = null;
function startAdminDrag(event, scope, index) {
  if (event.button != null && event.button !== 0) return;
  event.preventDefault();
  const handle = event.currentTarget;
  const row = handle.closest('.admin-sortable-item');
  if (!row) return;
  const list = row.parentElement;
  const rect = row.getBoundingClientRect();
  const ghost = row.cloneNode(true);
  ghost.classList.add('admin-drag-ghost');
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  document.body.appendChild(ghost);
  row.classList.add('admin-drag-source');
  adminDragState = { scope, row, list, ghost, offsetY: event.clientY - rect.top };
  handle.setPointerCapture?.(event.pointerId);
  document.body.classList.add('admin-is-dragging');
  document.addEventListener('pointermove', moveAdminDrag, { passive:false });
  document.addEventListener('pointerup', endAdminDrag, { once:true });
  document.addEventListener('pointercancel', endAdminDrag, { once:true });
}
function moveAdminDrag(event) {
  if (!adminDragState) return;
  event.preventDefault();
  const { ghost, list, row, scope } = adminDragState;
  ghost.style.top = `${event.clientY - adminDragState.offsetY}px`;
  const candidates = [...list.querySelectorAll(`.admin-sortable-item[data-sort-scope="${scope}"]`)].filter((item) => item !== row);
  const target = candidates.find((item) => {
    const r = item.getBoundingClientRect();
    return event.clientY >= r.top && event.clientY <= r.bottom;
  });
  if (!target) return;
  const r = target.getBoundingClientRect();
  if (event.clientY < r.top + r.height / 2) list.insertBefore(row, target);
  else list.insertBefore(row, target.nextSibling);
}
function endAdminDrag() {
  if (!adminDragState) return;
  const { scope, list, ghost, row } = adminDragState;
  const orderedKeys = [...list.querySelectorAll(`.admin-sortable-item[data-sort-scope="${scope}"]`)].map((el) => el.dataset.sortKey);
  if (scope === 'productGroups') {
    const map = new Map(astate.productGroups.map((item, index) => [String(item.id ?? `new-${index}`), item]));
    astate.productGroups = orderedKeys.map((key) => map.get(key)).filter(Boolean);
    astate.productGroups.forEach((item, index) => { item.sort_order = index + 1; });
  } else if (scope === 'optionGroups') {
    const map = new Map(astate.optionGroups.map((item, index) => [String(item.id ?? `new-${index}`), item]));
    astate.optionGroups = orderedKeys.map((key) => map.get(key)).filter(Boolean);
    astate.optionGroups.forEach((item, index) => { item.sort_order = index + 1; });
  } else if (scope === 'products') {
    const map = new Map(astate.menu.map((item) => [String(item.id), item]));
    astate.menu = orderedKeys.map((key) => map.get(key)).filter(Boolean);
    astate.menu.forEach((item, index) => { item.sort_order = index + 1; });
  }
  ghost.remove();
  row.classList.remove('admin-drag-source');
  document.body.classList.remove('admin-is-dragging');
  document.removeEventListener('pointermove', moveAdminDrag);
  adminDragState = null;
  render();
}
function dragHandle(scope, index) {
  return `<button type="button" class="admin-drag-handle" aria-label="Drag to reorder" title="Drag to reorder" onpointerdown="startAdminDrag(event,'${scope}',${index})"><span class="drag-dots" aria-hidden="true">⋮⋮</span></button>`;
}
function addProductGroup() { astate.productGroups = [...astate.productGroups, { id: null, name: "", sort_order: astate.productGroups.length, is_visible: true }]; render(); }
function onGroupField(index, key, value) { astate.productGroups[index][key] = key === "sort_order" ? Number(value || 0) : value; }
async function deleteProductGroup(index) {
  const group = astate.productGroups[index];
  if (!group) return;
  const groupHasProducts = astate.menu.some((product) => String(product.group_id) === String(group.id));
  if (groupHasProducts) { alert("Move or delete the products in this group before deleting the group."); return; }
  if (!confirm(`Delete the product group “${group.name || "Untitled"}”?`)) return;
  if (group.id && IS_CONFIGURED) {
    const { error } = await db.from("product_groups").delete().eq("id", group.id);
    if (error) { alert("Could not delete group: " + error.message); return; }
  }
  astate.productGroups.splice(index, 1);
  render();
}
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

/* ---- drink customisation: Ice, Sweetness, etc. ---- */
function drinkOptionsForGroup(groupId) {
  return astate.options.map((option, index) => ({ option, index })).filter(({ option }) => String(option.option_group_id) === String(groupId));
}
function addDrinkOptionGroup() {
  astate.optionGroups = [...astate.optionGroups, { id: null, name: "", required: true, is_visible: true, sort_order: astate.optionGroups.length + 1 }];
  render();
}
function onDrinkOptionGroupField(index, key, value) {
  astate.optionGroups[index][key] = (key === "required" || key === "is_visible") ? !!value : value;
}
async function deleteDrinkOptionGroup(index) {
  const group = astate.optionGroups[index];
  if (!group) return;
  if (group.id && drinkOptionsForGroup(group.id).length) {
    alert("Delete this group's choices first, then you can delete the group.");
    return;
  }
  if (!confirm(`Delete the drink option group “${group.name || "Untitled"}”?`)) return;
  if (group.id && IS_CONFIGURED) {
    const { error } = await db.from("option_groups").delete().eq("id", group.id);
    if (error) { alert("Could not delete option group: " + error.message); return; }
  }
  astate.optionGroups.splice(index, 1);
  render();
}
async function saveDrinkOptionGroups() {
  const rows = astate.optionGroups.filter((group) => String(group.name || "").trim());
  for (const group of rows) {
    const fields = { name: String(group.name).trim(), required: !!group.required, is_visible: group.is_visible !== false, sort_order: Number(group.sort_order || rows.indexOf(group) + 1) };
    const query = group.id ? db.from("option_groups").update(fields).eq("id", group.id).select().single() : db.from("option_groups").insert(fields).select().single();
    const { data, error } = await query;
    if (error) { alert("Could not save drink option group: " + error.message); return; }
    Object.assign(group, data);
  }
  astate.optionGroups = rows.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  alert("Drink option groups saved. You can now add choices below.");
  render();
}
function addDrinkOption(groupId) {
  if (!groupId) { alert("Save this new option group first, then add its choices."); return; }
  astate.options = [...astate.options, { id: null, option_group_id: groupId, name: "", price: 0, is_available: true }];
  render();
}
function onDrinkOptionField(index, key, value) {
  astate.options[index][key] = key === "price" ? Number(value || 0) : key === "is_available" ? !!value : value;
}
async function deleteDrinkOption(index) {
  const option = astate.options[index];
  if (!option || !confirm(`Delete “${option.name || "this choice"}”?`)) return;
  if (option.id && IS_CONFIGURED) {
    const { error } = await db.from("options").delete().eq("id", option.id);
    if (error) { alert("Could not delete choice: " + error.message); return; }
  }
  astate.options.splice(index, 1);
  render();
}
async function saveDrinkOptions() {
  const rows = astate.options.filter((option) => String(option.name || "").trim());
  for (const option of rows) {
    const fields = { option_group_id: option.option_group_id, name: String(option.name).trim(), price: Math.max(0, Number(option.price || 0)), is_available: option.is_available !== false };
    const query = option.id ? db.from("options").update(fields).eq("id", option.id).select().single() : db.from("options").insert(fields).select().single();
    const { data, error } = await query;
    if (error) { alert("Could not save drink choice: " + error.message); return; }
    Object.assign(option, data);
  }
  astate.options = rows;
  alert("Drink choices saved.");
  render();
}
function renderDrinkOptionsManager() {
  return `<section class="dashboard-card" style="padding:20px;margin-bottom:20px;">
    <div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Drink customisation</h2><span>Manage Ice, Sweetness and any future drink choices</span></div>
    ${astate.optionGroups.length ? astate.optionGroups.map((group, groupIndex) => {
      const choices = drinkOptionsForGroup(group.id);
      return `<div class="admin-sortable-item admin-option-group-card" data-sort-scope="optionGroups" data-sort-key="${escapeHtml(String(group.id ?? `new-${groupIndex}`))}">
        ${dragHandle("optionGroups", groupIndex)}
        <div class="admin-sortable-content">
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:9px;align-items:center;">
          <input value="${escapeHtml(group.name || "")}" placeholder="e.g. Ice" oninput="onDrinkOptionGroupField(${groupIndex},'name',this.value)">
          <label style="font-size:12px;white-space:nowrap;"><input type="checkbox" style="width:auto;" ${group.required ? "checked" : ""} onchange="onDrinkOptionGroupField(${groupIndex},'required',this.checked)"> Required</label>
          <label style="font-size:12px;white-space:nowrap;"><input type="checkbox" style="width:auto;" ${group.is_visible !== false ? "checked" : ""} onchange="onDrinkOptionGroupField(${groupIndex},'is_visible',this.checked)"> Show</label>
          <button class="link-danger" style="font-size:12px;" onclick="deleteDrinkOptionGroup(${groupIndex})">Delete</button>
        </div>
        ${group.id ? `<div style="margin-top:12px;">${choices.length ? choices.map(({ option, index }) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 100px auto auto;gap:9px;align-items:center;margin:8px 0;"><input value="${escapeHtml(option.name || "")}" placeholder="e.g. Less Ice" oninput="onDrinkOptionField(${index},'name',this.value)"><input type="number" min="0" step="0.10" value="${Number(option.price || 0)}" title="Extra price" oninput="onDrinkOptionField(${index},'price',this.value)"><label style="font-size:12px;white-space:nowrap;"><input type="checkbox" style="width:auto;" ${option.is_available !== false ? "checked" : ""} onchange="onDrinkOptionField(${index},'is_available',this.checked)"> Show</label><button class="link-danger" style="font-size:12px;" onclick="deleteDrinkOption(${index})">Delete</button></div>`).join("") : `<div class="hint" style="text-align:left;margin:6px 0;">No choices yet.</div>`}<button class="btn-secondary" style="margin-top:6px;" onclick="addDrinkOption('${group.id}')">+ Add choice</button></div>` : `<div class="hint" style="text-align:left;margin:10px 0 0;">Save this new group first, then add choices such as Normal Ice or Less Ice.</div>`}
      </div></div>`;
    }).join("") : `<div class="dashboard-empty">No drink option groups yet. Add Ice or Sweetness below.</div>`}
    <div class="btn-row" style="margin-top:14px;"><button class="btn-secondary" onclick="addDrinkOptionGroup()">+ Add option group</button><button class="btn-primary" onclick="saveDrinkOptionGroups()">Save groups</button><button class="btn-primary" onclick="saveDrinkOptions()">Save choices</button></div>
  </section>`;
}

/* ---- store settings ---- */
function onSettingsField(key, value) { astate.settingsDraft[key] = value; }
function settingsCollectionPoints() {
  const points = astate.settingsDraft?.collection_points;
  return Array.isArray(points) && points.length ? points : ["Blk 130A", "Near Creamier"];
}
function editCollectionPoint(index, value) { const points = [...settingsCollectionPoints()]; points[index] = value; astate.settingsDraft.collection_points = points; }
function addCollectionPoint() { astate.settingsDraft.collection_points = [...settingsCollectionPoints(), "New collection point"]; render(); }
function deleteCollectionPoint(index) { const points = [...settingsCollectionPoints()]; if (points.length <= 1) return alert("Keep at least one collection point."); points.splice(index, 1); astate.settingsDraft.collection_points = points; render(); }
function moveCollectionPoint(index, direction) { const points = [...settingsCollectionPoints()]; const next = index + direction; if (next < 0 || next >= points.length) return; [points[index], points[next]] = [points[next], points[index]]; astate.settingsDraft.collection_points = points; render(); }
function updateStorefrontPreview() {
  const circle = document.getElementById("logo-live-preview");
  const logo = document.getElementById("logo-live-preview-image");
  const banner = document.getElementById("banner-live-preview");
  const circleValue = document.getElementById("logo-circle-value");
  const imageValue = document.getElementById("logo-image-value");
  const logoXValue = document.getElementById("logo-x-value");
  const logoYValue = document.getElementById("logo-y-value");
  const bannerXValue = document.getElementById("banner-x-value");
  const bannerYValue = document.getElementById("banner-y-value");
  const heightValue = document.getElementById("banner-height-value");
  if (circle && astate.settingsDraft) circle.style.width = circle.style.height = `${Number(astate.settingsDraft.logo_circle_size || 68)}px`;
  const s = astate.settingsDraft || {};
  const logoX = Number(s.logo_image_x || 0), logoY = Number(s.logo_image_y || 0);
  const bannerX = Number(s.hero_image_x ?? 50), bannerY = Number(s.hero_image_y ?? s.hero_image_position ?? 68);
  if (logo) logo.style.transform = `translate(${logoX}%, ${logoY}%) scale(${Number(s.logo_image_scale || 1)})`;
  if (banner) banner.style.objectPosition = `${bannerX}% ${bannerY}%`;
  if (circleValue) circleValue.textContent = `${Number(astate.settingsDraft.logo_circle_size || 68)} px`;
  if (imageValue) imageValue.textContent = `${Number(astate.settingsDraft.logo_image_scale || 1).toFixed(2)}×`;
  if (logoXValue) logoXValue.textContent = `${logoX > 0 ? "+" : ""}${logoX}%`;
  if (logoYValue) logoYValue.textContent = `${logoY > 0 ? "+" : ""}${logoY}%`;
  if (bannerXValue) bannerXValue.textContent = `${bannerX}%`;
  if (bannerYValue) bannerYValue.textContent = `${bannerY}%`;
  if (heightValue) heightValue.textContent = `${Number(astate.settingsDraft.hero_banner_height || 190)} px`;
}

function updateWelcomeLogoPreview() {
  const frame = document.getElementById("welcome-logo-live-preview");
  const image = document.getElementById("welcome-logo-live-preview-image");
  const circleValue = document.getElementById("welcome-logo-circle-value");
  const imageValue = document.getElementById("welcome-logo-image-value");
  const xValue = document.getElementById("welcome-logo-x-value");
  const yValue = document.getElementById("welcome-logo-y-value");
  if (!astate.settingsDraft) return;
  const s = astate.settingsDraft;
  const size = Number(s.welcome_logo_circle_size || s.logo_circle_size || 100);
  const scale = Number(s.welcome_logo_image_scale || s.logo_image_scale || 1);
  const x = Number(s.welcome_logo_image_x || 0);
  const y = Number(s.welcome_logo_image_y || 0);
  if (frame) frame.style.width = frame.style.height = `${size}px`;
  if (image) image.style.transform = `translate(${x}%, ${y}%) scale(${scale})`;
  if (circleValue) circleValue.textContent = `${size} px`;
  if (imageValue) imageValue.textContent = `${scale.toFixed(2)}×`;
  if (xValue) xValue.textContent = `${x > 0 ? "+" : ""}${x}%`;
  if (yValue) yValue.textContent = `${y > 0 ? "+" : ""}${y}%`;
}
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
  render();
}

function onNotificationField(key, value) { astate.notificationDraft[key] = value; }
async function saveNotificationSettings() {
  if (!astate.notificationDraft) return;
  const draft = astate.notificationDraft;
  const email = String(draft.recipient_email || "").trim();
  if (draft.enabled && !/^\S+@\S+\.\S+$/.test(email)) {
    alert("Please enter a valid Gmail address before turning on alerts.");
    return;
  }
  const button = document.getElementById("notification-save-btn");
  if (button) { button.textContent = "Saving…"; button.disabled = true; }
  const fields = {
    id: 1,
    recipient_email: email || null,
    webhook_url: String(draft.webhook_url || "").trim() || null,
    enabled: !!draft.enabled,
    alert_new_order: !!draft.alert_new_order,
    alert_payment_proof: !!draft.alert_payment_proof,
    alert_live_chat: draft.alert_live_chat !== false,
  };
  // Update the existing row so the private webhook secret (configured only in
  // Supabase) is never overwritten by values coming from the browser.
  const { data, error } = await db.from("notification_settings").update(fields).eq("id", 1).select().single();
  if (button) { button.textContent = "Save notification settings"; button.disabled = false; }
  if (error) { alert("Could not save notification settings: " + error.message); return; }
  astate.notificationSettings = data;
  astate.notificationDraft = { ...data };
  alert("Notification settings saved.");
}

function adminEmailIsAllowed() {
  const email = String(astate.loginEmail || "").trim().toLowerCase();
  if (email !== String(ADMIN_EMAIL || "").toLowerCase()) {
    astate.loginMessage = "Please use the Gmail address linked to your Supabase account.";
    render();
    return false;
  }
  return true;
}

async function loginWithPassword() {
  if (!adminEmailIsAllowed()) return;
  if (!db) { astate.loginMessage = "Supabase is not connected yet."; render(); return; }
  if (!astate.loginPassword) { astate.loginMessage = "Please enter your password."; render(); return; }
  astate.loginMessage = "Signing in…";
  render();
  const { error } = await db.auth.signInWithPassword({
    email: String(astate.loginEmail || "").trim().toLowerCase(),
    password: astate.loginPassword,
  });
  astate.loginMessage = error
    ? "That Gmail or password is not correct. Please try again."
    : "Signed in.";
  if (!error) { astate.welcomePending = true; await checkAdminSession(); }
  render();
}

async function sendPasswordSetup() {
  if (!adminEmailIsAllowed()) return;
  if (!db) { astate.loginMessage = "Supabase is not connected yet."; render(); return; }
  astate.loginMessage = "Sending a password setup email…";
  render();
  const { error } = await db.auth.resetPasswordForEmail(String(astate.loginEmail || "").trim().toLowerCase(), {
    redirectTo: `${window.location.origin}${window.location.pathname}`,
  });
  astate.loginMessage = error
    ? `We could not send the password setup email: ${error.message}`
    : "Check Gmail and set your password once. After that, you can sign in here with Gmail and password.";
  render();
}

async function saveNewPassword() {
  if (!db) return;
  if (astate.recoveryPassword.length < 10) {
    astate.loginMessage = "Please choose a password with at least 10 characters.";
    render();
    return;
  }
  if (astate.recoveryPassword !== astate.recoveryPasswordConfirm) {
    astate.loginMessage = "The two passwords do not match.";
    render();
    return;
  }
  astate.loginMessage = "Saving your password…";
  render();
  const { error } = await db.auth.updateUser({ password: astate.recoveryPassword });
  if (error) {
    astate.loginMessage = `We could not save your password: ${error.message}`;
    render();
    return;
  }
  astate.recoveryMode = false;
  astate.recoveryPassword = "";
  astate.recoveryPasswordConfirm = "";
  astate.loginMessage = "Password saved. You are now signed in.";
  astate.welcomePending = true;
  await checkAdminSession();
}

async function checkAdminSession() {
  if (!db) return;
  const { data, error } = await db.auth.getUser();
  if (error || !data?.user) return;
  const email = String(data.user.email || "").toLowerCase();
  if (email === String(ADMIN_EMAIL || "").toLowerCase()) {
    astate.unlocked = true;
    await loadAll();
  } else {
    astate.loginMessage = "This email does not have access to the Shizuku Lab dashboard.";
    await db.auth.signOut();
    render();
  }
}

async function logoutAdmin() {
  if (db) await db.auth.signOut();
  astate.unlocked = false;
  astate.loginMessage = "You have signed out.";
  render();
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
    .shop-admin *{box-sizing:border-box}.shop-admin .admin-side{width:248px;flex:0 0 248px;min-height:100vh;padding:28px 16px;border-right:1px solid #eadfd2;background:#fffdf9;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;overflow:hidden}
    .shop-admin .admin-logo{font-family:Georgia,serif;font-size:27px;font-weight:700;line-height:1.05}.shop-admin .admin-caption{margin:6px 8px 32px;color:#75845d;font-size:13px;letter-spacing:.06em}
    .shop-admin .admin-nav-label{margin:0 8px 10px;color:#877d70;font-size:11px;font-weight:800;letter-spacing:.12em}.shop-admin .admin-nav{display:grid;gap:6px;flex:1;min-height:0;overflow-y:auto;align-content:start;padding:0 4px 8px 0}
    .shop-admin .admin-nav button{appearance:none;width:100%;border:0;border-radius:14px;background:transparent;padding:13px 14px;color:#504a42;font:600 15px/1.2 inherit;text-align:left;cursor:pointer}.shop-admin .admin-nav button:hover{background:#f5ede2}.shop-admin .admin-nav button.active{background:#263125;color:#fff;box-shadow:0 10px 24px rgba(47,63,36,.16)}
    .shop-admin .admin-nav .nav-icon{display:inline-block;width:27px;color:#fa7439;font-size:18px;text-align:center;margin-right:5px}.shop-admin .admin-nav button.active .nav-icon{color:#ffe4d8}
    .shop-admin .admin-collapse-toggle{position:absolute;top:18px;right:10px;z-index:3;width:32px;height:32px;border:1px solid #e5d8ca;border-radius:10px;background:#fff;color:#4b5d3a;font:700 24px/1 Georgia,serif;cursor:pointer;display:grid;place-items:center;padding:0}.shop-admin .admin-collapse-toggle:hover{background:#f5ede2}
    .shop-admin.nav-collapsed .admin-side{width:76px;flex-basis:76px;padding-left:9px;padding-right:9px}.shop-admin.nav-collapsed .admin-logo,.shop-admin.nav-collapsed .admin-caption,.shop-admin.nav-collapsed .admin-nav-label,.shop-admin.nav-collapsed .admin-side-bottom,.shop-admin.nav-collapsed .nav-text{display:none}.shop-admin.nav-collapsed .admin-collapse-toggle{position:relative;top:auto;right:auto;margin:0 auto 18px}.shop-admin.nav-collapsed .admin-nav{padding-right:0}.shop-admin.nav-collapsed .admin-nav button{padding:12px 5px;text-align:center}.shop-admin.nav-collapsed .admin-nav .nav-icon{width:auto;margin:0;font-size:19px}
    .shop-admin .admin-side-bottom{margin:16px 8px 0;border-top:1px solid #eadfd2;padding:18px 0 0;color:#6b645b;font-size:13px;flex:0 0 auto}.shop-admin .admin-side-bottom a{color:#4d633d;text-decoration:none;font-weight:700}
    .shop-admin .admin-main{width:100%;max-width:1500px;margin:0 auto;padding:42px 54px 80px}.shop-admin .admin-top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;border-bottom:1px solid #eadfd2;padding-bottom:26px;margin-bottom:28px}.shop-admin .admin-eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#ef7138;text-transform:uppercase;margin-bottom:9px}.shop-admin .admin-title{font:700 40px/1.05 Georgia,serif;margin:0;letter-spacing:-.02em}.shop-admin .admin-subtitle{color:#6e6b63;margin:9px 0 0;font-size:16px}.shop-admin .open-shop{border:1px solid #e8d9ca;background:#fff;border-radius:13px;padding:12px 16px;color:#33492c;font:700 14px inherit;white-space:nowrap;cursor:pointer}
    .shop-admin .stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:22px}.shop-admin .dashboard-summary-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.shop-admin .stat{border:1px solid #eadfd2;border-radius:18px;padding:19px 20px;background:#fff;min-height:120px}.shop-admin .stat:nth-child(1){background:#f0f7e8;border-color:#d7e8c8}.shop-admin .stat:nth-child(2){background:#fff1e7;border-color:#f2d7c4}.shop-admin .stat:nth-child(3){background:#f3efff;border-color:#dfd6ff}.shop-admin .stat.profit-stat{background:#eef7f0;border-color:#cfe3d3}.shop-admin .stat-label{display:flex;gap:8px;align-items:center;color:#69675f;font-weight:700;font-size:14px}.shop-admin .stat-icon{font-size:19px}.shop-admin .stat-value{font:700 30px/1 Georgia,serif;margin-top:18px}.shop-admin .stat-help{font-size:13px;color:#756e64;margin-top:7px}
    .shop-admin .dashboard-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:20px}.shop-admin .dashboard-card{border:1px solid #eadfd2;border-radius:18px;background:#fff;overflow:hidden}.shop-admin .dashboard-card-head{display:flex;justify-content:space-between;align-items:center;padding:19px 20px;border-bottom:1px solid #eee3d8}.shop-admin .dashboard-card-head h2{font:700 19px/1.1 Georgia,serif;margin:0}.shop-admin .dashboard-card-head span{color:#756e64;font-size:13px}.shop-admin .queue-row{padding:16px 20px;border-bottom:1px solid #f0e7de;cursor:pointer}.shop-admin .queue-row:last-child{border-bottom:0}.shop-admin .queue-row:hover{background:#fffaf6}.shop-admin .queue-top{display:flex;justify-content:space-between;gap:14px;align-items:center}.shop-admin .queue-number{font-family:ui-monospace,monospace;font-size:14px;font-weight:800}.shop-admin .queue-name{color:#6d665d;font-size:14px;margin-top:6px}.shop-admin .queue-amount{font-weight:800}.shop-admin .queue-status{font-size:12px;font-weight:800;padding:6px 9px;border-radius:99px;background:#f5efe7;color:#756950;white-space:nowrap}.shop-admin .dashboard-empty{padding:30px 20px;color:#756e64;text-align:center}.shop-admin .action-list{padding:8px 20px 12px}.shop-admin .action{display:flex;gap:12px;padding:17px 0;border-bottom:1px solid #f0e7de}.shop-admin .action:last-child{border:0}.shop-admin .action-icon{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#fff0e7;color:#ef7138}.shop-admin .action strong{font-size:14px}.shop-admin .action p{font-size:13px;color:#756e64;line-height:1.4;margin:4px 0 0}
    .shop-admin .tab-page-title{font:700 32px/1.1 Georgia,serif;margin:0 0 8px}.shop-admin .tab-page-subtitle{margin:0 0 24px;color:#6e6b63}.shop-admin .admin-content .tabs{margin-bottom:22px}.shop-admin .admin-content .screen{max-width:none}.shop-admin .admin-content .order-card{box-shadow:none}
    @media(max-width:1100px){.shop-admin .dashboard-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:800px){
      .shop-admin{display:grid;grid-template-columns:142px minmax(0,1fr);align-items:start}
      .shop-admin .admin-side{position:sticky;top:0;width:142px;height:100vh;min-height:100vh;padding:18px 10px 14px;border-right:1px solid #eadfd2;border-bottom:0;display:flex;overflow:hidden}
      .shop-admin .admin-logo{font-size:21px;line-height:1.05;margin:0 5px 4px;overflow-wrap:anywhere}
      .shop-admin .admin-caption{font-size:9px;letter-spacing:.12em;margin:0 5px 16px}
      .shop-admin .admin-nav-label,.shop-admin .admin-side-bottom{display:none}
      .shop-admin .admin-nav{grid-template-columns:1fr;overflow-x:hidden;overflow-y:auto;gap:5px;padding:0 2px 12px 0}
      .shop-admin .admin-nav button{padding:10px 9px;font-size:12px;text-align:left;white-space:normal;border-radius:11px;line-height:1.25}
      .shop-admin .admin-nav .nav-icon{display:inline-block;width:18px;margin-right:3px;font-size:14px}
      .shop-admin .admin-main{min-width:0;padding:22px 12px 64px}
      .shop-admin .admin-top{display:block;margin-bottom:18px;padding-bottom:18px}
      .shop-admin .admin-title,.shop-admin .tab-page-title{font-size:25px}
      .shop-admin .admin-subtitle,.shop-admin .tab-page-subtitle{font-size:13px;line-height:1.45}
      .shop-admin .open-shop{display:inline-block;margin-top:13px;padding:9px 10px;font-size:11px}
      .shop-admin .stat-grid,.shop-admin .dashboard-grid,.shop-admin .dashboard-summary-grid{grid-template-columns:1fr}
      .shop-admin .stat-grid{gap:10px}.shop-admin .stat{min-height:95px;padding:14px}.shop-admin .stat-value{font-size:24px;margin-top:11px}
      .shop-admin .dashboard-card-head{display:block;padding:15px}.shop-admin .dashboard-card-head span{display:block;margin-top:6px}
      .shop-admin .queue-row{padding:14px}.shop-admin .queue-top{align-items:flex-start;flex-wrap:wrap}
      .shop-admin .admin-content{min-width:0;overflow:hidden}
      .shop-admin.mobile-nav-top{display:block}
      .shop-admin.mobile-nav-top .admin-side{position:sticky;top:0;z-index:40;width:100%;height:auto;min-height:0;padding:10px 12px;border-right:0;border-bottom:1px solid #eadfd2;display:block;overflow:visible}
      .shop-admin.mobile-nav-top .admin-logo{display:inline-block;font-size:18px;margin:0 8px 3px 2px}
      .shop-admin.mobile-nav-top .admin-caption{display:inline-block;margin:0;font-size:8px}
      .shop-admin.mobile-nav-top .admin-collapse-toggle{display:none}
      .shop-admin.mobile-nav-top .admin-nav{display:flex;overflow-x:auto;overflow-y:hidden;gap:5px;padding:7px 0 2px;scrollbar-width:none}
      .shop-admin.mobile-nav-top .admin-nav::-webkit-scrollbar{display:none}
      .shop-admin.mobile-nav-top .admin-nav button{flex:0 0 auto;width:auto;padding:9px 11px;white-space:nowrap}
      .shop-admin.mobile-nav-top .admin-main{width:100%;padding:18px 12px 64px}
      .shop-admin.mobile-nav-left.nav-collapsed{grid-template-columns:64px minmax(0,1fr)}
      .shop-admin.mobile-nav-left.nav-collapsed .admin-side{width:64px;padding-left:7px;padding-right:7px}
    }
  </style>`;
}

function paidOrders() { return astate.orders.filter((order) => order.payment_status === "paid" && order.order_status !== "cancelled"); }
function savedProductFoodCost(productId) {
  return astate.recipes
    .filter((row) => String(row.product_id) === String(productId))
    .reduce((sum, row) => {
      const ingredient = astate.inventory.find((item) => String(item.id) === String(row.inventory_item_id));
      return sum + Number(row.quantity_used || 0) * ingredientUnitCost(ingredient);
    }, 0);
}
function dashboardStats() {
  const paid = paidOrders();
  const now = new Date();
  const monthly = paid.filter((order) => { const d = new Date(order.created_at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const customerKeys = new Set(astate.orders.map((order) => String(order.customer_phone || order.instagram || order.customer_name || "").trim()).filter(Boolean));
  const revenue = monthly.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const missingRecipeProducts = new Set();
  const foodCost = monthly.reduce((orderSum, order) => orderSum + (order.order_items || []).reduce((itemSum, item) => {
    const recipeRows = astate.recipes.filter((row) => String(row.product_id) === String(item.product_id));
    if (!recipeRows.length) missingRecipeProducts.add(String(item.product_name || item.product_id || "Unknown product"));
    return itemSum + savedProductFoodCost(item.product_id) * Number(item.quantity || 0);
  }, 0), 0);
  const grossProfit = revenue - foodCost;
  const profitMargin = revenue > 0 ? grossProfit / revenue * 100 : 0;
  return { revenue, foodCost, grossProfit, profitMargin, missingRecipeProducts: [...missingRecipeProducts], orders: monthly.length, customers: customerKeys.size, paymentReview: astate.orders.filter((order) => order.payment_status === "submitted").length };
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
function pickupTimeMinutes(value) {
  const match = String(value || "").trim().toUpperCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]) % 12;
  if (match[3] === "PM") hours += 12;
  return (hours * 60) + Number(match[2] || 0);
}

function nextPickupProduction() {
  const active = paidOrders().filter((order) => ["confirmed", "preparing", "ready"].includes(order.order_status));
  const dates = [...new Set(active.map((order) => order.collection_date).filter(Boolean))].sort();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const date = dates.find((value) => value >= todayKey) || dates[0] || "";
  const orders = active
    .filter((order) => order.collection_date === date)
    .sort((a, b) => (
      pickupTimeMinutes(a.collection_time) - pickupTimeMinutes(b.collection_time)
      || String(a.customer_name || "").localeCompare(String(b.customer_name || ""))
    ));
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

function showNewOrderNotice(order) {
  astate.newOrderAlert = {
    id: order.id,
    orderNumber: order.order_number || order.id,
    customer: order.customer_name || "Customer",
    total: Number(order.total || 0),
  };
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("New Shizuku Lab order", { body: `${astate.newOrderAlert.orderNumber} · ${astate.newOrderAlert.customer} · ${money(astate.newOrderAlert.total)}` });
    }
  } catch (_) {}
}
function dismissNewOrderAlert() { astate.newOrderAlert = null; render(); }
async function refreshOrdersOnly() {
  const nested = await db.from("orders").select("*, order_items(*, order_item_options(*))").order("created_at", { ascending: false });
  if (!nested.error) astate.orders = nested.data || [];
  else {
    const { data } = await db.from("orders").select("*").order("created_at", { ascending: false });
    astate.orders = data || [];
  }
  render();
}
function subscribeToOrderChanges() {
  if (!IS_CONFIGURED || astate.realtimeChannel) return;
  astate.realtimeChannel = db.channel("admin-live-orders")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (payload) => {
      showNewOrderNotice(payload.new || {});
      await refreshOrdersOnly();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, async () => {
      await refreshOrdersOnly();
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" }, async (payload) => {
      const message = payload.new || {};
      if (!astate.messages.some((item) => String(item.id) === String(message.id))) astate.messages = [...astate.messages, message];
      if (message.sender === "customer") {
        astate.newMessageAlert = { orderNumber: message.order_number || "Order", text: message.message_text || "New message" };
        if ("Notification" in window && Notification.permission === "granted") new Notification("New customer message", { body: `${message.order_number || "Order"} · ${message.message_text || ""}` });
      }
      render();
    })
    .subscribe();
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
}
function setTab(tab) {
  const nav = document.querySelector(".admin-nav");
  if (nav) astate.navScrollTop = nav.scrollTop;
  astate.tab = tab;
  render();
  requestAnimationFrame(() => { const nextNav = document.querySelector(".admin-nav"); if (nextNav) nextNav.scrollTop = astate.navScrollTop; });
}

function messageThreads() {
  const map = new Map();
  astate.messages.forEach((message) => { const key = String(message.order_id); const thread = map.get(key) || { orderId: key, orderNumber: message.order_number, messages: [], latest: message.created_at }; thread.messages.push(message); thread.latest = message.created_at; map.set(key, thread); });
  return [...map.values()].sort((a,b) => new Date(b.latest) - new Date(a.latest));
}
function unreadMessageCount() { return astate.messages.filter((item) => item.sender === "customer" && !item.read_by_seller).length; }
async function markThreadRead(orderId) {
  const ids = astate.messages.filter((item) => String(item.order_id) === String(orderId) && item.sender === "customer" && !item.read_by_seller).map((item) => item.id);
  if (!ids.length) return;
  const { error } = await db.from("order_messages").update({ read_by_seller: true }).in("id", ids);
  if (!error) { astate.messages = astate.messages.map((item) => ids.includes(item.id) ? { ...item, read_by_seller: true } : item); render(); }
}
async function replyToOrder(orderId) {
  const text = String(astate.messageDrafts[orderId] || "").trim(); if (!text) return;
  const thread = messageThreads().find((item) => String(item.orderId) === String(orderId)); if (!thread) return;
  const { data, error } = await db.from("order_messages").insert({ order_id: String(orderId), order_number: thread.orderNumber, sender: "seller", message_text: text, read_by_seller: true }).select().single();
  if (error) { alert("Could not send reply: " + error.message); return; }
  astate.messages = [...astate.messages, data]; astate.messageDrafts[orderId] = ""; await markThreadRead(orderId); render();
}
function renderMessagesTab() {
  const threads = messageThreads();
  if (!threads.length) return `<div class="dashboard-card"><div class="dashboard-empty">No customer messages yet.</div></div>`;
  return threads.map((thread) => { const unread = thread.messages.filter((item) => item.sender === "customer" && !item.read_by_seller).length; const order = astate.orders.find((item) => String(item.id) === thread.orderId); return `<section class="dashboard-card" style="margin-bottom:16px;" onclick="markThreadRead('${escapeHtml(thread.orderId)}')"><div class="dashboard-card-head"><h2>${escapeHtml(thread.orderNumber || "Order")}${unread ? ` <span style="display:inline-grid;place-items:center;min-width:23px;height:23px;padding:0 6px;border-radius:99px;background:#ef7138;color:#fff;font:800 12px/1 inherit;">${unread}</span>` : ""}</h2><span>${escapeHtml(order?.customer_name || "Customer")} · ${escapeHtml(order?.customer_phone || "")}</span></div><div style="padding:18px 20px;"><div style="display:flex;flex-direction:column;gap:9px;max-height:360px;overflow:auto;">${thread.messages.map((item) => `<div style="max-width:82%;align-self:${item.sender === "seller" ? "flex-end" : "flex-start"};padding:10px 12px;border-radius:13px;background:${item.sender === "seller" ? "#263125" : "#f3ece3"};color:${item.sender === "seller" ? "#fff" : "#332f2a"};"><div style="font-size:10px;font-weight:800;opacity:.7;margin-bottom:4px;">${item.sender === "seller" ? "YOU" : "CUSTOMER"}</div><div style="white-space:pre-wrap;line-height:1.45;">${escapeHtml(item.message_text)}</div></div>`).join("")}</div><div class="field" style="margin-top:16px;"><label>Reply</label><textarea rows="3" maxlength="1000" oninput="astate.messageDrafts['${escapeHtml(thread.orderId)}']=this.value">${escapeHtml(astate.messageDrafts[thread.orderId] || "")}</textarea></div><button class="btn-primary" onclick="event.stopPropagation();replyToOrder('${escapeHtml(thread.orderId)}')">Send reply</button></div></section>`; }).join("");
}

async function setReviewStatus(id, status) {
  const fields = { status, published_at: status === "published" ? new Date().toISOString() : null };
  const { data, error } = await db.from("customer_reviews").update(fields).eq("id", id).select().single();
  if (error) { alert("Could not update review: " + error.message); return; }
  astate.reviews = astate.reviews.map((item) => String(item.id) === String(id) ? data : item); render();
}
async function deleteReview(id) { if (!confirm("Delete this review permanently?")) return; const { error } = await db.from("customer_reviews").delete().eq("id", id); if (error) { alert(error.message); return; } astate.reviews = astate.reviews.filter((item) => String(item.id) !== String(id)); render(); }
function renderReviewsTab() { return astate.reviews.length ? astate.reviews.map((item) => `<section class="dashboard-card" style="padding:20px;margin-bottom:14px;"><div class="queue-top"><div><b>${escapeHtml(item.customer_name)}</b><div class="queue-name">${escapeHtml(item.order_number)} · ${"★".repeat(Number(item.rating) || 0)}${"☆".repeat(5-(Number(item.rating)||0))}</div></div><div class="queue-status">${escapeHtml(String(item.status).toUpperCase())}</div></div><p style="line-height:1.6;white-space:pre-wrap;">${escapeHtml(item.review_text)}</p><div style="display:flex;gap:9px;flex-wrap:wrap;"><button class="btn-primary" onclick="setReviewStatus('${item.id}','published')">Publish</button><button class="btn-secondary" onclick="setReviewStatus('${item.id}','hidden')">Hide</button><button class="link-danger" onclick="deleteReview('${item.id}')">Delete</button></div></section>`).join("") : `<div class="dashboard-card"><div class="dashboard-empty">No reviews submitted yet.</div></div>`; }
function renderDashboardTab() {
  const stats = dashboardStats();
  const liveOrders = astate.orders.filter((order) => order.order_status !== "cancelled" && order.order_status !== "collected").slice(0, 6);
  const performance = salesPerformance();
  const production = nextPickupProduction();
  const insights = customerInsights();
  const highestDailySale = Math.max(...performance.days.map((day) => day.total), 1);
  return `
    <div class="admin-top"><div><div class="admin-eyebrow">Command center</div><h1 class="admin-title">Good day, ${(astate.settings && escapeHtml(astate.settings.store_name)) || "Shizuku Lab"}</h1><p class="admin-subtitle">Your orders, revenue and customers — all in one place.</p></div><a class="open-shop" href="order.html">Open customer shop ↗</a></div>
    <div class="stat-grid dashboard-summary-grid">
      <div class="stat"><div class="stat-label"><span class="stat-icon">✦</span>Revenue this month</div><div class="stat-value">${money(stats.revenue)}</div><div class="stat-help">Paid orders only</div></div>
      <div class="stat"><div class="stat-label"><span class="stat-icon">▣</span>Orders this month</div><div class="stat-value">${stats.orders}</div><div class="stat-help">${stats.paymentReview ? `${stats.paymentReview} need payment review` : "Everything is up to date"}</div></div>
      <div class="stat"><div class="stat-label"><span class="stat-icon">◉</span>Customers</div><div class="stat-value">${stats.customers}</div><div class="stat-help">Across all orders</div></div>
      <div class="stat profit-stat"><div class="stat-label"><span class="stat-icon">$</span>Gross profit this month</div><div class="stat-value">${money(stats.grossProfit)}</div><div class="stat-help">Sales ${money(stats.revenue)} − food cost ${money(stats.foodCost)} · ${stats.profitMargin.toFixed(1)}% margin${stats.missingRecipeProducts.length ? `<br><span style="color:#b33333">Incomplete: ${stats.missingRecipeProducts.length} sold product${stats.missingRecipeProducts.length === 1 ? "" : "s"} missing Food Cost</span>` : ""}</div></div>
    </div>
    <div class="dashboard-grid"><section class="dashboard-card"><div class="dashboard-card-head"><h2>Order queue</h2><button class="link-btn" onclick="setTab('orders')">View all</button></div>${liveOrders.length ? liveOrders.map((order) => `<div class="queue-row" onclick="setTab('orders')"><div class="queue-top"><div class="queue-number">${escapeHtml(order.order_number || order.id)}</div><div class="queue-status">${escapeHtml(PAY_LABEL[order.payment_status] || order.payment_status || "Pending")}</div></div><div class="queue-top"><div class="queue-name">${escapeHtml(order.customer_name || "Customer")} · ${escapeHtml(order.collection_date || "Pickup date pending")}</div><div class="queue-amount">${money(order.total)}</div></div></div>`).join("") : `<div class="dashboard-empty">You’re all caught up — no active orders right now.</div>`}</section>
    <section class="dashboard-card"><div class="dashboard-card-head"><h2>Next steps</h2><span>Shop checklist</span></div><div class="action-list"><div class="action"><div class="action-icon">✓</div><div><strong>Review payment proofs</strong><p>${stats.paymentReview ? `${stats.paymentReview} customer payment${stats.paymentReview === 1 ? "" : "s"} waiting for confirmation.` : "No payment proof waiting right now."}</p></div></div><div class="action"><div class="action-icon">◷</div><div><strong>Set pickup availability</strong><p>Open or close special collection days in your calendar.</p></div></div><div class="action"><div class="action-icon">✦</div><div><strong>Keep your menu fresh</strong><p>Edit prices, availability and products whenever you need.</p></div></div></div></section></div>
    <div style="margin-top:28px"><div class="admin-eyebrow">Next pickup production</div><section class="dashboard-card"><div class="dashboard-card-head"><h2>${production.date ? escapeHtml(production.date) : "No upcoming paid orders"}</h2><span>${production.orders.length ? `${production.orders.length} drink order${production.orders.length === 1 ? "" : "s"}` : "Your paid pickup orders will appear here"}</span></div>${production.orders.length ? production.orders.map((order) => `<div class="queue-row" onclick="setTab('orders')"><div class="queue-top"><div><div class="queue-number">${escapeHtml(order.collection_time || "Time pending")} · ${escapeHtml(order.customer_name || "Customer")}</div><div class="queue-name">${(order.order_items || []).map((item) => `${escapeHtml(item.product_name)} × ${item.quantity}`).join(" · ") || "Order items loading"}</div></div><div class="queue-status">${escapeHtml(ORDER_LABEL[order.order_status] || order.order_status)}</div></div></div>`).join("") : `<div class="dashboard-empty">When you confirm payment, the order will show here for its collection day.</div>`}</section></div>
    <div style="margin-top:28px"><div class="admin-eyebrow">Sales performance</div><div class="dashboard-grid"><section class="dashboard-card"><div class="dashboard-card-head"><h2>Last 7 days</h2><span>Paid sales only</span></div><div style="height:210px;padding:24px 20px 15px;display:flex;align-items:flex-end;gap:12px">${performance.days.map((day) => `<div style="height:100%;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px"><div title="${money(day.total)}" style="width:min(44px,100%);height:${day.total ? Math.max(10, Math.round(day.total / highestDailySale * 145)) : 4}px;background:${day.total ? "#ef7138" : "#eee3d8"};border-radius:8px 8px 3px 3px"></div><div style="font-size:12px;font-weight:700;color:#756e64">${day.label}</div><div style="font-size:11px;color:#8a8177">${day.total ? money(day.total) : "—"}</div></div>`).join("")}</div></section>
    <section class="dashboard-card"><div class="dashboard-card-head"><h2>Top drinks this month</h2><span>By sales</span></div>${performance.topProducts.length ? performance.topProducts.map((product, index) => `<div class="queue-row"><div class="queue-top"><div><div class="queue-number">${index + 1}. ${escapeHtml(product.name)}</div><div class="queue-name">${product.quantity} cup${product.quantity === 1 ? "" : "s"} sold</div></div><div class="queue-amount">${money(product.revenue)}</div></div></div>`).join("") : `<div class="dashboard-empty">Your top drinks will appear here after paid orders come in.</div>`}</section></div></div>
    <div style="margin-top:28px"><div class="admin-eyebrow">Customer insights</div><div class="dashboard-grid"><section class="dashboard-card"><div class="dashboard-card-head"><h2>Customer snapshot</h2><button class="link-btn" onclick="setTab('customers')">View customers</button></div><div style="padding:20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px"><div style="padding:16px;border-radius:14px;background:#f3efff"><div style="font-size:12px;font-weight:800;color:#756e64">REPEAT CUSTOMERS</div><div style="font:700 30px/1 Georgia,serif;margin-top:12px">${insights.repeat.length}</div><div class="queue-name">Ordered more than once</div></div><div style="padding:16px;border-radius:14px;background:#f0f7e8"><div style="font-size:12px;font-weight:800;color:#756e64">NEW THIS MONTH</div><div style="font:700 30px/1 Georgia,serif;margin-top:12px">${insights.newThisMonth.length}</div><div class="queue-name">First-time customers</div></div></div></section><section class="dashboard-card"><div class="dashboard-card-head"><h2>Top customer</h2><span>All paid orders</span></div>${insights.top ? `<div style="padding:24px 20px"><div style="font:700 26px/1.1 Georgia,serif">${escapeHtml(insights.top.name)}</div><div class="queue-name" style="margin-top:8px">${insights.top.orders.length} order${insights.top.orders.length === 1 ? "" : "s"} · ${escapeHtml(insights.top.phone || (insights.top.instagram ? `@${insights.top.instagram}` : "No contact detail"))}</div><div style="font:700 31px/1 Georgia,serif;color:#4d633d;margin-top:24px">${money(insights.top.spent)}</div><div class="queue-name">Total paid spend</div></div>` : `<div class="dashboard-empty">Your highest-spending customer will appear here after paid orders come in.</div>`}</section></div></div>`;
}

function renderLogin() {
  if (astate.recoveryMode) return `
  <div class="overlay" style="position:relative;background:none;align-items:flex-start;padding:60px 16px;">
    <div class="overlay-card" style="max-width:340px;margin:0 auto;">
      <div class="display overlay-title">Choose your password</div>
      <div class="overlay-sub">This is a one-time setup. Use this password to sign in to your dashboard from any device.</div>
      <input type="password" autocomplete="new-password" placeholder="New password (at least 10 characters)"
        oninput="astate.recoveryPassword=this.value; astate.loginMessage='';"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #E1D9C8;margin-bottom:10px;font-size:15px;">
      <input type="password" autocomplete="new-password" placeholder="Confirm new password"
        oninput="astate.recoveryPasswordConfirm=this.value; astate.loginMessage='';"
        onkeydown="if(event.key==='Enter') saveNewPassword();"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #E1D9C8;margin-bottom:10px;font-size:15px;">
      ${astate.loginMessage ? `<div class="hint" style="text-align:left;line-height:1.45;margin:0 0 10px;">${escapeHtml(astate.loginMessage)}</div>` : ""}
      <button class="btn-primary" style="width:100%;" onclick="saveNewPassword()">Save password</button>
    </div>
  </div>`;
  return `
  <div class="overlay" style="position:relative;background:none;align-items:flex-start;padding:60px 16px;">
    <div class="overlay-card" style="max-width:340px;margin:0 auto;">
      <div class="display overlay-title">Shop access</div>
      <div class="overlay-sub">Sign in with the Gmail and password linked to your Supabase account.</div>
      <input type="email" placeholder="tinghuioh29@gmail.com" value="${escapeHtml(astate.loginEmail)}"
        oninput="astate.loginEmail=this.value; astate.loginMessage='';"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #E1D9C8;margin-bottom:10px;font-size:15px;">
      <input type="password" autocomplete="current-password" placeholder="Your password" value=""
        oninput="astate.loginPassword=this.value; astate.loginMessage='';"
        onkeydown="if(event.key==='Enter') loginWithPassword();"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #E1D9C8;margin-bottom:10px;font-size:15px;">
      ${astate.loginMessage ? `<div class="hint" style="text-align:left;line-height:1.45;margin:0 0 10px;">${escapeHtml(astate.loginMessage)}</div>` : ""}
      <div class="btn-row">
        <a href="index.html" style="flex:1;"><button class="btn-secondary" style="width:100%;">Cancel</button></a>
        <button class="btn-primary" onclick="loginWithPassword()">Sign in</button>
      </div>
      <button class="link-btn" style="margin-top:14px;width:100%;" onclick="sendPasswordSetup()">First time here? Set or reset password</button>
    </div>
  </div>`;
}

function renderAdminWelcome() {
  const welcomeBrand = escapeHtml(astate.settings?.store_name || "Your Studio");
  const welcomeIcon = escapeHtml(astate.settings?.logo_url || "logo.png");
  const welcomeLogoSize = Math.max(120, Math.min(220, Number(astate.settings?.welcome_logo_circle_size || 160)));
  const welcomeDurationMs = Math.max(2, Math.min(10, Number(astate.settings?.admin_welcome_duration_seconds || 5))) * 1000;
  if (!astate.welcomeTimer) {
    astate.welcomeTimer = setTimeout(() => {
      astate.welcomePending = false;
      astate.welcomeTimer = null;
      render();
    }, welcomeDurationMs);
  }
  return `<style>
    @keyframes shizukuWelcomeIn{0%{opacity:0;transform:translateY(18px) scale(.985)}100%{opacity:1;transform:none}}
    @keyframes slowStudioIconIn{0%{opacity:0;transform:translateY(18px) scale(.78) rotate(-5deg)}70%{transform:translateY(-2px) scale(1.04) rotate(1deg)}100%{opacity:1;transform:none}}
    @keyframes slowStudioHalo{0%{opacity:0;transform:scale(.6)}55%{opacity:.5}100%{opacity:0;transform:scale(1.45)}}
    .admin-welcome{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:linear-gradient(145deg,#f7f0e5 0%,#eef4e7 48%,#e3eddb 100%);color:#263125;text-align:center;overflow:hidden}
    .admin-welcome-inner{animation:shizukuWelcomeIn .75s cubic-bezier(.2,.8,.2,1) both}
    .admin-welcome-mark{position:relative;width:${welcomeLogoSize + 18}px;height:${welcomeLogoSize + 18}px;margin:0 auto 24px;display:grid;place-items:center}
    .admin-welcome-icon{position:relative;z-index:2;width:${welcomeLogoSize}px;height:${welcomeLogoSize}px;border-radius:50%;border:5px solid rgba(255,255,255,.72);box-shadow:0 16px 42px rgba(38,49,37,.12);padding:12px;background:#fff;object-fit:contain;animation:slowStudioIconIn .9s cubic-bezier(.2,.8,.2,1) both}
    .admin-welcome-halo{position:absolute;inset:0;border:1.5px solid #71865c;border-radius:50%;animation:slowStudioHalo 1.4s .12s ease-out both}
    .admin-welcome-kicker{font:800 11px/1.2 'Work Sans',sans-serif;letter-spacing:.18em;color:#7a8c65;text-transform:uppercase;margin-bottom:10px}
    .admin-welcome h1{font:700 clamp(38px,7vw,68px)/.98 Georgia,serif;letter-spacing:-.035em;margin:0}
    .admin-welcome p{font:500 15px/1.5 'Work Sans',sans-serif;color:#68725e;margin:14px 0 0}
    .admin-welcome-enter{margin-top:24px;border:0;border-radius:999px;padding:13px 28px;background:#263125;color:#fff;font:700 14px/1 'Work Sans',sans-serif;cursor:pointer;box-shadow:0 10px 24px rgba(38,49,37,.16)}
    .admin-welcome-enter:hover{transform:translateY(-1px);background:#354434}
    @media(prefers-reduced-motion:reduce){.admin-welcome-inner,.admin-welcome-icon,.admin-welcome-halo{animation:none}}
  </style><div class="admin-welcome" role="status" aria-live="polite"><div class="admin-welcome-inner"><div class="admin-welcome-mark"><span class="admin-welcome-halo"></span><img class="admin-welcome-icon" src="${welcomeIcon}" alt="${welcomeBrand} logo"></div><div class="admin-welcome-kicker">Powered by Slow Studio</div><h1>Welcome back,<br>${welcomeBrand}.</h1><p>Everything is ready for today’s slow moments.</p><button class="admin-welcome-enter" onclick="enterAdminNow()">Enter Admin →</button></div></div>`;
}

function enterAdminNow() {
  if (astate.welcomeTimer) clearTimeout(astate.welcomeTimer);
  astate.welcomeTimer = null;
  astate.welcomePending = false;
  render();
}

function toggleAdminNav() {
  astate.navCollapsed = !astate.navCollapsed;
  try { localStorage.setItem("shizuku-admin-nav-collapsed", astate.navCollapsed ? "1" : "0"); } catch (_) {}
  render();
}

function setOrderFilter(filter) { astate.orderFilter = filter; render(); }
function setOrderSearch(value) { astate.orderSearch = value; render(); }

/* ---- order editing ---- */
function editOrder(id) {
  const order = astate.orders.find((item) => String(item.id) === String(id));
  if (!order) return;
  astate.editingOrder = JSON.parse(JSON.stringify(order));
  const redemption = astate.promoRedemptions.find((row) => String(row.order_id) === String(order.id));
  const subtotal = (order.order_items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  astate.editingOrder._promoCode = redemption?.code || null;
  astate.editingOrder._originalPromoDiscount = redemption ? Math.max(0, subtotal - Number(order.total || 0)) : 0;
  render();
}
function closeOrderEditor() { astate.editingOrder = null; render(); }
function editOrderField(key, value) { if (astate.editingOrder) astate.editingOrder[key] = value; }
function editOrderItem(index, key, value) {
  const item = astate.editingOrder?.order_items?.[index];
  if (!item) return;
  if (key === "quantity" || key === "unit_price") item[key] = Math.max(0, Number(value || 0));
  else item[key] = value;
  item.subtotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
  recalculateEditedOrder();
}
function editedOrderDiscount(order, subtotal) { if (!order?._promoCode) return 0; const promo = astate.promos.find((item) => String(item.code).toUpperCase() === String(order._promoCode).toUpperCase()); if (!promo) return Math.min(subtotal, Number(order._originalPromoDiscount || 0)); return Math.min(subtotal, promo.discount_type === "percent" ? subtotal * Number(promo.discount_value || 0) / 100 : Number(promo.discount_value || 0)); }
function recalculateEditedOrder() { if (!astate.editingOrder) return; const subtotal = (astate.editingOrder.order_items || []).filter((row) => !row._removed).reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.unit_price || 0), 0); astate.editingOrder.total = Math.max(0, subtotal - editedOrderDiscount(astate.editingOrder, subtotal)); }
function addOrderItem() {
  const product = astate.menu.find((item) => item.is_available !== false) || astate.menu[0];
  if (!product || !astate.editingOrder) return;
  astate.editingOrder.order_items.push({ id: null, product_id: product.id, product_name: product.name, quantity: 1, unit_price: Number(product.discount_price || product.price || 0), subtotal: Number(product.discount_price || product.price || 0), order_item_options: [] });
  editOrderItem(astate.editingOrder.order_items.length - 1, "quantity", 1);
  render();
}
function chooseOrderItemProduct(index, productId) {
  const product = astate.menu.find((item) => String(item.id) === String(productId));
  const item = astate.editingOrder?.order_items?.[index];
  if (!product || !item) return;
  item.product_id = product.id; item.product_name = product.name; item.unit_price = Number(product.discount_price || product.price || 0); item.order_item_options = [];
  editOrderItem(index, "quantity", item.quantity || 1); render();
}
function removeOrderItem(index) { const item = astate.editingOrder?.order_items?.[index]; if (!item) return; if (item.id) item._removed = true; else astate.editingOrder.order_items.splice(index, 1); recalculateEditedOrder(); render(); }
async function saveEditedOrder() {
  const order = astate.editingOrder;
  if (!order) return;
  const activeItems = (order.order_items || []).filter((item) => !item._removed && Number(item.quantity) > 0);
  if (!activeItems.length) return alert("An order must contain at least one item.");
  const subtotal = activeItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
  const total = Math.max(0, subtotal - editedOrderDiscount(order, subtotal));
  const fields = { customer_name: String(order.customer_name || "").trim(), customer_phone: String(order.customer_phone || "").trim(), instagram: String(order.instagram || "").trim(), collection_date: order.collection_date || null, collection_time: order.collection_time || null, collection_point: order.collection_point || null, notes: String(order.notes || "").trim() || null, total };
  const button = document.getElementById("save-edited-order"); if (button) { button.disabled = true; button.textContent = "Saving…"; }
  try {
    const { error: orderError } = await db.from("orders").update(fields).eq("id", order.id); if (orderError) throw orderError;
    for (const item of order.order_items || []) {
      if (item._removed && item.id) { const { error } = await db.from("order_items").delete().eq("id", item.id); if (error) throw error; continue; }
      if (item._removed || Number(item.quantity) <= 0) continue;
      const payload = { product_id: item.product_id, product_name: item.product_name, quantity: Number(item.quantity), unit_price: Number(item.unit_price), subtotal: Number(item.quantity) * Number(item.unit_price) };
      if (item.id) { const { error } = await db.from("order_items").update(payload).eq("id", item.id); if (error) throw error; }
      else { const { error } = await db.from("order_items").insert({ ...payload, order_id: order.id }); if (error) throw error; }
    }
    if (order.payment_status === "paid") await db.rpc("reconcile_shizuku_order_inventory", { p_order_id: order.id });
    astate.editingOrder = null; await loadAll(); alert("Order updated.");
  } catch (error) { alert("Could not update order: " + (error?.message || error)); if (button) { button.disabled = false; button.textContent = "Save order"; } }
}

/* ---- inventory and food cost ---- */
function newInventoryItem() { astate.inventoryDraft = { id: null, name: "", unit: "g", stock_quantity: 0, low_stock_level: 0, pack_size: 1, pack_cost: 0, supplier: "" }; render(); }
function editInventoryItem(id) { const item = astate.inventory.find((row) => String(row.id) === String(id)); astate.inventoryDraft = item ? { ...item } : null; render(); }
function inventoryField(key, value) { if (!astate.inventoryDraft) return; astate.inventoryDraft[key] = ["stock_quantity","low_stock_level","pack_size","pack_cost"].includes(key) ? Math.max(0, Number(value || 0)) : value; }
async function saveInventoryItem() { const d = astate.inventoryDraft; if (!d || !String(d.name).trim()) return alert("Enter the ingredient name."); const payload = { name: String(d.name).trim(), unit: String(d.unit || "g").trim(), stock_quantity: Number(d.stock_quantity || 0), low_stock_level: Number(d.low_stock_level || 0), pack_size: Math.max(.0001, Number(d.pack_size || 1)), pack_cost: Number(d.pack_cost || 0), supplier: String(d.supplier || "").trim() || null }; const result = d.id ? await db.from("inventory_items").update(payload).eq("id", d.id).select().single() : await db.from("inventory_items").insert(payload).select().single(); if (result.error) return alert("Could not save ingredient: " + result.error.message); astate.inventoryDraft = null; await loadAll(); }
async function deleteInventoryItem(id) { if (!confirm("Delete this ingredient and its recipe links?")) return; const { error } = await db.from("inventory_items").delete().eq("id", id); if (error) return alert(error.message); await loadAll(); }
function beginRecipeDraft(productId) {
  astate.recipeDraftProductId = productId;
  astate.recipeDraft = astate.recipes.filter((row) => String(row.product_id) === String(productId)).map((row) => ({ ...row, draft_id: String(row.id) }));
  astate.recipeDirty = false;
}
function activeRecipeRows(productId) {
  if (String(astate.recipeDraftProductId) === String(productId) && Array.isArray(astate.recipeDraft)) return astate.recipeDraft;
  return astate.recipes.filter((row) => String(row.product_id) === String(productId));
}
function setRecipeProduct(id) {
  if (astate.recipeDirty && !confirm("You have unsaved food-cost changes. Discard them and switch product?")) { render(); return; }
  astate.recipeProductId = id;
  beginRecipeDraft(id);
  render();
}
function addRecipeIngredient(inventoryId) {
  if (!astate.recipeProductId || !inventoryId) return;
  if (!Array.isArray(astate.recipeDraft)) beginRecipeDraft(astate.recipeProductId);
  if (astate.recipeDraft.some((row) => String(row.inventory_item_id) === String(inventoryId))) return;
  astate.recipeDraft.push({
    draft_id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    product_id: astate.recipeProductId,
    inventory_item_id: inventoryId,
    quantity_used: 0,
  });
  astate.recipeDirty = true;
  render();
}
function updateRecipeQuantity(id, value) {
  const row = (astate.recipeDraft || []).find((item) => String(item.draft_id) === String(id));
  if (!row) return;
  row.quantity_used = Math.max(0, Number(value || 0));
  astate.recipeDirty = true;
  updateRecipePreview();
}
function deleteRecipeRow(id) {
  astate.recipeDraft = (astate.recipeDraft || []).filter((row) => String(row.draft_id) !== String(id));
  astate.recipeDirty = true;
  render();
}
async function saveProductRecipe() {
  const productId = astate.recipeProductId;
  if (!productId || !Array.isArray(astate.recipeDraft)) return;
  const button = document.getElementById("save-food-cost-btn");
  if (button) { button.disabled = true; button.textContent = "Saving…"; }
  const recipe = astate.recipeDraft.map((row) => ({ inventory_item_id: row.inventory_item_id, quantity_used: Math.max(0, Number(row.quantity_used || 0)) }));
  const { error } = await db.rpc("save_shizuku_product_recipe", { p_product_id: String(productId), p_recipe: recipe });
  if (error) {
    if (button) { button.disabled = false; button.textContent = "Save food cost"; }
    return alert("Could not save food cost: " + error.message + "\n\nRun the latest supabase-customer-product-stock.sql once if this is the first time using the Save button.");
  }
  astate.recipeDraft = null;
  astate.recipeDraftProductId = null;
  astate.recipeDirty = false;
  await loadAll();
  alert("Food cost saved.");
}
function ingredientUnitCost(item) { return Number(item?.pack_cost || 0) / Math.max(.0001, Number(item?.pack_size || 1)); }
function productFoodCost(productId) { return activeRecipeRows(productId).reduce((sum, row) => sum + Number(row.quantity_used || 0) * ingredientUnitCost(astate.inventory.find((item) => String(item.id) === String(row.inventory_item_id))), 0); }
function updateRecipePreview() {
  const productId = astate.recipeProductId;
  const selectedProduct = astate.menu.find((item) => String(item.id) === String(productId));
  const cost = productFoodCost(productId);
  const sellingPrice = Number(selectedProduct?.discount_price || selectedProduct?.price || 0);
  const percentage = sellingPrice > 0 ? cost / sellingPrice * 100 : 0;
  const costValue = document.getElementById("selected-food-cost-value");
  const percentValue = document.getElementById("selected-food-cost-percent");
  const headerValue = document.getElementById("recipe-cost-header");
  if (costValue) costValue.textContent = money(cost);
  if (percentValue) percentValue.textContent = `${percentage.toFixed(1)}%`;
  if (headerValue) headerValue.textContent = `${money(cost)} per serving`;
  (astate.recipeDraft || []).forEach((row) => {
    const ingredient = astate.inventory.find((item) => String(item.id) === String(row.inventory_item_id));
    const line = document.getElementById(`recipe-line-cost-${row.draft_id}`);
    if (line) line.textContent = money(Number(row.quantity_used || 0) * ingredientUnitCost(ingredient));
  });
}
function renderInventoryTab() {
  if (!astate.inventoryReady) return `<section class="dashboard-card"><div class="dashboard-empty"><b>Inventory setup is not installed yet.</b><br><br>Run <code>supabase-inventory-food-cost.sql</code> once in Supabase SQL Editor, then refresh this page.</div></section>`;
  const productId = astate.recipeProductId || astate.menu[0]?.id;
  if (!astate.recipeProductId && productId) astate.recipeProductId = productId;
  if (productId && (String(astate.recipeDraftProductId) !== String(productId) || !Array.isArray(astate.recipeDraft))) beginRecipeDraft(productId);
  const selectedProduct = astate.menu.find((item) => String(item.id) === String(productId));
  const recipeRows = activeRecipeRows(productId);
  const cost = productFoodCost(productId);
  const sellingPrice = Number(selectedProduct?.discount_price || selectedProduct?.price || 0);
  const percentage = sellingPrice > 0 ? cost / sellingPrice * 100 : 0;
  const inventoryHtml = astate.inventory.length ? astate.inventory.map((item) => `
    <div class="queue-row"><div class="queue-top"><div><b>${escapeHtml(item.name)}</b>
      <div class="queue-name">${escapeHtml(item.supplier || "No supplier")} · ${money(item.pack_cost)} / ${escapeHtml(item.pack_size)} ${escapeHtml(item.unit)}</div>
    </div><div style="text-align:right"><b style="color:${Number(item.stock_quantity) <= Number(item.low_stock_level) ? "#B33333" : "inherit"}">${Number(item.stock_quantity)} ${escapeHtml(item.unit)}</b>
      <div style="margin-top:7px"><button class="link-btn" onclick="editInventoryItem('${item.id}')">Edit</button> <button class="link-danger" onclick="deleteInventoryItem('${item.id}')">Delete</button></div>
    </div></div></div>`).join("") : `<div class="dashboard-empty">Add matcha, milk, syrup, cups and other ingredients.</div>`;
  const recipeHtml = recipeRows.map((row) => {
    const ingredient = astate.inventory.find((item) => String(item.id) === String(row.inventory_item_id));
    const lineCost = Number(row.quantity_used || 0) * ingredientUnitCost(ingredient);
    return `<div style="display:grid;grid-template-columns:1fr 105px 70px;gap:8px;align-items:end;margin:10px 0">
      <div><b>${escapeHtml(ingredient?.name || "Ingredient")}</b><div id="recipe-line-cost-${escapeHtml(row.draft_id)}" class="hint" style="text-align:left;margin:3px 0 0">${money(lineCost)}</div></div>
      <div><label style="font-size:11px">Use (${escapeHtml(ingredient?.unit || "unit")})</label><input type="number" min="0" step="0.01" value="${Number(row.quantity_used || 0)}" oninput="updateRecipeQuantity('${escapeHtml(row.draft_id)}',this.value)"></div>
      <button class="link-danger" onclick="deleteRecipeRow('${escapeHtml(row.draft_id)}')">Remove</button>
    </div>`;
  }).join("");
  return `
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">Ingredients</div><div class="stat-value">${astate.inventory.length}</div><div class="stat-help">${astate.inventory.filter((item) => Number(item.stock_quantity) <= Number(item.low_stock_level)).length} low-stock item(s)</div></div>
      <div class="stat"><div class="stat-label">Food + packaging cost</div><div id="selected-food-cost-value" class="stat-value">${money(cost)}</div><div class="stat-help">Ingredients and packaging per serving</div></div>
      <div class="stat"><div class="stat-label">Product-cost %</div><div id="selected-food-cost-percent" class="stat-value">${percentage.toFixed(1)}%</div><div class="stat-help">Selling price ${money(sellingPrice)}</div></div>
    </div>
    <div class="dashboard-grid">
      <section class="dashboard-card"><div class="dashboard-card-head"><h2>Inventory stock</h2><button class="btn-primary" onclick="newInventoryItem()">+ Ingredient / packaging</button></div>${inventoryHtml}</section>
      <section class="dashboard-card"><div class="dashboard-card-head"><div><h2>Food cost recipe</h2><span id="recipe-cost-header">${money(cost)} per serving</span></div><button id="save-food-cost-btn" class="btn-primary" ${astate.recipeDirty ? "" : "disabled"} onclick="saveProductRecipe()">Save food cost</button></div>
        <div style="padding:20px"><div class="field"><label>Product</label><select onchange="setRecipeProduct(this.value)">${astate.menu.map((product) => `<option value="${product.id}" ${String(product.id) === String(productId) ? "selected" : ""}>${escapeHtml(product.name)}</option>`).join("")}</select></div>
          ${recipeHtml}
          <div class="field" style="margin-top:18px"><label>Add ingredient or packaging</label><select onchange="if(this.value){addRecipeIngredient(this.value)}"><option value="">Choose cost item…</option>${astate.inventory.filter((item) => !recipeRows.some((row) => String(row.inventory_item_id) === String(item.id))).map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select></div>
          <div class="ref-note">Add both ingredients and packaging (cup, lid, straw, sticker or carrier). Edit everything first, then press Save food cost once.</div>
        </div>
      </section>
    </div>${astate.inventoryDraft ? renderInventoryEditor() : ""}`;
}
function renderInventoryEditor() { const d = astate.inventoryDraft; return `<div class="overlay"><div class="overlay-card" style="max-height:85vh;overflow:auto"><div class="display overlay-title" style="font-size:19px">${d.id ? "Edit ingredient" : "New ingredient"}</div><div class="field"><label>Name</label><input value="${escapeHtml(d.name)}" oninput="inventoryField('name',this.value)"></div><div class="field"><label>Unit</label><select onchange="inventoryField('unit',this.value)">${["g","ml","pc","pack","bottle"].map((unit) => `<option ${d.unit === unit ? "selected" : ""}>${unit}</option>`).join("")}</select></div><div class="field"><label>Current stock</label><input type="number" min="0" step="0.01" value="${d.stock_quantity}" oninput="inventoryField('stock_quantity',this.value)"></div><div class="field"><label>Low-stock alert at</label><input type="number" min="0" step="0.01" value="${d.low_stock_level}" oninput="inventoryField('low_stock_level',this.value)"></div><div class="field"><label>Purchased pack size</label><input type="number" min="0.0001" step="0.01" value="${d.pack_size}" oninput="inventoryField('pack_size',this.value)"></div><div class="field"><label>Pack cost ($)</label><input type="number" min="0" step="0.01" value="${d.pack_cost}" oninput="inventoryField('pack_cost',this.value)"></div><div class="field"><label>Supplier</label><input value="${escapeHtml(d.supplier || "")}" oninput="inventoryField('supplier',this.value)"></div><div class="btn-row"><button class="btn-secondary" onclick="astate.inventoryDraft=null;render()">Cancel</button><button class="btn-primary" onclick="saveInventoryItem()">Save ingredient</button></div></div></div>`; }
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
function renderPreparationTab() {
  const today = localDateText(new Date());
  const orders = astate.orders.filter((order) => order.collection_date === today && order.payment_status === "paid" && !["cancelled","collected"].includes(order.order_status)).sort((a,b) => String(a.collection_time || "").localeCompare(String(b.collection_time || "")));
  const totals = new Map();
  orders.forEach((order) => (order.order_items || []).forEach((item) => totals.set(item.product_name, (totals.get(item.product_name) || 0) + Number(item.quantity || 0))));
  return `<style>@media print{.admin-side,.admin-top,.no-print{display:none!important}.admin-main{padding:0!important}.prep-print{box-shadow:none!important;border:0!important}}</style><section class="dashboard-card prep-print" style="padding:22px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Today · ${escapeHtml(today)}</h2><div><span>${orders.length} active paid order${orders.length === 1 ? "" : "s"}</span><button class="btn-secondary no-print" style="margin-left:10px;" onclick="window.print()">Print list</button></div></div><div class="display" style="font-size:20px;margin:6px 0 10px;">Total drinks to prepare</div>${totals.size ? [...totals.entries()].map(([name,qty]) => `<div class="row" style="padding:9px 0;border-bottom:1px solid #eee5da;"><b>${escapeHtml(name)}</b><b>× ${qty}</b></div>`).join("") : `<div class="dashboard-empty">No paid drinks scheduled for today.</div>`}<div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:10px;">Preparation order</div>${orders.map((order) => `<div style="padding:14px 0;border-bottom:1px solid #eee5da;"><div class="queue-top"><b>${escapeHtml(order.collection_time || "Time pending")} · ${escapeHtml(order.customer_name || "Customer")}</b><span class="mono">${escapeHtml(order.order_number || order.id)}</span></div><div class="queue-name" style="margin-top:7px;">${(order.order_items || []).map((item) => `${escapeHtml(item.product_name)} × ${Number(item.quantity || 0)}`).join(" · ")}</div><div class="queue-name">${escapeHtml(order.collection_point || "")}${order.notes ? ` · Note: ${escapeHtml(order.notes)}` : ""}</div></div>`).join("")}</section>`;
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
  return controls + orders.map((o) => {
    const redemption = astate.promoRedemptions.find((row) => String(row.order_id) === String(o.id));
    const subtotal = (o.order_items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const discount = redemption ? Math.max(0, subtotal - Number(o.total || 0)) : 0;
    return `
    <div class="order-card">
      <div class="order-top">
        <div class="mono">${o.order_number || o.id}</div>
        <div class="status-tag" style="color:${PAY_COLOR[o.payment_status] || "#8A8478"}">${PAY_LABEL[o.payment_status] || o.payment_status || "—"}</div>
      </div>
      <div class="order-meta">${o.customer_name || ""} · ${o.customer_phone || ""}${o.instagram ? " · @" + o.instagram : ""}</div>
      <div class="order-meta">Pickup: ${o.collection_date || ""} ${o.collection_time || ""}</div>
      <div class="order-meta">Collection point: <b>${escapeHtml(o.collection_point || "—")}</b></div>
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
      ${redemption ? `<div class="row"><span class="label">Subtotal</span><span>${money(subtotal)}</span></div><div class="row" style="color:#A36D1E;"><span class="label">Promo code · <b>${escapeHtml(redemption.code)}</b></span><span>−${money(discount)}</span></div>` : ""}
      <div class="row bold"><span class="label">Total</span><span>${money(o.total)}</span></div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center;">
        <button class="btn-secondary" onclick="editOrder('${o.id}')">Edit order</button>
        ${o.order_status !== "cancelled" && (o.payment_status === "submitted" || o.payment_status === "awaiting_payment") ? `<button class="small-btn" onclick="confirmPayment('${o.id}')">✓ Confirm payment</button>` : ""}
        ${o.order_status !== "cancelled" && o.payment_status === "submitted" ? `<button class="link-danger" onclick="rejectPayment('${o.id}')">Reject proof</button>` : ""}
        ${o.payment_status === "awaiting_payment" ? `<span class="hint" style="margin:0;">Check the Instagram DM payment screenshot before confirming.</span>` : ""}
        ${o.payment_status === "paid" && o.order_status === "confirmed" ? `<button class="small-btn" onclick="updateOrderStatus('${o.id}','preparing')">Start preparing</button>` : ""}
        ${o.payment_status === "paid" && o.order_status === "preparing" ? `<button class="small-btn" onclick="updateOrderStatus('${o.id}','ready')">Mark ready for collection</button>` : ""}
        ${o.payment_status === "paid" && o.order_status === "ready" ? `<button class="small-btn" onclick="updateOrderStatus('${o.id}','collected')">Mark collected</button>` : ""}
        ${o.order_status !== "cancelled" && o.order_status !== "collected" ? `<button class="link-danger" onclick="cancelOrder('${o.id}')">Cancel order</button>` : ""}
      </div>
    </div>`;
  }).join("");
}

async function saveProductOrder() {
  if (!IS_CONFIGURED) { alert("Connect Supabase to save the product order."); return; }
  const button = document.getElementById("save-product-order-btn");
  if (button) { button.textContent = "Saving…"; button.disabled = true; }
  try {
    for (let index = 0; index < astate.menu.length; index++) {
      const product = astate.menu[index];
      const sortOrder = index + 1;
      const { error } = await db.from("products").update({ sort_order: sortOrder }).eq("id", product.id);
      if (error) throw error;
      product.sort_order = sortOrder;
    }
    alert("Product order saved.");
  } catch (error) {
    alert("Could not save product order: " + ((error && error.message) || String(error)));
  } finally {
    if (button) { button.textContent = "Save product order"; button.disabled = false; }
    render();
  }
}

function renderMenuTab() {
  return `
    <section class="dashboard-card" style="padding:20px;margin-bottom:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Product groups</h2><span>These become the big headings on the ordering page</span></div>
      <div class="admin-sortable-list">${astate.productGroups.map((group, index) => `<div class="admin-sortable-item admin-product-group-row" data-sort-scope="productGroups" data-sort-key="${escapeHtml(String(group.id ?? `new-${index}`))}">${dragHandle("productGroups", index)}<div class="admin-sortable-content admin-product-group-fields"><input value="${escapeHtml(group.name || "")}" placeholder="e.g. Special" oninput="onGroupField(${index},'name',this.value)"><label style="font-size:12px;white-space:nowrap;"><input type="checkbox" style="width:auto;" ${group.is_visible ? "checked" : ""} onchange="onGroupField(${index},'is_visible',this.checked)"> Show</label><button class="link-danger" style="font-size:12px;" onclick="deleteProductGroup(${index})">Delete</button></div></div>`).join("")}</div>
      <div class="btn-row" style="margin-top:14px;"><button class="btn-secondary" onclick="addProductGroup()">+ Add group</button><button class="btn-primary" onclick="saveProductGroups()">Save groups</button></div>
    </section>
    ${renderDrinkOptionsManager()}
    <section class="dashboard-card" style="padding:20px;margin-bottom:20px;">
      <div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Products</h2><span>Drag the six-dot handle to change the ordering-page sequence</span></div>
      <div class="admin-sortable-list">${astate.menu.map((item, index) => `
        <div class="admin-sortable-item admin-product-sort-row order-card" data-sort-scope="products" data-sort-key="${escapeHtml(String(item.id))}">
          ${dragHandle("products", index)}
          <div class="admin-sortable-content">
            <div class="order-top">
              <div>
                <div style="font-size:14px;font-weight:600;">${item.name}</div>
                <div class="order-meta">${item.category || "Other"} · ${item.is_bundle ? "Bundle · " : ""}${item.is_available ? "Visible" : "Hidden"} · ${Number(item.discount_price) > 0 && Number(item.discount_price) < Number(item.price) ? `${money(item.discount_price)} (was ${money(item.price)})` : money(item.price)}</div>
              </div>
              <div style="display:flex;gap:10px;">
                <button class="link-btn" onclick="editMenuItem('${item.id}')">Edit</button>
                <button class="link-danger" onclick="deleteMenuItem('${item.id}')">Delete</button>
              </div>
            </div>
          </div>
        </div>
      `).join("")}</div>
      <div class="btn-row" style="margin-top:14px;">
        <button class="btn-secondary" onclick="newMenuItem()">+ Add menu item</button>
        <button class="btn-primary" id="save-product-order-btn" onclick="saveProductOrder()">Save product order</button>
      </div>
    </section>
  `;
}

/* ---- promos ---- */
function onPromoField(key, value) { astate.promoDraft[key] = key === "code" ? String(value || "").toUpperCase().replace(/\s+/g, "") : value; }
function togglePromoProduct(productId, checked) {
  const ids = Array.isArray(astate.promoDraft.applicable_product_ids) ? astate.promoDraft.applicable_product_ids.map(String) : [];
  astate.promoDraft.applicable_product_ids = checked ? [...new Set([...ids, String(productId)])] : ids.filter((id) => id !== String(productId));
}
function clearPromoDraft() {
  astate.editingPromoId = null;
  astate.promoDraft = { code: "", discount_type: "fixed", discount_value: "", minimum_spend: "", usage_limit: "", valid_until: "", applicable_product_ids: [] };
  render();
}
function editPromo(id) {
  const promo = astate.promos.find((item) => String(item.id) === String(id));
  if (!promo) return;
  astate.editingPromoId = promo.id;
  astate.promoDraft = {
    code: promo.code || "",
    discount_type: promo.discount_type === "percent" ? "percent" : "fixed",
    discount_value: promo.discount_value ?? "",
    minimum_spend: promo.minimum_spend ?? "",
    usage_limit: promo.usage_limit ?? "",
    valid_until: promo.valid_until ? String(promo.valid_until).slice(0, 10) : "",
    applicable_product_ids: Array.isArray(promo.applicable_product_ids) ? promo.applicable_product_ids.map(String) : [],
  };
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function createPromo() {
  const draft = astate.promoDraft;
  const code = String(draft.code || "").trim().toUpperCase();
  const value = Number(draft.discount_value);
  if (!code) return alert("Enter a promo code.");
  if (!Number.isFinite(value) || value <= 0) return alert("Enter a valid discount amount.");
  const button = document.getElementById("create-promo-btn"); if (button) { button.textContent = "Saving…"; button.disabled = true; }
  const payload = { discount_type: draft.discount_type === "percent" ? "percent" : "fixed", discount_value: value, minimum_spend: Number(draft.minimum_spend || 0), usage_limit: draft.usage_limit === "" ? null : Math.max(1, Number(draft.usage_limit)), valid_until: draft.valid_until || null, applicable_product_ids: Array.isArray(draft.applicable_product_ids) ? draft.applicable_product_ids : [] };
  const editingId = astate.editingPromoId;
  const query = editingId
    ? db.from("promo_codes").update(payload).eq("id", editingId).select().single()
    : db.from("promo_codes").insert({ ...payload, code, is_active: true }).select().single();
  const { data, error } = await query;
  if (button) { button.textContent = editingId ? "Save changes" : "Create promo"; button.disabled = false; }
  if (error) return alert(`Could not ${editingId ? "update" : "create"} promo: ` + error.message);
  if (editingId) astate.promos = astate.promos.map((promo) => String(promo.id) === String(editingId) ? data : promo);
  else astate.promos = [data, ...astate.promos];
  clearPromoDraft();
  alert(editingId ? "Promo updated." : "Promo created.");
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
function togglePromoUses(code) { astate.expandedPromoCode = astate.expandedPromoCode === code ? null : code; render(); }
function renderPromosTab() {
  const d = astate.promoDraft;
  const isEditingPromo = !!astate.editingPromoId;
  const selectedProductIds = Array.isArray(d.applicable_product_ids) ? d.applicable_product_ids.map(String) : [];
  const productChoices = astate.menu.map((product) => `<label class="slot" style="cursor:pointer;gap:9px;margin:0 0 7px;padding:10px 12px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A" ${selectedProductIds.includes(String(product.id)) ? "checked" : ""} onchange="togglePromoProduct('${product.id}',this.checked)"><span>${escapeHtml(product.name)}</span></label>`).join("");
  const form = `<section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>${isEditingPromo ? "Edit promo code" : "New promo code"}</h2></div><div class="field"><label>Code</label><input value="${escapeHtml(d.code)}" placeholder="WELCOME10" style="text-transform:uppercase" ${isEditingPromo ? "readonly" : ""} oninput="onPromoField('code',this.value);this.value=this.value.toUpperCase()">${isEditingPromo ? `<div class="hint" style="text-align:left;margin-top:5px">The code stays unchanged so its customer redemption history remains connected.</div>` : ""}</div><div class="field"><label>Discount type</label><select onchange="onPromoField('discount_type',this.value)"><option value="fixed" ${d.discount_type === "fixed" ? "selected" : ""}>Dollar off ($)</option><option value="percent" ${d.discount_type === "percent" ? "selected" : ""}>Percent off (%)</option></select></div><div class="field"><label>Discount value</label><input type="number" min="0.01" step="0.01" value="${escapeHtml(d.discount_value)}" placeholder="1.00" oninput="onPromoField('discount_value',this.value)"></div><div class="field"><label>Minimum spend (optional)</label><input type="number" min="0" step="0.01" value="${escapeHtml(d.minimum_spend)}" placeholder="0.00" oninput="onPromoField('minimum_spend',this.value)"></div><div class="field"><label>Products this promo applies to</label><div class="hint" style="text-align:left;margin:0 0 8px">Leave every product unticked to apply the code to the whole cart.</div><div style="max-height:210px;overflow:auto">${productChoices || `<div class="hint">Add products first.</div>`}</div></div><div class="field"><label>Usage limit (optional)</label><input type="number" min="1" value="${escapeHtml(d.usage_limit)}" placeholder="No limit" oninput="onPromoField('usage_limit',this.value)"></div><div class="field"><label>End date (optional)</label><input type="date" value="${escapeHtml(d.valid_until)}" oninput="onPromoField('valid_until',this.value)"></div><div class="btn-row"><button class="btn-secondary" onclick="clearPromoDraft()">${isEditingPromo ? "Cancel" : "Clear"}</button><button class="btn-primary" id="create-promo-btn" onclick="createPromo()">${isEditingPromo ? "Save changes" : "Create promo"}</button></div></section>`;
  const list = `<section class="dashboard-card"><div class="dashboard-card-head"><h2>Promo codes</h2><span>${astate.promos.length} total</span></div>${astate.promos.length ? astate.promos.map((promo) => {
    const uses = astate.promoRedemptions.filter((row) => String(row.code || "").toUpperCase() === String(promo.code || "").toUpperCase());
    const exhausted = promo.usage_limit != null && uses.length >= Number(promo.usage_limit);
    const active = promo.is_active && !exhausted;
    const expanded = astate.expandedPromoCode === promo.code;
    const applicableIds = Array.isArray(promo.applicable_product_ids) ? promo.applicable_product_ids.map(String) : [];
    const applicableNames = applicableIds.map((id) => astate.menu.find((product) => String(product.id) === id)?.name).filter(Boolean);
    const appliesTo = applicableNames.length ? applicableNames.join(", ") : "All products";
    return `<div class="queue-row" style="cursor:default"><div class="queue-top"><div><div class="queue-number">${escapeHtml(promo.code)}</div><div class="queue-name">${promo.discount_type === "percent" ? `${escapeHtml(promo.discount_value)}% off` : `${money(promo.discount_value)} off`} · min. ${money(promo.minimum_spend || 0)}</div><div class="queue-name" style="color:#4B5D3A;margin-top:3px">Applies to: ${escapeHtml(appliesTo)}</div></div><div class="queue-status" style="background:${active ? "#e6f5df" : "#f5e8e4"};color:${active ? "#28753a" : "#a33c28"};">${active ? "LIVE" : exhausted ? "USED UP" : "PAUSED"}</div></div><div style="display:flex;gap:12px;align-items:center;margin-top:12px;flex-wrap:wrap"><button class="link-btn" onclick="togglePromoUses('${escapeHtml(promo.code)}')">${uses.length} used · ${expanded ? "Hide customers" : "View customers"}</button><span class="hint" style="margin:0">${promo.usage_limit != null ? `limit ${promo.usage_limit}` : "No total limit"}${promo.valid_until ? ` · ends ${escapeHtml(String(promo.valid_until).slice(0,10))}` : ""}</span><span style="margin-left:auto;display:flex;gap:8px"><button class="link-btn" onclick="editPromo('${promo.id}')">Edit</button><button class="link-btn" onclick="setPromoActive('${promo.id}',${!promo.is_active})">${promo.is_active ? "Pause" : "Make live"}</button><button class="link-danger" onclick="removePromo('${promo.id}')">Delete</button></span></div>${expanded ? `<div style="margin-top:14px;border-top:1px solid #eee3d8;padding-top:8px">${uses.length ? uses.map((use) => { const order = astate.orders.find((item) => String(item.id) === String(use.order_id)); return `<div class="row" style="padding:9px 0;border-bottom:1px solid #f3ebe2"><span><b>${escapeHtml(order?.customer_name || "Customer")}</b><br><span class="hint" style="margin:0">${escapeHtml(use.phone || order?.customer_phone || "—")} · ${escapeHtml(order?.order_number || "Order")}</span></span><span class="hint" style="margin:0">${use.created_at ? new Date(use.created_at).toLocaleString() : "Used"}</span></div>`; }).join("") : `<div class="hint" style="padding:10px 0">Nobody has used this code yet.</div>`}</div>` : ""}</div>`;
  }).join("") : `<div class="dashboard-empty">No promo codes yet.</div>`}</section>`;
  return `<div class="dashboard-grid" style="grid-template-columns:minmax(290px,.72fr) minmax(400px,1.28fr);align-items:start">${form}${list}</div>`;
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
  const welcomeFonts = [
    ["fraunces", "Elegant serif · Fraunces"],
    ["noto_serif_jp", "Japanese serif · Noto Serif JP"],
    ["work_sans", "Clean sans · Work Sans"],
    ["noto_sans_jp", "Japanese sans · Noto Sans JP"],
    ["georgia", "Classic serif · Georgia"],
  ];
  const fontSelect = (label, key, fallback) => `<div class="field"><label>${label}</label><select onchange="onSettingsField('${key}',this.value)">${welcomeFonts.map(([value, name]) => `<option value="${value}" ${(s[key] || fallback) === value ? "selected" : ""}>${name}</option>`).join("")}</select></div>`;
  const active = astate.settingsSection || "welcome";
  const sectionButton = (id, label) => `<button type="button" class="${active === id ? "btn-primary" : "btn-secondary"}" onclick="astate.settingsSection='${id}';render()">${label}</button>`;
  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 22px;">${sectionButton("welcome","Welcome")}${sectionButton("logo","Logo")}${sectionButton("banner","Banner picture")}${sectionButton("product_page","Product page")}${sectionButton("details","Store details")}</div>
    <section ${active === "product_page" ? "" : "hidden"}>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Product customisation page</div>
    <p class="hint" style="text-align:left;margin:0 0 14px;">Controls the page customers see after tapping a product.</p>
    <div class="field"><label>Product image height <span id="product-detail-height-value" style="float:right;color:#4B5D3A;">${Number(s.product_detail_image_height || 180)} px</span></label><input type="range" min="100" max="420" step="10" value="${Number(s.product_detail_image_height || 180)}" oninput="onSettingsField('product_detail_image_height',Number(this.value));document.getElementById('product-detail-height-value').textContent=this.value+' px'"></div>
    <div class="field"><label>Product image display</label><select onchange="onSettingsField('product_detail_image_fit',this.value)"><option value="cover" ${(s.product_detail_image_fit || "cover") === "cover" ? "selected" : ""}>Fill frame (crop if needed)</option><option value="contain" ${s.product_detail_image_fit === "contain" ? "selected" : ""}>Show complete image</option></select></div>
    <div class="field"><label>Option text size <span id="product-option-size-value" style="float:right;color:#4B5D3A;">${Number(s.product_option_text_size || 15)} px</span></label><input type="range" min="12" max="24" step="1" value="${Number(s.product_option_text_size || 15)}" oninput="onSettingsField('product_option_text_size',Number(this.value));document.getElementById('product-option-size-value').textContent=this.value+' px'"></div>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.product_option_compact !== false ? "checked" : ""} onchange="onSettingsField('product_option_compact',this.checked)"><span><b>Use compact option cards</b><br><span class="hint">Reduces the empty space between Ice, Sweetness and Milk choices on phones.</span></span></label>
    <button class="btn-primary" id="settings-save-btn" style="width:100%;" onclick="saveSettings()">Save product page</button>
    </section>
    <section ${active === "details" ? "" : "hidden"}>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Store details</div>
    ${field("Store name", "store_name")}
    ${field("Store tagline", "store_tagline", "雫ラボ · crafted drop by drop")}
    <div class="field"><label>Admin mobile menu position</label><select onchange="onSettingsField('admin_mobile_nav_position',this.value)"><option value="left" ${(s.admin_mobile_nav_position || "left") === "left" ? "selected" : ""}>Left sidebar</option><option value="top" ${s.admin_mobile_nav_position === "top" ? "selected" : ""}>Top menu</option></select><div class="hint" style="text-align:left;margin-top:5px;">Only changes the Admin layout on phones. Desktop stays on the left.</div></div>
    ${field("Instagram (without @)", "instagram")}
    ${field("Shizuku Lab website link (optional)", "website_url", "https://your-brand-website.com")}
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Powered by footer</div>
    ${field("Footer text", "powered_by_text", "Powered by Slow Studio")}
    ${field("Slow Studio link (optional)", "powered_by_url", "https://slow-studio.com")}
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_powered_by !== false ? "checked" : ""} onchange="onSettingsField('show_powered_by', this.checked)"><span><b>Show Powered by Slow Studio</b><br><span class="hint">When a link is entered, customers can click the footer and it opens in a new tab.</span></span></label>
    </section>
    <section ${active === "welcome" ? "" : "hidden"}>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Instagram browser guidance</div>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_instagram_browser_notice !== false ? "checked" : ""} onchange="onSettingsField('show_instagram_browser_notice',this.checked)"><span><b>Show “Open in browser” guidance</b><br><span class="hint">Only appears when a customer opens your Welcome page inside Instagram or Facebook. They can still continue if they prefer.</span></span></label>
    <div class="divider"></div>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Welcome announcement</div>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_announcement ? "checked" : ""} onchange="onSettingsField('show_announcement', this.checked)"><span><b>Show announcement before Welcome page</b><br><span class="hint">The same announcement appears at most once per customer per day.</span></span></label>
    ${field("Announcement title", "announcement_title", "This week at Shizuku Lab")}
    <div class="field"><label>Announcement message</label><textarea rows="4" placeholder="Opening dates, pickup hours or an important update." oninput="onSettingsField('announcement_message', this.value)">${escapeHtml(s.announcement_message || "")}</textarea></div>
    ${field("Promo code to show (optional)", "announcement_promo_code", "WELCOME10")}
    ${field("Continue button text", "announcement_button_text", "Continue")}
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Welcome cover</div>
    ${field("Welcome title", "welcome_title", "Welcome to Shizuku Lab")}
    ${fontSelect("Welcome title font", "welcome_title_font", "fraunces")}
    ${field("Welcome subtitle", "welcome_subtitle", "雫ラボ · CRAFTED DROP BY DROP")}
    <div class="field"><label>Welcome introduction</label><textarea rows="3" placeholder="A short message shown before customers enter the ordering page." oninput="onSettingsField('welcome_copy', this.value)">${escapeHtml(s.welcome_copy || "")}</textarea></div>
    ${field("Order button text", "welcome_order_button_text", "Enter ordering →")}
    ${field("Track order button text", "welcome_track_button_text", "Track order")}
    ${field("Loyalty button text", "welcome_loyalty_button_text", "Check your loyalty")}
    ${field("Website button text", "welcome_website_button_text", "Visit Shizuku Lab website ↗")}
    ${fontSelect("Welcome body & button font", "welcome_body_font", "work_sans")}
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Admin Welcome screen</div>
    <p class="hint" style="text-align:left;margin:0 0 12px;">The Welcome back screen now uses your Store Logo in a large circle. Change the picture and circle size in the Logo section.</p>
    <div class="field"><label>Admin welcome duration <span id="admin-welcome-duration-value" style="float:right;font-weight:600;color:#4B5D3A;">${Math.max(2, Math.min(10, Number(s.admin_welcome_duration_seconds || 5)))} seconds</span></label><input type="range" min="2" max="10" step="1" value="${Math.max(2, Math.min(10, Number(s.admin_welcome_duration_seconds || 5)))}" oninput="onSettingsField('admin_welcome_duration_seconds',Number(this.value));document.getElementById('admin-welcome-duration-value').textContent=this.value+' seconds'"><div class="hint" style="text-align:left;margin-top:5px;">Choose how long Welcome back appears after Admin login.</div></div>
    </section>
    <section ${active === "logo" ? "" : "hidden"}>
    <div class="field"><label>Welcome logo position</label><select onchange="onSettingsField('welcome_logo_position',this.value)"><option value="left" ${s.welcome_logo_position === "left" ? "selected" : ""}>Left</option><option value="center" ${(!s.welcome_logo_position || s.welcome_logo_position === "center") ? "selected" : ""}>Centre</option><option value="right" ${s.welcome_logo_position === "right" ? "selected" : ""}>Right</option></select><div class="hint" style="text-align:left;margin-top:5px;">Choose where the logo sits on the Welcome cover.</div></div>
    ${s.logo_url ? `<div class="field"><label>Welcome logo preview</label><div id="welcome-logo-live-preview" style="width:${Number(s.welcome_logo_circle_size || s.logo_circle_size || 100)}px;height:${Number(s.welcome_logo_circle_size || s.logo_circle_size || 100)}px;border:5px solid #F4EEE3;border-radius:50%;overflow:hidden;background:#fff;display:grid;place-items:center;margin-top:8px;"><img id="welcome-logo-live-preview-image" src="${escapeHtml(s.logo_url)}" alt="Welcome logo preview" style="width:100%;height:100%;object-fit:contain;padding:12px;transform:translate(${Number(s.welcome_logo_image_x || 0)}%, ${Number(s.welcome_logo_image_y || 0)}%) scale(${Number(s.welcome_logo_image_scale || s.logo_image_scale || 1)});"></div></div>` : ""}
    <div class="field"><label>Welcome logo circle size <span id="welcome-logo-circle-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.welcome_logo_circle_size || s.logo_circle_size || 100)} px</span></label><input type="range" min="56" max="220" step="1" value="${Number(s.welcome_logo_circle_size || s.logo_circle_size || 100)}" oninput="onSettingsField('welcome_logo_circle_size',Number(this.value));updateWelcomeLogoPreview()"></div>
    <div class="field"><label>Welcome logo image size <span id="welcome-logo-image-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.welcome_logo_image_scale || s.logo_image_scale || 1).toFixed(2)}×</span></label><input type="range" min="0.55" max="2.4" step="0.05" value="${Number(s.welcome_logo_image_scale || s.logo_image_scale || 1)}" oninput="onSettingsField('welcome_logo_image_scale',Number(this.value));updateWelcomeLogoPreview()"></div>
    <div class="field"><label>Move Welcome logo left / right <span id="welcome-logo-x-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.welcome_logo_image_x || 0) > 0 ? "+" : ""}${Number(s.welcome_logo_image_x || 0)}%</span></label><input type="range" min="-45" max="45" step="1" value="${Number(s.welcome_logo_image_x || 0)}" oninput="onSettingsField('welcome_logo_image_x',Number(this.value));updateWelcomeLogoPreview()"></div>
    <div class="field"><label>Move Welcome logo up / down <span id="welcome-logo-y-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.welcome_logo_image_y || 0) > 0 ? "+" : ""}${Number(s.welcome_logo_image_y || 0)}%</span></label><input type="range" min="-45" max="45" step="1" value="${Number(s.welcome_logo_image_y || 0)}" oninput="onSettingsField('welcome_logo_image_y',Number(this.value));updateWelcomeLogoPreview()"><div class="hint" style="text-align:left;margin-top:5px;">Use these two sliders when the artwork in your uploaded logo is not centred.</div></div>
    <div class="hint" style="text-align:left;margin:-6px 0 14px;">Your Welcome cover uses the same logo you upload below. Leave the website link empty if you only want the ordering button.</div>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Storefront images</div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 16px;"><div style="border:1px solid #E1D9C8;border-radius:13px;padding:12px;background:#fff;"><b style="display:block;margin-bottom:4px;">Logo frame · 1 : 1</b><span class="hint" style="margin:0;text-align:left;">Best upload: square, at least 1000 × 1000 px.</span></div><div style="border:1px solid #E1D9C8;border-radius:13px;padding:12px;background:#fff;"><b style="display:block;margin-bottom:4px;">Banner frame · 2 : 1</b><span class="hint" style="margin:0;text-align:left;">Best upload: landscape, at least 1600 × 800 px.</span></div></div>
    <div class="field"><label>Logo</label><input value="${escapeHtml(s.logo_url || "")}" placeholder="Upload below or paste image URL" oninput="onSettingsField('logo_url', this.value)"><input type="file" accept="image/*" style="margin-top:8px;" onchange="uploadStorefrontImage(this,'logo_url')">${s.logo_url ? `<div id="logo-live-preview" style="width:${Number(s.logo_circle_size || 68)}px;height:${Number(s.logo_circle_size || 68)}px;border:1px solid #E1D9C8;border-radius:50%;overflow:hidden;margin-top:10px;background:#fff;display:grid;place-items:center;"><img id="logo-live-preview-image" src="${escapeHtml(s.logo_url)}" alt="Logo preview" style="width:100%;height:100%;object-fit:contain;transform:translate(${Number(s.logo_image_x || 0)}%,${Number(s.logo_image_y || 0)}%) scale(${Number(s.logo_image_scale || 1)});"></div>` : ""}</div>
    <div class="field"><label>Logo circle size <span id="logo-circle-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.logo_circle_size || 68)} px</span></label><input type="range" min="56" max="150" step="1" value="${Number(s.logo_circle_size || 68)}" oninput="onSettingsField('logo_circle_size',Number(this.value));updateStorefrontPreview()"><div class="hint" style="text-align:left;margin-top:5px;">The preview changes while you drag. Press Save settings to publish it to your customer page.</div></div>
    <div class="field"><label>Logo image size <span id="logo-image-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.logo_image_scale || 1).toFixed(2)}×</span></label><input type="range" min="0.55" max="2" step="0.05" value="${Number(s.logo_image_scale || 1)}" oninput="onSettingsField('logo_image_scale',Number(this.value));updateStorefrontPreview()"><div class="hint" style="text-align:left;margin-top:5px;">Zoom the logo inside the circle without changing the circle itself.</div></div>
    <div class="field"><label>Move logo left / right <span id="logo-x-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.logo_image_x || 0) > 0 ? "+" : ""}${Number(s.logo_image_x || 0)}%</span></label><input type="range" min="-45" max="45" step="1" value="${Number(s.logo_image_x || 0)}" oninput="onSettingsField('logo_image_x',Number(this.value));updateStorefrontPreview()"></div>
    <div class="field"><label>Move logo up / down <span id="logo-y-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.logo_image_y || 0) > 0 ? "+" : ""}${Number(s.logo_image_y || 0)}%</span></label><input type="range" min="-45" max="45" step="1" value="${Number(s.logo_image_y || 0)}" oninput="onSettingsField('logo_image_y',Number(this.value));updateStorefrontPreview()"><div class="hint" style="text-align:left;margin-top:5px;">Move the artwork inside the circle without moving the circle itself.</div></div>
    </section>
    <section ${active === "banner" ? "" : "hidden"}>
    <div class="field"><label>Top banner image</label><input value="${escapeHtml(s.hero_image_url || "")}" placeholder="Upload below or paste image URL" oninput="onSettingsField('hero_image_url', this.value)"><input type="file" accept="image/*" style="margin-top:8px;" onchange="uploadStorefrontImage(this,'hero_image_url')">${s.hero_image_url ? `<img id="banner-live-preview" src="${escapeHtml(s.hero_image_url)}" alt="Banner preview" style="display:block;width:100%;aspect-ratio:2/1;object-fit:cover;object-position:${Number(s.hero_image_x ?? 50)}% ${Number(s.hero_image_y ?? s.hero_image_position ?? 68)}%;border:1px solid #E1D9C8;border-radius:12px;margin-top:10px;">` : ""}</div>
    <div class="field"><label>Banner left / right crop <span id="banner-x-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.hero_image_x ?? 50)}%</span></label><input type="range" min="0" max="100" step="1" value="${Number(s.hero_image_x ?? 50)}" oninput="onSettingsField('hero_image_x',Number(this.value));updateStorefrontPreview()"></div>
    <div class="field"><label>Banner up / down crop <span id="banner-y-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.hero_image_y ?? s.hero_image_position ?? 68)}%</span></label><input type="range" min="0" max="100" step="1" value="${Number(s.hero_image_y ?? s.hero_image_position ?? 68)}" oninput="onSettingsField('hero_image_y',Number(this.value));updateStorefrontPreview()"><div class="hint" style="text-align:left;margin-top:5px;">Adjust until the drink layers sit where you want them in the banner.</div></div>
    <div class="field"><label>Banner height <span id="banner-height-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.hero_banner_height || 190)} px</span></label><input type="range" min="130" max="320" step="5" value="${Number(s.hero_banner_height || 190)}" oninput="onSettingsField('hero_banner_height',Number(this.value));updateStorefrontPreview()"><div class="hint" style="text-align:left;margin-top:5px;">Make the banner taller or shorter.</div></div>
    <div class="field"><label>Store introduction</label><textarea rows="4" placeholder="A short introduction customers see below your collection address." oninput="onSettingsField('store_description', this.value)">${escapeHtml(s.store_description || "")}</textarea><div class="hint" style="text-align:left;margin-top:5px;">Shown on the customer ordering page.</div></div>
    ${field("Top rolling message", "ticker_text", "e.g. PRE-ORDER ONLY · FRESHLY WHISKED · SHIZUKU LAB")}
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_ticker !== false ? "checked" : ""} onchange="onSettingsField('show_ticker', this.checked)"><span><b>Show rolling message</b><br><span class="hint">Untick to hide it from the ordering page.</span></span></label>
    </section>
    <section ${active === "details" ? "" : "hidden"}>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Contact</div>
    ${field("WhatsApp number", "whatsapp_number", "+65 9XXX XXXX")}
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;">
      <input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_whatsapp ? "checked" : ""} onchange="onSettingsField('show_whatsapp', this.checked)">
      <span><b>Show WhatsApp on website</b><br><span class="hint">Keep this unticked if you only want to save the number for later.</span></span>
    </label>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Payment & collection</div>
    <div class="field"><label>PayNow QR mode</label><select onchange="onSettingsField('payment_qr_mode',this.value);render()"><option value="dynamic" ${(s.payment_qr_mode || "dynamic") === "dynamic" ? "selected" : ""}>Dynamic QR · order amount locked</option><option value="uploaded" ${s.payment_qr_mode === "uploaded" ? "selected" : ""}>Use my uploaded QR image</option></select><div class="hint" style="text-align:left;margin-top:5px;">Dynamic QR is recommended because it inserts the exact order total. An uploaded static QR cannot prevent customers changing the amount in their banking app.</div></div>
    ${field("PayNow name", "paynow_name")}
    ${field("PayNow number", "paynow_number", "+65 9XXX XXXX")}
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:10px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_paynow_name !== false ? "checked" : ""} onchange="onSettingsField('show_paynow_name',this.checked)"><span><b>Show PayNow name to customers</b></span></label>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_paynow_number !== false ? "checked" : ""} onchange="onSettingsField('show_paynow_number',this.checked)"><span><b>Show PayNow phone number to customers</b></span></label>
    <div class="field"><label>Uploaded PayNow QR image</label><input value="${escapeHtml(s.paynow_url || "")}" placeholder="Upload below or paste image URL" oninput="onSettingsField('paynow_url',this.value)"><input type="file" accept="image/*" style="margin-top:8px;" onchange="uploadStorefrontImage(this,'paynow_url')">${s.paynow_url ? `<img src="${escapeHtml(s.paynow_url)}" alt="PayNow QR preview" style="display:block;width:190px;height:190px;object-fit:contain;margin-top:10px;border:1px solid #E1D9C8;border-radius:14px;padding:8px;background:#fff;">` : ""}<div class="hint" style="text-align:left;margin-top:5px;">Used only when QR mode is set to “Use my uploaded QR image”.</div></div>
    ${field("Collection address", "collection_address")}
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Collection points</div>
    <p class="hint" style="text-align:left;margin:0 0 12px;">Customers choose one of these at Checkout. The order shown here becomes the dropdown order.</p>
    ${settingsCollectionPoints().map((point,index) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;margin-bottom:9px;"><input value="${escapeHtml(point)}" placeholder="Collection point name" oninput="editCollectionPoint(${index},this.value)"><div style="display:flex;gap:5px;"><button type="button" class="btn-secondary" ${index === 0 ? "disabled" : ""} onclick="moveCollectionPoint(${index},-1)" aria-label="Move up">↑</button><button type="button" class="btn-secondary" ${index === settingsCollectionPoints().length-1 ? "disabled" : ""} onclick="moveCollectionPoint(${index},1)" aria-label="Move down">↓</button><button type="button" class="link-danger" onclick="deleteCollectionPoint(${index})">Delete</button></div></div>`).join("")}
    <button type="button" class="btn-secondary" style="margin-bottom:16px;" onclick="addCollectionPoint()">+ Add collection point</button>
    ${field("Saturday collection time", "saturday_collection_time", "10:00 AM - 12:00 PM")}
    ${field("Sunday collection time", "sunday_collection_time", "10:00 AM - 1:00 PM")}
    </section>
    <button class="btn-primary" id="settings-save-btn" style="width:100%;margin-top:18px;" onclick="saveSettings()">Save settings</button>
  `;
}

function renderNotificationsTab() {
  const n = astate.notificationDraft || { recipient_email: "", webhook_url: "", enabled: false, alert_new_order: true, alert_payment_proof: true, alert_live_chat: true };
  return `<section class="dashboard-card" style="padding:22px;max-width:860px;">
    <div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Email notifications</h2><span>${n.enabled ? "On" : "Off"}</span></div>
    <p class="hint" style="text-align:left;margin:0 0 16px;">Choose which Shizuku Lab activity should send an email.</p>
    <div class="field"><label>Receive alerts at</label><input type="email" value="${escapeHtml(n.recipient_email || "")}" placeholder="tinghuioh29@gmail.com" oninput="onNotificationField('recipient_email', this.value)"></div>
    <div class="field"><label>Google Apps Script web app URL</label><input value="${escapeHtml(n.webhook_url || "")}" placeholder="Paste the web app URL after you deploy it" oninput="onNotificationField('webhook_url', this.value)"><div class="hint" style="text-align:left;margin-top:5px;">This private link sends the alert to your Gmail. Leave alerts off until your Google setup is complete.</div></div>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:10px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${n.enabled ? "checked" : ""} onchange="onNotificationField('enabled', this.checked)"><span><b>Turn on email notifications</b></span></label>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:10px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${n.alert_new_order !== false ? "checked" : ""} onchange="onNotificationField('alert_new_order', this.checked)"><span>Notify me when a new order is placed</span></label>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${n.alert_payment_proof !== false ? "checked" : ""} onchange="onNotificationField('alert_payment_proof', this.checked)"><span>Notify me when payment proof is uploaded</span></label>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${n.alert_live_chat !== false ? "checked" : ""} onchange="onNotificationField('alert_live_chat', this.checked)"><span>Notify me when a customer sends a live chat message</span></label>
    <button class="btn-primary" id="notification-save-btn" style="width:100%;margin-top:0;" onclick="saveNotificationSettings()">Save notification settings</button>
  </section>`;
}

function cmsField(label, key, placeholder = "", rows = 0) {
  const s = astate.settingsDraft || {};
  return rows
    ? `<div class="field"><label>${label}</label><textarea rows="${rows}" placeholder="${escapeHtml(placeholder)}" oninput="onSettingsField('${key}',this.value)">${escapeHtml(s[key] || "")}</textarea></div>`
    : `<div class="field"><label>${label}</label><input value="${escapeHtml(s[key] || "")}" placeholder="${escapeHtml(placeholder)}" oninput="onSettingsField('${key}',this.value)"></div>`;
}
function cmsToggle(label, key, description = "") {
  const s = astate.settingsDraft || {};
  return `<label class="slot" style="cursor:pointer;gap:10px;margin-bottom:12px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s[key] !== false ? "checked" : ""} onchange="onSettingsField('${key}',this.checked)"><span><b>${label}</b>${description ? `<br><span class="hint">${description}</span>` : ""}</span></label>`;
}
function cmsSaveButton() { return `<button class="btn-primary" id="settings-save-btn" style="width:100%;margin-top:18px;" onclick="saveSettings()">Save settings</button>`; }

function updateDesignPreview() {
  const s = astate.settingsDraft || {};
  const shop = document.getElementById("design-shop-preview");
  const card = document.getElementById("design-loyalty-preview");
  const headingFont = ({ fraunces:"Fraunces,serif", noto_serif_jp:"'Noto Serif JP',serif", work_sans:"'Work Sans',sans-serif", noto_sans_jp:"'Noto Sans JP',sans-serif", georgia:"Georgia,serif" })[s.theme_heading_font || "fraunces"];
  const bodyFont = ({ fraunces:"Fraunces,serif", noto_serif_jp:"'Noto Serif JP',serif", work_sans:"'Work Sans',sans-serif", noto_sans_jp:"'Noto Sans JP',sans-serif", georgia:"Georgia,serif" })[s.theme_body_font || "work_sans"];
  if (shop && !document.getElementById("reset-original-colours")) {
    const button = document.createElement("button");
    button.id = "reset-original-colours";
    button.type = "button";
    button.className = "btn-secondary";
    button.style.margin = "0 0 14px";
    button.textContent = "↺ Reset to original colours";
    button.onclick = resetOriginalDesignColours;
    shop.parentElement?.before(button);
  }
  if (shop) {
    shop.style.background = s.theme_background_color || "#F3EEE3";
    shop.style.color = s.theme_text_color || "#2A2A22";
    shop.style.fontFamily = bodyFont;
    shop.querySelectorAll("[data-preview-heading]").forEach((element) => { element.style.fontFamily = headingFont; element.style.fontSize = `${Number(s.theme_heading_size || 25)}px`; });
    shop.querySelectorAll("[data-preview-card] [data-preview-heading]").forEach((element) => element.style.fontSize = `${Number(s.theme_product_name_size || 15)}px`);
    shop.querySelectorAll("[data-preview-primary]").forEach((element) => element.style.fontSize = `${Number(s.theme_button_size || 14)}px`);
    shop.querySelectorAll("[data-preview-card]").forEach((element) => element.style.background = s.theme_card_color || "#FFFFFF");
    shop.querySelectorAll("[data-preview-primary]").forEach((element) => { element.style.background = s.theme_primary_color || "#4B5D3A"; element.style.color = s.theme_background_color || "#F3EEE3"; });
  }
  if (card) {
    card.style.background = s.loyalty_card_background || "#1E473E";
    card.style.color = s.loyalty_card_text_color || "#F9F4E8";
    card.style.fontFamily = bodyFont;
    card.querySelectorAll("[data-preview-heading]").forEach((element) => element.style.fontFamily = headingFont);
    card.querySelectorAll("[data-preview-accent]").forEach((element) => element.style.background = s.loyalty_card_accent_color || "#CAE4B3");
  }
}
function resetOriginalDesignColours() {
  const originals = {
    theme_primary_color: "#4B5D3A", theme_background_color: "#F3EEE3",
    theme_card_color: "#FFFFFF", theme_text_color: "#2A2A22",
    loyalty_card_background: "#1E473E", loyalty_card_text_color: "#F9F4E8",
    loyalty_card_accent_color: "#CAE4B3"
  };
  Object.assign(astate.settingsDraft, originals);
  Object.entries(originals).forEach(([key,value]) => document.querySelectorAll(`[data-design-key="${key}"]`).forEach((input) => { input.value = value; }));
  updateDesignPreview();
}

function applyDesignPreset(name) {
  const presets = {
    elegant: { theme_heading_font:"fraunces", theme_body_font:"work_sans", theme_heading_size:25, theme_body_size:14, theme_product_name_size:15, theme_price_size:14, theme_button_size:14, welcome_title_font:"fraunces", welcome_body_font:"work_sans", welcome_title_size:39 },
    japanese: { theme_heading_font:"noto_serif_jp", theme_body_font:"noto_sans_jp", theme_heading_size:24, theme_body_size:14, theme_product_name_size:15, theme_price_size:14, theme_button_size:14, welcome_title_font:"noto_serif_jp", welcome_body_font:"noto_sans_jp", welcome_title_size:37 },
    clean: { theme_heading_font:"work_sans", theme_body_font:"work_sans", theme_heading_size:26, theme_body_size:15, theme_product_name_size:16, theme_price_size:15, theme_button_size:15, welcome_title_font:"work_sans", welcome_body_font:"work_sans", welcome_title_size:40 }
  };
  Object.assign(astate.settingsDraft, presets[name] || presets.elegant);
  render();
}

const SYSTEM_THEMES = {
  zen:{label:"Zen",note:"Quiet Japanese list",primary:"#4B5D3A",background:"#F3EEE3",card:"#FFFFFF",text:"#2A2A22",heading:"noto_serif_jp",body:"noto_sans_jp",menu:"list"},
  korean:{label:"Korean Minimal",note:"Soft banner and rounded cards",primary:"#9B8172",background:"#FAF7F2",card:"#F0EAE4",text:"#4B4742",heading:"work_sans",body:"work_sans",menu:"gallery"},
  editorial:{label:"Editorial Café",note:"Magazine-style monochrome menu",primary:"#111111",background:"#FFFFFF",card:"#FFFFFF",text:"#111111",heading:"georgia",body:"work_sans",menu:"list"},
  retro:{label:"Retro Menu Board",note:"Cream, brick red and printed edges",primary:"#9A3E2F",background:"#F4E1B8",card:"#FFF8E8",text:"#3D2B20",heading:"georgia",body:"work_sans",menu:"list"},
  threed:{label:"3D Bento",note:"Lavender tiles and raised controls",primary:"#6254A3",background:"#EEEAFB",card:"#FFFFFF",text:"#292638",heading:"work_sans",body:"work_sans",menu:"gallery"}
};

function applySystemTheme(name) {
  const theme = SYSTEM_THEMES[name] || SYSTEM_THEMES.zen;
  Object.assign(astate.settingsDraft, {system_theme:name,theme_primary_color:theme.primary,theme_background_color:theme.background,theme_card_color:theme.card,theme_text_color:theme.text,theme_heading_font:theme.heading,theme_body_font:theme.body,default_menu_view:theme.menu,admin_theme_primary:theme.primary,admin_theme_background:theme.background,admin_theme_card:theme.card,admin_theme_text:theme.text});
  render();
}

function themeMiniPreview(surface) {
  const heading = surface === "welcome" ? "Welcome" : surface === "order" ? "Ordering" : "Dashboard";
  const content = surface === "welcome" ? `<div class="theme-preview-window"><div style="font-family:Georgia,serif;font-size:13px;font-weight:700;">Welcome to Shizuku Lab</div><div class="theme-preview-row"></div><span class="theme-preview-button">Enter store</span></div>` : surface === "order" ? `<div class="theme-preview-window"><b>Shizuku Lab</b><div class="theme-preview-card">Ichigo Matcha <span style="float:right;">$6.90</span></div><span class="theme-preview-button">Add</span></div>` : `<div class="theme-preview-window" style="display:grid;grid-template-columns:34% 1fr;gap:6px;"><div style="border-right:1px solid currentColor;font-size:8px;">Dashboard<br><br>Orders<br><br>Products</div><div><b>Welcome back</b><div class="theme-preview-card">Today’s orders · 8</div></div></div>`;
  return `<div class="theme-preview-screen"><b>${heading}</b>${content}</div>`;
}

function renderThemeTab() {
  const current = astate.settingsDraft?.system_theme || "zen";
  return `<div style="display:grid;gap:16px;">${Object.entries(SYSTEM_THEMES).map(([name,theme]) => `<section class="dashboard-card theme-preview-theme-${name}" style="padding:20px;background:${theme.background};color:${theme.text};border-color:${theme.primary};"><div class="dashboard-card-head" style="padding:0 0 14px;"><div><h2 style="color:${theme.text};">${theme.label}</h2><span style="color:${theme.text};opacity:.7;">${theme.note}</span></div>${current === name ? `<span style="color:${theme.primary};font-weight:700;">Currently selected ✓</span>` : ""}</div><div class="theme-preview-grid">${themeMiniPreview("welcome")}${themeMiniPreview("order")}${themeMiniPreview("dashboard")}</div><button class="btn-primary" style="margin-top:14px;background:${theme.primary};color:${theme.background};" onclick="applySystemTheme('${name}')">${current === name ? "Selected" : "Apply theme"}</button></section>`).join("")}${cmsSaveButton()}</div>`;
}

function renderDesignTab() {
  const s = astate.settingsDraft || {};
  const color = (label,key,fallback) => `${key === "theme_primary_color" ? `<div style="grid-column:1/-1;"><div class="display" style="font-size:20px;margin-bottom:10px;">Menu display</div><div class="field"><label>Default customer menu view</label><select onchange="onSettingsField('default_menu_view',this.value)"><option value="list" ${(s.default_menu_view || "list") === "list" ? "selected" : ""}>List</option><option value="gallery" ${s.default_menu_view === "gallery" ? "selected" : ""}>Gallery</option></select></div><label class="slot" style="cursor:pointer;gap:10px;margin-bottom:14px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_menu_view_switch !== false ? "checked" : ""} onchange="onSettingsField('show_menu_view_switch',this.checked)"><span><b>Let customers switch between List and Gallery</b><br><span class="hint">Untick this to keep everyone on your selected default view.</span></span></label><div class="divider"></div></div>` : ""}<div class="field"><label>${label}</label><div style="display:grid;grid-template-columns:64px 1fr;gap:9px;"><input data-design-key="${key}" type="color" value="${escapeHtml(s[key] || fallback)}" oninput="onSettingsField('${key}',this.value);this.nextElementSibling.value=this.value;updateDesignPreview()"><input data-design-key="${key}" value="${escapeHtml(s[key] || fallback)}" oninput="onSettingsField('${key}',this.value);if(/^#[0-9a-fA-F]{6}$/.test(this.value)){this.previousElementSibling.value=this.value;updateDesignPreview()}"></div></div>`;
  const fonts = [["fraunces","Elegant serif · Fraunces"],["noto_serif_jp","Japanese serif · Noto Serif JP"],["work_sans","Clean sans · Work Sans"],["noto_sans_jp","Japanese sans · Noto Sans JP"],["georgia","Classic serif · Georgia"]];
  const select = (label,key,fallback) => `${key === "theme_heading_font" ? `<div style="grid-column:1/-1;"><div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:10px;">Recommended font styles</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px;"><button class="btn-secondary" onclick="applyDesignPreset('elegant')">Shizuku Elegant</button><button class="btn-secondary" onclick="applyDesignPreset('japanese')">Japanese Calm</button><button class="btn-secondary" onclick="applyDesignPreset('clean')">Clean Studio</button></div></div>` : ""}<div class="field"><label>${label}</label><select onchange="onSettingsField('${key}',this.value);updateDesignPreview()">${fonts.map(([v,n]) => `<option value="${v}" ${(s[key] || fallback) === v ? "selected" : ""}>${n}</option>`).join("")}</select></div>${key === "theme_body_font" ? `<div style="grid-column:1/-1;"><div class="display" style="font-size:20px;margin:8px 0 10px;">Font sizes</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">${size("Main heading","theme_heading_size",25,18,48)}${size("Body text","theme_body_size",14,12,22)}${size("Product name","theme_product_name_size",15,12,26)}${size("Price","theme_price_size",14,12,24)}${size("Buttons","theme_button_size",14,12,22)}${size("Welcome title","welcome_title_size",39,28,64)}</div></div>` : ""}`;
  const size = (label,key,fallback,min,max) => `<div class="field"><label>${label} <span style="float:right;color:#4B5D3A;">${Number(s[key] || fallback)} px</span></label><input type="range" min="${min}" max="${max}" step="1" value="${Number(s[key] || fallback)}" oninput="onSettingsField('${key}',Number(this.value));render()"></div>`;
  return `<section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Customer shop design</h2><span>Used across the ordering pages</span></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">${color("Primary colour","theme_primary_color","#4B5D3A")}${color("Background colour","theme_background_color","#F3EEE3")}${color("Card colour","theme_card_color","#FFFFFF")}${color("Text colour","theme_text_color","#2A2A22")}${select("Heading font","theme_heading_font","fraunces")}${select("Body font","theme_body_font","work_sans")}</div><div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px;">Loyalty card design</div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;">${color("Card background","loyalty_card_background","#1E473E")}${color("Card text","loyalty_card_text_color","#F9F4E8")}${color("Card accent","loyalty_card_accent_color","#CAE4B3")}</div><div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px;">Live preview</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:stretch;"><div id="design-shop-preview" style="background:${escapeHtml(s.theme_background_color || "#F3EEE3")};color:${escapeHtml(s.theme_text_color || "#2A2A22")};padding:20px;border-radius:20px;border:1px solid #e1d9c8;"><div data-preview-heading style="font-size:25px;font-weight:700;">${escapeHtml(s.store_name || "Your Store")}</div><div style="font-size:12px;opacity:.7;margin:3px 0 18px;">${escapeHtml(s.store_tagline || "crafted with care")}</div><div data-preview-card style="background:${escapeHtml(s.theme_card_color || "#FFFFFF")};border-radius:15px;padding:14px;box-shadow:0 8px 22px rgba(30,30,20,.08);"><div data-preview-heading style="font-size:18px;font-weight:700;">Ichigo Matcha Latte</div><div style="font-size:12px;opacity:.72;margin:5px 0 13px;">Freshly whisked matcha with creamy oat milk.</div><div style="display:flex;justify-content:space-between;align-items:center;"><b>$6.90</b><span data-preview-primary style="background:${escapeHtml(s.theme_primary_color || "#4B5D3A")};color:${escapeHtml(s.theme_background_color || "#F3EEE3")};padding:8px 15px;border-radius:99px;">Add</span></div></div></div><div id="design-loyalty-preview" style="background:${escapeHtml(s.loyalty_card_background || "#1E473E")};color:${escapeHtml(s.loyalty_card_text_color || "#F9F4E8")};padding:22px;border-radius:20px;box-shadow:0 12px 28px rgba(20,35,25,.16);"><div style="font-size:10px;letter-spacing:.15em;opacity:.75;">MEMBER</div><div data-preview-heading style="font-size:24px;font-weight:700;margin-top:8px;">${escapeHtml(s.loyalty_heading || "Shizuku Club")}</div><div style="font-size:13px;margin-top:8px;opacity:.9;">Welcome back, Shermin</div><div style="font-size:42px;font-weight:700;margin:22px 0 7px;">8 <span style="font-size:14px;">points</span></div><div style="height:9px;background:rgba(255,255,255,.2);border-radius:99px;overflow:hidden;"><div data-preview-accent style="width:64%;height:100%;background:${escapeHtml(s.loyalty_card_accent_color || "#CAE4B3")};border-radius:99px;"></div></div><div style="font-size:11px;margin-top:9px;opacity:.75;">8 / 50 points</div></div></div><div class="hint" style="text-align:left;margin-top:10px;">Changes appear here instantly. Press Save settings when you are happy with the design.</div>${cmsSaveButton()}</section>`;
}

function renderWordingTab() {
  return `<section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Customer wording</h2><span>Main customer-facing titles</span></div>${cmsField("Store name","store_name","Shizuku Lab")}${cmsField("Store tagline","store_tagline","雫ラボ · crafted drop by drop")}${cmsField("Menu heading","menu_heading","メニュー · DRINK MENU")}${cmsField("Reviews heading","reviews_heading","お客様の声 · REVIEWS")}${cmsField("Loyalty programme name","loyalty_heading","Shizuku Club")}${cmsField("Chat heading","chat_heading","Message us")}<div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:6px;">Track order wording</div><div class="hint" style="text-align:left;margin-bottom:14px;">Edit every main label and every order-status message shown to customers.</div>${cmsField("Page heading","track_order_heading","Track my order")}${cmsField("Intro sentence","track_intro_text","Enter either your order number or the phone number used at checkout.",2)}<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">${cmsField("Order number label","track_order_number_label","Order number")}${cmsField("Phone number label","track_phone_label","Phone number")}${cmsField("Between fields","track_or_text","OR")}${cmsField("Track button","track_button_text","Track order")}${cmsField("Live updates label","track_live_updates_text","LIVE UPDATES")}${cmsField("Refresh button","track_refresh_text","Refresh now")}${cmsField("Order detail label","track_order_label","Order")}${cmsField("Pickup detail label","track_pickup_label","Pickup")}${cmsField("Stage 1","track_stage_payment","Payment review")}${cmsField("Stage 2","track_stage_confirmed","Confirmed")}${cmsField("Stage 3","track_stage_preparing","Preparing")}${cmsField("Stage 4","track_stage_ready","Ready")}</div><div class="divider"></div>${trackStatusFields("Awaiting payment","track_awaiting","Awaiting payment","Please complete payment and submit your payment screenshot.")}${trackStatusFields("Payment under review","track_review","Payment under review","We’ll confirm your order once your payment proof is verified.")}${trackStatusFields("Order confirmed","track_confirmed","Order confirmed","Payment verified — we’ll prepare your order closer to pickup.")}${trackStatusFields("Preparing","track_preparing","Preparing your order","We’re freshly preparing your drinks now.")}${trackStatusFields("Ready","track_ready","Ready for collection","Your order is ready — see you at your pickup time!")}${trackStatusFields("Collected","track_collected","Collected with care ✨","We hope you enjoyed every sip. Looking forward to making your next Shizuku drink.")}${trackStatusFields("Cancelled","track_cancelled","Order cancelled","This order can no longer accept payment. Please place a new order.")}${trackStatusFields("Payment rejected","track_rejected","Payment proof needs attention","Please upload a new payment screenshot.")}${cmsSaveButton()}</section>`;
}

function trackStatusFields(label, prefix, title, note) {
  return `<div class="display" style="font-size:16px;margin:14px 0 8px;">${label}</div><div style="display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:12px;">${cmsField("Title",`${prefix}_title`,title)}${cmsField("Sentence",`${prefix}_note`,note,2)}</div>`;
}

function renderCheckoutCommunicationTab() {
  return `<section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Checkout fields</h2><span>Choose what customers see</span></div>${cmsToggle("Show customer email field","show_checkout_email","Customers can enter an email to receive order updates.")}${cmsToggle("Show Instagram field","show_checkout_instagram","Optional Instagram handle at Checkout.")}${cmsToggle("Show Notes field","show_checkout_notes","For allergies, ice level or special requests.")}<div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px;">Receipt after payment</div>${cmsToggle("Show receipt option","show_customer_receipt","After submitting payment, customers can view, print or save their receipt.")}${cmsField("Receipt button text","receipt_button_text","View receipt")}<div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px;">Payment wording</div>${cmsField("Payment instructions","payment_instructions","Scan with your banking app, or PayNow to the account below.",3)}<div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px;">Live chat</div>${cmsToggle("Enable order live chat","chat_enabled","Only customers who can verify an order can open its chat.")}${cmsField("Chat heading","chat_heading","Message us")}${cmsField("Automatic reply","chat_auto_reply","Thanks for your message. We will reply as soon as possible.",3)}${cmsField("Chat business hours","chat_business_hours","e.g. Replies daily, 10 AM – 8 PM")}<div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px;">Customer reviews</div>${cmsToggle("Enable customer reviews","reviews_enabled","Collected and paid orders can submit a review.")}${cmsField("Reviews heading","reviews_heading","お客様の声 · REVIEWS")}${cmsSaveButton()}</section>`;
}

function renderPaymentPageTab() {
  const s = astate.settingsDraft || {};
  const size = Math.max(150, Math.min(300, Number(s.payment_qr_size || 220)));
  return `<section class="dashboard-card" style="padding:20px;max-width:900px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Payment page layout</h2><span>Choose what customers see</span></div>${cmsToggle("Use compact layout","payment_compact_layout","Reduces spacing so the screenshot upload appears sooner.")}<div class="field"><label>QR size <span id="payment-qr-size-value" style="float:right;font-weight:600;color:#4B5D3A;">${size} px</span></label><input type="range" min="150" max="300" step="10" value="${size}" oninput="onSettingsField('payment_qr_size',Number(this.value));document.getElementById('payment-qr-size-value').textContent=this.value+' px'"></div>${cmsField("Payment instructions","payment_instructions","Scan with your banking app, or PayNow to the account below.",3)}${cmsToggle("Show order details","show_payment_order_details","Shows order number, amount and collection point.")}${cmsToggle("Show payment reference","show_payment_transaction_reference","Shows the reference instruction and optional transaction reference field.")}${cmsToggle("Show Instagram DM help","show_instagram_payment_help","Shows the upload-problem button and opens Instagram after submission.")}${cmsField("Submit button text","payment_submit_button_text","Submit payment proof")}<div class="hint" style="text-align:left;margin-top:8px;">The payment screenshot remains required for payment verification.</div>${cmsSaveButton()}</section>`;
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
    cells.push(`<button class="slot availability-day" style="min-height:70px;padding:8px;text-align:left;display:block;border-color:${isSelected ? "#4B5D3A" : "#E1D9C8"};background:${isSelected ? "#F1F5EA" : "#fff"};" onclick="selectAvailabilityDate('${dateText}')"><b>${day}</b><br><span style="font-size:11px;color:${color};">${label}</span></button>`);
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
    <style>.availability-week,.availability-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;width:100%;min-width:0}.availability-week{text-align:center;margin-bottom:6px;color:#777064;font-size:12px}.availability-day{width:100%;min-width:0;overflow:hidden}@media(max-width:640px){.availability-week,.availability-calendar{gap:3px}.availability-week{font-size:9px}.availability-day{min-height:54px!important;padding:5px 3px!important;font-size:11px}.availability-day span{display:block;font-size:8px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}</style>
    <div class="availability-week"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
    <div class="availability-calendar">${cells.join("")}</div>
    <div class="order-card" style="margin-top:16px;">
      <div class="order-top"><b>${escapeHtml(selected.collection_date)}</b><span class="hint">${existing ? "Special calendar setting" : "Normal weekly schedule"}</span></div>
      <label class="slot" style="cursor:pointer;gap:10px;margin:12px 0;">
        <input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${selected.is_open ? "checked" : ""} onchange="onAvailabilityField('is_open', this.checked)">
        <span><b>Open for pickup</b><br><span class="hint">Untick to close this date.</span></span>
      </label>
      <div class="field"><label>Pickup windows for this date</label><div class="hint" style="text-align:left;margin:0 0 8px;">You can open more than one window, e.g. 10:00 AM – 12:00 PM and 4:00 PM – 6:00 PM.</div>${availabilityRanges(selected.collection_time).map((range, index) => `<div style="display:flex;gap:8px;margin:8px 0;"><input value="${escapeHtml(range)}" placeholder="10:00 AM - 12:00 PM" oninput="setAvailabilityRange(${index}, this.value)">${availabilityRanges(selected.collection_time).length > 1 ? `<button class="btn-secondary" style="flex:0 0 auto;padding:0 12px;" onclick="removeAvailabilityRange(${index})">Remove</button>` : ""}</div>`).join("")}<button class="link-btn" style="padding:3px 0;" onclick="addAvailabilityRange()">+ Add another pickup window</button></div>
      <div class="btn-row"><button class="btn-primary" id="availability-save-btn" onclick="saveAvailabilityOverride()">Save day</button>${existing ? `<button class="btn-secondary" onclick="clearAvailabilityOverride()">Use weekly schedule</button>` : ""}</div>
    </div>
  `;
}

function renderEditOverlay() {
  if (astate.editingOrder) return renderOrderEditor();
  if (!astate.editing) return "";
  const item = astate.editing;
  return `
  <div class="overlay">
    <div class="overlay-card" style="max-height:80vh;overflow-y:auto;">
      <div class="display overlay-title" style="font-size:18px;">${astate.menu.some(m => String(m.id) === String(item.id)) ? "Edit item" : "New item"}</div>
      <div class="field"><label>Name</label><input value="${item.name}" oninput="onEditField('name', this.value)"></div>
      <div class="field"><label>Product group</label><select onchange="onEditGroup(this.value)"><option value="">Other</option>${astate.productGroups.map((group) => `<option value="${group.id}" ${String(item.group_id) === String(group.id) ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}</select><div class="hint" style="text-align:left;margin-top:5px;">Shown as a large group heading on the ordering page.</div></div>
      <div class="field"><label>Description</label><textarea rows="2" oninput="onEditField('description', this.value)">${item.description || ""}</textarea></div>
      <div class="field"><label>Original price (SGD)</label><input type="number" min="0" step="0.01" value="${item.price}" oninput="onEditField('price', this.value)"></div>
      <div class="field"><label>Discount price (SGD, optional)</label><input type="number" min="0" step="0.01" value="${item.discount_price ?? ""}" placeholder="Leave blank if there is no sale" oninput="onEditField('discount_price', this.value)"><div class="hint" style="text-align:left;margin-top:5px;">Customers will see the original price crossed out and the discount price in green.</div></div>
      <div class="field"><label>Product image</label><input value="${item.image_url || ""}" placeholder="Upload below or paste image URL" oninput="onEditField('image_url', this.value)"><input type="file" accept="image/*" style="margin-top:8px;" onchange="uploadStorefrontImage(this,'products')">${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="Product preview" style="display:block;width:100%;height:150px;object-fit:cover;border:1px solid #E1D9C8;border-radius:12px;margin-top:8px;">` : ""}</div>
      <div class="field"><label>Weekly starting stock</label><input type="number" min="0" value="${item.stock || 0}" oninput="onEditField('stock', this.value)"><div class="hint" style="text-align:left;margin-top:5px;">Available stock refreshes automatically every Monday. Orders from previous weeks will not reduce this week's stock.</div></div>
      <div class="field" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="bundle-check" ${item.is_bundle ? "checked" : ""} onchange="onEditField('is_bundle', this.checked);render()" style="width:auto;"><label style="margin:0;" for="bundle-check">This is a Bundle of Two</label></div>
      <div class="field"><label>Customisation shown for this drink</label><div class="hint" style="text-align:left;margin:0 0 7px;">Tick only the options that apply. Unticked groups will not appear to customers.</div>${astate.optionGroups.filter((group) => group.is_visible !== false).map((group) => `<label class="slot" style="cursor:pointer;gap:10px;margin:7px 0;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${(item.enabled_option_group_ids || []).map(String).includes(String(group.id)) ? "checked" : ""} onchange="toggleProductOptionGroup('${group.id}',this.checked)"><span>${escapeHtml(group.name)}</span></label>`).join("")}</div>
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

function renderOrderEditor() {
  const order = astate.editingOrder;
  const items = order.order_items || [];
  const subtotal = (items || []).filter((item) => !item._removed).reduce((sum,item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),0);
  const discount = editedOrderDiscount(order, subtotal);
  const editablePoints = [...new Set([...(Array.isArray(astate.settings?.collection_points) ? astate.settings.collection_points : ["Blk 130A","Near Creamier"]), order.collection_point].filter(Boolean))];
  return `<div class="overlay"><div class="overlay-card" style="max-width:720px;max-height:88vh;overflow-y:auto"><div class="display overlay-title" style="font-size:20px">Edit ${escapeHtml(order.order_number || "order")}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label>Customer name</label><input value="${escapeHtml(order.customer_name || "")}" oninput="editOrderField('customer_name',this.value)"></div><div class="field"><label>Phone</label><input value="${escapeHtml(order.customer_phone || "")}" oninput="editOrderField('customer_phone',this.value)"></div><div class="field"><label>Instagram</label><input value="${escapeHtml(order.instagram || "")}" oninput="editOrderField('instagram',this.value)"></div><div class="field"><label>Collection date</label><input type="date" value="${escapeHtml(order.collection_date || "")}" oninput="editOrderField('collection_date',this.value)"></div><div class="field"><label>Collection time</label><input value="${escapeHtml(order.collection_time || "")}" oninput="editOrderField('collection_time',this.value)"></div><div class="field"><label>Collection point</label><select onchange="editOrderField('collection_point',this.value)">${editablePoints.map((point) => `<option value="${escapeHtml(point)}" ${order.collection_point === point ? "selected" : ""}>${escapeHtml(point)}</option>`).join("")}</select></div></div><div class="divider"></div><div class="order-top"><b>Order items</b><button class="link-btn" onclick="addOrderItem()">+ Add item</button></div>${items.map((item,index) => item._removed ? "" : `<div style="border:1px solid #e8ded1;border-radius:13px;padding:12px;margin:10px 0"><div class="field"><label>Product</label><select onchange="chooseOrderItemProduct(${index},this.value)">${astate.menu.map((product) => `<option value="${product.id}" ${String(product.id) === String(item.product_id) ? "selected" : ""}>${escapeHtml(product.name)}</option>`).join("")}</select></div><div style="display:grid;grid-template-columns:1fr 1fr auto;gap:9px;align-items:end"><div class="field" style="margin:0"><label>Quantity</label><input type="number" min="1" value="${Number(item.quantity || 1)}" oninput="editOrderItem(${index},'quantity',this.value)"></div><div class="field" style="margin:0"><label>Unit price ($)</label><input type="number" min="0" step="0.01" value="${Number(item.unit_price || 0)}" oninput="editOrderItem(${index},'unit_price',this.value)"></div><button class="link-danger" onclick="removeOrderItem(${index})">Remove</button></div>${(item.order_item_options || []).length ? `<div class="hint" style="text-align:left;margin-top:8px">Options: ${item.order_item_options.map((option) => escapeHtml(option.option_name)).join(", ")}</div>` : ""}</div>`).join("")}<div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>${order._promoCode ? `<div class="row" style="color:#A36D1E"><span>Promo · ${escapeHtml(order._promoCode)}</span><span>−${money(discount)}</span></div>` : ""}<div class="row bold" style="margin:8px 0 14px"><span>Total</span><span>${money(Math.max(0,subtotal-discount))}</span></div><div class="field"><label>Customer notes</label><textarea rows="3" oninput="editOrderField('notes',this.value)">${escapeHtml(order.notes || "")}</textarea></div><div class="btn-row"><button class="btn-secondary" onclick="closeOrderEditor()">Cancel</button><button class="btn-primary" id="save-edited-order" onclick="saveEditedOrder()">Save order</button></div></div></div>`;
}

function render() {
  const app = document.getElementById("app");
  if (!astate.unlocked) { app.innerHTML = renderLogin(); return; }
  if (astate.welcomePending) { app.innerHTML = renderAdminWelcome(); return; }
  if (astate.loading) { app.innerHTML = header("") + `<div class="loading">Loading…</div>`; return; }
  const nav = [
    ["dashboard", "▦", "Dashboard"],
    ["orders", "▣", "Orders"],
    ["preparation", "☷", "Today's prep"],
    ["menu", "◇", "Products"],
    ["inventory", "▤", "Inventory & cost"],
    ["promos", "✦", "Promos"],
    ["rewards", "♧", "Rewards"],
    ["customers", "◉", "Customers"],
    ["messages", "✉", `Messages${unreadMessageCount() ? ` (${unreadMessageCount()})` : ""}`],
    ["reviews", "★", "Reviews"],
    ["availability", "◷", "Availability"],
    ["faq", "?", "FAQ"],
    ["notifications", "🔔", "Notifications"],
    ["theme", "◈", "Theme"],
    ["design", "◐", "Design"],
    ["wording", "Aa", "Customer wording"],
    ["checkout_comms", "☏", "Checkout & chat"],
    ["settings", "⚙", "Store settings"],
  ];
  const tabTitle = { preparation: "Today's preparation", orders: "Orders", menu: "Products", inventory: "Inventory & food cost", promos: "Promos", rewards: "Rewards", customers: "Customers", messages: "Messages", reviews: "Reviews", availability: "Availability", faq: "FAQ", notifications: "Notifications", theme: "Theme", design: "Design", wording: "Customer wording", checkout_comms: "Checkout & communication", settings: "Store settings" };
  const tabSubtitle = { preparation: "See every paid drink to prepare and print today's list.", orders: "Review payments and edit every customer order.", menu: "Keep your drinks, prices and availability up to date.", inventory: "Track ingredient stock and calculate each product's food cost.", promos: "Create discounts customers can use at checkout.", rewards: "Choose a stamp card or points programme for repeat customers.", customers: "See every customer and save private remarks.", messages: "Read and reply to order-linked customer messages.", reviews: "Approve the customer reviews shown on your ordering page.", availability: "Choose your pickup window and collection calendar.", faq: "Edit the answers customers see on your ordering page.", notifications: "Choose where you receive new-order alerts.", design: "Change the customer shop and loyalty card colours and fonts.", wording: "Edit the main words customers see across your shop.", checkout_comms: "Control checkout fields, payment wording, chat and reviews.", settings: "Manage your store details, images, contact information and payment details." };
  const page = astate.tab === "dashboard" ? renderDashboardTab() : `
    <div class="admin-top"><div><div class="admin-eyebrow">Shizuku Lab admin</div><h1 class="tab-page-title">${tabTitle[astate.tab] || "Dashboard"}</h1><p class="tab-page-subtitle">${tabSubtitle[astate.tab] || ""}</p></div><a class="open-shop" href="order.html">Open customer shop ↗</a></div>
    <div class="admin-content">
      ${astate.tab === "preparation" ? renderPreparationTab() : astate.tab === "orders" ? renderOrders() : astate.tab === "menu" ? renderMenuTab() : astate.tab === "inventory" ? renderInventoryTab() : astate.tab === "promos" ? renderPromosTab() : astate.tab === "rewards" ? renderRewardsTab() : astate.tab === "customers" ? renderCustomersTab() : astate.tab === "messages" ? renderMessagesTab() : astate.tab === "reviews" ? renderReviewsTab() : astate.tab === "availability" ? renderAvailabilityTab() : astate.tab === "faq" ? renderFaqTab() : astate.tab === "notifications" ? renderNotificationsTab() : astate.tab === "theme" ? renderThemeTab() : astate.tab === "design" ? renderDesignTab() : astate.tab === "wording" ? renderWordingTab() : astate.tab === "checkout_comms" ? renderCheckoutCommunicationTab() : renderSettingsTab()}
    </div>`;
  app.innerHTML = `
    ${dashboardStyles()}
    <div class="shop-admin theme-${escapeHtml(astate.settingsDraft?.system_theme || "zen")} ${(astate.settings?.admin_mobile_nav_position || "left") === "top" ? "mobile-nav-top" : "mobile-nav-left"} ${astate.navCollapsed ? "nav-collapsed" : ""}">
      <aside class="admin-side"><button class="admin-collapse-toggle" onclick="toggleAdminNav()" title="${astate.navCollapsed ? "Expand menu" : "Collapse menu"}" aria-label="${astate.navCollapsed ? "Expand menu" : "Collapse menu"}">${astate.navCollapsed ? "›" : "‹"}</button><div class="admin-logo">${(astate.settings && escapeHtml(astate.settings.store_name)) || "Shizuku Lab"}</div><div class="admin-caption">SHOP ADMIN</div><div class="admin-nav-label">MAIN</div><nav class="admin-nav">${nav.map(([tab, icon, label]) => `<button class="${astate.tab === tab ? "active" : ""}" onclick="setTab('${tab}')"><span class="nav-icon">${icon}</span><span class="nav-text">${label}</span></button>`).join("")}</nav><div class="admin-side-bottom"><button class="link-btn" onclick="logoutAdmin()">Sign out</button></div></aside>
      <main class="admin-main">${!IS_CONFIGURED ? `<div class="setup-banner">Demo mode — connect Supabase in <code>config.js</code> to see real orders and save changes.</div>` : ""}${astate.loadError ? `<div class="setup-banner" style="border-color:#B33;background:#FBEAEA;color:#7a1f1f;">Could not load data: <code>${astate.loadError}</code></div>` : ""}${astate.newMessageAlert ? `<div class="new-order-alert" role="alert"><div><strong>New customer message</strong><span>${escapeHtml(astate.newMessageAlert.orderNumber)} · ${escapeHtml(astate.newMessageAlert.text)}</span></div><div style="display:flex;gap:8px;"><button class="btn-primary" onclick="astate.newMessageAlert=null;setTab('messages')">Open message</button><button class="btn-secondary" onclick="astate.newMessageAlert=null;render()">Dismiss</button></div></div>` : ""}${astate.newOrderAlert ? `<div class="new-order-alert" role="alert"><div><strong>New order received</strong><span>${escapeHtml(astate.newOrderAlert.orderNumber)} · ${escapeHtml(astate.newOrderAlert.customer)} · ${money(astate.newOrderAlert.total)}</span></div><div style="display:flex;gap:8px;"><button class="btn-primary" onclick="setTab('orders')">Open order</button><button class="btn-secondary" onclick="dismissNewOrderAlert()">Dismiss</button></div></div>` : ""}${page}</main>
    </div>
    ${renderEditOverlay()}
  `;
  if (astate.tab === "design") requestAnimationFrame(updateDesignPreview);
}

if (db) {
  db.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      astate.recoveryMode = true;
      astate.unlocked = false;
      render();
    }
  });
}
render();
checkAdminSession();
