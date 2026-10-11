import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createGameServer} from '../realtime/server.js';
import {checkedSettings} from '../worker/settings.js';
let record={settings:checkedSettings({normalSpeed:150,startLength:240,startScale:1.5,foodCount:1000}),revision:'first',updatedAt:new Date().toISOString()};
const storage=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(record))});
storage.listen(0,'127.0.0.1');await once(storage,'listening');
const settingsUrl=`http://127.0.0.1:${storage.address().port}`;
let game=createGameServer({settingsUrl,settingsPollMs:10000});
const sockets=[];
async function join(port){const ws=new WebSocket(`ws://127.0.0.1:${port}/realtime`);sockets.push(ws);await once(ws,'open');const result=once(ws,'message');ws.send(JSON.stringify({type:'join',room:'ignored',name:'test',skin:'egypt'}));return {ws,state:JSON.parse((await result)[0])}}
try{
 let address=await game.listen();const a=await join(address.port),b=await join(address.port);
 assert.equal(game.rooms.size,1);assert.equal(b.state.roomPopulation,2);assert.equal(a.state.tuning.normalSpeed,150);assert.equal(a.state.settingsRevision,'first');assert.equal(a.state.players[0].trailData.length>0,true);
 const room=[...game.rooms.values()][0].room;assert.equal(room.players[0].rules.startLength,240);assert.equal(room.players[0].rules.startScale,1.5);
 const old=room.players.map(w=>({x:w.x,y:w.y}));
 record={...record,settings:checkedSettings({...record.settings,normalSpeed:200,boostSpeed:310,mapScale:1.5,maxScale:4,foodCount:1100}),revision:'second'};
 const applied=await (await fetch(`http://127.0.0.1:${address.port}/api/play-settings`)).json();assert.equal(applied.revision,'second');
 assert.equal(room.rules.normalSpeed,200);assert.equal(room.rules.boostSpeed,310);assert.equal(room.players.every(w=>w.rules===room.rules),true);assert.equal(room.settingsRevision,'second');assert.equal(Math.abs(room.players[0].x-old[0].x*1.5)<30,true);
 const state=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No synchronized state')),2000);a.ws.on('message',raw=>{const s=JSON.parse(raw);if(s.type==='state'&&s.settingsRevision==='second'){clearTimeout(timer);resolve(s)}})});
 assert.equal(state.tuning.boostSpeed,310);assert.equal(state.arenaRadius,3600*Math.SQRT2*1.5);assert.equal(state.players[0].alive,true);
 for(const ws of sockets)ws.terminate();await game.close();
 game=createGameServer({settingsUrl,settingsPollMs:10000});address=await game.listen();const c=await join(address.port);assert.equal(c.state.tuning.normalSpeed,200);assert.equal(c.state.settingsRevision,'second');
 record={...record,settings:{...record.settings,normalSpeed:Infinity},revision:'bad'};await fetch(`http://127.0.0.1:${address.port}/api/play-settings`);assert.equal([...game.rooms.values()][0].room.rules.normalSpeed,200);
 console.log('PASS: two clients share settings; live updates, map resize, restart persistence, invalid settings rejected');
}finally{for(const ws of sockets)ws.terminate();await game.close();await new Promise(resolve=>storage.close(resolve))}
