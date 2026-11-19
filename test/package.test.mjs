import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {prepare} from '../skills/vzhuh-publish/scripts/prepare-upload.mjs';
import registerPi from '../pi/index.js';
const tmp=prefix=>fs.mkdtemp(path.join(os.tmpdir(),prefix));
test('Upload helper produces byte-exact binary chunks and rejects secret/symlink/output-inside-artifact',async()=>{
 const root=await tmp('vzhuh-prepare-');try{
  const artifact=path.join(root,'artifact');await fs.mkdir(path.join(artifact,'.openai'),{recursive:true});await fs.mkdir(path.join(artifact,'dist/client'),{recursive:true});
  await fs.writeFile(path.join(artifact,'.openai/hosting.json'),'{"static":{"directory":"dist/client"}}');
  const data=Buffer.alloc(400001);for(let i=0;i<data.length;i++)data[i]=i%256;
  await fs.writeFile(path.join(artifact,'dist/client/index.html'),'hello');await fs.writeFile(path.join(artifact,'dist/client/binary.bin'),data);
  const output=path.join(root,'out'),report=await prepare(artifact,output);assert.equal(report.files,3);
  const files=JSON.parse(await fs.readFile(path.join(output,'files.json'))).files;assert.equal(files.find(f=>f.path.endsWith('binary.bin')).sha256,createHash('sha256').update(data).digest('hex'));
  const chunks=[];for(const name of (await fs.readdir(output)).sort())if(name.startsWith('chunk-')){const c=JSON.parse(await fs.readFile(path.join(output,name)));assert.ok(Buffer.from(c.content,'base64').length<=196608);if(c.path.endsWith('binary.bin'))chunks.push(c);}
  assert.deepEqual(Buffer.concat(chunks.map(c=>Buffer.from(c.content,'base64'))),data);assert.deepEqual(chunks.map(c=>c.offset),[0,196608,393216]);
  await assert.rejects(prepare(artifact,path.join(artifact,'out')),/outside/);
  await fs.writeFile(path.join(artifact,'.env'),'SECRET');await assert.rejects(prepare(artifact,path.join(root,'unsafe')),/Unsafe/);await fs.unlink(path.join(artifact,'.env'));
  await fs.symlink('/etc/passwd',path.join(artifact,'secret'));await assert.rejects(prepare(artifact,path.join(root,'unsafe')),/Unsafe/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('Pi extension registers discover/call/login and preserves MCP errors',async()=>{
 const tools=new Map(),commands=new Map(),events=new Map();let closed=false;
 registerPi({registerTool:t=>tools.set(t.name,t),registerCommand:(n,c)=>commands.set(n,c),on:(n,f)=>events.set(n,f)}, {list:async()=>({tools:[{name:'whoami'}]}),call:async name=>name==='bad'?{isError:true,content:[{type:'text',text:'denied'}]}:{content:[{type:'text',text:'ok'}],structuredContent:{ok:true}},close:async()=>{closed=true;}});
 assert.match((await tools.get('vzhuh_tools').execute('id',{})).content[0].text,/whoami/);
 assert.deepEqual((await tools.get('vzhuh_call').execute('id',{name:'whoami',arguments:{}})).details,{ok:true});
 await assert.rejects(tools.get('vzhuh_call').execute('id',{name:'bad',arguments:{}}),/denied/);
 const notices=[];await commands.get('vzhuh-login').handler('',{ui:{notify:(...x)=>notices.push(x)}});assert.equal(notices[0][1],'info');await events.get('session_shutdown')();assert.equal(closed,true);
});

