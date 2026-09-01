const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "admin.js"), "utf8");
const dashboardBlock = source.slice(source.indexOf("function dashboardStats()"), source.indexOf("function salesPerformance()"));

test("dashboard separates total and current-month sales and margins", () => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 2).toISOString();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 2).toISOString();
  const orders = [
    { id: "sg-current", market_code: "SG", payment_status: "paid", order_status: "collected", counts_as_sale: true, total: 10, created_at: thisMonth, order_items: [{ product_id: "p1", product_name: "Matcha", quantity: 2 }] },
    { id: "sg-previous", market_code: "SG", payment_status: "paid", order_status: "collected", counts_as_sale: true, total: 20, created_at: previousMonth, order_items: [{ product_id: "p1", product_name: "Matcha", quantity: 1 }] },
    { id: "sg-free", market_code: "SG", payment_status: "paid", order_status: "collected", counts_as_sale: false, total: 99, created_at: thisMonth, order_items: [{ product_id: "p1", product_name: "Matcha", quantity: 1 }] },
    { id: "my-current", market_code: "MY", payment_status: "paid", order_status: "collected", counts_as_sale: true, total: 100, created_at: thisMonth, order_items: [{ product_id: "p1", product_name: "Matcha", quantity: 1 }] },
  ];
  const context = {
    Date,
    DASHBOARD_MARKET: "SG",
    astate: { orders, menu: [{ id: "p1", name: "Matcha" }], recipes: [{ product_id: "p1", market_code: "SG" }] },
    ordersForMarket: () => orders.filter((order) => order.market_code === "SG"),
    paidOrders: () => orders.filter((order) => order.market_code === "SG" && order.payment_status === "paid" && order.order_status !== "cancelled"),
    AdminMarketRules: { recipesForProductMarket: () => [{}] },
    AdminOrderRules: { isPaymentReviewOrder: () => false },
    savedProductFoodCost: () => 2,
  };
  vm.createContext(context);
  vm.runInContext(dashboardBlock, context);
  const stats = context.dashboardStats();
  assert.equal(stats.monthlyRevenue, 10);
  assert.equal(stats.totalRevenue, 30);
  assert.equal(stats.monthlyFoodCost, 4);
  assert.equal(stats.totalFoodCost, 6);
  assert.equal(stats.monthlyGrossProfit, 6);
  assert.equal(stats.totalGrossProfit, 24);
  assert.equal(stats.monthlyProfitMargin, 60);
  assert.equal(stats.totalProfitMargin, 80);
  assert.equal(stats.orders, 1);
  assert.equal(stats.totalOrders, 2);
  assert.equal(stats.totalPaidOrders, 3);
});
