const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("./admin-market-rules.js");

test("Singapore dashboard orders exclude Malaysia orders and legacy orders default to Singapore", () => {
  const orders = [
    { id: 1, market_code: "SG" },
    { id: 2, market_code: "MY" },
    { id: 3 },
  ];
  assert.deepEqual(rules.ordersForMarket(orders, "SG").map((order) => order.id), [1, 3]);
  assert.deepEqual(rules.ordersForMarket(orders, "MY").map((order) => order.id), [2]);
});

test("Singapore food cost ignores Malaysia recipes and inventory", () => {
  const recipes = [
    { product_id: 10, inventory_item_id: 1, quantity_used: 2, market_code: "SG" },
    { product_id: 10, inventory_item_id: 2, quantity_used: 100, market_code: "MY" },
  ];
  const inventory = [
    { id: 1, market_code: "SG", unit_cost: 1.5 },
    { id: 2, market_code: "MY", unit_cost: 9 },
  ];
  const cost = rules.savedProductFoodCost({ recipes, inventory, productId: 10, market: "SG", unitCost: (item) => item.unit_cost });
  assert.equal(cost, 3);
});

test("Singapore costing includes Shizuku Duo and Mix & Match bundle products", () => {
  const menu = [
    { id: 10, name: "Shizuku Duo", is_bundle: true },
    { id: 28, name: "Shizuku Mix & Match", is_bundle: true },
    { id: 1, name: "Matcha Latte", is_bundle: false },
  ];
  assert.deepEqual(rules.productsForCostingMarket(menu, "SG").map((product) => product.name), ["Shizuku Duo", "Shizuku Mix & Match", "Matcha Latte"]);
});

test("Malaysia costing only shows Malaysia-enabled products, including eligible bundles", () => {
  const menu = [
    { id: 10, name: "Shizuku Duo", is_bundle: true, malaysia_available: true },
    { id: 28, name: "Shizuku Mix & Match", is_bundle: true, malaysia_available: false },
    { id: 1, name: "Matcha Latte", malaysia_available: true },
  ];
  assert.deepEqual(rules.productsForCostingMarket(menu, "MY").map((product) => product.name), ["Shizuku Duo", "Matcha Latte"]);
});
