(() => {
  const status=document.getElementById("unsubscribeStatus"),button=document.getElementById("unsubscribeButton");
  const params=new URLSearchParams(location.search),token=params.get("token")||"",workspace=params.get("workspace")||"";
  if(!/^[0-9a-f-]{36}$/i.test(token)){button.disabled=true;status.textContent="This unsubscribe link is invalid or incomplete.";return;}
  const cfg=window.SHIZUKU_SUPABASE||{};
  if(!window.supabase||!cfg.url||!cfg.anonKey){button.disabled=true;status.textContent="Email preferences are temporarily unavailable.";return;}
  const db=window.supabase.createClient(cfg.url,cfg.anonKey);
  button.addEventListener("click",async()=>{
    button.disabled=true;button.textContent="Updating…";
    const request=workspace&&/^[0-9a-f-]{36}$/i.test(workspace)
      ?db.rpc("unsubscribe_slow_studio_email",{p_workspace_id:workspace,p_token:token})
      :db.rpc("unsubscribe_shizuku_email",{p_token:token});
    const{data,error}=await request;
    if(error||!data?.ok){status.textContent="We could not update this preference. Please contact the store.";button.disabled=false;button.textContent="Try again";return;}
    const store=String(data.store_name||"The store").replace(/[<>]/g,"");
    button.textContent="Marketing emails stopped";status.innerHTML="You are now unsubscribed from <b>marketing emails</b>. Order confirmation, payment updates and ready-for-collection emails will continue. "+store+" has been notified.";
  });
})();
