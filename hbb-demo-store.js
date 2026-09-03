(() => {
  /* ==========================================
     MARKET
  ========================================== */

  const params =
    new URLSearchParams(
      window.location.search
    );

  const path =
    window.location.pathname
      .toLowerCase();

  const market =
    String(
      params.get("market") || ""
    ).toUpperCase() === "MY" ||
    path.includes("/demo/malaysia")
      ? "MY"
      : "SG";

  const config =
    market === "MY"
      ? {
          country: "Malaysia",
          symbol: "RM",
          key:
            "slow-studio-hbb-demo-v1-my"
        }
      : {
          country: "Singapore",
          symbol: "S$",
          key:
            "slow-studio-hbb-demo-v1-sg"
        };

  let cart = [];

  /* ==========================================
     DATA
  ========================================== */

  function loadState() {
    try {
      return JSON.parse(
        localStorage.getItem(
          config.key
        ) || "{}"
      );
    } catch (_) {
      return {};
    }
  }

  function saveState(state) {
    localStorage.setItem(
      config.key,
      JSON.stringify(state)
    );
  }

  function money(value) {
    return (
      config.symbol +
      Number(value || 0)
        .toFixed(2)
    );
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll(
        "'",
        "&#039;"
      );
  }

  function uid() {
    return (
      "order-" +
      Date.now()
    );
  }

  /* ==========================================
     CART
  ========================================== */

  function add(productId) {
    const state =
      loadState();

    const product =
      (
        state.products || []
      ).find(
        item =>
          item.id === productId
      );

    if (!product) return;

    const existing =
      cart.find(
        item =>
          item.productId ===
          productId
      );

    if (existing) {
      if (
        existing.qty <
        Number(product.stock || 0)
      ) {
        existing.qty++;
      }
    } else {
      cart.push({
        productId:
          product.id,

        name:
          product.name,

        price:
          Number(
            product.price || 0
          ),

        qty: 1
      });
    }

    render();
  }

  function changeQty(
    productId,
    amount
  ) {
    const state =
      loadState();

    const product =
      (
        state.products || []
      ).find(
        item =>
          item.id === productId
      );

    const cartItem =
      cart.find(
        item =>
          item.productId ===
          productId
      );

    if (
      !cartItem ||
      !product
    ) {
      return;
    }

    cartItem.qty += amount;

    if (
      cartItem.qty <= 0
    ) {
      cart =
        cart.filter(
          item =>
            item.productId !==
            productId
        );
    } else {
      cartItem.qty =
        Math.min(
          cartItem.qty,
          Number(
            product.stock || 0
          )
        );
    }

    render();
  }

  function cartCount() {
    return cart.reduce(
      (sum, item) =>
        sum + item.qty,
      0
    );
  }

  function subtotal() {
    return cart.reduce(
      (sum, item) =>
        sum +
        item.price *
        item.qty,
      0
    );
  }

  /* ==========================================
     CHECKOUT
  ========================================== */

  function openCheckout() {
    if (!cart.length) {
      return;
    }

    const drawer =
      document.getElementById(
        "storeCheckout"
      );

    if (drawer) {
      drawer.hidden = false;
    }
  }

  function closeCheckout() {
    const drawer =
      document.getElementById(
        "storeCheckout"
      );

    if (drawer) {
      drawer.hidden = true;
    }
  }

  function placeOrder(event) {
    event.preventDefault();

    const state =
      loadState();

    const form =
      new FormData(
        event.target
      );

    const name =
      String(
        form.get("name") || ""
      ).trim();

    const email =
      String(
        form.get("email") || ""
      ).trim();

    const collection =
      String(
        form.get(
          "collection"
        ) || ""
      );

    const payment =
      String(
        form.get(
          "payment"
        ) || ""
      );

    if (
      !name ||
      !email ||
      !collection ||
      !payment
    ) {
      alert(
        "Please complete the required details."
      );

      return;
    }

    const order = {
      id: uid(),

      customerName: name,

      email,

      items:
        cart.map(
          item => ({
            ...item
          })
        ),

      total:
        subtotal(),

      collectionSlot:
        collection,

      paymentMethod:
        payment,

      status:
        "waiting",

      createdAt:
        new Date()
          .toISOString()
    };

    if (
      !Array.isArray(
        state.orders
      )
    ) {
      state.orders = [];
    }

    state.orders.unshift(
      order
    );

    /* reduce stock */

    cart.forEach(
      cartItem => {
        const product =
          (
            state.products || []
          ).find(
            item =>
              item.id ===
              cartItem.productId
          );

        if (product) {
          product.stock =
            Math.max(
              0,
              Number(
                product.stock || 0
              ) -
              cartItem.qty
            );
        }
      }
    );

    saveState(state);

    cart = [];

    document.getElementById(
      "demoStore"
    ).innerHTML = `
      <main class="store-success">

        <section class="demo-card">

          <div class="demo-eyebrow">
            DEMO ORDER
          </div>

          <h1>
            Order received 🤍
          </h1>

          <p>
            Thank you,
            ${esc(name)}.
          </p>

          <p>
            Order number:
            <strong>
              ${esc(order.id)}
            </strong>
          </p>

          <h2>
            ${money(
              order.total
            )}
          </h2>

          <p>
            No real payment
            has been made.
          </p>

          <button
            class="demo-btn primary"
            onclick="
              location.reload()
            "
          >
            Back to shop
          </button>

        </section>

      </main>
    `;
  }

  /* ==========================================
     PRODUCT IMAGES
  ========================================== */

  function openImageDb() {
    return new Promise(
      (resolve, reject) => {
        const request =
          indexedDB.open(
            `slow-studio-demo-images-${market.toLowerCase()}`,
            1
          );

        request.onsuccess =
          () =>
            resolve(
              request.result
            );

        request.onerror =
          () =>
            reject(
              request.error
            );
      }
    );
  }

  async function loadImages() {
    const elements =
      document.querySelectorAll(
        "[data-product-image]"
      );

    try {
      const db =
        await openImageDb();

      if (
        !db.objectStoreNames
          .contains(
            "productImages"
          )
      ) {
        return;
      }

      for (
        const element of
        elements
      ) {
        const productId =
          element.dataset
            .productImage;

        const transaction =
          db.transaction(
            "productImages",
            "readonly"
          );

        const request =
          transaction
            .objectStore(
              "productImages"
            )
            .get(productId);

        request.onsuccess =
          () => {
            const blob =
              request.result;

            if (!blob) return;

            const url =
              URL.createObjectURL(
                blob
              );

            element.innerHTML = `
              <img
                src="${url}"
                alt=""
                style="
                  width:100%;
                  height:100%;
                  object-fit:cover;
                "
              >
            `;
          };
      }
    } catch (_) {}
  }

  /* ==========================================
     RENDER
  ========================================== */

  function render() {
    const root =
      document.getElementById(
        "demoStore"
      );

    if (!root) return;

    const state =
      loadState();

    const store =
      state.store || {};

    const products =
      (
        state.products || []
      ).filter(
        item =>
          item.visible &&
          Number(
            item.stock || 0
          ) > 0
      );

    const slots =
      (
        state.availability
          ?.slots || []
      ).filter(
        slot =>
          slot.enabled
      );

    const payments =
      store.paymentMethods ||
      [];

    if (
      store.visibility !==
      "live"
    ) {
      root.innerHTML = `
        <main class="store-hidden">

          <article>

            <h1>
              We’ll be back soon.
            </h1>

            <p>
              Ordering is
              currently closed.
            </p>

          </article>

        </main>
      `;

      return;
    }

    root.innerHTML = `

      <header class="store-top">

        <div class="store-brand">
          ${esc(
            store.name ||
            "Demo Store"
          )}
        </div>

        <button
          class="demo-btn"
          onclick="
            HBBDemoStore.openCheckout()
          "
          ${
            cart.length
              ? ""
              : "disabled"
          }
        >
          Cart (${cartCount()})
        </button>

      </header>


      <section class="store-hero">

        <div class="demo-eyebrow">
          ${config.country}
          · DEMO STORE
        </div>

        <h1>
          ${esc(
            store.name ||
            "Demo Store"
          )}
        </h1>

        <p>
          ${esc(
            store.tagline || ""
          )}
        </p>

      </section>


      <section class="store-grid">

        ${products
          .map(
            product => `
              <article
                class="store-product"
              >

                <div
                  class="store-product-photo"
                  data-product-image="${esc(
                    product.id
                  )}"
                >
                  ${esc(
                    product.name
                      .slice(0,1)
                  )}
                </div>

                <div
                  class="store-product-copy"
                >

                  <small>
                    ${esc(
                      product.category
                    )}
                  </small>

                  <h2>
                    ${esc(
                      product.name
                    )}
                  </h2>

                  <p>
                    ${Number(
                      product.stock
                    )}
                    available
                  </p>

                  <div
                    class="store-product-actions"
                  >

                    <strong
                      class="store-price"
                    >
                      ${money(
                        product.price
                      )}
                    </strong>

                    <button
                      class="demo-btn primary"
                      onclick="
                        HBBDemoStore.add(
                          '${esc(
                            product.id
                          )}'
                        )
                      "
                      ${
                        state.availability
                          ?.orderingOpen ===
                        false
                          ? "disabled"
                          : ""
                      }
                    >
                      Add
                    </button>

                  </div>

                </div>

              </article>
            `
          )
          .join("")}

      </section>


      <div
        id="storeCheckout"
        class="store-checkout-overlay"
        hidden
      >

        <section
          class="store-checkout"
        >

          <div
            class="demo-card-head"
          >

            <h2>
              Your order
            </h2>

            <button
              class="demo-btn"
              onclick="
                HBBDemoStore.closeCheckout()
              "
            >
              Close
            </button>

          </div>


          ${cart
            .map(
              item => `
                <div
                  class="store-cart-line"
                >

                  <div>
                    <strong>
                      ${esc(
                        item.name
                      )}
                    </strong>

                    <small>
                      ${money(
                        item.price
                      )}
                    </small>
                  </div>

                  <div
                    class="store-qty"
                  >

                    <button
                      onclick="
                        HBBDemoStore.changeQty(
                          '${item.productId}',
                          -1
                        )
                      "
                    >
                      −
                    </button>

                    <span>
                      ${item.qty}
                    </span>

                    <button
                      onclick="
                        HBBDemoStore.changeQty(
                          '${item.productId}',
                          1
                        )
                      "
                    >
                      +
                    </button>

                  </div>

                </div>
              `
            )
            .join("")}


          <div
            class="store-cart-total"
          >
            <span>
              Total
            </span>

            <strong>
              ${money(
                subtotal()
              )}
            </strong>
          </div>


          <form
            class="store-checkout-form"
            onsubmit="
              HBBDemoStore.placeOrder(
                event
              )
            "
          >

            <label>
              Name *

              <input
                name="name"
                required
              >
            </label>


            <label>
              Email *

              <input
                name="email"
                type="email"
                required
              >
            </label>


            <label>
              Collection *

              <select
                name="collection"
                required
              >

                <option value="">
                  Select
                </option>

                ${slots
                  .map(
                    slot => `
                      <option
                        value="${esc(
                          slot.id
                        )}"
                      >
                        ${esc(
                          slot.label
                        )}
                        ·
                        ${esc(
                          slot.time
                        )}
                      </option>
                    `
                  )
                  .join("")}

              </select>

            </label>


            <label>
              Payment *

              <select
                name="payment"
                required
              >

                <option value="">
                  Select
                </option>

                ${payments
                  .map(
                    method => `
                      <option
                        value="${esc(
                          method
                        )}"
                      >
                        ${esc(
                          method
                        )}
                      </option>
                    `
                  )
                  .join("")}

              </select>

            </label>


            <div class="demo-note">
              Demo only —
              no real payment.
            </div>


            <button
              class="demo-btn primary"
              type="submit"
            >
              Place demo order ·
              ${money(
                subtotal()
              )}
            </button>

          </form>

        </section>

      </div>
    `;

    loadImages();
  }

  window.HBBDemoStore = {
    add,
    changeQty,
    openCheckout,
    closeCheckout,
    placeOrder,
    render
  };

  render();
})();
