import {makeRoom,makePlayer,R,tuning,growth,bodyScale,kill as originalKill} from '../worker/simulation.js';
import {SpatialGrid} from './spatial.js';
export {makeRoom,makePlayer,R,tuning};
const dist=(a,b)=>Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2);
const bodyLength=w=>Math.min(tuning.maxLength,186+(tuning.maxLength-186)*growth(w));
const colors=['#63efbf','#ffb75a','#b59aff','#65caff','#ff769c','#fff18c'];
function spot(){const angle=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*(R-100);return{x:Math.cos(angle)*r,y:Math.sin(angle)*r}}
function pellet(room,p=spot(),value=1){room.food.push({...p,id:room.nextFood++,value,color:colors[Math.floor(Math.random()*6)],angle:Math.random()*.7-.35,kind:Math.floor(Math.random()*12)})}
const cellRadius=12*(tuning.maxScale+tuning.maxScale)*.68;
function followBody(w,dt,fast){
 const spacing=3,length=bodyLength(w);w.spacing=spacing;
 if(!w.path)w.path=w.trail.map(p=>({...p}));
 const previous=w.path[0],travel=dist(w,previous);w.travel=(w.travel||0)+travel;
 w.path.unshift({x:w.x,y:w.y});
 const sampled=w.bodyBuffer||[];let sampleCount=0;function sample(x,y){let p=sampled[sampleCount];if(!p)sampled[sampleCount]=p={x,y};else{p.x=x;p.y=y}sampleCount++}sample(w.x,w.y);let remaining=spacing,used=0;
 for(let i=1;i<w.path.length&&used<length;i++){
  const start=w.path[i-1],end=w.path[i];let ax=start.x,ay=start.y,dx=end.x-ax,dy=end.y-ay,span=Math.sqrt(dx*dx+dy*dy);if(span<1e-8)continue;
  while(span>=remaining&&used<length){const t=remaining/span;ax+=(end.x-ax)*t;ay+=(end.y-ay)*t;sample(ax,ay);used+=spacing;span-=remaining;remaining=spacing;}
  remaining-=span;
 }
 while(used<length){const a=sampled[sampleCount-1],b=sampled[sampleCount-2]||{x:a.x+Math.cos(w.a),y:a.y+Math.sin(w.a)},d=dist(a,b)||1;sample(a.x+(a.x-b.x)/d*spacing,a.y+(a.y-b.y)/d*spacing);used+=spacing;}
 // Preserve a continuous travelled curve, including the sub-spacing head movement.
 // Lower stability relaxes the actual body curve, so tight loops shrink gradually.
 sampled.length=sampleCount;const relaxation=(1-tuning.bodyStability/100)*(1-Math.exp(-dt*8));
 const bendWindow=Math.max(2,Math.round(12*bodyScale(w)/spacing));
 if(relaxation>0){const original=w.relaxBuffer||(w.relaxBuffer=[]);for(let i=0;i<sampled.length;i++){let p=original[i];if(!p)original[i]=p={x:0,y:0};p.x=sampled[i].x;p.y=sampled[i].y}original.length=sampled.length;for(let i=1;i<sampled.length-1;i++){
  const window=Math.min(bendWindow,i,original.length-1-i),a=original[i-window],b=original[i+window];sampled[i].x+=( (a.x+b.x)/2-sampled[i].x)*relaxation;
  sampled[i].y+=( (a.y+b.y)/2-sampled[i].y)*relaxation;
 }}
 // Gradual downward body drift leaves the head under direct steering control.
 let minX=w.x,maxX=w.x,minY=w.y,maxY=w.y;
 for(let i=1;i<sampled.length;i++){const p=sampled[i],tailWeight=Math.min(1,i*spacing/120);p.y+=tuning.bodyDrift*.16*dt*tailWeight;if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y}
 const bounds=w.bodyBounds||(w.bodyBounds={});bounds.minX=minX;bounds.maxX=maxX;bounds.minY=minY;bounds.maxY=maxY;
 w.bodyBuffer=w.path;w.path=sampled;w.trail=sampled;

}

