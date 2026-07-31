/* Shizuku Lab — shop dashboard (wired to real Supabase schema) */

const astate = {
  unlocked: false,
  pin: "",
  pinError: false,
  tab: "orders",
  orders: [],
  menu: [],
  settings: null,
  settingsDraft: null,
  loading: true,
  loadError: null,
  editing: null,
};

function money(n) { return `$${Number(n).toFixed(2)}`; }

const PAY_LABEL = { unpaid: "Awaiting payment", pending_confirmation: "Payment sent — pending confirmation", paid: "Paid" };
const PAY_COLOR = { unpaid: "#B78A2E", pending_confirmation: "#B78A2E", paid: "#4B5D3A" };
const ORDER_LABEL = { pending: "Pending", confirmed: "Confirmed", collected: "Collected" };

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

      const { data: settingsRows } = await db.from("store_settings").select("*").limit(1);
      astate.settings = (settingsRows && settingsRows[0]) || null;
      astate.settingsDraft = astate.settings ? { ...astate.settings } : null;
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

async function updatePaymentStatus(id, payment_status) {
  astate.orders = astate.orders.map((o) => (String(o.id) === String(id) ? { ...o, payment_status } : o));
  render();
  if (IS_CONFIGURED) await db.from("orders").update({ payment_status }).eq("id", id);
}
async function updateOrderStatus(id, order_status) {
  astate.orders = astate.orders.map((o) => (String(o.id) === String(id) ? { ...o, order_status } : o));
  render();
  if (IS_CONFIGURED) await db.from("orders").update({ order_status }).eq("id", id);
}

