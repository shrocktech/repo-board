// Offline test: fakes the GitHub API, then exercises the board API end to end. Run: npm test
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const dir=await mkdtemp(join(tmpdir(),'repo-board-'));
process.env.DATA_DIR=dir;process.env.GITHUB_TOKEN='test-token';
const repo=(name,extra={})=>({full_name:`acme/${name}`,html_url:`https://github.com/acme/${name}`,description:`${name} app`,private:true,archived:false,default_branch:'main',updated_at:'2026-01-01T00:00:00Z',owner:{login:'acme'},...extra});
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,opts)=>{const u=String(url);
 if(u.startsWith('https://api.github.com/')){assert.equal(opts.headers.Authorization,'Bearer test-token');
  const body=u.includes('/user/repos')?[repo('web'),repo('api'),repo('old',{archived:true})]:{login:'acme-dev',name:'Acme',avatar_url:''};
  return new Response(JSON.stringify(body),{status:200});}
 return realFetch(url,opts);};

const {server}=await import('./server.mjs');
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const get=async p=>(await fetch(base+p)).json();
const post=(body,headers={})=>fetch(base+'/api/repositories',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
try{
 assert.equal((await get('/api/account')).login,'acme-dev');
 let b=await get('/api/repositories');
 assert.deepEqual(b.cards.map(c=>[c.repo,c.stage]),[['acme/web','Backlog'],['acme/api','Backlog'],['acme/old','Archived']]);
 const cards=b.cards.map(c=>({...c}));cards[1].stage='Ready';cards[1].notes='ship it';cards[1].labels=['bug'];cards[1].avatar='preset:3';cards[0].hidden=true;
 const ok=await post({revision:b.revision,cards:[cards[1],cards[0],cards[2]]});assert.equal(ok.status,200);
 b=await get('/api/repositories');
 const api=b.cards.find(c=>c.repo==='acme/api');
 assert.deepEqual([api.stage,api.notes,api.labels,api.avatar,api.order],['Ready','ship it',['bug'],'preset:3',0]);
 assert.equal(b.cards.find(c=>c.repo==='acme/web').hidden,true);
 assert.equal((await post({revision:0,cards:b.cards})).status,409,'stale revision refused');
 assert.equal((await post({revision:b.revision,cards:b.cards.map(c=>({...c,stage:'Nope'}))})).status,400,'unknown stage refused');
 assert.equal((await post({revision:b.revision,cards:b.cards.map(c=>({...c,labels:['x']}))})).status,400,'unknown tag refused');
 assert.equal((await post({revision:b.revision,cards:b.cards},{Origin:'https://evil.example'})).status,403,'cross-site write refused');
 assert.equal((await fetch(base+'/../server.mjs')).status,404);
 assert.match(await (await fetch(base+'/')).text(),/GitHub Repos/);
 assert.equal(JSON.parse(await readFile(join(dir,'board.json'),'utf8')).revision,1);
 console.log('ok: all board API checks passed');
}finally{server.close();await rm(dir,{recursive:true,force:true});}
