const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(new URL("./app.js", `file://${__dirname}/`), "utf8");
const adminSource = fs.readFileSync(new URL("./admin.js", `file://${__dirname}/`), "utf8");

test("Malaysia customer slots use the Malaysia weekly schedule and limits", () => {
  assert.match(appSource, /state\.market === "MY" \? state\.store\.malaysia_weekly_pickup_schedule/);
  assert.match(appSource, /state\.market === "MY" \? state\.store\.malaysia_order_advance_days/);
  assert.match(appSource, /state\.market === "MY" \? state\.store\.malaysia_minimum_order_notice_hours/);
  assert.match(appSource, /String\(item\.market_code \|\| "SG"\) === state\.market/);
});

test("Admin keeps Singapore and Malaysia availability separate", () => {
  assert.match(adminSource, /market_code: astate\.availabilityMarket/);
  assert.match(adminSource, /onConflict: "market_code,collection_date"/);
  assert.match(adminSource, /malaysia_weekly_pickup_schedule/);
  assert.match(adminSource, /openMalaysiaAvailability/);
});
