import * as T from './vendor/three.module.js';
import {TOWER_PARTS} from './launch-tower.js?v=104';
import {blockBounds} from './door-rules.js';
import {CRAFT_LAYOUT,TRADE_LAYOUT,isSolidBlock,padHeightAt} from './surface-layout.js';
import {surfaceHeight} from './surface.js?v=142';
const CELL=8,EPS=.002;
const box=(x,y,z,hx,hy,hz,kind)=>({min:{x:x-hx,y:y-hy,z:z-hz},max:{x:x+hx,y:y+hy,z:z+hz},kind});
export function sweepBox(start,end,half,b){let near=0,far=1,axis=null,sign=0;for(const k of ['x','y','z']){const lo=b.min[k]-half[k],hi=b.max[k]+half[k],d=end[k]-start[k];if(Math.abs(d)<1e-10){if(start[k]<=lo||start[k]>=hi)return null;continue}let a=(lo-start[k])/d,c=(hi-start[k])/d,n=-Math.sign(d);if(a>c)[a,c]=[c,a];if(a>=near&&a>=0){near=a;axis=k;sign=n}far=Math.min(far,c);if(near>far)return null}if(!axis||near<0||near>1)return null;const normal=new T.Vector3();normal[axis]=sign;return {t:near,normal,box:b}}
export class SurfaceCollisions{
 constructor(surface){this.surface=surface;surface.collisions=this;this.cells=new Map();this.key='';this.stats={boxes:0,queries:0,candidates:0}}
 ensure(){const s=this.surface,e=s.building?.economy||s.prospecting?.economy,key=[s.body?.id,(e?.placementRevision??e?.worldRevision),e?.placements.length,s.stream?.collisionRevision,s.baseRevision].join(':');if(key===this.key)return;this.key=key;this.cells.clear();this.stats.boxes=0;if(!s.body?.solid)return;
  for(const p of e?.placements||[])if(p.body===s.body.id&&isSolidBlock(p))this.add({...blockBounds(p),kind:p.origin==='village'?'house/block':'block'});
  for(const g of s.stream?.chunks.values()||[]){const mesh=g.userData.scenery;if(mesh?.visible)for(const b of mesh.userData.colliders||[])this.add(b)}
  for(const b of s.baseColliders||[])this.add(b);if(s.padSign){s.padSign.updateWorldMatrix(true,true);for(const child of s.padSign.children){if(!child.isMesh)continue;const bounds=new T.Box3().setFromObject(child);this.add({min:bounds.min,max:bounds.max,kind:'pad sign'})}}
  this.add(box(12,surfaceHeight(12,0)+padHeightAt(12,0)+.65,0,1, .65,1,'ship station'));
  const ground=surfaceHeight;
  if(s.body.name==='Earth'){
   this.add(box(CRAFT_LAYOUT.x,ground(CRAFT_LAYOUT.x,CRAFT_LAYOUT.z)+2.5,CRAFT_LAYOUT.z,CRAFT_LAYOUT.halfX,2.5,CRAFT_LAYOUT.halfZ,'crafting'));
   this.add(box(TRADE_LAYOUT.x,ground(TRADE_LAYOUT.x,TRADE_LAYOUT.z)+3.2,TRADE_LAYOUT.z,6.1,3.2,4.1,'trade'));
   for(let i=0;i<5;i++)this.add(box(80+i*35,6+i,25,12.75,6.3+i,20.25,'hangar'));
   for(const part of TOWER_PARTS){const [x,y,z]=part.position,[w,h,d]=part.size;this.add(box(x,y,z,w/2,h/2,d/2,'tower'))}
  }

 }
 add(b){if(!['x','y','z'].every(k=>Number.isFinite(b.min[k])&&Number.isFinite(b.max[k])))return;this.stats.boxes++;for(let x=Math.floor(b.min.x/CELL);x<=Math.floor(b.max.x/CELL);x++)for(let z=Math.floor(b.min.z/CELL);z<=Math.floor(b.max.z/CELL);z++){const key=x+','+z;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(b)}}
 query(minX,minZ,maxX,maxZ){this.ensure();const out=new Set();for(let x=Math.floor(minX/CELL);x<=Math.floor(maxX/CELL);x++)for(let z=Math.floor(minZ/CELL);z<=Math.floor(maxZ/CELL);z++)for(const b of this.cells.get(x+','+z)||[])out.add(b);for(const m of this.surface.prospecting?.meshes||[])if(m.userData.node){const node=m.userData.node,e=this.surface.prospecting.economy;if(e?.depleted.has(node.id)||node.hp<=0)continue;const r=node.radius;if(m.position.x+r>=minX&&m.position.x-r<=maxX&&m.position.z+r>=minZ&&m.position.z-r<=maxZ)out.add(box(m.position.x,m.position.y,m.position.z,r,r,r,'mineral'))}this.stats.queries++;this.stats.candidates=out.size;return out}
 floorAt(x,z,feet,radius=.25){let y=surfaceHeight(x,z)+padHeightAt(x,z);for(const b of this.query(x-radius,z-radius,x+radius,z+radius))if(x+radius>b.min.x&&x-radius<b.max.x&&z+radius>b.min.z&&z-radius<b.max.z&&b.max.y<=feet+.02)y=Math.max(y,b.max.y);return y}
 blockedCrew(x,z,feet){for(const b of this.query(x-.27,z-.27,x+.27,z+.27))if(x+.27>b.min.x&&x-.27<b.max.x&&z+.27>b.min.z&&z-.27<b.max.z&&feet+1.7>b.min.y+EPS&&feet<b.max.y-EPS&&b.max.y>feet+.65)return true;
  const s=this.surface;if(s.shipRig){const upright=['parked','countdown'].includes(s.phase),dx=Math.abs(x-s.pos.x),dz=z-s.pos.z;if(feet<s.pos.y+(upright?4.5:1)&&dx<3.95&&dz>(upright?-1.9:-4.75)&&dz<(upright?2.45:4.45)&&feet+1.7>s.pos.y-(upright?4.23:1.2))return true}return false}
 ceiling(x,z,from,to){if(to<=from)return to;let y=to;for(const b of this.query(x-.25,z-.25,x+.25,z+.25))if(x+.25>b.min.x&&x-.25<b.max.x&&z+.25>b.min.z&&z-.25<b.max.z&&from+1.7<=b.min.y+EPS&&to+1.7>b.min.y)y=Math.min(y,b.min.y-1.7-EPS);return y}
 safeLanding(x,z){const contact=this.surface.shipRig?.contactHeight??4.23;
  for(let ring=0;ring<=20;ring++){const count=ring?Math.ceil(2*Math.PI*ring):1;for(let i=0;i<count;i++){const a=i/count*Math.PI*2,px=x+Math.cos(a)*ring*8,pz=z+Math.sin(a)*ring*8,ground=surfaceHeight(px,pz)+padHeightAt(px,pz),radius=5.5;let clear=true;
   for(const b of this.query(px-radius,pz-radius,px+radius,pz+radius))if(px+radius>b.min.x&&px-radius<b.max.x&&pz+radius>b.min.z&&pz-radius<b.max.z&&ground+contact+5>b.min.y&&ground+.05<b.max.y){clear=false;break}
   if(clear)return new T.Vector3(px,ground+contact,pz);
  }}return null;
 }
 moveShip(before){const s=this.surface;if(!s.body?.solid||!s.launched)return null;const half=new T.Vector3(3.7,1.95,4.5),matrix=new T.Matrix4().makeRotationFromQuaternion(s.flight.q),e=matrix.elements,extent=new T.Vector3(Math.abs(e[0])*half.x+Math.abs(e[4])*half.y+Math.abs(e[8])*half.z,Math.abs(e[1])*half.x+Math.abs(e[5])*half.y+Math.abs(e[9])*half.z,Math.abs(e[2])*half.x+Math.abs(e[6])*half.y+Math.abs(e[10])*half.z);let first=null;
  for(const b of this.query(Math.min(before.x,s.pos.x)-extent.x,Math.min(before.z,s.pos.z)-extent.z,Math.max(before.x,s.pos.x)+extent.x,Math.max(before.z,s.pos.z)+extent.z)){let hit=sweepBox(before,s.pos,extent,b);if(!hit&&['x','y','z'].every(k=>before[k]>b.min[k]-extent[k]+EPS&&before[k]<b.max[k]+extent[k]-EPS)){let depth=Infinity,normal=new T.Vector3();for(const k of ['x','y','z'])for(const sign of [-1,1]){const d=sign<0?before[k]-(b.min[k]-extent[k]):b.max[k]+extent[k]-before[k];if(d<depth){depth=d;normal.set(0,0,0);normal[k]=sign}}hit={t:0,normal,box:b,depth}}if(hit&&(!first||hit.t<first.t))first=hit}
  if(!first)return null;const delta=s.pos.clone().sub(before);s.pos.copy(before).addScaledVector(delta,Math.max(0,first.t-1e-5)).addScaledVector(first.normal,EPS+(first.depth||0));const into=s.vel.dot(first.normal);if(into<0)s.vel.addScaledVector(first.normal,-into);s.flight.cruiseSpeed=0;s.flight.speedCapHeld=0;s.launchElapsed=null;
  if(!['terrain decoration','mineral','tree','rock'].includes(first.box.kind)&&first.normal.y>.7&&s.pos.x+.7>first.box.min.x&&s.pos.x-.7<first.box.max.x&&s.pos.z+.7>first.box.min.z&&s.pos.z-.7<first.box.max.z){s.pos.y=first.box.max.y+(s.shipRig?.contactHeight??1.39);s.vel.set(0,0,0);s.phase='parked';s.flight.q.identity();s.flight.gear=true;s.flight.throttle=0;return {type:'touchdown',b:s.body}}
  return {type:'obstacleContact',b:s.body,obstacle:first.box.kind};
 }
}
