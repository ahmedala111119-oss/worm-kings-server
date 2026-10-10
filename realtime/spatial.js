export class SpatialGrid {
 constructor(cell=128){this.cell=cell;this.cells=new Map();this.pool=[]}
 key(x,y){return (Math.floor(x/this.cell)+32768)*65536+Math.floor(y/this.cell)+32768}
 clear(){for(const bucket of this.cells.values()){bucket.length=0;this.pool.push(bucket)}this.cells.clear()}
 add(point,value=point){const key=this.key(point.x,point.y);let bucket=this.cells.get(key);if(!bucket)this.cells.set(key,bucket=this.pool.pop()||[]);bucket.push(value)}
 *near(x,y,r){for(let gx=Math.floor((x-r)/this.cell);gx<=Math.floor((x+r)/this.cell);gx++)for(let gy=Math.floor((y-r)/this.cell);gy<=Math.floor((y+r)/this.cell);gy++){const bucket=this.cells.get((gx+32768)*65536+gy+32768);if(bucket)yield* bucket}}
}
