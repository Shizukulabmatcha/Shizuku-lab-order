(() => {
  const MIN=-40,MAX=40;
  const dial=document.getElementById('dial'),status=document.getElementById('dialStatus');
  const create=document.getElementById('createOption'),login=document.getElementById('loginOption');
  document.getElementById('dialTicks').innerHTML=Array.from({length:17},(_,i)=>`<i style="transform:rotate(${i*5-40}deg) translateY(-114px)"></i>`).join('');
  let angle=0,drag=null;
  const clamp=value=>Math.max(MIN,Math.min(MAX,value));
  const pointerAngle=event=>{const rect=dial.getBoundingClientRect();return Math.atan2(event.clientY-(rect.top+rect.height/2),event.clientX-(rect.left+rect.width/2))*180/Math.PI;};
  const delta=(from,to)=>{let value=to-from;if(value>180)value-=360;if(value<-180)value+=360;return value;};
  function paint(){dial.style.transform=`rotate(${angle}deg)`;dial.setAttribute('aria-valuenow',String(Math.round(angle)));const left=angle<=-20,right=angle>=20;dial.setAttribute('aria-valuetext',left?'Create account':right?'Log in':'Neutral');create.classList.toggle('is-active',left);login.classList.toggle('is-active',right);status.textContent=left?'CREATE ACCOUNT':right?'LOG IN':'TURN TO BEGIN';status.disabled=!left&&!right;}
  function choose(next,navigate=true){angle=next<=-20?MIN:next>=20?MAX:0;paint();if(navigate&&angle)window.setTimeout(()=>{location.href=angle<0?'/shizuku-account?mode=create':'/shizuku-account?mode=login';},220);}
  create.addEventListener('click',()=>choose(MIN));login.addEventListener('click',()=>choose(MAX));status.addEventListener('click',()=>choose(angle));
  dial.addEventListener('pointerdown',event=>{drag={pointer:pointerAngle(event),dial:angle};dial.setPointerCapture(event.pointerId);dial.classList.add('is-dragging');});
  dial.addEventListener('pointermove',event=>{if(!drag)return;angle=clamp(drag.dial+delta(drag.pointer,pointerAngle(event)));paint();});
  dial.addEventListener('pointerup',event=>{if(!drag)return;drag=null;dial.classList.remove('is-dragging');dial.releasePointerCapture(event.pointerId);choose(angle);});
  dial.addEventListener('pointercancel',()=>{drag=null;dial.classList.remove('is-dragging');choose(0,false);});
  dial.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();choose(MIN,false);}if(event.key==='ArrowRight'){event.preventDefault();choose(MAX,false);}if(event.key==='Home'){event.preventDefault();choose(0,false);}if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(angle);}});
  paint();
})();