/* ---- menu (products) CRUD — unchanged from before ---- */
function newMenuItem() {
  astate.editing = { id: null, category: "Signature", name: "", description: "", price: 0, image_url: "", is_available: true, stock: 0 };
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

function renderOrders() {
  if (astate.orders.length === 0) return `<div class="empty">No orders yet.</div>`;
  return astate.orders.map((o) => `
    <div class="order-card">
      <div class="order-top">
        <div class="mono">${o.order_number || o.id}</div>
        <div class="status-tag" style="color:${PAY_COLOR[o.payment_status] || "#8A8478"}">${PAY_LABEL[o.payment_status] || o.payment_status || "—"}</div>
      </div>
      <div class="order-meta">${o.customer_name || ""} · ${o.customer_contact || ""}${o.instagram ? " · @" + o.instagram : ""}</div>
      <div class="order-meta">Pickup: ${o.collection_date || ""} ${o.collection_time || ""}</div>
      <div class="order-meta">Order status: <b>${ORDER_LABEL[o.order_status] || o.order_status || "—"}</b></div>
      <div style="margin-top:8px;">
        ${(o.order_items || []).map((it) => `
          <div class="row"><span>${it.product_name} × ${it.quantity}</span><span>${money(it.subtotal)}</span></div>
          ${(it.order_item_options || []).length ? `<div class="hint" style="margin:0 0 4px;text-align:left;">${it.order_item_options.map((op) => op.option_name).join(", ")}</div>` : ""}
        `).join("")}
      </div>
      ${o.notes ? `<div class="ref-note">Note: ${o.notes}</div>` : ""}
      <div class="divider"></div>
      <div class="row bold"><span class="label">Total</span><span>${money(o.total)}</span></div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        ${o.payment_status === "pending_confirmation" ? `<button class="small-btn" onclick="updatePaymentStatus('${o.id}','paid')">Confirm payment</button>` : ""}
        ${o.payment_status === "unpaid" ? `<span class="hint" style="margin:0;">Waiting on customer to pay</span>` : ""}
        ${o.payment_status === "paid" && o.order_status !== "collected" ? `<button class="small-btn" onclick="updateOrderStatus('${o.id}','collected')">Mark collected</button>` : ""}
      </div>
    </div>
  `).join("");
}

function renderMenuTab() {
  return `
    ${astate.menu.map((item) => `
      <div class="order-card">
        <div class="order-top">
          <div>
            <div style="font-size:14px;font-weight:600;">${item.name}</div>
            <div class="order-meta">${item.category} · ${money(item.price)}</div>
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

function renderSettingsTab() {
  if (!astate.settingsDraft) return `<div class="empty">No store_settings row found. Add one in Supabase, then refresh.</div>`;
  const s = astate.settingsDraft;
  const field = (label, key, placeholder = "") => `
    <div class="field"><label>${label}</label><input value="${s[key] || ""}" placeholder="${placeholder}" oninput="onSettingsField('${key}', this.value)"></div>`;
  return `
    ${field("Store name", "store_name")}
    ${field("Instagram (without @)", "instagram")}
    ${field("PayNow name", "paynow_name")}
    ${field("PayNow number", "paynow_number", "+65 9XXX XXXX")}
    ${field("PayNow URL (optional)", "paynow_url")}
    ${field("Collection address", "collection_address")}
    ${field("Saturday collection time", "saturday_collection_time", "10:00 AM - 12:00 PM")}
    ${field("Sunday collection time", "sunday_collection_time", "10:00 AM - 1:00 PM")}
    <button class="btn-primary" id="settings-save-btn" style="width:100%;margin-top:8px;" onclick="saveSettings()">Save settings</button>
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
      <div class="field"><label>Category</label><input value="${item.category || ''}" oninput="onEditField('category', this.value)"></div>
      <div class="field"><label>Description</label><textarea rows="2" oninput="onEditField('description', this.value)">${item.description || ""}</textarea></div>
      <div class="field"><label>Price (SGD)</label><input type="number" step="0.1" value="${item.price}" oninput="onEditField('price', this.value)"></div>
      <div class="field"><label>Image path or URL</label><input value="${item.image_url || ""}" placeholder="your-photo.jpg" oninput="onEditField('image_url', this.value)"></div>
      <div class="field"><label>Stock</label><input type="number" value="${item.stock || 0}" oninput="onEditField('stock', this.value)"></div>
      <div class="field" style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="avail-check" ${item.is_available ? "checked" : ""} onchange="onEditField('is_available', this.checked)" style="width:auto;">
        <label style="margin:0;" for="avail-check">Available on menu</label>
      </div>
      <div class="hint" style="text-align:left;margin-bottom:0;">To add a new photo: upload the image file to the same GitHub folder as the other photos, then reference it here as <code>filename.jpg</code>.</div>
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
  app.innerHTML = `
    ${header(`${astate.orders.length} order${astate.orders.length === 1 ? "" : "s"} total`)}
    ${!IS_CONFIGURED ? `<div class="setup-banner">Demo mode — connect Supabase in <code>config.js</code> to see real orders and save changes.</div>` : ""}
    ${astate.loadError ? `<div class="setup-banner" style="border-color:#B33;background:#FBEAEA;color:#7a1f1f;">Could not load data: <code>${astate.loadError}</code></div>` : ""}
    <div class="tabs">
      <button class="pill ${astate.tab === "orders" ? "active" : ""}" onclick="astate.tab='orders'; render();">Orders</button>
      <button class="pill ${astate.tab === "menu" ? "active" : ""}" onclick="astate.tab='menu'; render();">Menu</button>
      <button class="pill ${astate.tab === "settings" ? "active" : ""}" onclick="astate.tab='settings'; render();">Settings</button>
      <button class="link-btn" style="margin-left:auto;" onclick="loadAll()">Refresh</button>
    </div>
    <div class="screen">
      ${astate.tab === "orders" ? renderOrders() : astate.tab === "menu" ? renderMenuTab() : renderSettingsTab()}
    </div>
    ${renderEditOverlay()}
    <div class="footer-link"><a href="index.html"><button>Exit shop view</button></a></div>
  `;
}

render();
