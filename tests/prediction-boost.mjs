import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {assets} from '../worker/assets.js';
import {makeRoom,makePlayer,tick} from '../realtime/simulation.js';
const entry=Object.entries(assets).find(([key])=>key.includes('game.js'))[1],source=Buffer.from(entry.data,'base64').toString();
const prediction=source.slice(source.indexOf('function predictVelocity('),source.indexOf('\nfunction advanceSnapshot('));
const sandbox={Math,tuning:null};vm.createContext(sandbox);vm.runInContext('function growth(w){return 1-Math.exp(-Math.max(0,w.score-20)/(tuning.growthPoints||1400))}\n'+prediction,sandbox);
let worst=0;
for(const score of [20,21,23,100])for(const accelerating of [false,true]){
 const room=makeRoom(Date.now(),{foodCount:0,startLength:200,growthPoints:1400});room.powerups=[];
 const actual=makePlayer('a','t','test','egypt',Date.now(),null,room.rules);Object.assign(actual,{x:0,y:0,a:0,target:0,score,boost:accelerating,trail:Array.from({length:68},(_,i)=>({x:-i*3,y:0}))});room.players=[actual];
 const predicted={...actual};sandbox.tuning=room.rules;
 for(let i=0;i<60;i++){const target=i<20?0:.6;actual.target=target;tick(room,1/60);sandbox.predictVelocity(predicted,1/60,target,accelerating,room.elapsed);predicted.x+=predicted.vx/60;predicted.y+=predicted.vy/60;worst=Math.max(worst,Math.hypot(predicted.x-actual.x,predicted.y-actual.y));}
 if(!process.env.BASELINE)assert.ok(Math.hypot(predicted.x-actual.x,predicted.y-actual.y)<.01,`Boost prediction mismatch at score ${score}: ${predicted.x-actual.x}`);
}
console.log(JSON.stringify({maxPositionError:worst,pass:worst<.01}));

const frameSource=source.slice(source.indexOf('function onlineFrame('),source.indexOf('\nasync function syncOnline('));
vm.runInContext(frameSource,sandbox);
for(const fps of [30,60]){
 const room=makeRoom(Date.now(),{foodCount:0,startLength:200,growthPoints:1400});room.powerups=[];
 const actual=makePlayer('f','t','test','egypt',Date.now(),null,room.rules);Object.assign(actual,{x:0,y:0,a:0,target:.5,score:21,boost:true,trail:Array.from({length:68},(_,i)=>({x:-i*3,y:0}))});room.players=[actual];
 const predicted={...actual};Object.assign(sandbox,{tuning:room.rules,Date,performance:{now:()=>0},receivedAt:0,controlHistory:[],elapsed:0,aim:{x:Math.cos(.5),y:Math.sin(.5)},boost:true,worms:[predicted],player:predicted,cam:{x:0,y:0},followBody:()=>{}});
 for(let i=0;i<fps;i++){for(let j=0;j<60/fps;j++)tick(room,1/60);sandbox.onlineFrame(1/fps)}
 assert.ok(Math.hypot(predicted.x-actual.x,predicted.y-actual.y)<.01,`Frame prediction mismatch at ${fps} fps`);
}
console.log('PASS: live frame loop matches server boost depletion at 30 and 60 fps');
