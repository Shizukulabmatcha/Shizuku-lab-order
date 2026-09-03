(() => {
  const ctx = window.HBBDemoContext;

  if (!ctx) {
    console.error("HBBDemoContext is required before loading orders module.");
    return;
  }

  const state = ctx.state;
  const market = ctx.market;
  const money = (value) => ctx.money(value);

  /* =========================================================
     ORDERS SEED
  ========================================================= */

  const defaultOrders = [
    {
      id: "ORD-1001",
      customerName: "Amanda Lee",
      customerEmail: "amanda@example.com",
      createdAt: new Date(
        Date.now() - 2 * 60 * 60 * 1000
      ).toISOString(),
      collectionDate: new Date().toISOString().slice(0, 10),
      collectionTime: "15:00",
      status: "waiting",
      items: [
        {
          productId: "demo-2",
          name: "Matcha Madeleines",
          qty: 2,
          price: market === "MY" ? 21 : 6.8
        }
      ]
    },

    {
      id: "ORD-1002",
      customerName: "Rachel Tan",
      customerEmail: "rachel@example.com",
      createdAt: new Date(
        Date.now() - 26 * 60 * 60 * 1000
      ).toISOString(),
      collectionDate: new Date(
        Date.now() + 86400000
      ).toISOString().slice(0, 10),
      collectionTime: "11:00",
      status: "confirmed",
      items: [
        {
          productId: "demo-1",
          name: "Brown Butter Financier",
          qty: 3,
          price: market === "MY" ? 14 : 4.5
        },
        {
          productId: "demo-2",
          name: "Matcha Madeleines",
          qty: 1,
          price: market === "MY" ? 21 : 6.8
        }
      ]
    },

    {
      id: "ORD-1003",
      customerName: "Sarah Lim",
      customerEmail: "sarah@example.com",
      createdAt: new Date(
        Date.now() - 3 * 86400000
      ).toISOString(),
      collectionDate: new Date().toISOString().slice(0, 10),
      collectionTime: "15:00",
      status: "ready",
      items: [
        {
          productId: "demo-3",
          name: "Weekend Cake Box",
          qty: 1,
          price: market === "MY" ? 76 : 24
        }
      ]
    },

    {
      id: "ORD-1004",
      customerName: "Emily Wong",
      customerEmail: "emily@example.com",
      createdAt: new Date(
        Date.now() - 8 * 86400000
      ).toISOString(),
      collectionDate: new Date(
        Date.now() - 7 * 86400000
      ).toISOString().slice(0, 10),
      collectionTime: "11:00",
      status: "completed",
      items: [
        {
          productId: "demo-1",
          name: "Brown Butter Financier",
          qty: 2,
          price: market === "MY" ? 14 : 4.5
        },
        {
          productId: "demo-3",
          name: "Weekend Cake Box",
          qty: 1,
          price: market === "MY" ? 76 : 24
        }
      ]
    }
  ];

  /* =========================================================
     MIGRATION
  ========================================================= */

  if (!Array.isArray(state.orders)) {
    state.orders = JSON.parse(
      JSON.stringify(defaultOrders)
    );

    ctx.save();
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  function orderTotal(order) {
    return (order.items || []).reduce(
      (sum, item) =>
        sum +
        Number(item.price || 0) *
        Number(item.qty || 0),
      0
    );
  }

  function statusLabel(status) {
    return {
      waiting: "Waiting Confirmation",
      confirmed: "Confirmed",
      ready: "Ready for Collection",
      completed: "Completed",
      cancelled: "Cancelled"
    }[status] || status;
  }

  function statusClass(status) {
    return `demo-order-status ${status}`;
  }

  function getOrder(id) {
    return state.orders.find(
      (order) => order.id === id
    );
  }

  function getOrders() {
    return state.orders;
  }

  function completedOrders() {
    return state.orders.filter(
      (order) =>
        order.status === "completed" ||
        order.status === "ready" ||
        order.status === "confirmed"
    );
  }

  /* =========================================================
     STATUS CHANGE
  ========================================================= */

  function setStatus(id, nextStatus) {
    const order = getOrder(id);

    if (!order) return;

    const previous = order.status;

    order.status = nextStatus;

    ctx.activity(
      `${order.id} changed from ${statusLabel(previous)} to ${statusLabel(nextStatus)}`
    );

    ctx.save();

    if (
      window.HBBDemoEmail &&
      typeof window.HBBDemoEmail.previewStatusAutomation === "function"
    ) {
      window.HBBDemoEmail.previewStatusAutomation(
        order,
        nextStatus
      );
    }

    ctx.refreshAdmin();
  }

  /* =========================================================
     ADD DEMO ORDER
  ========================================================= */

  function addDemoOrder() {
    const products = state.products || [];

    if (!products.length) {
      alert("Add a product first.");
      return;
    }

    const product =
      products[
        Math.floor(
          Math.random() * products.length
        )
      ];

    const number =
      state.orders.length + 1001;

    const order = {
      id: `ORD-${number}`,
      customerName: "New Demo Customer",
      customerEmail: "customer@example.com",
      createdAt: new Date().toISOString(),
      collectionDate: new Date(
        Date.now() + 86400000
      ).toISOString().slice(0, 10),
      collectionTime: "15:00",
      status: "waiting",
      items: [
        {
          productId: product.id,
          name: product.name,
          qty: 1,
          price: Number(product.price || 0)
        }
      ]
    };

    state.orders.unshift(order);

    ctx.activity(
      `${order.id} received`
    );

    ctx.save();

    if (
      window.HBBDemoEmail &&
      typeof window.HBBDemoEmail.previewNewOrderAutomation === "function"
    ) {
      window.HBBDemoEmail.previewNewOrderAutomation(order);
    }

    ctx.refreshAdmin();
  }

  /* =========================================================
     DELETE DEMO ORDER
  ========================================================= */

  function removeOrder(id) {
    const order = getOrder(id);

    if (!order) return;

    if (
      !confirm(
        `Delete ${order.id} from this demo?`
      )
    ) {
      return;
    }

    state.orders =
      state.orders.filter(
        (item) => item.id !== id
      );

    ctx.activity(
      `${order.id} removed`
    );

    ctx.save();

    ctx.refreshAdmin();
  }

  /* =========================================================
     ORDER ROWS
  ========================================================= */

  function orderRows() {
    return [...state.orders]
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .map((order) => {
        const itemCount =
          (order.items || []).reduce(
            (sum, item) =>
              sum + Number(item.qty || 0),
            0
          );

        return `
          <tr>

            <td>
              <div>
                <b>${order.id}</b>
                <br>
                <small>
                  ${new Date(order.createdAt).toLocaleString()}
                </small>
              </div>
            </td>

            <td>
              <b>${order.customerName}</b>
              <br>
              <small>${order.customerEmail}</small>
            </td>

            <td>
              ${itemCount} item${itemCount === 1 ? "" : "s"}
            </td>

            <td>
              <b>${money(orderTotal(order))}</b>
            </td>

            <td>
              ${order.collectionDate}
              <br>
              <small>${order.collectionTime}</small>
            </td>

            <td>
              <span class="${statusClass(order.status)}">
                ${statusLabel(order.status)}
              </span>
            </td>

            <td>
              <select
                class="demo-order-select"
                onchange="
                  HBBDemoOrders.setStatus(
                    '${order.id}',
                    this.value
                  )
                "
              >

                <option
                  value="waiting"
                  ${order.status === "waiting" ? "selected" : ""}
                >
                  Waiting Confirmation
                </option>

                <option
                  value="confirmed"
                  ${order.status === "confirmed" ? "selected" : ""}
                >
                  Confirmed
                </option>

                <option
                  value="ready"
                  ${order.status === "ready" ? "selected" : ""}
                >
                  Ready for Collection
                </option>

                <option
                  value="completed"
                  ${order.status === "completed" ? "selected" : ""}
                >
                  Completed
                </option>

                <option
                  value="cancelled"
                  ${order.status === "cancelled" ? "selected" : ""}
                >
                  Cancelled
                </option>

              </select>
            </td>

            <td>
              <button
                class="demo-btn danger"
                onclick="
                  HBBDemoOrders.removeOrder(
                    '${order.id}'
                  )
                "
              >
                Delete
              </button>
            </td>

          </tr>
        `;
      })
      .join("");
  }

  /* =========================================================
     ORDERS PANEL
  ========================================================= */

  function panelHtml() {
    return `
      <section class="demo-card">

        <div class="demo-card-head">

          <div>
            <h2>Orders</h2>
            <p>
              Try the full order flow from new order to collection.
              Demo only — no real customer emails are sent.
            </p>
          </div>

          <button
            class="demo-btn primary"
            onclick="HBBDemoOrders.addDemoOrder()"
          >
            + Add demo order
          </button>

        </div>

        <div class="demo-table-wrap">

          <table class="demo-table">

            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Collection</th>
                <th>Status</th>
                <th>Update</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              ${orderRows()}
            </tbody>

          </table>

        </div>

      </section>
    `;
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

  window.HBBDemoOrders = {
    getOrders,
    getOrder,
    completedOrders,
    orderTotal,
    statusLabel,
    setStatus,
    addDemoOrder,
    removeOrder,
    orderRows,
    panelHtml
  };
})();
