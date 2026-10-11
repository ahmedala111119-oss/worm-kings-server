export const R=3600*Math.SQRT2;
export const tuning={normalSpeed:125,boostSpeed:230,turnRate:3.4,sharpTurn:7,turnSmooth:.055,bodySlip:60,boostSlip:80,bodyDrift:30,bodyStability:100,maxLength:2600,maxScale:2.25,foodCount:2400,revealRadius:900};
const baseTuning=tuning;
const colors=['#63efbf','#ffb75a','#b59aff','#65caff','#ff769c','#fff18c'];
const rand=(a,b)=>a+Math.random()*(b-a),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function spot(limit=R-100){let a=rand(0,Math.PI*2),r=Math.sqrt(Math.random())*limit;return{x:Math.cos(a)*r,y:Math.sin(a)*r}}
export function growth(w){return 1-Math.exp(-Math.max(0,w.score-20)/(w.rules?.growthPoints||1400))}
export function bodyScale(w){const rules=w.rules||baseTuning,start=rules.startScale||1;return start+(rules.maxScale-start)*growth(w)}
function bodyLength(w){const rules=w.rules||baseTuning,start=rules.startLength||186;return start+(rules.maxLength-start)*growth(w)}
function contactDistance(a,b,heads=false){return 12*(bodyScale(a)+bodyScale(b))*(heads?.82:.68)}
function followBody(w,dt,fast){const tuning=w.rules||baseTuning;
 const spacing=3,desiredLength=bodyLength(w);w.spacing=spacing;
 if(!w.path)w.path=w.trail.map(p=>({...p}));
 const previous=w.path[0],travel=dist(w,previous);w.travel=(w.travel||0)+travel;
 if(!Number.isFinite(w.currentLength))w.currentLength=desiredLength;
 const growing=desiredLength>w.currentLength+1e-8,heldTail=w.path.at(-1),heldTailX=heldTail.x,heldTailY=heldTail.y;
 // During growth the head's travelled distance becomes added body length.
 // Preserve the tail's path until the target length has been reached.
 w.currentLength=desiredLength<w.currentLength?desiredLength:Math.min(desiredLength,w.currentLength+(dt>0?travel:0));
 const length=w.currentLength;

 w.path.unshift({x:w.x,y:w.y});
 const sampled=w.bodyBuffer||[];let sampleCount=0;function sample(x,y){let p=sampled[sampleCount];if(!p)sampled[sampleCount]=p={x,y};else{p.x=x;p.y=y}sampleCount++}sample(w.x,w.y);let remaining=Math.min(spacing,length),used=0;
 for(let i=1;i<w.path.length&&used<length;i++){
  const start=w.path[i-1],end=w.path[i];let ax=start.x,ay=start.y,dx=end.x-ax,dy=end.y-ay,span=Math.sqrt(dx*dx+dy*dy);if(span<1e-8)continue;
  while(span>=remaining&&used<length){const advance=remaining,t=advance/span;ax+=(end.x-ax)*t;ay+=(end.y-ay)*t;sample(ax,ay);used+=Math.min(spacing,length-used);span-=advance;remaining=Math.min(spacing,length-used);}
  remaining-=span;
 }
 while(used<length){const a=sampled[sampleCount-1],b=sampled[sampleCount-2]||{x:a.x+Math.cos(w.a),y:a.y+Math.sin(w.a)},d=dist(a,b)||1;const advance=Math.min(spacing,length-used);sample(a.x+(a.x-b.x)/d*advance,a.y+(a.y-b.y)/d*advance);used+=advance;}
 // Preserve a continuous travelled curve, including the sub-spacing head movement.
 // Lower stability relaxes the actual body curve, so tight loops shrink gradually.
 sampled.length=sampleCount;const relaxation=(growing?0:1-tuning.bodyStability/100)*(1-Math.exp(-dt*8));
 const bendWindow=Math.max(2,Math.round(12*bodyScale(w)/spacing));
 if(relaxation>0){const original=w.relaxBuffer||(w.relaxBuffer=[]);for(let i=0;i<sampled.length;i++){let p=original[i];if(!p)original[i]=p={x:0,y:0};p.x=sampled[i].x;p.y=sampled[i].y}original.length=sampled.length;for(let i=1;i<sampled.length-1;i++){
  const window=Math.min(bendWindow,i,original.length-1-i),a=original[i-window],b=original[i+window];sampled[i].x+=( (a.x+b.x)/2-sampled[i].x)*relaxation;
  sampled[i].y+=( (a.y+b.y)/2-sampled[i].y)*relaxation;
 }}
 if(growing){sampled[sampled.length-1].x=heldTailX;sampled[sampled.length-1].y=heldTailY}
 // Gradual downward body drift leaves the head under direct steering control.
 let minX=w.x,maxX=w.x,minY=w.y,maxY=w.y;
 for(let i=1;i<sampled.length;i++){const p=sampled[i],tailWeight=Math.min(1,i*spacing/120);p.y+=(growing?0:tuning.bodyDrift*.16*dt*tailWeight);if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y}
 const bounds=w.bodyBounds||(w.bodyBounds={});bounds.minX=minX;bounds.maxX=maxX;bounds.minY=minY;bounds.maxY=maxY;
 w.bodyBuffer=w.path;w.path=sampled;w.trail=sampled;

}


