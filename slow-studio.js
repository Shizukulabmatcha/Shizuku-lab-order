(() => {
 const status=document.getElementById('status'),entries=document.getElementById('entries'),signout=document.getElementById('signout');
 const cards=[['Brand Web','Shizuku Lab brand website','/shizuku-website','/cms'],['Malaysia Admin','Manage Malaysia orders and products','/workspace/shizuku-lab-my.html?market=MY'],['Malaysia Store','Malaysia · MYR','/my'],['Singapore Admin','Manage Singapore orders and products','/workspace/shizuku-lab-sg.html?market=SG'],['Singapore Store','Singapore · SGD','/'],['Singapore Demo','Complete demo workspace · SGD','/demo/singapore'],['Malaysia Demo','Complete demo workspace · MYR','/demo/malaysia']];
 // This hub contains navigation only. Each admin destination enforces its own authentication and permissions.
 entries.innerHTML=cards.map(([title,caption,url,admin])=>`<article class="card"><h2>${title}</h2><p>${caption}</p><a class="open" href="${url}">Open →</a>${admin?`<a class="secondary" href="${admin}">Edit brand website →</a>`:''}</article>`).join('');
 entries.hidden=false;
 status.textContent='Your brand website, both country stores and both demos, together in one place. Admin pages require your Shizuku Lab login.';
 signout.hidden=true;
 const login=document.createElement('a');login.href='/shizuku-account?mode=login';login.textContent='Shizuku Lab login →';login.className='secondary';status.after(login);
})();
