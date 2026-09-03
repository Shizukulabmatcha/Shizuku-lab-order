(() => {
  /* =========================================================
     MARKET
  ========================================================= */

  const params =
    new URLSearchParams(location.search);

  const path =
    location.pathname.toLowerCase();

  const MARKET =
    String(params.get("market") || "")
      .toUpperCase() === "MY" ||
    path.includes("/malaysia")
      ? "MY"
      : "SG";

  const CONFIG =
    MARKET === "MY"
      ? {
          country: "Malaysia",
          currency: "MYR",
          symbol: "RM",
          stateKey:
            "slow-studio-hbb-demo-v1-my",
          cartKey:
            "slow-studio-customer-cart-v1-my"
        }
      : {
          country: "Singapore",
          currency: "SGD",
          symbol: "S$",
          stateKey:
            "slow-studio-hbb-demo-v1-sg",
          cartKey:
            "slow-studio-customer-cart-v1-sg"
        };
  
  let appliedPromoCode = "";
  let checkoutSubmitting = false;

  /* =========================================================
     HELPERS
  ========================================================= */

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function money(value) {
    return (
      CONFIG.symbol +
      Number(value || 0).toFixed(2)
    );
  }

  function withMarket(url) {
    return (
      url +
      `?market=${MARKET}`
    );
  }

  function loadState() {
    try {
      return JSON.parse(
        localStorage.getItem(
          CONFIG.stateKey
        ) || "{}"
      );
    } catch (_) {
      return {};
    }
  }

  function saveState(state) {
    localStorage.setItem(
      CONFIG.stateKey,
      JSON.stringify(state)
    );
  }

  function loadCart() {
    try {
      const data =
        JSON.parse(
          localStorage.getItem(
            CONFIG.cartKey
          ) || "[]"
        );

      return Array.isArray(data)
        ? data
        : [];
    } catch (_) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(
      CONFIG.cartKey,
      JSON.stringify(cart)
    );
  }

  function clearCart() {
    localStorage.removeItem(
      CONFIG.cartKey
    );
  }

  function cartSubtotal(cart) {
    return cart.reduce(
      (sum, item) =>
        sum +
        Number(item.price || 0) *
          Number(item.qty || 0),
      0
    );
  }

  function cartCount(cart) {
    return cart.reduce(
      (sum, item) =>
        sum +
        Number(item.qty || 0),
      0
    );
  }


  /* =========================================================
     PRODUCT IMAGES
  ========================================================= */

  function openImageDb() {
    return new Promise(
      (resolve, reject) => {
        const request =
          indexedDB.open(
            `slow-studio-demo-images-${MARKET.toLowerCase()}`,
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

    if (!elements.length) {
      return;
    }

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

      elements.forEach(
        element => {
          const id =
            element.dataset
              .productImage;

          const tx =
            db.transaction(
              "productImages",
              "readonly"
            );

          const request =
            tx
              .objectStore(
                "productImages"
              )
              .get(id);

          request.onsuccess =
            () => {
              if (
                !request.result
              ) {
                return;
              }

              const url =
                URL.createObjectURL(
                  request.result
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
      );
    } catch (error) {
      console.warn(
        "Images unavailable",
        error
      );
    }
  }


  /* =========================================================
     CART ACTIONS
  ========================================================= */

  function add(productId) {
    const state =
      loadState();

    const cart =
      loadCart();

    const product =
      (
        state.products || []
      ).find(
        item =>
          item.id === productId
      );

    if (!product) {
      return;
    }

    const existing =
      cart.find(
        item =>
          item.productId ===
          productId
      );

    if (existing) {
      existing.qty =
        Math.min(
          existing.qty + 1,
          Number(
            product.stock || 0
          )
        );
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

    saveCart(cart);

    renderStore();
  }

  function changeQty(
    productId,
    amount
  ) {
    const state =
      loadState();

    let cart =
      loadCart();

    const product =
      (
        state.products || []
      ).find(
        item =>
          item.id === productId
      );

    const item =
      cart.find(
        row =>
          row.productId ===
          productId
      );

    if (
      !item ||
      !product
    ) {
      return;
    }

    item.qty += amount;

    if (item.qty <= 0) {
      cart =
        cart.filter(
          row =>
            row.productId !==
            productId
        );
    } else {
      item.qty =
        Math.min(
          item.qty,
          Number(
            product.stock || 0
          )
        );
    }

    saveCart(cart);

    renderCart();
  }

  function removeItem(
    productId
  ) {
    const cart =
      loadCart().filter(
        item =>
          item.productId !==
          productId
      );

    saveCart(cart);

    renderCart();
  }


  /* =========================================================
     STORE
  ========================================================= */

  function renderStore() {
    const root =
      document.getElementById(
        "customerStore"
      );

    if (!root) return;

    const state =
      loadState();

    const store =
      state.store || {};

    const cart =
      loadCart();

    const products =
      (
        state.products || []
      ).filter(
        product =>
          product.visible
      );

    const orderingOpen =
      state.availability
        ?.orderingOpen !== false;

    root.innerHTML = `

      <header class="customer-top">

        <div>
          <small>
            ${CONFIG.country}
          </small>

          <strong>
            ${esc(
              store.name ||
              "Demo Store"
            )}
          </strong>
        </div>

        <a
          class="customer-cart-link"
          href="${withMarket(
            "hbb-demo-cart.html"
          )}"
        >
          Cart
          <span>
            ${cartCount(
              cart
            )}
          </span>
        </a>

      </header>


      <main class="customer-main">

        <section class="customer-hero">

          <small>
            ORDER ONLINE
          </small>

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


        ${
          !orderingOpen
            ? `
              <div class="customer-alert">
                Ordering is currently closed.
              </div>
            `
            : ""
        }


        <section class="customer-products">

          ${products
            .map(
              product => `
                <article
                  class="customer-product"
                >

                  <div
                    class="customer-product-image"
                    data-product-image="${esc(
                      product.id
                    )}"
                  >
                    ${esc(
                      product.name
                        .slice(
                          0,
                          1
                        )
                    )}
                  </div>


                  <div
                    class="customer-product-copy"
                  >

                    <small>
                      ${esc(
                        product.category ||
                        ""
                      )}
                    </small>

                    <h2>
                      ${esc(
                        product.name
                      )}
                    </h2>

                    <p>
                      ${
                        Number(
                          product.stock ||
                          0
                        )
                      }
                      available
                    </p>


                    <div
                      class="customer-product-footer"
                    >

                      <strong>
                        ${money(
                          product.price
                        )}
                      </strong>

                      <button
                        onclick="
                          HBBCustomer.add(
                            '${esc(
                              product.id
                            )}'
                          )
                        "
                        ${
                          !orderingOpen ||
                          Number(
                            product.stock ||
                            0
                          ) <= 0
                            ? "disabled"
                            : ""
                        }
                      >
                        ${
                          Number(
                            product.stock ||
                            0
                          ) <= 0
                            ? "Sold out"
                            : "Add"
                        }
                      </button>

                    </div>

                  </div>

                </article>
              `
            )
            .join("")}

        </section>

      </main>
    `;

    loadImages();
  }


  /* =========================================================
     CART PAGE
  ========================================================= */

  function renderCart() {
    const root =
      document.getElementById(
        "customerCart"
      );

    if (!root) return;

    const cart =
      loadCart();

    root.innerHTML = `

      <header class="customer-top">

        <a
          class="customer-back"
          href="${withMarket(
            "hbb-demo-store.html"
          )}"
        >
          ← Shop
        </a>

        <strong>
          Your cart
        </strong>

        <span></span>

      </header>


      <main class="
        customer-main
        customer-narrow
      ">

        <section class="
          customer-page-title
        ">

          <small>
            YOUR ORDER
          </small>

          <h1>
            Cart
          </h1>

          <p>
            ${cartCount(
              cart
            )}
            item${
              cartCount(cart) === 1
                ? ""
                : "s"
            }
          </p>

        </section>


        ${
          cart.length
            ? `
              <section
                class="customer-cart-list"
              >

                ${cart
                  .map(
                    item => `
                      <article
                        class="
                          customer-cart-item
                        "
                      >

                        <div>
                          <h3>
                            ${esc(
                              item.name
                            )}
                          </h3>

                          <p>
                            ${money(
                              item.price
                            )}
                            each
                          </p>

                          <button
                            class="
                              customer-remove
                            "
                            onclick="
                              HBBCustomer
                                .removeItem(
                                  '${esc(
                                    item.productId
                                  )}'
                                )
                            "
                          >
                            Remove
                          </button>
                        </div>


                        <div
                          class="
                            customer-cart-right
                          "
                        >

                          <strong>
                            ${money(
                              item.price *
                              item.qty
                            )}
                          </strong>

                          <div
                            class="
                              customer-qty
                            "
                          >

                            <button
                              onclick="
                                HBBCustomer
                                  .changeQty(
                                    '${esc(
                                      item.productId
                                    )}',
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
                                HBBCustomer
                                  .changeQty(
                                    '${esc(
                                      item.productId
                                    )}',
                                    1
                                  )
                              "
                            >
                              +
                            </button>

                          </div>

                        </div>

                      </article>
                    `
                  )
                  .join("")}

              </section>


              <section
                class="
                  customer-summary
                "
              >

                <div>
                  <span>
                    Subtotal
                  </span>

                  <strong>
                    ${money(
                      cartSubtotal(
                        cart
                      )
                    )}
                  </strong>
                </div>

                <small>
                  Discounts will be applied
                  during checkout.
                </small>

                <a
                  class="
                    customer-primary
                  "
                  href="${withMarket(
                    "hbb-demo-checkout.html"
                  )}"
                >
                  Checkout →
                </a>

              </section>
            `
            : `
              <section
                class="
                  customer-empty
                "
              >

                <h2>
                  Your cart is empty.
                </h2>

                <a
                  class="
                    customer-primary
                  "
                  href="${withMarket(
                    "hbb-demo-store.html"
                  )}"
                >
                  Browse products
                </a>

              </section>
            `
        }

      </main>
    `;
  }


  /* =========================================================
     PROMO
  ========================================================= */

  function promoFromCode(
    state,
    code
  ) {
    const clean =
      String(code || "")
        .trim()
        .toUpperCase();

    if (!clean) {
      return null;
    }

    return (
      state.promos || []
    ).find(
      promo =>
        promo.active &&
        String(
          promo.code || ""
        ).toUpperCase() ===
          clean
    ) || null;
  }

  function discountAmount(
    promo,
    subtotal
  ) {
    if (!promo) {
      return 0;
    }

  function checkoutTotals() {
    const state =
      loadState();

    const cart =
      loadCart();

    const subtotal =
      cartSubtotal(cart);

    const promo =
      promoFromCode(
        state,
        appliedPromoCode
      );

    const discount =
      discountAmount(
        promo,
        subtotal
      );

    const total =
      Math.max(
        0,
        subtotal - discount
      );

    return {
      subtotal,
      promo,
      discount,
      total
    };
  }    
    
    if (
      subtotal <
      Number(
        promo.minimumSpend ||
        0
      )
    ) {
      return 0;
    }

    if (
      promo.type ===
      "percentage"
    ) {
      return (
        subtotal *
        Number(
          promo.value || 0
        )
      ) / 100;
    }

    return Math.min(
      subtotal,
      Number(
        promo.value || 0
      )
    );
  }


  /* =========================================================
     CHECKOUT
  ========================================================= */

  function renderCheckout() {
  const root =
    document.getElementById(
      "customerCheckout"
    );

  if (!root) return;

  const state =
    loadState();

  const cart =
    loadCart();

  if (!cart.length) {
    location.href =
      withMarket(
        "hbb-demo-cart.html"
      );

    return;
  }

  const slots =
    (
      state.availability
        ?.slots || []
    ).filter(
      slot =>
        slot.enabled
    );

  const payments =
    state.store
      ?.paymentMethods || [];

  const totals =
    checkoutTotals();

  root.innerHTML = `

    <header class="customer-top">

      <a
        class="customer-back"
        href="${withMarket(
          "hbb-demo-cart.html"
        )}"
      >
        ← Cart
      </a>

      <strong>
        Checkout
      </strong>

      <span></span>

    </header>

    <main class="
      customer-main
      customer-checkout-layout
    ">

      <section>

        <div class="
          customer-page-title
        ">

          <small>
            ALMOST THERE
          </small>

          <h1>
            Checkout
          </h1>

        </div>

        <form
          id="checkoutForm"
          class="
            customer-checkout-form
          "
          onsubmit="
            HBBCustomer.placeOrder(
              event
            )
          "
        >

          <!-- CUSTOMER -->

          <section
            class="
              customer-form-section
            "
          >

            <h2>
              Your details
            </h2>

            <label>
              Name *

              <input
                name="name"
                required
                autocomplete="name"
              >
            </label>

            <label>
              Email *

              <input
                name="email"
                type="email"
                required
                autocomplete="email"
              >
            </label>

            <label>
              Phone *

              <input
                name="phone"
                required
                autocomplete="tel"
              >
            </label>

          </section>

          <!-- COLLECTION -->

          <section
            class="
              customer-form-section
            "
          >

            <h2>
              Collection
            </h2>

            ${
              slots.length
                ? `
                  <div
                    class="
                      customer-choice-list
                    "
                  >

                    ${slots
                      .map(
                        (
                          slot,
                          index
                        ) => `

                          <label
                            class="
                              customer-choice
                            "
                          >

                            <input
                              type="radio"
                              name="collection"
                              value="${esc(
                                slot.id
                              )}"
                              ${
                                index === 0
                                  ? "required"
                                  : ""
                              }
                            >

                            <span
                              class="
                                customer-choice-dot
                              "
                            ></span>

                            <span
                              class="
                                customer-choice-copy
                              "
                            >

                              <strong>
                                ${esc(
                                  slot.label ||
                                  "Collection"
                                )}
                              </strong>

                              <small>
                                ${
                                  slot.date
                                    ? `${esc(
                                        slot.date
                                      )} · `
                                    : ""
                                }

                                ${esc(
                                  slot.time ||
                                  ""
                                )}
                              </small>

                            </span>

                          </label>

                        `
                      )
                      .join("")}

                  </div>
                `
                : `
                  <div
                    class="
                      customer-alert
                    "
                  >
                    No collection slots
                    are available.
                  </div>
                `
            }

          </section>

              <!-- PROMO -->

          <section
            class="
              customer-form-section
            "
          >

            <h2>
              Promo
            </h2>

            <div
              class="
                customer-promo-row
              "
            >

              <input
                id="promoInput"
                name="promo"
                value="${esc(
                  appliedPromoCode
                )}"
                placeholder="FIRSTDROP"
              >

              <button
                type="button"
                class="
                  customer-secondary
                "
                onclick="
                  HBBCustomer
                    .previewPromo()
                "
              >
                Apply
              </button>

            </div>

            <div
              id="promoMessage"
            >

              ${
                totals.promo &&
                totals.discount > 0
                  ? `
                    <p
                      class="
                        customer-success-text
                      "
                    >
                      ✓
                      ${esc(
                        totals.promo.code
                      )}
                      applied

                      ·

                      −${money(
                        totals.discount
                      )}
                    </p>
                  `
                  : ""
              }

            </div>

          </section>

          <!-- PAYMENT -->

          <section
            class="
              customer-form-section
            "
          >

            <h2>
              Payment
            </h2>

            <div
              class="
                customer-choice-list
              "
            >

              ${payments
                .map(
                  (
                    method,
                    index
                  ) => `

                    <label
                      class="
                        customer-choice
                      "
                    >

                      <input
                        type="radio"
                        name="payment"
                        value="${esc(
                          method
                        )}"
                        ${
                          index === 0
                            ? "required"
                            : ""
                        }
                      >

                      <span
                        class="
                          customer-choice-dot
                        "
                      ></span>

                      <span
                        class="
                          customer-choice-copy
                        "
                      >

                        <strong>
                          ${esc(
                            method
                          )}
                        </strong>

                      </span>

                    </label>

                  `
                )
                .join("")}

            </div>

            <p
              class="
                customer-muted
              "
            >
              Demo checkout only.
              No real payment will
              be collected.
            </p>

          </section>

          <!-- NOTE -->

          <section
            class="
              customer-form-section
            "
          >

            <h2>
              Order note
            </h2>

            <textarea
              name="note"
              rows="3"
              placeholder="Any special request?"
            ></textarea>

          </section>

          <button
            id="placeOrderButton"
            type="submit"
            class="
              customer-primary
              customer-place-order
            "
            ${
              checkoutSubmitting
                ? "disabled"
                : ""
            }
          >
            ${
              checkoutSubmitting
                ? "Placing order..."
                : `Place order · ${money(
                    totals.total
                  )}`
            }
          </button>

        </form>

      </section>

      <!-- ORDER SUMMARY -->

      <aside
        class="
          customer-order-summary
        "
      >

        <h2>
          Order summary
        </h2>

        ${cart
          .map(
            item => `
              <div
                class="
                  customer-summary-item
                "
              >

                <span>
                  ${item.qty}
                  ×
                  ${esc(
                    item.name
                  )}
                </span>

                <strong>
                  ${money(
                    item.price *
                    item.qty
                  )}
                </strong>

              </div>
            `
          )
          .join("")}
                customer-form-section
              "
            >

              <h2>
                Collection
              </h2>

              <label>
                Collection slot *

                <select
                  name="collection"
                  required
                >

                  <option value="">
                    Select a slot
                  </option>

                  ${slots
                    .map(
                      slot => `
                        <option
                          value="${esc(
                            slot.id
                          )}"
                        >
                          ${
                            slot.date
                              ? esc(
                                  slot.date
                                ) +
                                " · "
                              : ""
                          }

                          ${esc(
                            slot.label ||
                            ""
                          )}

                          ·

                          ${esc(
                            slot.time ||
                            ""
                          )}
                        </option>
                      `
                    )
                    .join("")}

                </select>

              </label>

            </section>


            <section
              class="
                customer-form-section
              "
            >

              <h2>
                Promo
              </h2>

              <label>
                Promo code

                <input
                  id="promoInput"
                  name="promo"
                  placeholder="FIRSTDROP"
                >
              </label>

              <button
                type="button"
                class="
                  customer-secondary
                "
                onclick="
                  HBBCustomer
                    .previewPromo()
                "
              >
                Apply promo
              </button>

              <div
                id="promoMessage"
              ></div>

            </section>


            <section
              class="
                customer-form-section
              "
            >

              <h2>
                Payment
              </h2>

              <label>
                Payment method *

                <select
                  name="payment"
                  required
                >

                  <option value="">
                    Select payment
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

                      <div
          class="
            customer-summary-line
          "
        >

          <span>
            Subtotal
          </span>

          <strong>
            ${money(
              totals.subtotal
            )}
          </strong>

        </div>

        ${
          totals.discount > 0
            ? `
              <div
                class="
                  customer-summary-line
                  discount
                "
              >

                <span>
                  ${
                    totals.promo
                      ? esc(
                          totals.promo.code
                        )
                      : "Discount"
                  }
                </span>

                <strong>
                  −${money(
                    totals.discount
                  )}
                </strong>

              </div>
            `
            : ""
        }

        <div
          class="
            customer-summary-total
          "
        >

          <span>
            Total
          </span>

          <strong>
            ${money(
              totals.total
            )}
          </strong>

        </div>

      </aside>

    </main>

  `;
}

    function previewPromo() {
    const state =
      loadState();

    const cart =
      loadCart();

    const input =
      document.getElementById(
        "promoInput"
      );

    if (!input) {
      return;
    }

    const code =
      String(
        input.value || ""
      )
        .trim()
        .toUpperCase();

    if (!code) {
      appliedPromoCode = "";

      renderCheckout();

      return;
    }

    const promo =
      promoFromCode(
        state,
        code
      );

    if (!promo) {
      appliedPromoCode = "";

      alert(
        "Promo code not found."
      );

      renderCheckout();

      return;
    }

    const subtotal =
      cartSubtotal(cart);

    const discount =
      discountAmount(
        promo,
        subtotal
      );

    if (discount <= 0) {
      appliedPromoCode = "";

      alert(
        `Minimum spend is ${money(
          promo.minimumSpend || 0
        )}.`
      );

      renderCheckout();

      return;
    }

    appliedPromoCode =
      promo.code;

    renderCheckout();
  }


  /* =========================================================
     PLACE ORDER
  ========================================================= */

  function placeOrder(event) {
  event.preventDefault();

  if (checkoutSubmitting) {
    return;
  }

  checkoutSubmitting = true;

  const button =
    document.getElementById(
      "placeOrderButton"
    );

  if (button) {
    button.disabled = true;
    button.textContent =
      "Placing order...";
  }

    const state =
      loadState();

    const cart =
      loadCart();

    if (!cart.length) {
      return;
    }

    const data =
      new FormData(
        event.target
      );

    const name =
      String(
        data.get("name") ||
        ""
      ).trim();

    const email =
      String(
        data.get("email") ||
        ""
      ).trim();

    const phone =
      String(
        data.get("phone") ||
        ""
      ).trim();

    const collection =
      String(
        data.get(
          "collection"
        ) || ""
      );

    const payment =
      String(
        data.get(
          "payment"
        ) || ""
      );

    const promoCode =
  appliedPromoCode;

    const note =
      String(
        data.get("note") ||
        ""
      ).trim();

    if (
      !name ||
      !email ||
      !phone ||
      !collection ||
      !payment
    ) {
      alert(
        "Please complete all required fields."
      );

      return;
    }

    const subtotal =
      cartSubtotal(cart);

    const promo =
      promoFromCode(
        state,
        promoCode
      );

    const discount =
      discountAmount(
        promo,
        subtotal
      );

    const total =
      Math.max(
        0,
        subtotal -
        discount
      );

    const selectedSlot =
      (
        state.availability
          ?.slots || []
      ).find(
        slot =>
          slot.id ===
          collection
      );

    const orderId =
      "ORD-" +
      Date.now()
        .toString()
        .slice(-6);

    const order = {
      id: orderId,

      customerName: name,
      customerEmail: email,
      customerPhone: phone,

      email,
      phone,

      items:
        cart.map(
          item => ({
            ...item
          })
        ),

      subtotal,
      discount,
      total,

      promoCode:
        promo
          ? promo.code
          : "",

      collectionSlot:
        collection,

      collectionLabel:
        selectedSlot
          ? `${
              selectedSlot.date ||
              ""
            } ${
              selectedSlot.label ||
              ""
            } ${
              selectedSlot.time ||
              ""
            }`.trim()
          : "",

      paymentMethod:
        payment,

      note,

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

        if (!product) {
          return;
        }

        product.stock =
          Math.max(
            0,
            Number(
              product.stock ||
              0
            ) -
            Number(
              cartItem.qty ||
              0
            )
          );
      }
    );


    if (
      !Array.isArray(
        state.activity
      )
    ) {
      state.activity = [];
    }

    state.activity.unshift({
      text:
        `New order ${orderId} from ${name}`,

      at:
        new Date()
          .toISOString()
    });


    saveState(state);

    sessionStorage.setItem(
      "slow-studio-last-order",
      JSON.stringify(order)
    );

    clearCart();

    location.href =
      withMarket(
        "hbb-demo-success.html"
      );
  }


  /* =========================================================
     SUCCESS
  ========================================================= */

  function renderSuccess() {
    const root =
      document.getElementById(
        "customerSuccess"
      );

    if (!root) return;

    let order = null;

    try {
      order =
        JSON.parse(
          sessionStorage.getItem(
            "slow-studio-last-order"
          ) || "null"
        );
    } catch (_) {}

    if (!order) {
      root.innerHTML = `
        <main
          class="
            customer-main
            customer-narrow
          "
        >
          <section
            class="
              customer-empty
            "
          >
            <h1>
              No recent order.
            </h1>

            <a
              class="
                customer-primary
              "
              href="${withMarket(
                "hbb-demo-store.html"
              )}"
            >
              Back to shop
            </a>
          </section>
        </main>
      `;

      return;
    }

    root.innerHTML = `

      <main class="
        customer-success-page
      ">

        <section
          class="
            customer-success-card
          "
        >

          <div
            class="
              customer-success-icon
            "
          >
            ✓
          </div>

          <small>
            ORDER RECEIVED
          </small>

          <h1>
            Thank you,
            ${esc(
              order.customerName
            )}.
          </h1>

          <p>
            Your order number is
          </p>

          <strong
            class="
              customer-order-number
            "
          >
            ${esc(
              order.id
            )}
          </strong>


          <div
            class="
              customer-order-status
            "
          >
            Waiting confirmation
          </div>


          <div
            class="
              customer-success-details
            "
          >

            <div>
              <span>
                Total
              </span>

              <strong>
                ${money(
                  order.total
                )}
              </strong>
            </div>

            <div>
              <span>
                Collection
              </span>

              <strong>
                ${esc(
                  order.collectionLabel ||
                  "Selected collection slot"
                )}
              </strong>
            </div>

            <div>
              <span>
                Payment
              </span>

              <strong>
                ${esc(
                  order.paymentMethod
                )}
              </strong>
            </div>

          </div>


          <p
            class="
              customer-muted
            "
          >
            This is a demo order.
            No real payment has been made.
          </p>


          <a
            class="
              customer-primary
            "
            href="${withMarket(
              "hbb-demo-store.html"
            )}"
          >
            Back to shop
          </a>

        </section>

      </main>
    `;
  }


  /* =========================================================
     START
  ========================================================= */

  window.HBBCustomer = {
    add,
    changeQty,
    removeItem,
    previewPromo,
    placeOrder
  };

  renderStore();
  renderCart();
  renderCheckout();
  renderSuccess();
})();
