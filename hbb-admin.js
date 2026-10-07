(() => {
  'use strict';
  const cfg=window.SHIZUKU_SUPABASE||{};
  const client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const app=document.getElementById('app'), message=document.getElementById('message');
  const workspaceId=new URLSearchParams(location.search).get('workspace');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let workspace, settings, section='settings', busy=false;
  const notice=text=>{message.textContent=text;};
  const field=(name,label,value='',type='text')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="any"':''}></label>`;
  const config=()=>settings.settings||{};
  async function start(){
    const {data,error}=await client.auth.getUser();
    if(error||!data.user)return login();
    document.getElementById('account').innerHTML=`${esc(data.user.email)} <button id="logout">Sign out</button>`;
    document.getElementById('logout').onclick=async()=>{await client.auth.signOut();location.reload();};
    const accepted=await client.rpc('accept_slow_studio_hbb_invitation');
    if(accepted.error) {login();return notice('Please sign in again with your email and password to verify this session.');}
    // RLS, not the URL, decides which workspace the current user can access.
    if(!workspaceId){
      const result=await client.from('slow_studio_workspaces').select('id,name,country_code').order('name');
      if(result.error)return notice(result.error.message);
      app.innerHTML=`<section><h2>Your workspaces</h2>${(result.data||[]).map(w=>`<p><a href="/hbb-admin.html?workspace=${encodeURIComponent(w.id)}">${esc(w.name)} · ${esc(w.country_code)}</a></p>`).join('')||'<p>No active workspace invitation. Contact OneTouch Studio.</p>'}</section>`;
      return;
    }
    const result=await client.from('slow_studio_workspaces').select('id,name,country_code,currency_code,status,owner_notification_email,owner_order_email_enabled,customer_confirmation_email_enabled,customer_ready_email_enabled,whatsapp_enabled').eq('id',workspaceId).maybeSingle();
    if(result.error||!result.data){app.textContent='Workspace not available for this login.';return;}
    workspace=result.data;
    const store=await client.from('slow_studio_store_settings').select('*').eq('workspace_id',workspaceId).single();
    if(store.error)return notice(store.error.message);
    settings=store.data;
    await render();
  }
  function login(){
    app.innerHTML=`<section class="login"><h2>HBB sign in</h2><p>Use your invited email and your own password.</p><form id="login">${field('email','Email','','email')}${field('password','Password','','password')}<button>Sign in</button></form></section>`;
    app.querySelector('[name=email]').autocomplete='username';app.querySelector('[name=password]').autocomplete='current-password';
    document.getElementById('login').onsubmit=async e=>{
      e.preventDefault();if(busy)return;busy=true;
      const button=e.target.querySelector('button');button.disabled=true;
      const email=e.target.elements.email.value, password=e.target.elements.password.value;
      const {error}=await client.auth.signInWithPassword({email,password});
      e.target.elements.password.value='';busy=false;button.disabled=false;
      if(error)return notice('Sign-in failed. Check your email and password.');
      notice('');await start();
    };
  }
  async function render(){
    const navigation=[['settings','Settings'],['products','Products'],['inventory','Inventory'],['orders','Orders'],['availability','Availability'],['promotions','Promos'],['reviews','Reviews'],['rewards','Rewards'],['costing','Costing'],['purchases','Stock purchases'],['cashflow','Cash flow'],['themes','Themes'],['marketing','Marketing & membership'],['messages','Messages']];
    app.innerHTML=`<h2>${esc(workspace.name)} · ${esc(workspace.currency_code)}</h2><p class="notice">${workspace.status==='live'?'Live workspace. Every record is isolated to this business.':'Setup mode. Complete collection and payment details before making the customer shop live.'}</p><nav>${navigation.map(([key,label])=>`<button data-section="${key}">${label}</button>`).join('')}</nav><section id="content"></section>`;
    app.querySelectorAll('[data-section]').forEach(button=>button.onclick=()=>{section=button.dataset.section;notice('');render();});
    const content=document.getElementById('content');
    if(section==='settings'){
      const s=config(),my=workspace.country_code==='MY';
      const checked=value=>value!==false?'checked':'';
      content.innerHTML=`<h2>Collection & payment setup</h2><p class="muted">${my?'+60 · Touch ’n Go / bank transfer':'+65 · PayNow'}. These details belong only to ${esc(workspace.name)}.</p><form id="settingsForm">${field('store_name','Store name',settings.store_name)}<label>Collection address<textarea name="collection_address">${esc(s.collection_address)}</textarea></label>${field('collection_hours','Collection dates / timings',s.collection_hours)}${field('payment_name','Show recipient name to customers',s.payment_name)}${field('payment_phone',my?'Touch ’n Go phone number':'PayNow phone number',s.payment_phone)}${my?field('bank_name','Bank name',s.bank_name)+field('bank_account','Bank account number',s.bank_account):''}
      <h3>Email & WhatsApp notifications</h3>
      ${field('owner_notification_email','Order notification email',workspace.owner_notification_email,'email')}
      <label class="check"><input name="owner_order_email_enabled" type="checkbox" ${checked(workspace.owner_order_email_enabled)}> Email me about new orders, payment updates and Ready for Collection</label>
      <label class="check"><input name="customer_confirmation_email_enabled" type="checkbox" ${checked(workspace.customer_confirmation_email_enabled)}> Send customer Email 1 after payment proof and Email 2 after confirmation</label>
      <label class="check"><input name="customer_ready_email_enabled" type="checkbox" ${checked(workspace.customer_ready_email_enabled)}> Send customer Email 3 when I mark Ready for Collection</label>
      <label class="check"><input name="whatsapp_enabled" type="checkbox" ${checked(workspace.whatsapp_enabled)}> Show WhatsApp actions</label>
      <h3>Editable customer email templates</h3>
      ${field('payment_review_email_subject_template','Email 1 subject',s.payment_review_email_subject_template||'We received your order · {order_number}')}
      ${field('payment_review_email_heading_template','Email 1 heading',s.payment_review_email_heading_template||'Hi {customer_name}, we received your order')}
      <label>Email 1 message<textarea name="payment_review_email_message_template">${esc(s.payment_review_email_message_template||'Your payment screenshot has been submitted for review. We’ll email you again once your order is confirmed.')}</textarea></label>
      ${field('customer_email_subject_template','Email 2 subject',s.customer_email_subject_template||'Your order is confirmed · {order_number}')}
      ${field('customer_email_heading_template','Email 2 heading',s.customer_email_heading_template||'Your order is confirmed')}
      <label>Email 2 message<textarea name="customer_email_message_template">${esc(s.customer_email_message_template||`Thank you for ordering with ${workspace.name}. We look forward to preparing your order.`)}</textarea></label>
      ${field('customer_ready_email_subject_template','Email 3 subject',s.customer_ready_email_subject_template||'Your order is ready for collection · {order_number}')}
      ${field('customer_ready_email_heading_template','Email 3 heading',s.customer_ready_email_heading_template||'Your order is ready for collection')}
      <label>Email 3 message<textarea name="customer_ready_email_message_template">${esc(s.customer_ready_email_message_template||'Your order is ready for collection. We look forward to seeing you at your selected pickup time.')}</textarea></label>
      <p class="muted">Variables: {customer_name} {order_number} {date} {time} {collection_point} {total}</p>
      <button>Save settings</button></form>`;
      document.getElementById('settingsForm').onsubmit=async e=>{
        e.preventDefault();const fields=new FormData(e.target);
        const next={...s};for(const key of ['collection_address','collection_hours','payment_name','payment_phone','bank_name','bank_account','payment_review_email_subject_template','payment_review_email_heading_template','payment_review_email_message_template','customer_email_subject_template','customer_email_heading_template','customer_email_message_template','customer_ready_email_subject_template','customer_ready_email_heading_template','customer_ready_email_message_template'])if(fields.has(key))next[key]=String(fields.get(key)).trim();
        const storeName=String(fields.get('store_name')).trim();
        const workspaceUpdate={name:storeName,owner_notification_email:String(fields.get('owner_notification_email')).trim(),owner_order_email_enabled:fields.has('owner_order_email_enabled'),customer_confirmation_email_enabled:fields.has('customer_confirmation_email_enabled'),customer_ready_email_enabled:fields.has('customer_ready_email_enabled'),whatsapp_enabled:fields.has('whatsapp_enabled'),updated_at:new Date().toISOString()};
        await save(e.target,async()=>{const a=await client.from('slow_studio_store_settings').update({store_name:storeName,settings:next,updated_at:new Date().toISOString()}).eq('workspace_id',workspaceId).select('workspace_id');if(a.error)return a;const b=await client.from('slow_studio_workspaces').update(workspaceUpdate).eq('id',workspaceId).select('id');return b;},async()=>{settings.settings=next;settings.store_name=storeName;Object.assign(workspace,workspaceUpdate);});
      };
      return;
    }
    if(section==='marketing')return renderMarketing(content);
    if(section==='messages')return renderMessages(content);
    if(['availability','promotions','reviews','rewards','costing','purchases','cashflow','themes'].includes(section))return renderWorkspaceRecords(content);
    const table={products:'slow_studio_products',inventory:'slow_studio_inventory',orders:'slow_studio_orders'}[section];
    const fields=section==='orders'?'id,order_number,customer_name,status,payment_status,total':section==='products'?'id,name,price,stock':'id,name,quantity,unit,unit_cost';
    const result=await client.from(table).select(fields).eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(100);
    if(result.error){content.textContent='This section is unavailable for your role.';return notice(result.error.message);}
    const rows=result.data||[];
    if(section==='orders'){
      content.innerHTML=`<h2>Orders</h2><p>Changing payment to Paid sends Email 2. Changing order status to Ready for Collection sends Email 3 when enabled.</p><div class="table"><table><thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th>Order status</th><th>Total (${esc(workspace.currency_code)})</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.order_number)}</td><td>${esc(row.customer_name)}</td><td><select data-payment="${esc(row.id)}">${['awaiting_payment','submitted','paid','rejected'].map(v=>`<option ${row.payment_status===v?'selected':''} value="${v}">${v.replaceAll('_',' ')}</option>`).join('')}</select></td><td><select data-status="${esc(row.id)}">${['pending','confirmed','preparing','ready_for_collection','collected','cancelled'].map(v=>`<option ${row.status===v?'selected':''} value="${v}">${v.replaceAll('_',' ')}</option>`).join('')}</select></td><td>${esc(row.total)}</td></tr>`).join('')||'<tr><td colspan="5">No orders yet.</td></tr>'}</tbody></table></div>`;
      content.querySelectorAll('[data-payment]').forEach(select=>select.onchange=()=>updateOrder(select.dataset.payment,{payment_status:select.value}));
      content.querySelectorAll('[data-status]').forEach(select=>select.onchange=()=>updateOrder(select.dataset.status,{status:select.value}));
      return;
    }
    const product=section==='products';
    content.innerHTML=`<h2>${product?'Products':'Inventory'}</h2><form id="itemForm"><input type="hidden" name="id"><div class="grid">${field('name','Name')}${product?field('price',`Price (${workspace.currency_code})`,0,'number')+field('stock','Stock',0,'number'):field('quantity','Quantity',0,'number')+field('unit','Unit (e.g. ml, g, pcs)')+field('unit_cost',`Cost per unit (${workspace.currency_code})`,0,'number')}</div><button>Save item</button> <button type="reset">New item</button></form><div class="table"><table><tbody>${rows.map(row=>`<tr><td>${esc(row.name)}</td><td>${esc(product?row.price:row.unit_cost)} ${esc(workspace.currency_code)}</td><td>${esc(product?row.stock:row.quantity)} ${product?'':esc(row.unit)}</td><td><button data-edit="${esc(row.id)}">Edit</button></td></tr>`).join('')||'<tr><td>No items yet.</td></tr>'}</tbody></table></div>`;
    const form=document.getElementById('itemForm');form.elements.name.required=true;
    content.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>{const row=rows.find(r=>r.id===button.dataset.edit);for(const [key,value]of Object.entries(row))if(form.elements[key])form.elements[key].value=value??'';form.scrollIntoView({behavior:'smooth'});});
    form.onsubmit=async e=>{
      e.preventDefault();const fields=new FormData(form),id=String(fields.get('id')||'');
      const record={name:String(fields.get('name')).trim(),updated_at:new Date().toISOString()};
      for(const key of (product?['price','stock']:['quantity','unit_cost'])){const n=Number(fields.get(key));if(!Number.isFinite(n)||n<0)return notice('Enter a valid non-negative number.');record[key]=n;}
      if(!product)record.unit=String(fields.get('unit')).trim();
      await save(form,()=>id?client.from(table).update(record).eq('workspace_id',workspaceId).eq('id',id).select('id'):client.from(table).insert({...record,workspace_id:workspaceId}).select('id'),render);
    };
  }
  async function updateOrder(id,patch){
    const result=await client.from('slow_studio_orders').update({...patch,updated_at:new Date().toISOString()}).eq('workspace_id',workspaceId).eq('id',id).select('id');
    if(result.error)return notice(result.error.message);
    notice(patch.status==='ready_for_collection'?'Saved. Email 3 has been queued if it is enabled and the customer has an email.':'Order updated.');
  }
  async function renderMarketing(content){
    const result=await client.from('slow_studio_marketing_contacts').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(200);
    if(result.error)return notice(result.error.message);
    const rows=result.data||[];
    content.innerHTML=`<h2>Marketing & membership</h2><form id="contactForm"><div class="grid">${field('name','Customer name')}${field('email','Email','','email')}${field('phone',workspace.country_code==='MY'?'Phone (+60)':'Phone (+65)')}</div><label class="check"><input name="email_opt_in" type="checkbox"> Email marketing consent</label><label class="check"><input name="whatsapp_opt_in" type="checkbox"> WhatsApp marketing consent</label><button>Add customer</button></form><div class="table"><table><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Consent</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.phone)}</td><td>${r.unsubscribed_at?'Unsubscribed':[r.email_opt_in?'Email':'',r.whatsapp_opt_in?'WhatsApp':''].filter(Boolean).join(', ')||'None'}</td></tr>`).join('')||'<tr><td colspan="4">No contacts yet.</td></tr>'}</tbody></table></div>`;
    document.getElementById('contactForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await save(e.target,()=>client.from('slow_studio_marketing_contacts').insert({workspace_id:workspaceId,name:String(f.get('name')).trim(),email:String(f.get('email')).trim()||null,phone:String(f.get('phone')).trim()||null,email_opt_in:f.has('email_opt_in'),whatsapp_opt_in:f.has('whatsapp_opt_in')}).select('id'),render);};
  }
  async function renderMessages(content){
    const result=await client.from('slow_studio_messages').select('id,order_id,sender_type,message,created_at').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(200);
    if(result.error)return notice(result.error.message);
    content.innerHTML=`<h2>Customer messages</h2>${(result.data||[]).map(r=>`<article><b>${esc(r.sender_type)}</b> · ${esc(new Date(r.created_at).toLocaleString())}<p>${esc(r.message)}</p><small>Order: ${esc(r.order_id||'—')}</small></article>`).join('')||'<p>No messages yet.</p>'}`;
  }
  async function renderWorkspaceRecords(content){
    const types={availability:'availability',promotions:'promotion',reviews:'review',rewards:'reward',costing:'recipe',purchases:'stock_purchase',cashflow:'cash_flow',themes:'theme'};
    const labels={availability:'Availability',promotions:'Promos',reviews:'Reviews',rewards:'Rewards',costing:'Recipes & costing',purchases:'Stock purchases',cashflow:'Cash flow',themes:'Themes'};
    const type=types[section],label=labels[section];
    const result=await client.from('slow_studio_workspace_records').select('*').eq('workspace_id',workspaceId).eq('record_type',type).order('created_at',{ascending:false}).limit(200);
    if(result.error){content.textContent='This section is unavailable for your role.';return notice(result.error.message);}
    const rows=result.data||[], money=['promotion','recipe','stock_purchase','cash_flow'].includes(type);
    content.innerHTML=`<h2>${label}</h2><p class="muted">All records belong only to ${esc(workspace.name)}. ${money?`Amounts use ${esc(workspace.currency_code)}.`:''}</p><form id="recordForm"><input type="hidden" name="id"><div class="grid">${field('title',recordTitle(type))}${money?field('amount',`Amount (${workspace.currency_code})`,'','number'):''}${field('status','Status','active')}</div><label>Details<textarea name="details" placeholder="${esc(recordHint(type))}"></textarea></label><button>Save record</button> <button type="reset">New record</button></form><div class="table"><table><thead><tr><th>${esc(recordTitle(type))}</th>${money?'<th>Amount</th>':''}<th>Status</th><th>Details</th><th></th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.title)}</td>${money?`<td>${row.amount==null?'—':esc(row.amount)+' '+esc(workspace.currency_code)}</td>`:''}<td>${esc(row.status)}</td><td>${esc(row.data?.details||'')}</td><td><button data-record-edit="${esc(row.id)}">Edit</button></td></tr>`).join('')||`<tr><td colspan="${money?5:4}">No records yet.</td></tr>`}</tbody></table></div>`;
    const form=document.getElementById('recordForm');form.elements.title.required=true;
    content.querySelectorAll('[data-record-edit]').forEach(button=>button.onclick=()=>{const row=rows.find(r=>r.id===button.dataset.recordEdit);form.elements.id.value=row.id;form.elements.title.value=row.title;form.elements.status.value=row.status||'active';form.elements.details.value=row.data?.details||'';if(form.elements.amount)form.elements.amount.value=row.amount??'';form.scrollIntoView({behavior:'smooth'});});
    form.onsubmit=async e=>{
      e.preventDefault();const f=new FormData(form),id=String(f.get('id')||'');
      const record={record_type:type,title:String(f.get('title')).trim(),status:String(f.get('status')||'active').trim(),data:{details:String(f.get('details')||'').trim()},updated_at:new Date().toISOString()};
      if(money){const raw=String(f.get('amount')||'').trim();record.amount=raw===''?null:Number(raw);if(record.amount!==null&&(!Number.isFinite(record.amount)||record.amount<0))return notice('Enter a valid non-negative amount.');}
      await save(form,()=>id?client.from('slow_studio_workspace_records').update(record).eq('workspace_id',workspaceId).eq('id',id).select('id'):client.from('slow_studio_workspace_records').insert({...record,workspace_id:workspaceId}).select('id'),render);
    };
  }
  function recordTitle(type){return({availability:'Date / collection slot',promotion:'Promo code / campaign',review:'Customer / item',reward:'Customer',recipe:'Product / recipe',stock_purchase:'Inventory item',cash_flow:'Entry name',theme:'Theme name'})[type]||'Name';}
  function recordHint(type){return({availability:'Time, capacity, collection address and notes',promotion:'Discount, minimum spend, usage limit and validity',review:'Drink item, rating, review text and approval status',reward:'Phone/email, stamp balance and reward notes',recipe:'Ingredients, quantities, units and per-serving cost',stock_purchase:'Quantity, unit, supplier, purchase date and receipt notes',cash_flow:'Income or expense, date, category and notes',theme:'Primary/background/accent colours, fonts and whether active'})[type]||'Add record details';}
  async function save(form,operation,after){
    if(busy)return;busy=true;const button=form.querySelector('button');button.disabled=true;
    try{const {error,data}=await operation();if(error)throw error;if(!data?.length)throw new Error('No record saved. Check workspace permissions.');await after();notice('Saved.');}
    catch(error){notice(error.message||'Could not save.');}finally{busy=false;button.disabled=false;}
  }
  start().catch(()=>{app.textContent='Unable to open this workspace. Please reload.';});
})();
