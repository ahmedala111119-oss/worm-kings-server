import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {makeRoom,makePlayer,tick} from '../realtime/simulation.js';
import {syncBots} from '../realtime/bots.js';
import {checkedSettings} from '../worker/settings.js';
let seed=41;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const room=makeRoom(Date.now(),checkedSettings({botCount:24,mapScale:1.7,startLength:200,foodSize:59,turnSmooth:.04,boostSlip:60}));const human=makePlayer('human','','test','egypt',Date.now(),null,room.rules);room.players=[human];syncBots(room,human);
const bots=room.players.filter(w=>w.bot);let minDistance=Infinity;for(let i=0;i<bots.length;i++)for(let j=i+1;j<bots.length;j++)minDistance=Math.min(minDistance,Math.hypot(bots[i].x-bots[j].x,bots[i].y-bots[j].y));assert.ok(minDistance>300);assert.ok(bots.filter(w=>Math.hypot(w.x-human.x,w.y-human.y)<900).length<5);
let maxFood=0,totalMs=0;for(let i=0;i<3600;i++){const start=performance.now();tick(room,1/60);totalMs+=performance.now()-start;maxFood=Math.max(maxFood,room.food.length);assert.ok(room.players.length<=25)}
assert.ok(room.food.filter(f=>f.value>1).length<300,'Bot deaths must not flood the arena');
function position(w,x){Object.assign(w,{x,y:0,a:0,target:0,thinkAt:999,trail:[{x,y:0},{x:x-3,y:0}],path:undefined,boost:false})}
const fight=makeRoom(Date.now(),checkedSettings({botCount:2}));fight.players=[];syncBots(fight);position(fight.players[0],0);position(fight.players[1],10);tick(fight,1/60);assert.equal(fight.players.filter(w=>!w.alive).length,1);assert.equal(fight.food.filter(f=>f.value>1).length,0,'Bot-bot deaths must not drop loot');
const reward=makeRoom(Date.now(),checkedSettings({botCount:1,botScore:10000}));const hunter=makePlayer('hunter','','human','raw',Date.now(),null,reward.rules);reward.players=[hunter];syncBots(reward,hunter);position(hunter,10);position(reward.players.find(w=>w.bot),0);tick(reward,1/60);assert.equal(hunter.kills,1);assert.ok(reward.food.filter(f=>f.value>1).length<=64,'Human kill rewards must be bounded');
console.log(JSON.stringify({pass:true,simulationSeconds:60,bots:24,minSpawnDistance:minDistance,maxFood,averageTickMs:totalMs/3600}));
