import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {bridge} from '../pi/bridge.mjs';
test('Real mcp-remote stdio bridge discovers and invokes an HTTP MCP tool',{timeout:30000},async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vzhuh-bridge-'));
 const server=http.createServer(async(req,res)=>{
  if(req.headers.authorization!=='Bearer fixture-only'){res.writeHead(401);res.end();return;}
  const mcp=new Server({name:'fixture',version:'1'},{capabilities:{tools:{}}});
  mcp.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'whoami',description:'Test identity',inputSchema:{type:'object',properties:{}}}]}));
  mcp.setRequestHandler(CallToolRequestSchema,async()=>({content:[{type:'text',text:'fixture-account'}]}));
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  res.on('close',()=>void mcp.close());await mcp.connect(transport);await transport.handleRequest(req,res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const connection=bridge({authDirectory:path.join(directory,'auth'),transportOptions:{command:process.execPath,args:[path.resolve('node_modules/mcp-remote/dist/proxy.js'),'http://127.0.0.1:'+server.address().port+'/mcp','--allow-http','--transport','http-only','--header','Authorization: Bearer fixture-only'],stderr:'ignore'}});
 try{assert.equal((await connection.list()).tools[0].name,'whoami');assert.equal((await connection.call('whoami',{})).content[0].text,'fixture-account');}
 finally{await connection.close();await new Promise(r=>server.close(r));await fs.rm(directory,{recursive:true,force:true});}
});
