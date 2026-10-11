import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createGameServer} from '../realtime/server.js';
import {makeRoom,makePlayer,tick,view} from '../realtime/simulation.js';
import {syncBots} from '../realtime/bots.js';
import {checkedSettings} from '../worker/settings.js';
let record={settings:checkedSettings({botCount:3,botScore:500,startScore:80,sizeMultiplier:1.5,thicknessMultiplier:2,foodCount:1000}),revision:'bots-3'};
const storage=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(record))});storage.listen(0,'127.0.0.1');await once(storage,'listening');
const game=createGameServer({settingsUrl:`http://127.0.0.1:${storage.address().port}`,settingsPollMs:10000});const sockets=[];
async function join(port){const ws=new WebSocket(`ws://127.0.0.1:${port}/realtime`);sockets.push(ws);await once(ws,'open');const response=once(ws,'message');ws.send(JSON.stringify({type:'join',room:'ignored',name:'human',skin:'egypt'}));return JSON.parse((await response)[0])}
try{
 const address=await game.listen(),a=await join(address.port),b=await join(address.port),room=[...game.rooms.values()][0].room;
 assert.equal(game.rooms.size,1);assert.equal(b.roomPopulation,2);assert.equal(b.botPopulation,3);assert.equal(a.tuning.botCount,3);assert.equal(a.players.find(w=>w.id===a.selfId).score,80);
 assert.equal(room.rules.startLength,186*1.5);assert.equal(room.rules.maxScale,2.25*3);assert.equal(room.players.filter(w=>w.bot).every(w=>w.score===500),true);
 const humans=room.players.filter(w=>!w.bot);humans[1].x=humans[0].x+100;humans[1].y=humans[0].y;
 const ids=viewer=>view(room,viewer.id).players.filter(w=>w.bot).map(w=>w.id).sort();const bots=room.players.filter(w=>w.bot);for(let i=0;i<bots.length;i++)for(let j=i+1;j<bots.length;j++)assert.ok(Math.hypot(bots[i].x-bots[j].x,bots[i].y-bots[j].y)>700,'Bots must spawn across the arena');
 const first=room.players.find(w=>w.bot),before={x:first.x,y:first.y};tick(room,1/60);assert.ok(Math.hypot(first.x-before.x,first.y-before.y)>0);
 first.alive=false;syncBots(room);room.elapsed+=8.1;syncBots(room);assert.equal(room.players.filter(w=>w.bot&&w.alive).length,3);
 record={...record,settings:checkedSettings({...record.settings,botCount:1,botScore:900}),revision:'bots-1'};await fetch(`http://127.0.0.1:${address.port}/api/play-settings`);assert.equal(room.players.filter(w=>w.bot).length,1);assert.equal(room.players.find(w=>w.bot).score,900);assert.equal(room.players.filter(w=>!w.bot).length,2);
 record={...record,settings:checkedSettings({...record.settings,botCount:0}),revision:'bots-0'};await fetch(`http://127.0.0.1:${address.port}/api/play-settings`);assert.equal(room.players.filter(w=>w.bot).length,0);assert.equal(room.players.filter(w=>!w.bot).length,2);
 assert.throws(()=>checkedSettings({botCount:1.5}));assert.throws(()=>checkedSettings({botCount:25}));
 console.log('PASS: shared bots, AI movement, respawn, live count/score updates, zero disables bots, starting points and size multipliers');
}finally{for(const ws of sockets)ws.terminate();await game.close();await new Promise(resolve=>storage.close(resolve))}
// Bots use the same authoritative collision rules as human worms.
const collision=makeRoom(Date.now(),checkedSettings({botCount:1}));collision.food=[];collision.powerups=[];const h=makePlayer('h','','human','raw',Date.now(),null,collision.rules);Object.assign(h,{x:0,y:0,a:0,target:0,trail:[{x:0,y:0},{x:-3,y:0}]});collision.players=[h];syncBots(collision,h);const bot=collision.players.find(w=>w.bot);Object.assign(bot,{x:10,y:0,a:0,target:0,thinkAt:999,trail:[{x:10,y:0},{x:7,y:0}]});tick(collision,1/60);assert.equal(h.alive,false);assert.equal(bot.alive,true);assert.equal(bot.kills,1);console.log('PASS: bots participate in shared head collisions and kills');
