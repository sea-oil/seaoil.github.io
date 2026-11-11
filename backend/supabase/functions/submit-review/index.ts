// Public reviews must pass Turnstile and a server-enforced throttle.
// Deploy with: supabase functions deploy submit-review --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY') || '';
const captchaSecret = Deno.env.get('TURNSTILE_SECRET_KEY') || '';
const rateSalt = Deno.env.get('RATE_LIMIT_SALT') || '';
const allowedOrigins = (Deno.env.get('C_OIL_ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean);
const db = createClient(supabaseUrl, secretKey, {auth:{autoRefreshToken:false,persistSession:false}});
function headers(origin:string|null){
 const accepted=origin && allowedOrigins.includes(origin);
 return {'Content-Type':'application/json','Vary':'Origin','Access-Control-Allow-Origin':accepted?origin:'null','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey,content-type','Cache-Control':'no-store'};
}
function respond(status:number,data:Record<string,unknown>,origin:string|null){return new Response(JSON.stringify(data),{status,headers:headers(origin)})}
async function sha256(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')}
Deno.serve(async request=>{
 const origin=request.headers.get('origin');
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
 if(request.method!=='POST')return respond(405,{error:'Method not allowed.'},origin);
 if(!origin||!allowedOrigins.includes(origin))return respond(403,{error:'Origin not allowed.'},origin);
 // Fail closed when secrets and host allowlist are not ready.
 if(!supabaseUrl||!secretKey||!captchaSecret||!rateSalt||rateSalt.length<24)return respond(503,{error:'Review service is unavailable.'},origin);
 const type=request.headers.get('content-type')||'';
 if(!type.includes('application/json'))return respond(415,{error:'Send JSON.'},origin);
 if(Number(request.headers.get('content-length')||0)>12000)return respond(413,{error:'Request too large.'},origin);
 try{
   const body=await request.json();
   const rating=body?.rating,name=String(body?.name||'').trim(),comment=String(body?.comment||'').trim();
   const token=String(body?.turnstileToken||'');
   if(body?.website)return respond(400,{error:'Invalid submission.'},origin);
   if(!Number.isInteger(rating)||rating<1||rating>5||name.length>60||comment.length<10||comment.length>1200||token.length<10||token.length>4096)
      return respond(400,{error:'Please check your rating, name and review.'},origin);
   const ip=request.headers.get('cf-connecting-ip') || (request.headers.get('x-forwarded-for')||'').split(',')[0].trim(); // Use the managed gateway's forwarded client address.
   if(!ip)return respond(503,{error:'Submission protection is unavailable.'},origin);
   const visitorHash=await sha256(rateSalt+':'+ip);
   const {data:allowed,error:limitError}=await db.rpc('consume_review_rate_limit',{visitor:visitorHash});
   if(limitError||allowed!==true)return respond(429,{error:'Too many reviews. Please try again later.'},origin);
   const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({secret:captchaSecret,response:token,remoteip:ip})
   });
   if(!verification.ok)return respond(503,{error:'Security verification could not be completed.'},origin);
   const check=await verification.json();
   if(!check.success)return respond(400,{error:'Security check failed. Please retry.'},origin);
   // Turnstile siteverify also returns hostname. Check it against the submitting origin.
   if(new URL(origin).hostname!==check.hostname)return respond(403,{error:'Hostname mismatch.'},origin);
   const {error}=await db.from('reviews').insert({display_name:name||'Anonymous customer',rating,comment,status:'pending'});
   if(error){console.error('C-OIL review insert failed',error.code);return respond(503,{error:'Could not save review. Try again.'},origin)}
   return respond(201,{ok:true,message:'Review received for moderation.'},origin);
 }catch(error){console.error('Submission failure',error);return respond(400,{error:'Unable to process this review.'},origin)}
});