function pellet(room,p=spot(R*(room.rules?.mapScale||1)-100),value=1){room.food.push({...p,id:room.nextFood++,value,color:colors[Math.floor(rand(0,colors.length))],angle:rand(-.35,.35),kind:Math.floor(rand(0,12))})}
function power(room){room.powerups.push({...spot(R*(room.rules?.mapScale||1)-160),id:room.nextFood++,type:['speed','turn','x2','x5','x10'][Math.floor(rand(0,5))]})}
export function makeRoom(now,settings){const tuning={...baseTuning,...settings};const room={rules:tuning,version:0,now,elapsed:0,players:[],food:[],powerups:[],nextFood:1};for(let i=0;i<tuning.foodCount;i++)pellet(room);for(let i=0;i<144;i++)power(room);return room}
export function makePlayer(id,token,name,skin,now,skinImage=null,rules=baseTuning){const p=spot(R*(rules.mapScale||1)*.55),a=rand(-Math.PI,Math.PI);return {...p,rules,id,token,name,skin,skinImage,a,target:a,score:20,kills:0,color:colors[Math.floor(rand(0,colors.length))],alive:true,spacing:3,trail:Array.from({length:Math.ceil((rules.startLength||186)/3)+1},(_,j)=>({x:p.x-Math.cos(a)*j*3,y:p.y-Math.sin(a)*j*3})),lastSeen:now,boost:false,until:[],speedUntil:0,turnUntil:0}}
export function kill(room,w){if(!w.alive)return;w.alive=false;const points=[w,...w.trail];for(let i=0;i<points.length;i+=3){const p=points[i];for(let j=0;j<5;j++)if(Math.hypot(p.x,p.y)<R*(room.rules?.mapScale||1)-12)pellet(room,{x:p.x+rand(-8,8),y:p.y+rand(-8,8)},4)}if(room.food.length>12000)room.food.splice(0,room.food.length-12000)}
export function advance(room,now){room.players=room.players.filter(p=>now-p.lastSeen<15000);const gap=Math.min(.5,Math.max(0,(now-room.now)/1000));room.now=now;let remaining=gap;while(remaining>1e-8){const dt=Math.min(1/60,remaining);step(room,dt);remaining-=dt}}
function step(room,dt){const tuning=room.rules||baseTuning,R=3600*Math.SQRT2*(tuning.mapScale||1);room.elapsed+=dt;const time=room.elapsed;for(const w of room.players){if(!w.alive)continue;w.until=w.until.filter(e=>e.until>time);let delta=Math.atan2(Math.sin(w.target-w.a),Math.cos(w.target-w.a)),rate=(time<w.turnUntil?tuning.sharpTurn:tuning.turnRate)/(1+.35*growth(w));const desired=Math.max(-rate,Math.min(rate,delta/dt));w.turnVelocity=(w.turnVelocity||0)+(desired-(w.turnVelocity||0))*(1-Math.exp(-dt/tuning.turnSmooth));w.a+=w.turnVelocity*dt;const fast=w.boost&&w.score>20,speed=(fast?tuning.boostSpeed:tuning.normalSpeed)*(time<w.speedUntil?1.35:1);if(fast){w.score=Math.max(20,w.score-dt*7);if(Math.random()<dt*10)pellet(room,w.trail.at(-1))}const vx=Math.cos(w.a)*speed,vy=Math.sin(w.a)*speed;if(!Number.isFinite(w.vx)){w.vx=vx;w.vy=vy}const slip=fast?tuning.boostSlip:tuning.bodySlip,response=1-Math.exp(-dt/(.025+slip*.002));w.vx+=(vx-w.vx)*response;w.vy+=(vy-w.vy)*response;const length=Math.hypot(w.vx,w.vy)||1;w.vx=w.vx/length*speed;w.vy=w.vy/length*speed;w.x+=w.vx*dt;w.y+=w.vy*dt;followBody(w,dt,fast);if(Math.hypot(w.x,w.y)>R-3*bodyScale(w)){kill(room,w);continue}
const radius=12*bodyScale(w)+8;for(let i=room.food.length-1;i>=0;i--){const f=room.food[i];if(Math.abs(f.x-w.x)<radius&&Math.abs(f.y-w.y)<radius&&dist(w,f)<radius){w.score+=f.value*(w.until.reduce((s,e)=>s+e.value,0)||1);room.food.splice(i,1)}}
for(let i=room.powerups.length-1;i>=0;i--){const p=room.powerups[i];if(dist(w,p)<27){if(p.type==='speed')w.speedUntil=time+30;else if(p.type==='turn')w.turnUntil=time+30;else{const value=Number(p.type.slice(1)),existing=w.until.find(e=>e.value===value);if(existing)existing.until=time+30;else w.until.push({value,until:time+30})}room.powerups.splice(i,1);power(room)}}}
for(let i=0;i<room.players.length;i++){const a=room.players[i];if(!a.alive)continue;for(let j=i+1;j<room.players.length;j++){const b=room.players[j];if(!b.alive)continue;if(dist(a,b)<contactDistance(a,b,true)){const delta=Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y);if(Math.abs(delta)<.01){kill(room,a);kill(room,b)}else{const win=delta>0?a:b;win.kills++;kill(room,win===a?b:a)}if(!a.alive)break}}}
for(const a of room.players){if(!a.alive)continue;for(const b of room.players){if(a===b||!b.alive)continue;for(let j=Math.ceil(24*bodyScale(b)/3);j<b.trail.length;j+=Math.max(1,Math.floor(10*bodyScale(b)/3))){if(dist(a,b.trail[j])<contactDistance(a,b)){b.kills++;kill(room,a);break}}if(!a.alive)break}}
while(room.food.length<tuning.foodCount)pellet(room)}
export function snapshot(room,id){const self=room.players.find(p=>p.id===id);return {version:room.version,elapsed:room.elapsed,selfId:id,players:room.players.map(({token,path,lastSeen,target,boost,rules,bodyBuffer,relaxBuffer,...p})=>p),food:self?room.food.filter(f=>Math.abs(f.x-self.x)<1600&&Math.abs(f.y-self.y)<1600):[],powerups:room.powerups,tuning:room.rules||tuning,arenaRadius:R*(room.rules?.mapScale||1)}}
