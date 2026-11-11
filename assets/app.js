(function(){'use strict';const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];const safe=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));$('.menu')?.addEventListener('click',()=>{$('.navlinks')?.classList.toggle('open')});
// Live C-OIL review system. Only the publishable key is present in this browser.
const reviewConfig=window.COIL_CONFIG||{};
const reviewsReady=(()=>{
 try{return /^https:\/\/[^/]+\.supabase\.co$/.test(reviewConfig.supabaseUrl||'') &&
  /^(sb_publishable_|eyJ)/.test(reviewConfig.supabasePublishableKey||'') && !!window.supabase?.createClient;
 }catch{return false}
})();
const reviewClient=reviewsReady?window.supabase.createClient(reviewConfig.supabaseUrl,reviewConfig.supabasePublishableKey):null;
let rating=0,turnstileWidget=null,turnstileToken='';
$$('.star').forEach(b=>b.addEventListener('click',()=>{rating=Number(b.dataset.star);$$('.star').forEach(s=>{const chosen=Number(s.dataset.star)<=rating;s.classList.toggle('selected',chosen);s.setAttribute('aria-pressed',String(chosen))})}));
function reviewNotice(message,isError=false){const n=$('#review-message');if(n){n.classList.add('show');n.textContent=message;n.setAttribute('role',isError?'alert':'status')}}
async function loadPublicReviews(){
 const list=$('#reviews-list');if(!reviewClient){if(list)list.innerHTML='<div class="empty">Customer reviews are temporarily unavailable.</div>';return}
 try{
   const {data,error}=await reviewClient.from('reviews').select('id,display_name,rating,comment,created_at').eq('status','approved').order('created_at',{ascending:false}).limit(100);
   if(error)throw error;
   if(list){list.replaceChildren();if(!data.length){const placeholder=document.createElement('div');placeholder.className='empty';placeholder.textContent='No published reviews yet. Share your experience with C-OIL.';list.appendChild(placeholder)}
     for(const r of data){const el=document.createElement('article');el.className='review-item';const stars=document.createElement('span');stars.className='rating';stars.textContent='★'.repeat(r.rating)+'☆'.repeat(5-r.rating);const who=document.createElement('strong');who.textContent=r.display_name||'Anonymous customer';const date=document.createElement('span');date.className='small';date.textContent=new Date(r.created_at).toLocaleDateString('en-KE',{year:'numeric',month:'short',day:'numeric'});const comment=document.createElement('p');comment.textContent=r.comment;el.append(stars,who,date,comment);list.append(el)}
   }
   const count=$('#review-count');if(count)count.textContent=String(data.length)+(data.length===100?'+':'');
 }catch(e){console.error('Could not load reviews',e);if(list)list.innerHTML='<div class="empty">Reviews could not load. Please refresh later.</div>'}
}
function renderReviewChallenge(){
 if(!$('#turnstile-review'))return;
 const form=$('#review-form');const btn=form?.querySelector('[type="submit"]');
 if(!reviewClient){if(btn)btn.disabled=true;reviewNotice('Customer reviews are temporarily unavailable.',true);return;}
 if(!reviewConfig.turnstileSiteKey || reviewConfig.turnstileSiteKey.startsWith('REPLACE_'))return;
 let tries=0;
 const wait=setInterval(()=>{
   if(window.turnstile){clearInterval(wait);try{turnstileWidget=window.turnstile.render('#turnstile-review',{
     sitekey:reviewConfig.turnstileSiteKey,
     callback:token=>{turnstileToken=token},
     'expired-callback':()=>{turnstileToken=''},
     'error-callback':()=>{turnstileToken=''}
   })}catch(err){console.error('Security check error',err);reviewNotice('The security check is unavailable. Please try again later.',true)} }
   if(++tries>100){clearInterval(wait);reviewNotice('Security verification could not load. Please check your connection.',true)}
 },100);
}
// Modest anti-abuse proof-of-work, in addition to server-side IP throttling.
// This is not equivalent to a full Turnstile challenge.
async function findReviewProof(name,comment,rating){
 if(!window.crypto?.subtle)throw new Error('A secure connection is required to submit reviews.');
 const prefix=[name,comment,rating].join(':')+':', encoder=new TextEncoder();
 for(let nonce=0;nonce<250000;nonce++){
  const bytes=await crypto.subtle.digest('SHA-256',encoder.encode(prefix+nonce));
  const hash=new Uint8Array(bytes);
  if(hash[0]===0 && hash[1]<16)return String(nonce);
  if(nonce%256===255)await new Promise(resolve=>setTimeout(resolve,0));
 }
 throw new Error('Review verification timed out. Please try again.');
}
$('#review-form')?.addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget;const submit=form.querySelector('[type="submit"]');
 const name=($('#review-name')?.value||'').trim(),comment=($('#review-text')?.value||'').trim();
 if(!rating || comment.length<10 || comment.length>1200 || name.length>60){reviewNotice('Choose a rating and write between 10 and 1,200 characters.',true);return}
 if(!reviewClient){reviewNotice('Review service is temporarily unavailable.',true);return}
 if(reviewConfig.turnstileSiteKey && !reviewConfig.turnstileSiteKey.startsWith('REPLACE_') && !turnstileToken){reviewNotice('Complete the security check before submitting.',true);return}
 const honeypot=($('#review-website')?.value||'');
 submit.disabled=true;submit.textContent='Submitting…';
 try{
   submit.textContent='Verifying…';
   const proofNonce=await findReviewProof(name,comment,rating);
   submit.textContent='Submitting…';
   const response=await fetch(reviewConfig.supabaseUrl+'/functions/v1/submit-review',{
     method:'POST',headers:{'Content-Type':'application/json','apikey':reviewConfig.supabasePublishableKey},
     body:JSON.stringify({name,comment,rating,turnstileToken,proofNonce,website:honeypot})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok || !result.ok)throw new Error(result.error||'Your review could not be submitted.');
   form.reset();rating=0;turnstileToken='';$$('.star').forEach(s=>{s.classList.remove('selected');s.setAttribute('aria-pressed','false')});
   reviewNotice('Thank you! Your review has been received and will appear after approval.');
 }catch(err){reviewNotice(err.message||'Review submission failed. Please try again.',true)}
 finally{submit.disabled=false;submit.textContent='Submit review';if(turnstileWidget!==null && window.turnstile)window.turnstile.reset(turnstileWidget);turnstileToken=''}
});
if($('#review-form')){
 const honeypot=document.createElement('input');honeypot.id='review-website';honeypot.name='website';honeypot.type='text';honeypot.tabIndex=-1;honeypot.autocomplete='off';honeypot.setAttribute('aria-hidden','true');honeypot.style.cssText='position:absolute;left:-9999px;opacity:0;pointer-events:none';$('#review-form').appendChild(honeypot);
 renderReviewChallenge();
}
loadPublicReviews();
if(reviewClient){document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadPublicReviews()});setInterval(()=>{if(!document.hidden)loadPublicReviews()},30000)}