export function tick(room,dt=1/60){
 room.elapsed+=dt;const time=room.elapsed,foodGrid=room.foodGrid||(room.foodGrid=new SpatialGrid(160)),foodIndex=room.foodIndex||(room.foodIndex=new Map());foodGrid.clear();foodIndex.clear();
 for(let i=0;i<room.food.length;i++){foodGrid.add(room.food[i]);foodIndex.set(room.food[i],i)}
 function removeFood(f){const i=foodIndex.get(f);if(i===undefined)return;const last=room.food.pop();foodIndex.delete(f);if(last!==f){room.food[i]=last;foodIndex.set(last,i)}}
 function die(w){const before=new Set(room.food);originalKill(room,w);foodIndex.clear();for(let i=0;i<room.food.length;i++){const f=room.food[i];foodIndex.set(f,i);if(!before.has(f))foodGrid.add(f)}}
 for(const w of room.players){if(!w.alive)continue;w.until=w.until.filter(e=>e.until>time);const delta=Math.atan2(Math.sin(w.target-w.a),Math.cos(w.target-w.a)),rate=(time<w.turnUntil?tuning.sharpTurn:tuning.turnRate)/(1+.35*growth(w)),desired=Math.max(-rate,Math.min(rate,delta/dt));w.turnVelocity=(w.turnVelocity||0)+(desired-(w.turnVelocity||0))*(1-Math.exp(-dt/tuning.turnSmooth));w.a+=w.turnVelocity*dt;
 const fast=w.boost&&w.score>20,speed=(fast?tuning.boostSpeed:tuning.normalSpeed)*(time<w.speedUntil?1.35:1);
 if(fast){w.score=Math.max(20,w.score-dt*7);if(Math.random()<dt*10){pellet(room,w.trail.at(-1));const f=room.food.at(-1);foodGrid.add(f);foodIndex.set(f,room.food.length-1)}}
 const vx=Math.cos(w.a)*speed,vy=Math.sin(w.a)*speed;if(!Number.isFinite(w.vx)){w.vx=vx;w.vy=vy}const slip=fast?tuning.boostSlip:tuning.bodySlip,response=1-Math.exp(-dt/(.025+slip*.002));w.vx+=(vx-w.vx)*response;w.vy+=(vy-w.vy)*response;const length=Math.hypot(w.vx,w.vy)||1;w.vx=w.vx/length*speed;w.vy=w.vy/length*speed;w.x+=w.vx*dt;w.y+=w.vy*dt;followBody(w,dt,fast);
 if(Math.hypot(w.x,w.y)>R-3*bodyScale(w)){die(w);continue}
 const radius=12*bodyScale(w)+8,multiplier=w.until.reduce((s,e)=>s+e.value,0)||1;
 for(const f of foodGrid.near(w.x,w.y,radius)){if(foodIndex.has(f)&&(w.x-f.x)**2+(w.y-f.y)**2<radius*radius){w.score+=f.value*multiplier;removeFood(f)}}
 for(let i=room.powerups.length-1;i>=0;i--){const p=room.powerups[i];if((w.x-p.x)**2+(w.y-p.y)**2<27*27){if(p.type==='speed')w.speedUntil=time+30;else if(p.type==='turn')w.turnUntil=time+30;else{const value=Number(p.type.slice(1)),existing=w.until.find(e=>e.value===value);if(existing)existing.until=time+30;else w.until.push({value,until:time+30})}room.powerups.splice(i,1);const pos=spot();room.powerups.push({...pos,id:room.nextFood++,type:['speed','turn','x2','x5','x10'][Math.floor(Math.random()*5)]})}}
 }
 const heads=room.headGrid||(room.headGrid=new SpatialGrid(80));heads.clear();room.players.forEach((w,index)=>{if(w.alive)heads.add(w,{w,index})});
 for(let i=0;i<room.players.length;i++){const a=room.players[i];if(!a.alive)continue;const candidates=[...heads.near(a.x,a.y,12*(tuning.maxScale*2)*.82)].filter(entry=>entry.index>i).sort((a,b)=>a.index-b.index);for(const {w:b} of candidates){if(!b.alive)continue;const r=12*(bodyScale(a)+bodyScale(b))*.82;if((a.x-b.x)**2+(a.y-b.y)**2<r*r){const delta=Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y);if(Math.abs(delta)<.01){die(a);die(b)}else{const win=delta>0?a:b;win.kills++;die(win===a?b:a)}if(!a.alive)break}}}
 const bodies=room.bodyGrid||(room.bodyGrid=new SpatialGrid(80));bodies.clear();
 room.players.forEach((w,index)=>{if(!w.alive)return;const scale=bodyScale(w),entries=w.gridEntries||(w.gridEntries=[]);let count=0;for(let j=Math.ceil(24*scale/3);j<w.trail.length;j+=Math.max(1,Math.floor(10*scale/3))){let entry=entries[count];if(!entry)entries[count]=entry={};entry.w=w;entry.index=index;entry.p=w.trail[j];bodies.add(entry.p,entry);count++}entries.length=count});
 for(const a of room.players){if(!a.alive)continue;const candidates=new Map();for(const e of bodies.near(a.x,a.y,cellRadius)){if(e.w===a||!e.w.alive)continue;const r=12*(bodyScale(a)+bodyScale(e.w))*.68;if((a.x-e.p.x)**2+(a.y-e.p.y)**2<r*r)candidates.set(e.index,e.w)}for(const [,b] of [...candidates].sort((a,b)=>a[0]-b[0])){if(b.alive){b.kills++;die(a);break}}}
 while(room.food.length<tuning.foodCount)pellet(room);
 room.version++;return room;
}
export function intersects(w,focus,radius){const r=radius+12*bodyScale(w),r2=r*r;let previous=w;if((w.x-focus.x)**2+(w.y-focus.y)**2<=r2)return true;const bounds=w.bodyBounds;if(bounds&&(focus.x<bounds.minX-r||focus.x>bounds.maxX+r||focus.y<bounds.minY-r||focus.y>bounds.maxY+r))return false;for(const p of w.trail){const dx=p.x-previous.x,dy=p.y-previous.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((focus.x-previous.x)*dx+(focus.y-previous.y)*dy)/d)):0;if((previous.x+dx*t-focus.x)**2+(previous.y+dy*t-focus.y)**2<=r2)return true;previous=p}return false}
export function view(room,id){const self=room.players.find(w=>w.id===id);if(!self)return null;const radius=tuning.revealRadius,players=room.players.filter(w=>w.id===id||(w.alive&&intersects(w,self,radius))).map(w=>({id:w.id,x:w.x,y:w.y,a:w.a,score:w.score,kills:w.kills,name:w.name,color:w.color,skin:w.skin,skinImage:w.skinImage,alive:w.alive,spacing:w.spacing,trail:w.trail,until:w.until,speedUntil:w.speedUntil,turnUntil:w.turnUntil,vx:w.vx,vy:w.vy,turnVelocity:w.turnVelocity||0}));return{version:room.version,elapsed:room.elapsed,selfId:id,players,food:room.food.filter(f=>(f.x-self.x)**2+(f.y-self.y)**2<radius*radius),powerups:room.powerups.filter(p=>(p.x-self.x)**2+(p.y-self.y)**2<(radius+30)**2),tuning,roomPopulation:room.players.filter(p=>p.alive).length}}
