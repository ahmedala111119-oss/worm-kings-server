import {randomUUID} from 'node:crypto';
import {makePlayer,R,growth,bodyScale} from '../worker/simulation.js';
const names=['نجم','كوبرا','برق','سريع','ظل','زوم','لولو','شهاب','تيتان','موج','أفعى','نورس'];
function createBot(room,index,anchor){
 const w=makePlayer('bot-'+randomUUID(),'','بوت '+names[index%names.length],'raw',Date.now(),null,room.rules);w.bot=true;w.score=room.rules.botScore??60;w.boost=false;w.thinkAt=0;
 if(anchor){const radius=R*(room.rules.mapScale||1),angle=Math.random()*Math.PI*2,distance=350+Math.random()*250;w.x=anchor.x+Math.cos(angle)*distance;w.y=anchor.y+Math.sin(angle)*distance;const d=Math.hypot(w.x,w.y);if(d>radius-250){w.x*=((radius-250)/d);w.y*=((radius-250)/d)}}
 const length=room.rules.startLength+(room.rules.maxLength-room.rules.startLength)*growth(w);w.trail=Array.from({length:Math.ceil(length/3)+1},(_,i)=>({x:w.x-Math.cos(w.a)*i*3,y:w.y-Math.sin(w.a)*i*3}));return w;
}
export function syncBots(room,anchor=room.players.find(w=>!w.bot&&w.alive)){
 const wanted=Math.max(0,Math.min(24,Math.round(room.rules.botCount||0))),bots=room.players.filter(w=>w.bot);
 for(const w of bots)if(!w.alive&&w.respawnAt===undefined)w.respawnAt=room.elapsed+3;
 const retained=bots.slice(0,wanted).map((w,i)=>!w.alive&&room.elapsed>=w.respawnAt?createBot(room,i,anchor):w);
 while(retained.length<wanted)retained.push(createBot(room,retained.length,anchor));
 room.players=[...room.players.filter(w=>!w.bot),...retained];return retained;
}
export function steerBots(room){
 const radius=R*(room.rules.mapScale||1);
 for(const w of room.players){if(!w.bot||!w.alive||room.elapsed<(w.thinkAt||0))continue;w.thinkAt=room.elapsed+.2;
  if(Math.hypot(w.x,w.y)>radius-350){w.target=Math.atan2(-w.y,-w.x);w.boost=false;continue}
  const look=130+18*bodyScale(w),px=w.x+Math.cos(w.a)*look,py=w.y+Math.sin(w.a)*look;let hazard=null,closest=Infinity;
  for(const other of room.players){if(other===w||!other.alive)continue;const step=Math.max(10,Math.ceil(other.trail.length/60));for(let i=0;i<other.trail.length;i+=step){const p=other.trail[i],d=(px-p.x)**2+(py-p.y)**2;if(d<closest){closest=d;hazard=p}}}
  if(hazard&&closest<(60+12*(bodyScale(w)+room.rules.maxScale))**2){w.target=Math.atan2(w.y-hazard.y,w.x-hazard.x);w.boost=false;continue}
  let food=null,distance=Infinity;const stride=Math.max(1,Math.floor(room.food.length/100)),offset=Math.floor(Math.random()*stride);
  for(let i=offset;i<room.food.length;i+=stride){const f=room.food[i],d=(w.x-f.x)**2+(w.y-f.y)**2;if(d<distance){distance=d;food=f}}
  w.target=food?Math.atan2(food.y-w.y,food.x-w.x):w.a+(Math.random()-.5)*.8;w.boost=false;
 }
}