// Controlled, layered slideshow (not a vertical list). Uses the customer's five photos.
function initMarineSlider(){
 const root=document.querySelector('.marine-slider');if(!root)return;
 const slides=[...root.querySelectorAll('.slide')];
 const dots=[...root.querySelectorAll('.dot')];
 const prev=root.querySelector('.slider-prev');const next=root.querySelector('.slider-next');
 let current=0,interval=null;
 const motionReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function show(index){
  current=(index+slides.length)%slides.length;
  slides.forEach((slide,i)=>{const on=i===current;slide.classList.toggle('active',on);slide.setAttribute('aria-hidden',String(!on))});
  dots.forEach((dot,i)=>{dot.classList.toggle('active',i===current);dot.setAttribute('aria-pressed',String(i===current))});
 }
 function stop(){if(interval!==null){clearInterval(interval);interval=null}}
 function play(){stop();if(!motionReduced && !document.hidden){interval=setInterval(()=>show(current+1),3900)}}
 function navigate(n){show(n);play()}
 next?.addEventListener('click',()=>navigate(current+1));
 prev?.addEventListener('click',()=>navigate(current-1));
 dots.forEach((dot,i)=>dot.addEventListener('click',()=>navigate(i)));
 root.addEventListener('mouseenter',stop);root.addEventListener('mouseleave',play);
 root.addEventListener('focusin',stop);root.addEventListener('focusout',e=>{if(!root.contains(e.relatedTarget))play()});
 root.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();navigate(current+1)}else if(e.key==='ArrowLeft'){e.preventDefault();navigate(current-1)}});
 document.addEventListener('visibilitychange',()=>{document.hidden?stop():play()});
 show(0);
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){play()}else{stop()}},{threshold:.2});observer.observe(root)}else{play()}
}
// One-shot five-second spinning coin reveal as visitor scrolls to origin section.
function initOriginSpin(){
 const image=document.querySelector('.origin-spin-image');if(!image)return;
 const run=()=>{image.classList.remove('spin-into-view');void image.offsetWidth;image.classList.add('spin-into-view')};
 if('IntersectionObserver' in window){const obs=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){run();obs.disconnect()}},{threshold:.25});obs.observe(image)}else{run()}
}
initMarineSlider();initOriginSpin();
})();