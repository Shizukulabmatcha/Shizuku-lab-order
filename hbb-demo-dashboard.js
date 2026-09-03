(() => {
  const ctx = window.HBBDemoContext;

  if (!ctx) {
    console.error(
      "HBBDemoContext is required before loading dashboard module."
    );
    return;
  }

  const state = ctx.state;

  let range = "week";

  /* =========================================================
     DATE HELPERS
  ========================================================= */

  function startOfDay(date) {
    const copy = new Date(date);

    copy.setHours(
      0,
      0,
      0,
      0
    );

    return copy;
  }

  function startOfWeek(date) {
    const copy =
      startOfDay(date);

    const day =
      copy.getDay();

    const diff =
      day === 0
        ? 6
        : day - 1;

    copy.setDate(
      copy.getDate() - diff
    );

    return copy;
  }

  function startOfMonth(date) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    );
  }

  function rangeStart() {
    const now =
      new Date();

    if (range === "today") {
      return startOfDay(now);
    }

    if (range === "month") {
      return startOfMonth(now);
    }

    return startOfWeek(now);
  }

  /* =========================================================
     ORDERS
  ========================================================= */

  function validOrders() {
    const orders =
      window.HBBDemoOrders
        ? window.HBBDemoOrders.getOrders()
        : state.orders || [];

    const start =
      rangeStart();

    return orders.filter(
      (order) => {
        if (
          order.status === "cancelled"
        ) {
          return false;
        }

        return (
          new Date(order.createdAt) >=
          start
        );
      }
    );
  }

  function orderTotal(order) {
    if (
      window.HBBDemoOrders
    ) {
      return window.HBBDemoOrders
        .orderTotal(order);
    }

    return (
      order.items || []
    ).reduce(
      (sum, item) =>
        sum +
        Number(item.price || 0) *
        Number(item.qty || 0),
      0
    );
  }

  /* =========================================================
     COSTING
  ========================================================= */

  function productCost(productId) {
    const costing =
      (state.costing || [])
        .find(
          (item) =>
            item.productId ===
            productId
        );

    if (!costing) {
      return 0;
    }

    return (
      Number(
        costing.ingredientCost || 0
      ) +
      Number(
        costing.packagingCost || 0
      ) +
      Number(
        costing.labourCost || 0
      )
    );
  }

  function orderCost(order) {
    return (
      order.items || []
    ).reduce(
      (sum, item) =>
        sum +
        productCost(
          item.productId
        ) *
        Number(item.qty || 0),
      0
    );
  }

  /* =========================================================
     METRICS
  ========================================================= */

  function metrics() {
    const orders =
      validOrders();

    const sales =
      orders.reduce(
        (sum, order) =>
          sum +
          orderTotal(order),
        0
      );

    const cogs =
      orders.reduce(
        (sum, order) =>
          sum +
          orderCost(order),
        0
      );

    const grossProfit =
      sales - cogs;

    const margin =
      sales > 0
        ? (
            grossProfit /
            sales *
            100
          )
        : 0;

    const averageOrder =
      orders.length
        ? sales /
          orders.length
        : 0;

    return {
      orders,
      sales,
      cogs,
      grossProfit,
      margin,
      averageOrder
    };
  }

  /* =========================================================
     BEST SELLERS
  ========================================================= */

  function topProducts() {
    const totals = {};

    validOrders().forEach(
      (order) => {
        (
          order.items || []
        ).forEach(
          (item) => {
            const key =
              item.productId ||
              item.name;

            if (!totals[key]) {
              totals[key] = {
                name:
                  item.name ||
                  "Product",

                qty: 0,

                sales: 0
              };
            }

            totals[key].qty +=
              Number(
                item.qty || 0
              );

            totals[key].sales +=
              Number(
                item.price || 0
              ) *
              Number(
                item.qty || 0
              );
          }
        );
      }
    );

    return Object.values(
      totals
    )
      .sort(
        (a, b) =>
          b.sales -
          a.sales
      )
      .slice(
        0,
        5
      );
  }

  /* =========================================================
     SALES BY DAY
  ========================================================= */

  function salesByDay() {
    const totals = {};

    validOrders().forEach(
      (order) => {
        const date =
          new Date(
            order.createdAt
          );

        const key =
          date.toISOString()
            .slice(
              0,
              10
            );

        if (!totals[key]) {
          totals[key] = 0;
        }

        totals[key] +=
          orderTotal(order);
      }
    );

    return Object.entries(
      totals
    )
      .sort(
        ([a], [b]) =>
          a.localeCompare(b)
      );
  }

  /* =========================================================
     RANGE
  ========================================================= */

  function setRange(next) {
    range = next;

    ctx.refreshAdmin();
  }

  /* =========================================================
     PANEL HTML
  ========================================================= */

  function panelHtml() {
    const data =
      metrics();

    const top =
      topProducts();

    const daily =
      salesByDay();

    const maxSale =
      Math.max(
        ...daily.map(
          ([, value]) =>
            value
        ),
        1
      );

    return `
      <div class="demo-dashboard-range">

        <button
          class="
            demo-btn
            ${
              range === "today"
                ? "primary"
                : ""
            }
          "
          onclick="
            HBBDemoDashboard.setRange(
              'today'
            )
          "
        >
          Today
        </button>

        <button
          class="
            demo-btn
            ${
              range === "week"
                ? "primary"
                : ""
            }
          "
          onclick="
            HBBDemoDashboard.setRange(
              'week'
            )
          "
        >
          This Week
        </button>

        <button
          class="
            demo-btn
            ${
              range === "month"
                ? "primary"
                : ""
            }
          "
          onclick="
            HBBDemoDashboard.setRange(
              'month'
            )
          "
        >
          This Month
        </button>

      </div>


      <div class="demo-dashboard-kpis">

        <article class="demo-kpi">
          <span>Sales</span>

          <strong>
            ${ctx.money(
              data.sales
            )}
          </strong>

          <small>
            Selected period
          </small>
        </article>


        <article class="demo-kpi">
          <span>Orders</span>

          <strong>
            ${data.orders.length}
          </strong>

          <small>
            Excludes cancelled
          </small>
        </article>


        <article class="demo-kpi">
          <span>
            Average Order
          </span>

          <strong>
            ${ctx.money(
              data.averageOrder
            )}
          </strong>

          <small>
            Sales ÷ orders
          </small>
        </article>


        <article class="demo-kpi">
          <span>
            Gross Profit
          </span>

          <strong>
            ${ctx.money(
              data.grossProfit
            )}
          </strong>

          <small>
            Sales − cost
          </small>
        </article>


        <article class="demo-kpi">
          <span>
            Margin
          </span>

          <strong>
            ${data.margin.toFixed(
              1
            )}%
          </strong>

          <small>
            Gross margin
          </small>
        </article>

      </div>


      <div class="demo-dashboard-grid">

        <section class="demo-card">

          <div class="demo-card-head">

            <div>
              <h2>
                Sales Overview
              </h2>

              <p>
                Sales from demo orders.
              </p>
            </div>

          </div>


          ${
            daily.length
              ? `
                <div class="demo-sales-chart">

                  ${daily
                    .map(
                      ([date, value]) => {

                        const height =
                          Math.max(
                            8,
                            value /
                            maxSale *
                            100
                          );

                        return `
                          <div
                            class="
                              demo-sales-column
                            "
                          >

                            <div
                              class="
                                demo-sales-value
                              "
                            >
                              ${ctx.money(
                                value
                              )}
                            </div>

                            <div
                              class="
                                demo-sales-bar-wrap
                              "
                            >
                              <div
                                class="
                                  demo-sales-bar
                                "
                                style="
                                  height:
                                  ${height}%
                                "
                              ></div>
                            </div>

                            <small>
                              ${new Date(
                                date
                              ).toLocaleDateString(
                                [],
                                {
                                  day:
                                    "numeric",

                                  month:
                                    "short"
                                }
                              )}
                            </small>

                          </div>
                        `;
                      }
                    )
                    .join("")}

                </div>
              `
              : `
                <div class="demo-note">
                  No sales in this period yet.
                </div>
              `
          }

        </section>


        <section class="demo-card">

          <div class="demo-card-head">

            <div>
              <h2>
                Top Products
              </h2>

              <p>
                Ranked by sales.
              </p>
            </div>

          </div>


          ${
            top.length
              ? top
                  .map(
                    (
                      product,
                      index
                    ) => `
                      <div
                        class="
                          demo-dashboard-product
                        "
                      >

                        <span
                          class="
                            demo-dashboard-rank
                          "
                        >
                          ${index + 1}
                        </span>

                        <div>
                          <b>
                            ${product.name}
                          </b>

                          <small>
                            ${product.qty}
                            sold
                          </small>
                        </div>

                        <strong>
                          ${ctx.money(
                            product.sales
                          )}
                        </strong>

                      </div>
                    `
                  )
                  .join("")
              : `
                <div class="demo-note">
                  No product sales yet.
                </div>
              `
          }

        </section>

      </div>
    `;
  }

  /* =========================================================
     PUBLIC
  ========================================================= */

  window.HBBDemoDashboard = {
    panelHtml,
    setRange,
    metrics,
    topProducts,
    salesByDay
  };
})();
