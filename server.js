const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const cookieName = 'daybook_session';
const sessionLifetime = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();
const attempts = new Map();
const maxAttempts = 10;
const attemptWindow = 15 * 60 * 1000;

function send(res, status, body, type='application/json; charset=utf-8', extraHeaders={}) {
  res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extraHeaders});
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readJson(req, limit=12*1024*1024) {
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',chunk=>{
      raw+=chunk;
      if(raw.length>limit){reject(new Error('Request is too large.'));req.destroy()}
    });
    req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'))}catch{reject(new Error('Invalid request.'))}});
    req.on('error',reject);
  });
}

function readCookie(req,name) {
  const prefix=`${name}=`;
  return (req.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(prefix))?.slice(prefix.length)||'';
}

function getSession(req) {
  const token=readCookie(req,cookieName);
  const expires=sessions.get(token);
  if(!expires)return null;
  if(expires<Date.now()){sessions.delete(token);return null}
  return token;
}

function safeEqual(left,right) {
  const leftHash=crypto.createHash('sha256').update(String(left)).digest();
  const rightHash=crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash,rightHash);
}

function loginPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#7667c8"><title>Sign in · Daybook</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f8f7f3;color:#29272b;font:15px 'Segoe UI',sans-serif;display:grid;place-items:center;padding:22px}.card{width:min(100%,390px);background:#fff;border:1px solid #ece9e2;border-radius:18px;padding:30px;box-shadow:0 12px 40px #342b1a0c}.brand{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:700;margin-bottom:34px}.mark{width:34px;height:34px;background:#7667c8;color:#fff;border-radius:11px;display:grid;place-items:center;font:700 23px Georgia}.eyebrow{color:#918a9d;font-size:10px;letter-spacing:1.6px;font-weight:700}.card h1{font-size:26px;margin:7px 0 6px;letter-spacing:-.5px}.sub{color:#8f8a84;font-size:13px;line-height:1.5;margin:0 0 25px}.label{display:block;font-size:12px;font-weight:600;margin:15px 0 7px}.input{width:100%;height:44px;border:1px solid #e5e1da;border-radius:8px;padding:0 12px;font:14px 'Segoe UI',sans-serif;outline:0}.input:focus{border-color:#9383d0;box-shadow:0 0 0 3px #f1effa}.button{width:100%;height:44px;margin-top:21px;border:0;border-radius:8px;background:#7667c8;color:#fff;font-size:13px;font-weight:700;cursor:pointer}.button:disabled{opacity:.6}.error{min-height:18px;color:#b45e53;font-size:12px;margin:11px 0 0}.private{border-top:1px solid #f0eee9;margin-top:22px;padding-top:14px;color:#aaa49c;font-size:10px;text-align:center} 
  </style></head><body><main class="card"><div class="brand"><span class="mark">d</span><span>daybook<span style="color:#7667c8">.</span></span></div><div class="eyebrow">YOUR PRIVATE STUDY SPACE</div><h1>Welcome back, Ben.</h1><p class="sub">Sign in to see your homework and weekly plan.</p><form id="loginForm"><label class="label" for="username">Username</label><input class="input" id="username" name="username" autocomplete="username" required maxlength="80"><label class="label" for="password">Password</label><input class="input" id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button class="button" id="submitButton" type="submit">Sign in</button><p class="error" id="error" role="alert"></p></form><div class="private">Only your pre-set login can open this planner. There is no sign-up.</div></main><script>
  const form=document.getElementById('loginForm'),error=document.getElementById('error'),button=document.getElementById('submitButton');form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;error.textContent='';try{const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.username.value,password:form.password.value})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not sign in.');location.assign('/')}catch(problem){error.textContent=problem.message||'Could not sign in.';button.disabled=false}});
  </script></body></html>`;
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
}

const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url,'http://localhost');
  const session=getSession(req);
  const secure=req.socket.encrypted||String(req.headers['x-forwarded-proto']||'').split(',')[0].trim()==='https';
  const cookieFlags=`Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionLifetime/1000}${secure?'; Secure':''}`;

  if(req.method==='POST'&&url.pathname==='/api/login'){
    if(!process.env.APP_USERNAME||!process.env.APP_PASSWORD||process.env.APP_PASSWORD.length<12)
      return send(res,503,{error:'Private login has not been configured on the host yet.'});
    const ip=clientIp(req),now=Date.now(),entry=attempts.get(ip);
    if(entry&&entry.until>now&&entry.count>=maxAttempts)return send(res,429,{error:'Too many attempts. Try again in 15 minutes.'});
    try{
      const body=await readJson(req,8192);
      const valid=safeEqual(body.username||'',process.env.APP_USERNAME)&&safeEqual(body.password||'',process.env.APP_PASSWORD);
      if(!valid){
        const current=attempts.get(ip);
        if(!current||current.until<=now)attempts.set(ip,{count:1,until:now+attemptWindow});
        else current.count++;
        return send(res,401,{error:'That username or password didn’t match.'});
      }
      attempts.delete(ip);
      const token=crypto.randomBytes(32).toString('base64url');
      sessions.set(token,now+sessionLifetime);
      return send(res,200,{ok:true},'application/json; charset=utf-8',{'Set-Cookie':`${cookieName}=${token}; ${cookieFlags}`});
    }catch(error){return send(res,400,{error:error.message||'Invalid sign-in request.'})}
  }

  if(req.method==='POST'&&url.pathname==='/api/logout'){
    if(session)sessions.delete(session);
    return send(res,200,{ok:true},'application/json; charset=utf-8',{'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`});
  }

  if(req.method==='GET'&&url.pathname==='/login'){
    if(session){res.writeHead(303,{Location:'/','Cache-Control':'no-store'});return res.end()}
    return send(res,200,loginPage(),'text/html; charset=utf-8');
  }

  if(!session){
    if(url.pathname.startsWith('/api/'))return send(res,401,{error:'Please sign in first.'});
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Method not allowed'});
    return send(res,200,loginPage(),'text/html; charset=utf-8');
  }

  if(req.method==='POST'&&url.pathname==='/api/identify'){
    if(!process.env.OPENAI_API_KEY)return send(res,503,{error:'AI naming needs an OpenAI API key configured on the server.'});
    try{
      const {image}=await readJson(req);
      const match=typeof image==='string'&&image.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
      if(!match)return send(res,400,{error:'Choose a JPEG, PNG, WEBP or GIF photo.'});
      if(match[2].length>11*1024*1024)return send(res,413,{error:'Photo is too large. Choose an image under 8 MB.'});
      const apiResponse=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
        body:JSON.stringify({
          model:process.env.OPENAI_MODEL||'gpt-6-astra',
          input:[{role:'user',content:[
            {type:'input_text',text:'Look at this photo of a school assignment. Give it a short, clear homework title (about 3–8 words) based on the subject and task. Return only the title. If this is not homework or is too unclear to identify, say: Please enter a title.'},
            {type:'input_image',image_url:image,detail:'high'}
          ]}],max_output_tokens:60
        })
      });
      const result=await apiResponse.json();
      if(!apiResponse.ok){console.error('OpenAI image naming failed:',apiResponse.status,result.error?.type||'API error');return send(res,502,{error:'AI could not read that photo. Try again or type the title yourself.'})}
      const title=(result.output||[]).flatMap(item=>item.content||[]).filter(part=>part.type==='output_text').map(part=>part.text).join(' ').trim();
      if(!title||title.toLowerCase()==='please enter a title.')return send(res,422,{error:'I couldn’t find a clear homework title. Try a closer photo or type it yourself.'});
      return send(res,200,{title});
    }catch(error){return send(res,400,{error:error.message||'Could not process that photo.'})}
  }

  if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Method not allowed'});
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/')pathname='/index.html';
  const target=path.resolve(root,'.'+pathname);
  if(!target.startsWith(root+path.sep))return send(res,403,{error:'Forbidden'});
  fs.readFile(target,(error,contents)=>{
    if(error)return send(res,404,'Not found','text/plain; charset=utf-8');
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')return res.end();
    res.end(contents);
  });
});

server.listen(port,'0.0.0.0',()=>console.log(`Daybook listening on port ${port}`));

