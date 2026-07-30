/* Shizuku Lab — shop dashboard */

const astate = {
  unlocked: false,
  pin: "",
  pinError: false,
  tab: "orders",
  orders: [],
  menu: [],
  loading: true,
  editing: null,
};

function money(n) { return `$${Number(n).toFixed(2)}`; }

const STATUS_LABEL = {
  awaiting_payment: "Awaiting payment",
  awaiting_confirmation: "Payment sent — pending confirmation",
  confirmed: "Confirmed",
  fulfilled: "Collected",
};
const STATUS_COLOR = {
  awaiting_payment: "#B78A2E",
  awaiting_confirmation: "#B78A2E",
  confirmed: "#4B5D3A",
  fulfilled: "#8A8478",
};

async function loadAll() {
  astate.loading = true; render();
  if (IS_CONFIGURED) {
    const [{ data: orders }, { data: menu }] = await Promise.all([
      db.from("order").select("*").order("created_at", { ascending: false }),
      db.from("product").select("*").order("category"),
    ]);
    astate.orders = orders || [];
    astate.menu = menu || [];
  } else {
    astate.orders = [];
    astate.menu = [];
  }
  astate.loading = false;
  render();
}

async function updateOrderStatus(id, status) {
  astate.orders = astate.orders.map((o) => (o.id === id ? { ...o, status } : o));
  render();
  if (IS_CONFIGURED) await db.from("order").update({ status }).eq("id", id);
}

function newMenuItem() {
  astate.editing = { id: null, category: "Signature", name: "", description: "", price: 0, image_url: "", is_available: true, stock: 0 };
  render();
}
function editMenuItem(id) {
  astate.editing = { ...astate.menu.find((m) => m.id === id) };
  render();
}
function cancelEdit() { astate.editing = null; render(); }
function onEditField(key, value) {
  if (key === "price" || key === "stock") astate.editing[key] = parseFloat(value) || 0;
  else if (key === "is_available") astate.editing[key] = value;
  else astate.editing[key] = value;
}

async function saveMenuItem() {
  const item = astate.editing;
  if (!item.name.trim()) { alert("Name is required."); return; }

  if (!IS_CONFIGURED) { alert("Demo mode: connect Supabase to persist menu changes."); astate.editing = null; render(); return; }

  if (item.id) {
    // existing product — update
    const { id, ...fields } = item;
    const { error } = await db.from("product").update(fields).eq("id", id);
    if (error) { alert("Could not save to Supabase: " + error.message); return; }
    astate.menu = astate.menu.map((m) => (m.id === id ? item : m));
  } else {
    // new product — let Supabase generate the id
    const { id, ...fields } = item;
    const { data, error } = await db.from("product").insert(fields).select().single();
    if (error) { alert("Could not save to Supabase: " + error.message); return; }
    astate.menu = [...astate.menu, data];
  }
  astate.editing = null;
  render();
}
async function deleteMenuItem(id) {
  if (!confirm("Delete this item?")) return;
  astate.menu = astate.menu.filter((m) => m.id !== id);
  render();
  if (IS_CONFIGURED) await db.from("product").delete().eq("id", id);
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
        <div class="display brand-title">Shizuku Lab — Shop</div>
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
        <div class="mono">${o.id}</div>
        <div class="status-tag" style="color:${STATUS_COLOR[o.status]}">${STATUS_LABEL[o.status] || o.status}</div>
      </div>
      <div class="order-meta">${o.customer_name} · ${o.phone} · ${o.pickup_label || ""} ${o.pickup_time || ""}</div>
      <div style="margin-top:8px;">
        ${(o.items || []).map((it) => `<div class="row"><span>${it.name} × ${it.qty}</span><span>${money(it.price * it.qty)}</span></div>`).join("")}
      </div>
      ${o.notes ? `<div class="ref-note">Note: ${o.notes}</div>` : ""}
      <div class="divider"></div>
      <div class="row bold"><span class="label">Total</span><span>${money(o.total)}</span></div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        ${o.status === "awaiting_confirmation" ? `<button class="small-btn" onclick="updateOrderStatus('${o.id}','confirmed')">Confirm payment</button>` : ""}
        ${o.status === "confirmed" ? `<button class="small-btn" onclick="updateOrderStatus('${o.id}','fulfilled')">Mark collected</button>` : ""}
        ${o.status === "awaiting_payment" ? `<span class="hint" style="margin:0;">Waiting on customer to pay</span>` : ""}
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

function renderEditOverlay() {
  if (!astate.editing) return "";
  const item = astate.editing;
  return `
  <div class="overlay">
    <div class="overlay-card" style="max-height:80vh;overflow-y:auto;">
      <div class="display overlay-title" style="font-size:18px;">${astate.menu.some(m => m.id === item.id) ? "Edit item" : "New item"}</div>
      <div class="field"><label>Name</label><input value="${item.name}" oninput="onEditField('name', this.value)"></div>
      <div class="field"><label>Category</label><input value="${item.category}" oninput="onEditField('category', this.value)"></div>
      <div class="field"><label>Description</label><textarea rows="2" oninput="onEditField('description', this.value)">${item.description || ""}</textarea></div>
      <div class="field"><label>Price (SGD)</label><input type="number" step="0.1" value="${item.price}" oninput="onEditField('price', this.value)"></div>
      <div class="field"><label>Image path or URL</label><input value="${item.image_url || ""}" placeholder="images/your-photo.jpg" oninput="onEditField('image_url', this.value)"></div>
      <div class="field"><label>Stock</label><input type="number" value="${item.stock || 0}" oninput="onEditField('stock', this.value)"></div>
      <div class="field" style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="avail-check" ${item.is_available ? "checked" : ""} onchange="onEditField('is_available', this.checked)" style="width:auto;">
        <label style="margin:0;" for="avail-check">Available on menu</label>
      </div>
      <div class="hint" style="text-align:left;margin-bottom:0;">To add a new photo: upload the file into the site's <code>images/</code> folder via your host, then reference it here as <code>images/filename.jpg</code>.</div>
      <div class="btn-row" style="margin-top:14px;">
        <button class="btn-secondary" onclick="cancelEdit()">Cancel</button>
        <button class="btn-primary" onclick="saveMenuItem()">Save</button>
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
    ${!IS_CONFIGURED ? `<div class="setup-banner">Demo mode — connect Supabase in <code>js/config.js</code> to see real orders and save menu changes. See <code>README.md</code>.</div>` : ""}
    <div class="tabs">
      <button class="pill ${astate.tab === "orders" ? "active" : ""}" onclick="astate.tab='orders'; render();">Orders</button>
      <button class="pill ${astate.tab === "menu" ? "active" : ""}" onclick="astate.tab='menu'; render();">Menu</button>
      <button class="link-btn" style="margin-left:auto;" onclick="loadAll()">Refresh</button>
    </div>
    <div class="screen">
      ${astate.tab === "orders" ? renderOrders() : renderMenuTab()}
    </div>
    ${renderEditOverlay()}
    <div class="footer-link"><a href="index.html"><button>Exit shop view</button></a></div>
  `;
}

render();
