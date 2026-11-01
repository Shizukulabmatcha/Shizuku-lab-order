/* In-person sales. Payment is never inferred from displaying a QR. */
function popupItems() { return (astate.popupDraft?.items || []); }
function popupAvailableProducts() { return offlineOrderProducts().filter(product => Number(product.ritual_validity_weeks||0) <= 0); }
function popupProduct(id) { return popupAvailableProducts().find(product => String(product.id) === String(id)); }
function popupOptionGroups(productId) {
  const linked = new Set(astate.productOptionGroups.filter(row => String(row.product_id) === String(productId)).map(row => String(row.option_group_id)));
  return astate.optionGroups.filter(group => linked.has(String(group.id)) && group.is_visible !== false && (DASHBOARD_MARKET === "MY" ? group.show_in_malaysia !== false : group.show_in_singapore !== false));
}
function popupNewSale() { astate.popupDraft = { items: [], customer_name: "Walk-in", payment_method: "cash" }; astate.popupPaymentOrder = null; render(); }
function popupAddProduct(id) {
  if (!astate.popupDraft) popupNewSale();
  const product = popupProduct(id); if (!product) return;
  astate.popupDraft.items.push({ product_id: product.id, product_name: product.name, quantity: 1, base_price: adminMarketProductPrice(product), options: [] });
  render();
}
function popupChangeQuantity(index, value) { const item=popupItems()[index];if(!item)return;item.quantity=Math.max(1,Math.floor(Number(value)||1));render(); }
function popupRemoveItem(index) { popupItems().splice(index,1);render(); }
function popupSelectOption(index, groupId, optionId) {
  const item=popupItems()[index];if(!item)return;
  item.options=item.options.filter(row=>String(row.group_id)!==String(groupId));
  if(optionId){const option=astate.options.find(row=>String(row.id)===String(optionId)&&String(row.option_group_id)===String(groupId)&&row.is_available!==false);if(option)item.options.push({group_id:groupId,option_id:option.id,option_name:option.name,price:Number(option.price||0)});}
  render();
}
function popupLinePrice(item) { return Math.max(0,Number(item.base_price||0)+(item.options||[]).reduce((sum,option)=>sum+Number(option.price||0),0)); }
function popupTotal() { return Math.round(popupItems().reduce((sum,item)=>sum+popupLinePrice(item)*Number(item.quantity||0),0)*100)/100; }
function popupAllRequiredOptionsSelected() {
  return popupItems().every(item=>popupOptionGroups(item.product_id).filter(group=>group.required).every(group=>(item.options||[]).some(option=>String(option.group_id)===String(group.id))));
}
function popupQrPayload(amount, reference) {
  const number=String(astate.settings?.paynow_number||"").replace(/\s+/g,"");
  if(!number)throw new Error("Set your PayNow number in Store Details first.");
  const tlv=(id,value)=>id+String(value.length).padStart(2,"0")+value;
  const expiry=new Date(Date.now()+15*60*1000),pad=value=>String(value).padStart(2,"0");
  const expires=`${expiry.getFullYear()}${pad(expiry.getMonth()+1)}${pad(expiry.getDate())}${pad(expiry.getHours())}${pad(expiry.getMinutes())}${pad(expiry.getSeconds())}`;
  const merchant=tlv("00","SG.PAYNOW")+tlv("01","0")+tlv("02",number)+tlv("03","0")+tlv("04",expires);
  let payload=tlv("00","01")+tlv("01","12")+tlv("26",merchant)+tlv("52","0000")+tlv("53","702")+tlv("54",Number(amount).toFixed(2))+tlv("58","SG")+tlv("59",String(astate.settings?.paynow_name||astate.settings?.store_name||"SHIZUKU LAB").slice(0,25))+tlv("60","Singapore")+tlv("62",tlv("01",String(reference||"").slice(0,25)))+"6304";
  let crc=0xffff;for(let i=0;i<payload.length;i++){crc^=payload.charCodeAt(i)<<8;for(let bit=0;bit<8;bit++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;}
  return payload+crc.toString(16).toUpperCase().padStart(4,"0");
}
function popupQrHtml(order) {
  if(DASHBOARD_MARKET==="MY")return astate.settings?.touchngo_qr_url?`<img class="popup-payment-qr" src="${escapeHtml(astate.settings.touchngo_qr_url)}" alt="Touch ’n Go payment QR">`:'<p class="ref-note">Add your Touch ’n Go QR in Store Details before accepting QR payments.</p>';
  try { const qr=qrcode(0,"M");qr.addData(popupQrPayload(order.total,order.order_number));qr.make();return `<div class="popup-payment-qr">${qr.createSvgTag({cellSize:5,margin:2})}</div>`; }
  catch(error){return `<p class="ref-note">${escapeHtml(error.message||"Could not create PayNow QR.")}</p>`;}
}
async function popupSaveSale() {
  const draft=astate.popupDraft;if(!draft||astate.popupSaving)return;
  if(!popupItems().length)return alert("Add a product first.");
  if(!popupAllRequiredOptionsSelected())return alert("Choose every required drink option before taking payment.");
  if(popupItems().some(item=>!popupProduct(item.product_id)))return alert("A selected product is no longer available in this store.");
  const total=popupTotal();if(total<=0)return alert("The sale total must be above zero.");
  const method=draft.payment_method;if(method!=="cash"&&DASHBOARD_MARKET==="SG"&&!astate.settings?.paynow_number)return alert("Set your PayNow number in Store Details first.");
  if(method!=="cash"&&DASHBOARD_MARKET==="MY"&&!astate.settings?.touchngo_qr_url)return alert("Upload a Touch ’n Go QR in Store Details first.");
  if(!IS_CONFIGURED)return alert("Pop-up sales need the live store database. Preview mode cannot take payment.");
  astate.popupSaving=true;render();let order=null;
  try {
    const number=`SL-P${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const now=new Date(),time=now.toLocaleTimeString("en-SG",{hour:"numeric",minute:"2-digit"});
    const payload={market_code:DASHBOARD_MARKET,currency_code:DASHBOARD_MARKET==="MY"?"MYR":"SGD",order_number:number,customer_name:String(draft.customer_name||"Walk-in").trim()||"Walk-in",customer_phone:"",customer_email:null,instagram:"",collection_date:localDateText(now),collection_time:null,collection_point:"Pop-up counter",notes:`Pop-up walk-in · ${time}`,total,payment_status:"awaiting_payment",order_status:"pending",payment_method:method==="cash"?"Cash":DASHBOARD_MARKET==="MY"?"Touch 'n Go":"PayNow",payment_reference:number,is_offline:true,offline_reason:"popup_sale",counts_as_sale:true};
    const created=await db.from("orders").insert(payload).select("*").single();if(created.error)throw created.error;order=created.data;
    const itemRows=popupItems().map(item=>({order_id:order.id,product_id:item.product_id,product_name:item.product_name,quantity:item.quantity,unit_price:popupLinePrice(item),subtotal:Math.round(popupLinePrice(item)*item.quantity*100)/100}));
    const inserted=await db.from("order_items").insert(itemRows).select("*");if(inserted.error)throw inserted.error;
    const optionRows=[];inserted.data.forEach((saved,index)=>(popupItems()[index].options||[]).forEach(option=>optionRows.push({order_item_id:saved.id,option_id:option.option_id,option_name:option.option_name,price:option.price})));
    if(optionRows.length){const result=await db.from("order_item_options").insert(optionRows);if(result.error)throw result.error;}
    if(method==="cash"){
      const paid=await db.from("orders").update({payment_status:"paid",order_status:"collected"}).eq("id",order.id).select("*").single();if(paid.error)throw paid.error;
      const stock=await db.rpc("reconcile_shizuku_order_inventory",{p_order_id:String(order.id)});if(stock.error)throw stock.error;
      astate.popupDraft=null;astate.popupPaymentOrder=null;await loadAll();alert(`Cash sale ${number} recorded. Inventory has been updated.`);
    }else{astate.popupDraft=null;astate.popupPaymentOrder=order;await loadAll();render();}
  }catch(error){alert(`Could not finish this pop-up sale${order?.order_number?` (${order.order_number})`:""}: ${error.message||error}. Check Orders before retrying to avoid a duplicate.`);}
  finally{astate.popupSaving=false;render();}
}
async function popupConfirmPayment() {
  const order=astate.popupPaymentOrder;if(!order||astate.popupSaving)return;
  if(!confirm(`Confirm ${money(order.total)} has arrived for ${order.order_number}? Displaying or scanning a QR alone does not confirm payment.`))return;
  astate.popupSaving=true;render();
  try{
    const paid=await db.from("orders").update({payment_status:"paid",order_status:"collected"}).eq("id",order.id).eq("payment_status","awaiting_payment").select("*").single();if(paid.error)throw paid.error;
    const stock=await db.rpc("reconcile_shizuku_order_inventory",{p_order_id:String(order.id)});if(stock.error)throw stock.error;
    astate.popupPaymentOrder=null;await loadAll();alert(`Payment confirmed for ${order.order_number}. Sale and inventory are updated.`);
  }catch(error){alert(`Could not finish payment confirmation: ${error.message||error}. Check Orders before retrying.`);}
  finally{astate.popupSaving=false;render();}
}
function renderPopupTab() {
  const draft=astate.popupDraft,products=popupAvailableProducts().filter(product=>Number(adminMarketProductPrice(product))>=0),pending=astate.popupPaymentOrder;
  const recent=ordersForMarket(DASHBOARD_MARKET).filter(order=>order.offline_reason==="popup_sale").slice(0,8);
  return `<style>.popup-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr);gap:18px}.popup-products{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.popup-product{border:1px solid var(--admin-line);border-radius:14px;background:var(--admin-card);color:var(--admin-text);padding:14px;text-align:left;cursor:pointer}.popup-product b,.popup-product span{display:block}.popup-product span{margin-top:8px;color:var(--admin-primary)}.popup-cart-row{border-bottom:1px solid var(--admin-line);padding:12px 0}.popup-cart-row-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.popup-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-top:10px}.popup-options label{font-size:.85rem}.popup-options select{width:100%;margin-top:4px}.popup-payment-qr{display:block;width:min(280px,100%);height:auto;max-height:280px;object-fit:contain;margin:18px auto;background:white;padding:10px;border:1px solid var(--admin-line);border-radius:14px}.popup-payment-qr svg{display:block;width:100%;height:auto}@media(max-width:800px){.popup-layout{grid-template-columns:1fr}}</style><div class="popup-layout"><section class="dashboard-card" style="padding:20px"><div class="dashboard-card-head"><div><h2>Pop-up counter · ${DASHBOARD_MARKET==="MY"?"MYR":"SGD"}</h2><span>Tap drinks to add them to this sale.</span></div><button class="btn-secondary" onclick="popupNewSale()">New sale</button></div><div class="popup-products">${products.map(product=>`<button class="popup-product" onclick="popupAddProduct('${product.id}')"><b>${escapeHtml(product.name)}</b><span>${money(adminMarketProductPrice(product))}</span></button>`).join("")||"No available products for this store."}</div></section><section class="dashboard-card" style="padding:20px"><h2 style="margin-top:0">${pending?"Awaiting QR payment":"Current sale"}</h2>${pending?`<p><b>${escapeHtml(pending.order_number)}</b> · ${money(pending.total)}</p><p>Let the customer scan. Check your account before confirming.</p>${popupQrHtml(pending)}<button class="btn-primary" style="width:100%" onclick="popupConfirmPayment()" ${astate.popupSaving?"disabled":""}>I received the payment</button><button class="btn-secondary" style="width:100%;margin-top:8px" onclick="astate.popupPaymentOrder=null;render()">Leave pending · check Orders later</button>`:draft?`${popupItems().map((item,index)=>`<div class="popup-cart-row"><div class="popup-cart-row-head"><b>${escapeHtml(item.product_name)}</b><button class="link-danger" onclick="popupRemoveItem(${index})">Remove</button></div><div class="popup-cart-row-head"><label>Qty <input type="number" min="1" step="1" value="${item.quantity}" style="width:75px" onchange="popupChangeQuantity(${index},this.value)"></label><strong>${money(popupLinePrice(item)*item.quantity)}</strong></div><div class="popup-options">${popupOptionGroups(item.product_id).map(group=>`<label>${escapeHtml(group.name)}${group.required?" *":""}<select onchange="popupSelectOption(${index},'${group.id}',this.value)"><option value="">Choose</option>${astate.options.filter(option=>String(option.option_group_id)===String(group.id)&&option.is_available!==false).map(option=>`<option value="${option.id}" ${(item.options||[]).some(row=>String(row.option_id)===String(option.id))?"selected":""}>${escapeHtml(option.name)}${Number(option.price)?` · +${money(option.price)}`:""}</option>`).join("")}</select></label>`).join("")}</div></div>`).join("")}<div class="row bold" style="margin:14px 0"><span>Total</span><span>${money(popupTotal())}</span></div><div class="field"><label>Customer (optional)</label><input value="${escapeHtml(draft.customer_name)}" oninput="astate.popupDraft.customer_name=this.value"></div><div class="field"><label>Payment</label><select onchange="astate.popupDraft.payment_method=this.value;render()"><option value="cash" ${draft.payment_method==="cash"?"selected":""}>Cash</option><option value="qr" ${draft.payment_method==="qr"?"selected":""}>${DASHBOARD_MARKET==="MY"?"Touch ’n Go QR":"PayNow QR"}</option></select></div><button class="btn-primary" style="width:100%" onclick="popupSaveSale()" ${astate.popupSaving||!popupItems().length?"disabled":""}>${draft.payment_method==="cash"?"Record cash sale":"Create QR payment"}</button>`:'<p>Start a new sale or tap a product.</p>'}</section></div><section class="dashboard-card" style="padding:20px;margin-top:18px"><h2>Recent pop-up sales</h2>${recent.map(order=>`<div class="row"><span>${escapeHtml(order.order_number)} · ${escapeHtml(order.payment_method||"")}</span><b>${money(order.total)} · ${order.payment_status==="paid"?"Paid":"Pending"}</b></div>`).join("")||"No pop-up sales yet."}</section>`;
}
