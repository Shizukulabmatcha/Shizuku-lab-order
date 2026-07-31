

      <details class="faq-item">

        <summary>
          How do I pay?
        </summary>

        <div class="faq-answer">

          Payment is made via PayNow after
          submitting your order.

        </div>

      </details>


      <details class="faq-item">

        <summary>
          Can I change my order after payment?
        </summary>

        <div class="faq-answer">

          Please contact us as soon as possible
          if you need to make a change.

        </div>

      </details>

    </section>

  `;
}


/* =========================================================
   OPTIONS SCREEN
========================================================= */

function renderOptions() {

  const product =
    state.selectedProduct;


  if (!product) {

    return renderMenu();
  }


  const price =
    calculateProductPrice(
      product
    );


  return `

    ${header()}


    <div class="screen">

      <button
        class="back-link"
        onclick="setScreen('menu')"
      >

        ${ICONS.back}

        Back to menu

      </button>


      <div class="item-card">

        <img
          class="item-thumb"
          src="${escapeHtml(
            product.image_url ||
            "matcha-lab.jpg"
          )}"
          alt="${escapeHtml(
            product.name
          )}"
        >


        <div class="item-info">

          <div class="item-name">
            ${escapeHtml(
              product.name
            )}
          </div>

          <div class="item-desc">
            ${escapeHtml(
              product.description
            )}
          </div>

        </div>

      </div>


      ${
        state.optionGroups.length === 0

          ? `

            <div class="hint">
              No customisation options available.
            </div>

          `

          : state.optionGroups
              .map(group => {

                const options =
                  getOptionsForGroup(
                    group.id
                  );

                const selected =
                  state.selectedOptions[
                    group.id
                  ];


                return `

                  <div
                    class="field"
                    style="margin-top:20px;"
                  >

                    <label>

                      ${escapeHtml(
                        group.name
                      )}

                      ${
                        group.required
                          ? " *"
                          : " (optional)"
                      }

                    </label>


                    <div>

                      ${options
                        .map(
                          option => `

                        <button
                          type="button"
                          class="slot ${
                            selected &&
                            String(
                              selected.optionId
                            ) ===
                              String(
                                option.id
                              )
                              ? "active"
                              : ""
                          }"
                          onclick="selectOption('${escapeHtml(
                            group.id
                          )}','${escapeHtml(
                            option.id
                          )}')"
                        >

                          <div>

                            <div class="slot-day">
                              ${escapeHtml(
                                option.name
                              )}
                            </div>

                            <div class="slot-time">

                              ${
                                Number(
                                  option.price ||
                                  0
                                ) > 0

                                  ? `+${money(
                                      option.price
                                    )}`

                                  : "Included"
                              }

                            </div>

                          </div>

                        </button>

                      `
                        )
                        .join("")}

                    </div>

                  </div>

                `;
              })
              .join("")
      }

    </div>


    <div class="sticky-bar">

      <div class="sticky-bar-inner">

        <button
          class="primary-btn"
          onclick="addConfiguredProductToCart()"
        >

          Add to cart ·
          ${money(price)}

        </button>

      </div>

    </div>

  `;
}


/* =========================================================
   BUNDLE SCREEN
========================================================= */

function renderBundle() {

  const bundle =
    state.selectedProduct;


  if (!bundle) {

    return renderMenu();
  }


  const drinks =
    getBundleDrinkProducts();


  const drink1 =
    state.bundle.drink1;

  const drink2 =
    state.bundle.drink2;


  return `

    ${header()}


    <div class="screen">

      <button
        class="back-link"
        onclick="setScreen('menu')"
      >

        ${ICONS.back}

        Back to menu

      </button>


      <div class="item-card">

        <img
          class="item-thumb"
          src="${escapeHtml(
            bundle.image_url ||
            "matcha-lab.jpg"
          )}"
          alt="Shizuku Duo"
        >


        <div class="item-info">

          <div class="item-name">
            Shizuku Duo
          </div>

          <div class="item-desc">
            Choose your Matcha Latte +
            Hojicha Latte combination.
          </div>

          <div class="item-price">
            ${money(
              bundle.price
            )}
          </div>

        </div>

      </div>


      <!-- DRINK 1 -->

      <div class="bundle-section">

        <div class="bundle-heading">
          Drink 1
        </div>

        <div class="bundle-subheading">
          Choose your drink
        </div>


        <div class="bundle-drinks">

          ${drinks
            .map(
              drink => `

              <button
                type="button"
                class="slot ${
                  drink1 &&
                  String(
                    drink1.id
                  ) ===
                    String(
                      drink.id
                    )
                    ? "active"
                    : ""
                }"
                onclick="selectBundleDrink(
                  1,
                  '${escapeHtml(
                    drink.id
                  )}'
                )"
              >

                <div>

                  <div class="slot-day">
                    ${escapeHtml(
                      drink.name
                    )}
                  </div>

                  <div class="slot-time">
                    ${money(
                      drink.price
                    )}
                  </div>

                </div>

              </button>

            `
            )
            .join("")}

        </div>


        ${
          drink1
            ? renderBundleDrinkOptions(
                1,
                drink1,
                state.bundle
                  .drink1Options
              )
            : ""
        }

      </div>


      <!-- DRINK 2 -->

      <div class="bundle-section">

        <div class="bundle-heading">
          Drink 2
        </div>

        <div class="bundle-subheading">
          Choose your drink
        </div>


        <div class="bundle-drinks">

          ${drinks
            .map(
              drink => `

              <button
                type="button"
                class="slot ${
                  drink2 &&
                  String(
                    drink2.id
                  ) ===
                    String(
                      drink.id
                    )
                    ? "active"
                    : ""
                }"
                onclick="selectBundleDrink(
                  2,
                  '${escapeHtml(
                    drink.id
                  )}'
                )"
              >

                <div>

                  <div class="slot-day">
                    ${escapeHtml(
                      drink.name
                    )}
                  </div>

                  <div class="slot-time">
                    ${money(
                      drink.price
                    )}
                  </div>

                </div>

              </button>

            `
            )
            .join("")}

        </div>


        ${
          drink2
            ? renderBundleDrinkOptions(
                2,
                drink2,
                state.bundle
                  .drink2Options
              )
            : ""
        }

      </div>

    </div>


    <div class="sticky-bar">

      <div class="sticky-bar-inner">

        <button
          class="primary-btn"
          onclick="addBundleToCart()"
        >

          Add Duo to cart ·
          ${money(
            bundle.price
          )}

        </button>

      </div>

    </div>

  `;
}


/* =========================================================
   BUNDLE DRINK OPTIONS
========================================================= */

function renderBundleDrinkOptions(
  drinkNumber,
  drink,
  selectedOptions
) {

  return `

    <div
      class="bundle-customisation"
      style="margin-top:18px;"
    >

      <div class="bundle-selected">
        ${escapeHtml(
          drink.name
        )}
      </div>


      ${state.optionGroups
        .map(group => {

          const options =
            getOptionsForGroup(
              group.id
            );

          const selected =
            selectedOptions[
              group.id
            ];


          return `

            <div
              class="field"
              style="margin-top:16px;"
            >

              <label>

                ${escapeHtml(
                  group.name
                )}

                ${
                  group.required
                    ? " *"
                    : ""
                }

              </label>


              <div>

                ${options
                  .map(
                    option => `

                    <button
                      type="button"
                      class="slot ${
                        selected &&
                        String(
                          selected.optionId
                        ) ===
                          String(
                            option.id
                          )
                          ? "active"
                          : ""
                      }"
                      onclick="selectBundleOption(
                        ${drinkNumber},
                        '${escapeHtml(
                          group.id
                        )}',
                        '${escapeHtml(
                          option.id
                        )}'
                      )"
                    >

                      <div>

                        <div class="slot-day">
                          ${escapeHtml(
                            option.name
                          )}
                        </div>

                        <div class="slot-time">
                          ${
                            Number(
                              option.price ||
                              0
                            ) > 0

                              ? `+${money(
                                  option.price
                                )}`

                              : "Included"
                          }
                        </div>

                      </div>

                    </button>

                  `
                  )
                  .join("")}

              </div>

            </div>

          `;

        })
        .join("")}

    </div>

  `;
}


/* =========================================================
   STEPPER
========================================================= */

function stepper(
  key,
  qty
) {

  return `

    <div class="stepper">

      <button
        onclick="changeCartQty(
          '${escapeHtml(key)}',
          -1
        )"
      >

        ${ICONS.minus}

      </button>


      <span>
        ${qty}
      </span>


      <button
        onclick="changeCartQty(
          '${escapeHtml(key)}',
          1
        )"
      >

        ${ICONS.plus}

      </button>

    </div>

  `;
}


/* =========================================================
   CART
========================================================= */

function renderCart() {

  const lines =
    cartLines();


  return `

    ${header({
      showCart: true
    })}


    <div class="screen">

      <button
        class="back-link"
        onclick="setScreen('menu')"
      >

        ${ICONS.back}

        Continue browsing

      </button>


      ${
        lines.length === 0

          ? `

            <div class="empty">
              Your cart is empty —
              the whisk is waiting.
            </div>

          `

          : lines
              .map(
                line => `

                <div class="item-card">

                  <img
                    class="item-thumb"
                    src="${escapeHtml(
                      line.imageUrl ||
                      "matcha-lab.jpg"
                    )}"
                    alt="${escapeHtml(
                      line.productName
                    )}"
                  >


                  <div class="item-info">

                    <div class="item-name">
                      ${escapeHtml(
                        line.productName
                      )}
                    </div>


                    ${
                      line.options?.length

                        ? `

                          <div
                            class="item-desc"
                          >

                            ${
                              isBundle(
                                state.menu.find(
                                  p =>
                                    String(p.id) ===
                                    String(
                                      line.productId
                                    )
                                )
                              )

                                ? line.options
                                    .map(
                                      drink =>
                                        `<div>
                                          Drink ${drink.drinkNumber}:
                                          ${escapeHtml(
                                            drink.productName
                                          )}

                                          ${
                                            drink.options
                                              ?.length
                                              ? ` · ${drink.options
                                                  .map(
                                                    option =>
                                                      escapeHtml(
                                                        option.optionName
                                                      )
                                                  )
                                                  .join(
                                                    " · "
                                                  )}`
                                              : ""
                                          }

                                        </div>`
                                    )
                                    .join("")

                                : line.options
                                    .map(
                                      option =>
                                        escapeHtml(
                                          option.optionName
                                        )
                                    )
                                    .join(
                                      " · "
                                    )
                            }

                          </div>

                        `

                        : ""
                    }


                    <div class="item-price">
                      ${money(
                        line.unitPrice
                      )}
                    </div>

                  </div>


                  ${stepper(
                    line.key,
                    line.qty
                  )}

                </div>

              `
              )
              .join("")
      }

    </div>


    ${
      lines.length > 0

        ? `

          <div class="sticky-bar">

            <div class="sticky-bar-inner">

              <button
                class="primary-btn"
                onclick="setScreen('checkout')"
              >

                Checkout ·
                ${money(
                  cartTotal()
                )}

              </button>

            </div>

          </div>

        `

        : ""
    }

  `;
}


/* =========================================================
   CHECKOUT
========================================================= */

function renderCheckout() {

  const f =
    state.form;


  const canSubmit =
    f.name.trim() &&
    f.phone.trim() &&
    f.slotId;


  return `

    ${header()}


    <div class="screen">

      <button
        class="back-link"
        onclick="setScreen('cart')"
      >

        ${ICONS.back}

        Back to cart

      </button>


      <div class="field">

        <label>
          Name
        </label>

        <input
          id="f-name"
          value="${escapeHtml(
            f.name
          )}"
          placeholder="Your name"
          oninput="onFormInput(
            'name',
            this.value
          )"
        >

      </div>


      <div class="field">

        <label>
          Phone
        </label>

        <input
          id="f-phone"
          value="${escapeHtml(
            f.phone
          )}"
          placeholder="For pickup updates"
          inputmode="tel"
          oninput="onFormInput(
            'phone',
            this.value
          )"
        >

      </div>


      <div class="field">

        <label>
          Instagram (optional)
        </label>

        <input
          id="f-instagram"
          value="${escapeHtml(
            f.instagram
          )}"
          placeholder="@yourhandle"
          oninput="onFormInput(
            'instagram',
            this.value
          )"
        >

      </div>


      <div class="field">

        <label>
          Pickup slot
        </label>

      </div>


      ${state.slots
        .map(
          slot => `

          <button
            class="slot ${
              f.slotId ===
              slot.id
                ? "active"
                : ""
            }"
            onclick="onFormInput(
              'slotId',
              '${escapeHtml(
                slot.id
              )}'
            )"
          >

            ${ICONS.clock}


            <div>

              <div class="slot-day">
                ${escapeHtml(
                  slot.label
                )}
              </div>

              <div class="slot-time">
                ${escapeHtml(
                  slot.time
                )}
              </div>

            </div>

          </button>

        `
        )
        .join("")}


      <div class="field">

        <label>
          Notes (optional)
        </label>

        <textarea
          id="f-notes"
          rows="2"
          placeholder="Less ice, allergies, etc."
          oninput="onFormInput(
            'notes',
            this.value
          )"
        >${escapeHtml(
          f.notes
        )}</textarea>

      </div>


      <div class="field">

        <label>
          Promo code (optional)
        </label>


        ${
          state.promo

            ? `

              <div
                class="slot active"
                style="
                  justify-content:space-between;
                "
              >

                <span>

                  <b>
                    ${escapeHtml(
                      state.promo.code
                    )}
                  </b>

                  applied

                </span>


                <button
                  class="link-btn"
                  style="
                    border:none;
                    background:none;
                    color:#B33;
                  "
                  onclick="removePromoCode()"
                >
                  Remove
                </button>

              </div>

            `

            : `

              <div
                style="
                  display:flex;
                  gap:8px;
                "
              >

                <input
                  id="f-promo"
                  value="${escapeHtml(
                    f.promoCode
                  )}"
                  placeholder="e.g. WELCOME10"
                  style="flex:1;"
                  oninput="onFormInput(
                    'promoCode',
                    this.value
                  )"
                >


                <button
                  class="btn-primary"
                  style="
                    flex:none;
                    padding:0 18px;
                  "
                  onclick="applyPromoCode()"
                >
                  Apply
                </button>

              </div>

            `
        }


        ${
          state.promoMsg

            ? `

              <div class="ref-note">
                ${escapeHtml(
                  state.promoMsg
                )}
              </div>

            `

            : ""
        }

      </div>


      <div class="summary-card">

        ${cartLines()
          .map(
            line => `

            <div class="row">

              <span class="label">

                ${escapeHtml(
                  line.productName
                )}

                × ${line.qty}

              </span>


              <span>
                ${money(
                  line.unitPrice *
                  line.qty
                )}
              </span>

            </div>


            ${
              line.options?.length

                ? `

                  <div
                    class="hint"
                    style="
                      margin-top:-4px;
                      margin-bottom:8px;
                    "
                  >

                    ${
                      isBundle(
                        state.menu.find(
                          p =>
                            String(p.id) ===
                            String(
                              line.productId
                            )
                        )
                      )

                        ? line.options
                            .map(
                              drink =>
                                `Drink ${drink.drinkNumber}: ${escapeHtml(
                                  drink.productName
                                )}`
                            )
                            .join("<br>")

                        : line.options
                            .map(
                              option =>
                                escapeHtml(
                                  option.optionName
                                )
                            )
                            .join(
                              " · "
                            )
                    }

                  </div>

                `

                : ""
            }

          `
          )
          .join("")}


        ${
          state.promo

            ? `

              <div class="row">

                <span class="label">
                  Discount
                  (${escapeHtml(
                    state.promo.code
                  )})
                </span>

                <span>
                  -
                  ${money(
                    state.promo.amount
                  )}
                </span>

              </div>

            `

            : ""
        }


        <div class="divider"></div>


        <div class="row bold">

          <span class="label">
            Total
          </span>

          <span>
            ${money(
              orderTotal()
            )}
          </span>

        </div>

      </div>

    </div>


    <div class="sticky-bar">

      <div class="sticky-bar-inner">

        <button
          class="primary-btn"
          id="checkout-btn"
          ${
            canSubmit
              ? ""
              : "disabled"
          }
          onclick="submitOrder()"
        >

          Continue to payment ·
          ${money(
            orderTotal()
          )}

        </button>

      </div>

    </div>

  `;
}


/* =========================================================
   FORM INPUT
========================================================= */

function onFormInput(
  key,
  value
) {

  state.form[key] =
    value;


  if (
    state.screen !==
    "checkout"
  ) {
    return;
  }


  const canSubmit =
    state.form.name.trim() &&
    state.form.phone.trim() &&
    state.form.slotId;


  const button =
    document.getElementById(
      "checkout-btn"
    );


  if (button) {

    button.toggleAttribute(
      "disabled",
      !canSubmit
    );


    button.textContent =
      `Continue to payment · ${money(
        orderTotal()
      )}`;
  }


  if (
    key === "slotId"
  ) {

    render();
  }
}


/* =========================================================
   PAYMENT
========================================================= */

function renderPayment() {

  const order =
    state.lastOrder;


  if (!order) {

    return renderMenu();
  }


  const paynowName =
    state.store.paynow_name ||
    state.store.store_name ||
    "Shizuku Lab";


  const paynowNumber =
    state.store.paynow_number ||
    "";


  return `

    ${header()}


    <div class="screen">

      <div class="summary-card">

        ${
          state.store.paynow_url

            ? `

              <div class="qr-box">

                <img
                  src="${escapeHtml(
                    state.store.paynow_url
                  )}"
                  alt="PayNow QR"
                  style="
                    max-width:220px;
                    width:100%;
                    height:auto;
                  "
                >

              </div>

            `

            : `

              <div class="qr-box">
                <div class="qr-placeholder"></div>
              </div>

            `
        }


        <div class="hint">

          Scan with your banking app,
          or PayNow to

          <b>
            ${escapeHtml(
              paynowName
            )}
          </b>


          ${
            paynowNumber

              ? `

                <br>
                ${escapeHtml(
                  paynowNumber
                )}

              `

              : ""
          }

        </div>


        <div class="divider"></div>


        <div class="row">

          <span class="label">
            Order
          </span>

          <span class="mono">

            ${escapeHtml(
              order.order_number ||
              order.id ||
              ""
            )}

          </span>

        </div>


        <div class="row bold">

          <span class="label">
            Amount
          </span>

          <span>
            ${money(
              order.total
            )}
          </span>

        </div>


        <div class="ref-note">

          Enter

          <b>
            ${escapeHtml(
              order.order_number ||
              order.id ||
              ""
            )}
          </b>

          as the payment reference.

        </div>

      </div>

    </div>


    <div class="sticky-bar">

      <div class="sticky-bar-inner">

        <button
          class="primary-btn"
          onclick="markPaid()"
        >

          I've sent payment

        </button>


        <div
          class="hint"
          style="
            margin-top:8px;
            margin-bottom:0;
          "
        >

          We'll confirm your order once
          payment is verified.

        </div>

      </div>

    </div>

  `;
}


/* =========================================================
   CONFIRMATION
========================================================= */

function renderConfirmation() {

  const order =
    state.lastOrder;


  if (!order) {

    return renderMenu();
  }


  return `

    ${header()}


    <div class="screen center">

      <div class="check-circle">
        ${ICONS.check}
      </div>


      <div
        class="display"
        style="
          font-size:20px;
          margin-bottom:4px;
        "
      >

        Thanks,
        ${escapeHtml(
          (
            order.customer_name ||
            "there"
          )
            .split(" ")[0]
        )}

      </div>


      <div
        class="hint"
        style="
          margin-bottom:20px;
        "
      >

        We've received your payment
        submission and will confirm
        shortly.

      </div>


      <div class="code-box">

        <div class="mono code-text">

          ${escapeHtml(
            order.order_number ||
            order.id ||
            ""
          )}

        </div>


        <div class="divider"></div>


        <div class="row">

          <span class="label">
            Pickup
          </span>

          <span>

            ${escapeHtml(
              order.collection_date ||
              ""
            )}

            ·

            ${escapeHtml(
              order.collection_time ||
              ""
            )}

          </span>

        </div>


        <div class="row">

          <span class="label">
            Status
          </span>

          <span>
            Payment sent —
            pending confirmation
          </span>

        </div>


        <div class="row">

          <span class="label">
            Total
          </span>

          <span>
            ${money(
              order.total
            )}
          </span>

        </div>

      </div>


      <button
        class="primary-btn"
        style="
          margin-top:22px;
        "
        onclick="setScreen('menu')"
      >

        Back to menu

      </button>

    </div>

  `;
}


/* =========================================================
   MAIN RENDER
========================================================= */

function render() {

  const app =
    document.getElementById(
      "app"
    );


  if (!app) return;


  if (state.loading) {

    app.innerHTML = `

      <div class="loading">
        Loading Shizuku Lab…
      </div>

    `;

    return;
  }


  let html = "";


  if (
    state.screen ===
    "menu"
  ) {

    html =
      renderMenu();

  }

  else if (
    state.screen ===
    "options"
  ) {

    html =
      renderOptions();

  }

  else if (
    state.screen ===
    "bundle"
  ) {

    html =
      renderBundle();

  }

  else if (
    state.screen ===
    "cart"
  ) {

    html =
      renderCart();

  }

  else if (
    state.screen ===
    "checkout"
  ) {

    html =
      renderCheckout();

  }

  else if (
    state.screen ===
    "payment"
  ) {

    html =
      renderPayment();

  }

  else if (
    state.screen ===
    "confirmation"
  ) {

    html =
      renderConfirmation();

  }

  else {

    html =
      renderMenu();

  }


  html += `

    <div class="footer-link">

      <a href="admin.html">

        <button>
          Shop login
        </button>

      </a>

    </div>

  `;


  app.innerHTML =
    html;
}


/* =========================================================
   START
========================================================= */

init();


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
        await db.from("promo_redemptions").insert({ code: state.promo.code, phone: f.phone.trim(), order_id: order.id });
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
async function markPaid() {
  if (!state.lastOrder) return;
  const order = state.lastOrder;
  if (IS_CONFIGURED && order.id) {
    const { error } = await db.from("orders").update({ payment_status: "submitted", order_status: "awaiting_confirmation" }).eq("id", order.id);
    if (error) { alert("Could not update payment status.\n" + error.message); return; }
  }
  state.lastOrder = { ...order, payment_status: "submitted", order_status: "awaiting_confirmation" };
  state.cart = {};
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
function buildPayNowPayload({ mobile, amount, refNumber, merchantName }) {
  const expiry = (() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
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
  const mobile = (state.store.paynow_number || "").replace(/\s+/g, "");
  if (!mobile) throw new Error("no paynow number configured");
  const merchantName = state.store.paynow_name || state.store.store_name || "SHIZUKU LAB";
  const payload = buildPayNowPayload({ mobile, amount, refNumber, merchantName });
  const qr = qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  return qr.createSvgTag({ cellSize: 5, margin: 2 });
}

/* ---------- store info ---------- */
function storeInfoPanel() {
  const igHandle = String(state.store.instagram || "shizukulab.matcha").replace(/^@/, "");
  return `
    <div class="store-panel">
      <img src="logo.png" class="store-logo" alt="${escapeHtml(state.store.store_name)} logo">
      <a class="store-insta" href="https://instagram.com/${encodeURIComponent(igHandle)}" target="_blank" rel="noopener">@${escapeHtml(igHandle)}</a>
      <div class="store-dropoff">${escapeHtml(state.store.collection_address || "")}</div>
      <div class="hours-card">
        <div class="hours-row">
          <span class="hours-label">COLLECTION</span>
          <span class="hours-status open">PRE-ORDER</span>
        </div>
        <div class="hours-day">Saturday</div>
        <div class="hours-time">${escapeHtml(state.store.saturday_collection_time || "10:00 AM - 12:00 PM")}</div>
        <div class="hours-day" style="margin-top:8px;">Sunday</div>
        <div class="hours-time">${escapeHtml(state.store.sunday_collection_time || "10:00 AM - 1:00 PM")}</div>
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
        ${showCart ? `
          <button class="cart-btn" onclick="setScreen('cart')" aria-label="Cart">
            ${ICONS.bag}
            ${cartCount() > 0 ? `<span class="cart-badge">${cartCount()}</span>` : ""}
          </button>` : ""}
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
function renderMenu() {
  const categories = ["All", ...Array.from(new Set(state.menu.map((item) => item.category)))];
  const items = state.activeCategory === "All" ? state.menu : state.menu.filter((item) => item.category === state.activeCategory);
  return `
    ${header({ showCart: true })}
    ${storeInfoPanel()}
    ${state.loadError ? `<div class="setup-banner" style="border-color:#B33;background:#FBEAEA;color:#7a1f1f;">Could not load products: <code>${escapeHtml(state.loadError)}</code></div>` : ""}
    <div class="cats">
      ${categories.map((category) => `<button class="pill ${category === state.activeCategory ? "active" : ""}" onclick="setCategory('${escapeHtml(category)}')">${escapeHtml(category)}</button>`).join("")}
    </div>
    <div class="menu-list">
      ${items.length === 0 ? `<div class="empty">No items available yet.</div>` : items.map((item) => `
        <div class="item-card">
          <img class="item-thumb" src="${escapeHtml(item.image_url || "matcha-lab.jpg")}" alt="${escapeHtml(item.name)}">
          <div class="item-info">
            <div class="item-name">${escapeHtml(item.name)}</div>
            <div class="item-desc">${escapeHtml(item.description)}</div>
            <div class="item-row">
              <div class="item-price">${money(item.price)}</div>
              ${state.cart[`${item.id}__`]?.qty > 0
                ? stepper(`${item.id}__`, state.cart[`${item.id}__`].qty)
                : `<button class="add-btn" onclick="openProductOptions('${escapeHtml(item.id)}')">Add</button>`}
            </div>
          </div>
        </div>
      `).join("")}
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
      <div class="faq-title">FAQ</div>
      <details class="faq-item"><summary>Where is collection?</summary><div class="faq-answer">Collection is at ${escapeHtml(state.store.collection_address || "Toa Payoh Lorong 1, Singapore")}.</div></details>
      <details class="faq-item"><summary>When can I collect my drinks?</summary><div class="faq-answer">Saturday: ${escapeHtml(state.store.saturday_collection_time || "10:00 AM - 12:00 PM")}<br><br>Sunday: ${escapeHtml(state.store.sunday_collection_time || "10:00 AM - 1:00 PM")}</div></details>
      <details class="faq-item"><summary>Can I request less ice or less sweet?</summary><div class="faq-answer">Yes. Please select your preferred option when ordering.</div></details>
      <details class="faq-item"><summary>How do I pay?</summary><div class="faq-answer">Payment is made via PayNow after submitting your order.</div></details>
      <details class="faq-item"><summary>Can I change my order after payment?</summary><div class="faq-answer">Please contact us as soon as possible if you need to make a change.</div></details>
    </section>
  `;
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
      <div class="item-card">
        <img class="item-thumb" src="${escapeHtml(product.image_url || "matcha-lab.jpg")}" alt="${escapeHtml(product.name)}">
        <div class="item-info">
          <div class="item-name">${escapeHtml(product.name)}</div>
          <div class="item-desc">${escapeHtml(product.description)}</div>
        </div>
      </div>
      ${state.optionGroups.length === 0 ? `<div class="hint">No customisation options available.</div>` : state.optionGroups.map((group) => {
        const options = getOptionsForGroup(group.id);
        const selected = state.selectedOptions[group.id];
        return `
          <div class="field" style="margin-top:20px;">
            <label>${escapeHtml(group.name)}${group.required ? " *" : " (optional)"}</label>
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
      <div class="item-card">
        <img class="item-thumb" src="${escapeHtml(bundle.image_url || "matcha-lab.jpg")}" alt="Shizuku Duo">
        <div class="item-info">
          <div class="item-name">Shizuku Duo</div>
          <div class="item-desc">Choose your Matcha Latte + Hojicha Latte combination.</div>
          <div class="item-price">${money(bundle.price)}</div>
        </div>
      </div>
      <div class="bundle-section">
        <div class="bundle-heading">Drink 1</div>
        <div class="bundle-subheading">Choose your drink</div>
        <div class="bundle-drinks">
          ${drinks.map((drink) => `
            <button type="button" class="slot ${drink1 && String(drink1.id) === String(drink.id) ? "active" : ""}" onclick="selectBundleDrink(1,'${escapeHtml(drink.id)}')">
              <div><div class="slot-day">${escapeHtml(drink.name)}</div><div class="slot-time">${money(drink.price)}</div></div>
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
              <div><div class="slot-day">${escapeHtml(drink.name)}</div><div class="slot-time">${money(drink.price)}</div></div>
            </button>
          `).join("")}
        </div>
        ${drink2 ? renderBundleDrinkOptions(2, drink2, state.bundle.drink2Options) : ""}
      </div>
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" onclick="addBundleToCart()">Add Duo to cart · ${money(bundle.price)}</button>
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
            <label>${escapeHtml(group.name)}${group.required ? " *" : ""}</label>
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
  const canSubmit = f.name.trim() && f.phone.trim() && f.slotId;
  return `
    ${header()}
    <div class="screen">
      <button class="back-link" onclick="setScreen('cart')">${ICONS.back} Back to cart</button>
      <div class="field"><label>Name</label><input id="f-name" value="${escapeHtml(f.name)}" placeholder="Your name" oninput="onFormInput('name', this.value)"></div>
      <div class="field"><label>Phone</label><input id="f-phone" value="${escapeHtml(f.phone)}" placeholder="For pickup updates" inputmode="tel" oninput="onFormInput('phone', this.value)"></div>
      <div class="field"><label>Instagram (optional)</label><input id="f-instagram" value="${escapeHtml(f.instagram)}" placeholder="@yourhandle" oninput="onFormInput('instagram', this.value)"></div>
      <div class="field"><label>Pickup slot</label></div>
      ${state.slots.map((slot) => `
        <button class="slot ${f.slotId === slot.id ? "active" : ""}" onclick="onFormInput('slotId','${escapeHtml(slot.id)}')">
          ${ICONS.clock}
          <div><div class="slot-day">${escapeHtml(slot.label)}</div><div class="slot-time">${escapeHtml(slot.time)}</div></div>
        </button>
      `).join("")}
      <div class="field"><label>Notes (optional)</label><textarea id="f-notes" rows="2" placeholder="Less ice, allergies, etc." oninput="onFormInput('notes', this.value)">${escapeHtml(f.notes)}</textarea></div>
      <div class="field">
        <label>Promo code (optional)</label>
        ${state.promo
          ? `<div class="slot active" style="justify-content:space-between;"><span><b>${escapeHtml(state.promo.code)}</b> applied</span><button class="link-btn" style="border:none;background:none;color:#B33;" onclick="removePromoCode()">Remove</button></div>`
          : `<div style="display:flex;gap:8px;">
              <input id="f-promo" value="${escapeHtml(f.promoCode)}" placeholder="e.g. WELCOME10" style="flex:1;" oninput="onFormInput('promoCode', this.value)">
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
  const canSubmit = state.form.name.trim() && state.form.phone.trim() && state.form.slotId;
  const button = document.getElementById("checkout-btn");
  if (button) { button.toggleAttribute("disabled", !canSubmit); button.textContent = `Continue to payment · ${money(orderTotal())}`; }
  if (key === "slotId") render();
}

/* ---------- payment ---------- */
function renderPayment() {
  const order = state.lastOrder;
  if (!order) return renderMenu();
  const paynowName = state.store.paynow_name || state.store.store_name || "Shizuku Lab";
  const paynowNumber = state.store.paynow_number || "";
  let qrHtml;
  try {
    qrHtml = paynowNumber ? `<div class="qr-box">${payNowQrSvg(order.total, order.order_number)}</div>` : null;
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
        <div class="hint" style="color:#B78A2E;">This QR code is valid for 15 minutes — please pay promptly.</div>
        <div class="divider"></div>
        <div class="row"><span class="label">Order</span><span class="mono">${escapeHtml(order.order_number || order.id || "")}</span></div>
        <div class="row bold"><span class="label">Amount</span><span>${money(order.total)}</span></div>
        <div class="ref-note">Enter <b>${escapeHtml(order.order_number || order.id || "")}</b> as the payment reference.</div>
      </div>
    </div>
    <div class="sticky-bar"><div class="sticky-bar-inner">
      <button class="primary-btn" onclick="markPaid()">I've sent payment</button>
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
  else html = renderMenu();
  html += `<div class="footer-link"><a href="admin.html"><button>Shop login</button></a></div>`;
  app.innerHTML = html;
}

init();
