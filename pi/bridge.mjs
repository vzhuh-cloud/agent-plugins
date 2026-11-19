import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const endpoint='https://vzhuh.cloud/mcp';
export function bridge({makeClient=()=>new Client({name:'vzhuh-pi',version:'0.2.0'}),makeTransport=options=>new StdioClientTransport(options),authDirectory,transportOptions}={}){
 let client,pending;
 const connect=async()=>{
  if(client)return client;if(pending)return pending;
  pending=(async()=>{
   const directory=authDirectory??path.join(os.homedir(),'.local/share/vzhuh/pi-auth');await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.chmod(directory,0o700);
   const transport=makeTransport({command:process.execPath,args:[fileURLToPath(new URL('../node_modules/mcp-remote/dist/proxy.js',import.meta.url)),endpoint,'--transport','http-only','--resource',endpoint,'--static-oauth-client-metadata',JSON.stringify({client_name:'vzhuh.cloud for Pi',scope:'sites:read sites:write'})],env:{...process.env,MCP_REMOTE_CONFIG_DIR:directory},stderr:'pipe',...transportOptions});
   // OAuth links are shown to the human terminal, never returned as a model tool result.
   transport.stderr?.on('data',data=>process.stderr.write(data));
   const candidate=makeClient();try{await candidate.connect(transport,{timeout:300000});client=candidate;return client;}catch(error){await candidate.close().catch(()=>{});throw error;}
  })().finally(()=>{pending=undefined;});return pending;
 };
 return {
  async list(signal){return (await connect()).listTools({}, {signal,timeout:300000});},
  async call(name,args,signal){return (await connect()).callTool({name,arguments:args},undefined,{signal,timeout:300000});},
  async close(){if(pending)await pending.catch(()=>{});const current=client;client=undefined;await current?.close();}
 };
}
