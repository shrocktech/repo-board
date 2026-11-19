// GitHub Repo Board: a zero-dependency Node server (Node 18+) that lists your GitHub repositories as cards on a
// stage board and keeps your own notes, stages, tags, avatars and priority order in a local JSON file.
// GitHub is only read; nothing on GitHub is ever changed.
import {createServer} from 'node:http';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {join,extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('.',import.meta.url));
const PORT=Number(process.env.PORT||4870),HOST=process.env.HOST||'127.0.0.1';
const DATA_DIR=resolve(process.env.DATA_DIR||join(root,'data')),boardFile=join(DATA_DIR,'board.json');
// Board columns, left to right. Change the names here; existing cards on a removed stage fall back to the first one.
export const STAGES=(process.env.BOARD_STAGES?process.env.BOARD_STAGES.split(',').map(s=>s.trim()).filter(Boolean):['Backlog','Ready','In Development','Review & Testing','Live & Maintaining','Archived']);
export const TAGS=['security','qa','docs','blocked','needs review','deployment','maintenance','bug','high priority'];
// Optional: limit the board to one owner or organization (e.g. REPO_OWNER=my-org).
const OWNER=process.env.REPO_OWNER||'';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});

// ---- GitHub access: GITHUB_TOKEN, else the token of a signed-in GitHub CLI (`gh auth login`).
let tokenCache=null;
async function token(){
 if(process.env.GITHUB_TOKEN)return process.env.GITHUB_TOKEN;
 if(tokenCache&&Date.now()-tokenCache.at<60000)return tokenCache.value;
 const value=await new Promise(r=>execFile('gh',['auth','token'],{timeout:10000},(e,out)=>r(e?'':out.trim())));
 tokenCache={at:Date.now(),value};return value;
}
async function github(path){
 const t=await token();if(!t)throw fail('No GitHub token. Set GITHUB_TOKEN or run `gh auth login`, then restart.',401);
 let r;try{r=await fetch('https://api.github.com/'+path,{headers:{Authorization:`Bearer ${t}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'repo-board'},signal:AbortSignal.timeout(30000)});}
 catch{throw fail('GitHub could not be reached. Check the internet connection.',502);}
 if(r.status===401)throw fail('GitHub rejected the token. Check GITHUB_TOKEN or `gh auth status`.',401);
 if(!r.ok)throw fail(`GitHub request failed (${r.status}). Check access and API rate limits.`,502);
 return r.json();
}
async function pages(path){const all=[];for(let p=1;;p++){const rows=await github(`${path}${path.includes('?')?'&':'?'}per_page=100&page=${p}`);all.push(...rows);if(rows.length<100)return all;}}

const cache=new Map();
async function memo(key,ttl,load,fresh=false){const hit=cache.get(key);if(!fresh&&hit&&Date.now()-hit.at<ttl)return hit.value;const value=await load();cache.set(key,{at:Date.now(),value});return value;}
const repos=fresh=>memo('repos',300000,async()=>(await pages('user/repos?affiliation=owner,collaborator,organization_member&sort=updated')).filter(r=>!OWNER||r.owner.login.toLowerCase()===OWNER.toLowerCase()),fresh);

// ---- Board state: GitHub facts (name, description, branch, updated) merged with locally saved card fields.
async function saved(){try{return JSON.parse(await readFile(boardFile,'utf8'))}catch(e){if(e.code==='ENOENT')return {revision:0,cards:[]};throw e;}}
const tags=v=>{if(v===undefined)return [];if(!Array.isArray(v)||v.length>16||v.some(t=>!TAGS.includes(t)))throw fail('Invalid status tags.');return [...new Set(v)];};
function avatar(v=''){
 if(typeof v!=='string')throw fail('Invalid avatar.');
 if(!v||/^preset:(?:[0-9]|1[01])$/.test(v))return v;
 if(v.startsWith('data:')){if(v.length>16000||!/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(v))throw fail('Invalid avatar image.');return v;}
 let u;try{u=new URL(v)}catch{throw fail('Use an HTTPS image URL.')}if(u.protocol!=='https:'||u.username||u.password||v.length>2048)throw fail('Use an HTTPS image URL.');return u.href;
}
async function board(fresh=false){
 const [available,store]=await Promise.all([repos(fresh),saved()]);
 const cards=available.map((r,i)=>{const prev=store.cards.find(c=>c.repo===r.full_name);const stage=prev&&STAGES.includes(prev.stage)?prev.stage:r.archived?STAGES.at(-1):STAGES[0];
  return {notes:'',hidden:false,order:i,labels:[],avatar:'',...prev,stage,repo:r.full_name,url:r.html_url,description:r.description||'',private:r.private,archived:r.archived,branch:r.default_branch,updated:r.pushed_at||r.updated_at};});
 return {revision:store.revision,stages:STAGES,tags:TAGS,cards,unavailable:store.cards.filter(c=>!available.some(r=>r.full_name===c.repo))};
}
let writing=Promise.resolve();
async function saveBoard(input){
 const current=await board();
 if(input.revision!==current.revision)throw fail('The board changed elsewhere. Sync and try again.',409);
 if(!Array.isArray(input.cards)||input.cards.length!==current.cards.length)throw fail('Repository list changed. Sync first.',409);
 const seen=new Set();
 const cards=input.cards.map((c,order)=>{if(!c||typeof c.repo!=='string'||seen.has(c.repo)||!current.cards.some(r=>r.repo===c.repo)||!STAGES.includes(c.stage)||typeof c.hidden!=='boolean')throw fail('Invalid repository card.');seen.add(c.repo);
  const notes=typeof c.notes==='string'?c.notes.slice(0,20000):'';return {repo:c.repo,stage:c.stage,notes,labels:tags(c.labels),avatar:avatar(c.avatar),hidden:c.hidden,order};});
 const next={revision:current.revision+1,cards:[...cards,...current.unavailable]};
 await mkdir(DATA_DIR,{recursive:true});const tmp=boardFile+'.tmp';await writeFile(tmp,JSON.stringify(next,null,2),{mode:0o600});await rename(tmp,boardFile);
 return {revision:next.revision};
}

// ---- HTTP
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const send=(res,status,body,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type.startsWith('application/json')?JSON.stringify(body):body);};
async function body(req){let size=0;const parts=[];for await(const c of req){size+=c.length;if(size>4e6)throw fail('Request too large.',413);parts.push(c);}try{const v=JSON.parse(Buffer.concat(parts).toString());if(!v||typeof v!=='object'||Array.isArray(v))throw 0;return v;}catch{throw fail('Invalid JSON.');}}
// Writes must come from this page (blocks other websites posting to a local server).
const sameOrigin=req=>{const o=req.headers.origin;if(!o)return true;try{return new URL(o).host===req.headers.host}catch{return false}};

export const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 try{
  if(url.pathname==='/api/account'&&req.method==='GET'){
   try{const u=await memo('user',300000,()=>github('user'),url.searchParams.has('fresh'));return send(res,200,{connected:true,login:u.login,name:u.name||'',avatar:u.avatar_url});}
   catch(e){return send(res,200,{connected:false,offline:e.status===502,error:e.message});}
  }
  if(url.pathname==='/api/repositories'&&req.method==='GET')return send(res,200,await board(url.searchParams.has('fresh')));
  if(url.pathname==='/api/repositories'&&req.method==='POST'){
   if(!sameOrigin(req))throw fail('Cross-site request refused.',403);
   const input=await body(req);const result=await(writing=writing.catch(()=>{}).then(()=>saveBoard(input)));return send(res,200,result);
  }
  if(url.pathname.startsWith('/api/'))throw fail('Not found.',404);
  if(req.method!=='GET'&&req.method!=='HEAD')throw fail('Method not allowed.',405);
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!/^[a-z0-9-]+\.(html|js|css|svg)$/.test(name))throw fail('Not found.',404);
  const file=await readFile(join(root,'public',name)).catch(()=>{throw fail('Not found.',404)});
  return send(res,200,file,types[extname(name)]);
 }catch(e){send(res,e.status||500,{error:e.status?e.message:'Server error.'});if(!e.status)console.error(e);}
});
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))server.listen(PORT,HOST,()=>console.log(`Repo board: http://${HOST}:${PORT}/`));
