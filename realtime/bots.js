import {randomUUID} from 'node:crypto';
import {makePlayer,R,growth,bodyScale} from '../worker/simulation.js';
const names=['نجم','كوبرا','برق','سريع','ظل','زوم','لولو','شهاب','تيتان','موج','أفعى','نورس'];
function createBot(room,index,anchor){
 const w=makePlayer('bot-'+randomUUID(),'','بوت '+names[index%names.length],'raw',Date.now(),null,room.rules);w.bot=true;w.score=room.rules.botScore??60;w.boost=false;w.thinkAt=0;
 const radius=R*(room.rules.mapScale||1),sector=index*2.399963229728653;
 const ring=radius*(.3+.32*((index%3)/2));w.x=Math.cos(sector)*ring;w.y=Math.sin(sector)*ring;w.a=sector+Math.PI/2;w.target=w.a;w.home={x:w.x,y:w.y};
 // Check the full initial body before accepting a spawn, including human trails.
 let spawnSafe=false;for(let attempt=0;attempt<40;attempt++){
  const length=room.rules.startLength+(room.rules.maxLength-room.rules.startLength)*growth(w),clearance=100+24*bodyScale(w);let safe=true;
  for(let j=0;j<=length;j+=Math.max(24,length/80)){
   const x=w.x-Math.cos(w.a)*j,y=w.y-Math.sin(w.a)*j;if(Math.hypot(x,y)>radius-clearance){safe=false;break}
   for(const other of room.players){if(!other.alive)continue;const spacing=Math.max(1,Math.floor(other.trail.length/80));for(let i=0;i<other.trail.length;i+=spacing){const point=other.trail[i];if(Math.hypot(x-point.x,y-point.y)<clearance+12*bodyScale(other)){safe=false;break}}if(!safe)break}if(!safe)break
  }
  if(safe){spawnSafe=true;break;}
  const angle=sector+(attempt+1)*.73,distance=radius*(.25+.45*((attempt%7)/6));w.x=Math.cos(angle)*distance;w.y=Math.sin(angle)*distance;w.a=angle+Math.PI/2;w.target=w.a;w.home={x:w.x,y:w.y};
 }

 if(!spawnSafe){w.alive=false;w.respawnAt=room.elapsed+8;w.pendingSpawn=true;w.trail=[{x:w.x,y:w.y}];return w}
 const length=room.rules.startLength+(room.rules.maxLength-room.rules.startLength)*growth(w);w.trail=Array.from({length:Math.ceil(length/3)+1},(_,i)=>({x:w.x-Math.cos(w.a)*i*3,y:w.y-Math.sin(w.a)*i*3}));return w;
}
export function syncBots(room,anchor=room.players.find(w=>!w.bot&&w.alive)){
 const wanted=Math.max(0,Math.min(24,Math.round(room.rules.botCount||0))),bots=room.players.filter(w=>w.bot);
 for(const w of bots)if(!w.alive&&w.respawnAt===undefined)w.respawnAt=room.elapsed+8;
 const retained=bots.slice(0,wanted).map((w,i)=>!w.alive&&room.elapsed>=w.respawnAt?createBot(room,i,anchor):w);
 while(retained.length<wanted){room.players=[...room.players.filter(w=>!w.bot),...retained];retained.push(createBot(room,retained.length,anchor));}
 room.players=[...room.players.filter(w=>!w.bot),...retained];return retained;
}
export function steerBots(room){
 const radius=R*(room.rules.mapScale||1);
 for(const w of room.players){if(!w.bot||!w.alive||room.elapsed<(w.thinkAt||0))continue;w.thinkAt=room.elapsed+.2;
  if(Math.hypot(w.x,w.y)>radius-350){w.target=Math.atan2(-w.y,-w.x);w.boost=false;continue}
  const look=130+18*bodyScale(w),px=w.x+Math.cos(w.a)*look,py=w.y+Math.sin(w.a)*look;let hazard=null,closest=Infinity;
  for(const other of room.players){if(other===w||!other.alive)continue;const step=Math.max(10,Math.ceil(other.trail.length/60));for(let i=0;i<other.trail.length;i+=step){const p=other.trail[i],d=(px-p.x)**2+(py-p.y)**2;if(d<closest){closest=d;hazard=p}}}
  if(hazard&&closest<(60+12*(bodyScale(w)+room.rules.maxScale))**2){w.target=Math.atan2(w.y-hazard.y,w.x-hazard.x);w.boost=false;continue}
  let food=null,distance=500*500;const stride=Math.max(1,Math.floor(room.food.length/100)),offset=Math.floor(Math.random()*stride);
  for(let i=offset;i<room.food.length;i+=stride){const f=room.food[i],d=(w.x-f.x)**2+(w.y-f.y)**2;if(d<distance){distance=d;food=f}}
  if(food){w.target=Math.atan2(food.y-w.y,food.x-w.x)}else{if(!w.roam||room.elapsed>(w.roamUntil||0)){const angle=Math.random()*Math.PI*2;w.roam={x:w.home.x+Math.cos(angle)*350,y:w.home.y+Math.sin(angle)*350};w.roamUntil=room.elapsed+4+Math.random()*4}w.target=Math.atan2(w.roam.y-w.y,w.roam.x-w.x)}w.boost=false;
 }
}
