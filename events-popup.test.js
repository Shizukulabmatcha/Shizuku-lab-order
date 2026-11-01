const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const admin = fs.readFileSync(path.join(__dirname,"admin.js"),"utf8");
const popup = fs.readFileSync(path.join(__dirname,"popup-pos.js"),"utf8");
const customerApp = fs.readFileSync(path.join(__dirname,"app.js"),"utf8");

test("event cost uses linked costing item quantity and saved unit price",()=>{
  const start=admin.indexOf("const EVENT_COST_FIELDS =");
  const end=admin.indexOf("function openEventPackage(",start);
  const context={astate:{eventPackages:[]}};vm.createContext(context);vm.runInContext(admin.slice(start,end),context);
  const event={pax:10,price_per_pax:60,flat_fee:0,amount_paid:300,costs:{transport:50,linked_items:[{quantity:12,unit_cost:1.5}]}};
  assert.equal(context.eventNumbers(event).cost,68);
  assert.equal(context.eventNumbers(event).balance,300);
});

test("event report records received cash, not the uncollected quote",()=>{
  const start=admin.indexOf("const EVENT_COST_FIELDS =");
  const end=admin.indexOf("function openEventPackage(",start);
  const context={astate:{eventPackages:[{status:"confirmed",amount_paid:300,costs:{receipts:[{amount:300,date:"2026-10-31"}]}}]}};
  vm.createContext(context);vm.runInContext(admin.slice(start,end),context);
  assert.equal(context.eventReceiptTotal("2026-10-01","2026-10-31"),300);
  assert.equal(context.eventReceiptTotal("2026-11-01","2026-11-30"),0);
});

test("pop-up sale records a separate channel and only confirms QR payment manually",()=>{
  assert.match(popup,/offline_reason:"popup_sale"/);
  assert.match(popup,/payment_status:"awaiting_payment"/);
  assert.match(popup,/popupConfirmPayment\(\)/);
  assert.match(popup,/reconcile_shizuku_order_inventory/);
  assert.match(popup,/group\.required/);
});

test("pop-up PayNow payload matches the customer checkout QR format",()=>{
  const fixed=Date.UTC(2026,9,31,12,0,0);
  class FixedDate extends Date { static now(){return fixed;} }
  const context={Date:FixedDate,astate:{settings:{paynow_number:"+6591234567",paynow_name:"Shizuku Lab"}}};
  vm.createContext(context);
  vm.runInContext(customerApp.slice(customerApp.indexOf("const CRC_TABLE ="),customerApp.indexOf("/* ---------- store info ---------- */")),context);
  vm.runInContext(popup,context);
  const expected=context.buildPayNowPayload({mobile:"+6591234567",amount:12.5,refNumber:"SL-P12345",merchantName:"Shizuku Lab",expiresAt:fixed+15*60*1000});
  assert.equal(context.popupQrPayload(12.5,"SL-P12345"),expected);
});

