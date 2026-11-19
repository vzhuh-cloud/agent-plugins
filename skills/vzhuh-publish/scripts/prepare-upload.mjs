import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export async function prepare(root,output){
 root=await fs.realpath(root);output=path.resolve(output);
 output=path.join(await fs.realpath(path.dirname(output)),path.basename(output));
 if(output===root||output.startsWith(root+path.sep))throw Error('Output must be outside artifact');
 const files=[];let total=0;const chunks=[];
 async function walk(rel=''){
  for(const entry of (await fs.readdir(path.join(root,rel),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const name=path.posix.join(rel,entry.name);
   if(entry.isSymbolicLink()||entry.name.startsWith('.env')||['.git','node_modules'].includes(entry.name)||name.includes('\\'))throw Error('Unsafe artifact: '+name);
   if(entry.isDirectory()){await walk(name);continue;}
   if(!entry.isFile())throw Error('Not a regular file: '+name);
   const stat=await fs.stat(path.join(root,name));
   if(stat.size>8388608||total+stat.size>33554432||files.length>=2000)throw Error('Artifact exceeds limits');
   const data=await fs.readFile(path.join(root,name));if(data.length!==stat.size)throw Error('Artifact changed');total+=data.length;
   files.push({path:name,size:data.length,sha256:createHash('sha256').update(data).digest('hex')});
   for(let offset=0;offset<data.length;offset+=196608)chunks.push({path:name,offset,encoding:'base64',content:data.subarray(offset,offset+196608).toString('base64')});
  }
 }
 await walk();if(!files.some(f=>f.path==='.openai/hosting.json'))throw Error('Missing .openai/hosting.json');
 await fs.mkdir(output,{recursive:false,mode:0o700});
 await fs.writeFile(path.join(output,'files.json'),JSON.stringify({files},null,2),{mode:0o600});
 for(let i=0;i<chunks.length;i++)await fs.writeFile(path.join(output,`chunk-${String(i).padStart(5,'0')}.json`),JSON.stringify(chunks[i]),{mode:0o600});
 return {files:files.length,bytes:total,chunks:chunks.length,output};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(await fs.realpath(process.argv[1])).href){
 try{if(process.argv.length!==4)throw Error('Usage: node prepare-upload.mjs ARTIFACT NEW_OUTPUT');console.log(JSON.stringify(await prepare(process.argv[2],process.argv[3])));}catch(e){console.error(e.message);process.exitCode=1;}
}
