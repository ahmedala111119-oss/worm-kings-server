const paths=new WeakMap(),serializedPlayers=new Map(),serializedFood=new WeakMap();
export function packState(state){return {...state,players:state.players.map(w=>{const {trail,...publicFields}=w;let cached=paths.get(trail);if(!cached){let format='q4-i16',bytes=Buffer.alloc(trail.length*4);for(let i=0;i<trail.length;i++){const x=Math.round(trail[i].x*4),y=Math.round(trail[i].y*4);if(x<-32768||x>32767||y<-32768||y>32767){format='f32';break}bytes.writeInt16LE(x,i*4);bytes.writeInt16LE(y,i*4+2)}if(format==='f32'){bytes=Buffer.alloc(trail.length*8);for(let i=0;i<trail.length;i++){bytes.writeFloatLE(trail[i].x,i*8);bytes.writeFloatLE(trail[i].y,i*8+4)}}cached={format,data:bytes.toString('base64')};paths.set(trail,cached)}return {...publicFields,trailFormat:cached.format,trailData:cached.data}})}}
// Trails use reusable simulation buffers. Clear caches once per broadcast batch.
export function clearWireCache(state){serializedPlayers.clear();for(const w of state.players)paths.delete(w.trail)}

// Public worm records are identical for every viewer within a broadcast batch.
// Food is immutable after creation; removed records are released by the WeakMap.
export function serializeState(state){
 const {players,food,powerups,...metadata}=state;
 const worms=players.map(w=>{let data=serializedPlayers.get(w.id);if(data===undefined){data=JSON.stringify(packState({players:[w]}).players[0]);serializedPlayers.set(w.id,data)}return data});
 const pellets=food.map(f=>{let data=serializedFood.get(f);if(data===undefined){data=JSON.stringify(f);serializedFood.set(f,data)}return data});
 return JSON.stringify({type:'state',...metadata}).slice(0,-1)+',"players":['+worms.join(',')+'],"food":['+pellets.join(',')+'],"powerups":'+JSON.stringify(powerups)+'}';
}
