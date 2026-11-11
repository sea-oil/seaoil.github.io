(()=>{'use strict';
const config=window.COIL_CONFIG||{},$=s=>document.querySelector(s);
const configured=/^https:\/\/[^/]+\.supabase\.co$/.test(config.supabaseUrl||'') && /^(sb_publishable_|eyJ)/.test(config.supabasePublishableKey||'') && !!window.supabase?.createClient;
const api=configured?window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey):null;
const login=$('#admin-login'),dashboard=$('#admin-dashboard'),info=$('#login-feedback'),msg=$('#admin-message');let filter='pending',currentUser=null;
function say(s){msg.textContent=s}
function el(tag,text,className){const n=document.createElement(tag);n.textContent=text??'';if(className)n.className=className;return n}
function showLogin(s=''){login.hidden=false;dashboard.hidden=true;if(s)info.textContent=s}
async function verifyAdmin(){if(!api)return showLogin('Owner dashboard is not configured.');
 const {data:{user},error}=await api.auth.getUser();if(error||!user){currentUser=null;return showLogin()}
 const check=await api.rpc('is_review_admin');
 if(check.error||check.data!==true){await api.auth.signOut();currentUser=null;return showLogin('This account is not authorised to manage reviews.')}
 currentUser=user;login.hidden=true;dashboard.hidden=false;await load();
}
async function load(){if(!currentUser)return;say('Loading '+filter+' reviews…');const target=$('#admin-review-list');target.replaceChildren();
 const {data,error}=await api.from('reviews').select('id,display_name,rating,comment,status,created_at,published_at').eq('status',filter).order('created_at',{ascending:false}).limit(200);
 if(error){say('Could not load reviews: '+error.message);return}
 say(data.length+' '+filter+' review'+(data.length===1?'':'s'));
 if(!data.length){target.appendChild(el('div','No '+filter+' reviews.','empty'));return}
 for(const r of data){const card=el('article','','review-item');const stars=el('span','★'.repeat(r.rating)+'☆'.repeat(5-r.rating),'rating');const name=el('strong',r.display_name||'Anonymous customer');const date=el('span',new Date(r.created_at).toLocaleString('en-KE'),'small');const body=el('p',r.comment);const controls=el('div','','admin-actions');
 const actions=filter==='pending'?[['Publish','approved'],['Reject','rejected']]:filter==='approved'?[['Hide','hidden']]:[['Publish','approved']];
 for(const [label,status] of actions){const b=el('button',label);b.type='button';b.addEventListener('click',()=>change(r.id,status,label));controls.appendChild(b)}
 const remove=el('button','Delete permanently');remove.type='button';remove.addEventListener('click',()=>removeReview(r.id));controls.appendChild(remove);
 card.append(stars,name,date,body,controls);target.appendChild(card)
 }
}
async function change(id,status,action){if(!window.confirm(action+' this customer review?'))return;say('Saving…');const patch={status,published_at:status==='approved'?new Date().toISOString():null};const {error}=await api.from('reviews').update(patch).eq('id',id);if(error){say('Update failed: '+error.message);return}await load()}
async function removeReview(id){if(!window.confirm('Permanently delete this review? This cannot be undone.'))return;say('Deleting…');const {error}=await api.from('reviews').delete().eq('id',id);if(error){say('Delete failed: '+error.message);return}await load()}
$('#admin-login-form').addEventListener('submit',async e=>{e.preventDefault();info.textContent='Signing in…';const email=$('#admin-email').value.trim(),password=$('#admin-password').value;const {error}=await api.auth.signInWithPassword({email,password});$('#admin-password').value='';if(error){info.textContent='Sign-in failed. Check your credentials.';return}info.textContent='';await verifyAdmin()});
$('#admin-signout').addEventListener('click',async()=>{await api.auth.signOut();currentUser=null;showLogin('Signed out.')});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));load()}));
if(!api){$('#admin-setup').hidden=false;$('#admin-login-form button').disabled=true;showLogin('Review system setup is required.');return}verifyAdmin();
})();