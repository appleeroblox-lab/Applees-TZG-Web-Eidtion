import {destinationLightYears} from './warp-pricing.js?v=105';
import {atmosphereBoundary} from './atmospheric-flight.js?v=142';
import {rotateShip} from './ship-rotation.js';
import {holdVelocity} from './speed-control.js?v=142';
import * as T from './vendor/three.module.js';
export const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export const clearance=1.65;
export function attitude(position,target,up=V(0,1,0)){
 const forward=target.clone().sub(position).normalize();
 if(Math.abs(forward.dot(up))>.99)up=V(0,0,1);
 return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(position,target,up));
}
export function surfaceAttitude(b,position){
 const up=position.clone().sub(b.pos).normalize();
 const tangent=V(0,0,-1).addScaledVector(up,up.z);
 if(tangent.lengthSq()<.01)tangent.set(1,0,0).addScaledVector(up,-up.x);
 return attitude(position,position.clone().add(tangent.normalize()),up);
}
export function safeArrival(b,from,bodies,margin){
 const dir=from.clone().sub(b.pos).normalize();if(dir.lengthSq()<.01)dir.set(.3,.2,1).normalize();
 const end=b.pos.clone().addScaledVector(dir,atmosphereBoundary(b)+margin);
 for(let attempt=0;attempt<6;attempt++)for(const other of bodies){
  if(other===b||other.system!==b.system)continue;
  const delta=end.clone().sub(other.pos),floor=atmosphereBoundary(other)+clearance+10;
  if(delta.length()<floor)end.copy(other.pos).addScaledVector(delta.lengthSq()?delta.normalize():V(0,1,0),floor);
 }
 return end;
}
export function warpDuration(){return 10}
export function warpBlocker(flight){return flight.active.find(b=>!['NEBULA','STAR CLUSTER','GALAXY'].includes(b.type)&&flight.pos.distanceTo(b.pos)<atmosphereBoundary(b)+Math.max(20,b.r*.2))||null}
export class Flight {
 constructor(bodies){this.bodies=bodies;this.pos=V(30,18,165);this.vel=V();this.q=attitude(this.pos,V());this.system='Sol';this.assist=true;this.gear=false;this.landed=null;this.nav=null;this.event=null;this.throttle=0;this.sensitivity=5;this.rotationSpeed=2;this.input={x:0,y:0,z:0,pitch:0,yaw:0,roll:0,boost:false,brake:false}}
 get active(){return this.bodies.filter(b=>b.system===this.system)}
 nearest(){return this.active.reduce((a,b)=>this.pos.distanceTo(a.pos)-a.r<this.pos.distanceTo(b.pos)-b.r?a:b)}
 cancel(){if(this.surface?.active){this.surface.abort();this.nav=null;this.throttle=0;return}this.nav=null;this.vel.set(0,0,0);this.throttle=0;this.cruiseSpeed=0;this.speedCapHeld=0;for(const b of this.active){if(['NEBULA','STAR CLUSTER','GALAXY'].includes(b.type))continue;const normal=this.pos.clone().sub(b.pos);if(normal.length()<b.r+clearance){if(normal.lengthSq()<.01)normal.set(0,1,0);this.pos.copy(b.pos).addScaledVector(normal.normalize(),b.r+clearance+.01)}}}
 align(b){this.q.copy(attitude(this.pos,b.pos));}
 warpDenial(b){const blocker=warpBlocker(this);if(blocker)return 'Move farther from '+blocker.name+' before warping';if(b.system===this.system&&this.pos.distanceTo(b.pos)<=atmosphereBoundary(b)+Math.max(100,b.r*2))return 'Already near '+b.name+' · approach instead of warping';return ''}
 navigate(b,mode){
  if(this.surface?.active)return mode==='land'&&this.surface.requestLand();
  if(this.strictSurface&&mode==='land')return false;
  if(mode==='land'&&(!b.solid||b.landable===false))return false;
  this.lastDenial='';const willWarp=mode==='warp'||b.system!==this.system||this.pos.distanceTo(b.pos)>25000;if(willWarp){const denial=this.warpDenial(b);if(denial){this.confirmationPending=false;this.lastDenial=denial;return false}}if(this.beforeNavigate&&this.beforeNavigate(b,mode,willWarp)===false)return false;
  this.cancel();this.landed=null;
  // Cross-system journeys and distant local journeys stage the requested action after warp.
  if(mode==='warp'||b.system!==this.system||this.pos.distanceTo(b.pos)>25000){
   const margin=b.type==='BLACK HOLE'?b.r*10:Math.max(25,b.r*.8),source=b.system===this.system?this.pos:b.pos.clone().add(V(0,0,1));
   const end=safeArrival(b,source,this.bodies,margin);
   this.nav={kind:'warp',b,mode,elapsed:0,duration:warpDuration(b,this.system,this.pos),start:this.pos.clone(),end,phase:false,transitQ:this.q.clone(),sourceSystem:this.system};
  }else this.beginApproach(b,mode);
  return true;
 }
 beginApproach(b,mode){
  const end=safeArrival(b,this.pos,this.bodies,mode==='land'?clearance:b.type==='BLACK HOLE'?b.r*10:Math.max(25,b.r*.75));
  this.nav={kind:'approach',b,mode,end};if(mode==='land')this.gear=true;
 }
 step(dt){
  this.event=null;const input=this.input;
  if(this.nav){this.stepNavigation(dt);return}
  rotateShip(this.q,input,dt,this.rotationSpeed);
  const forward=V(0,0,-1).applyQuaternion(this.q),up=V(0,1,0).applyQuaternion(this.q),right=V(1,0,0).applyQuaternion(this.q);
  const thrust=T.MathUtils.clamp(input.z+this.throttle,-1,1);
  const manual=Math.abs(thrust)+Math.abs(input.x)+Math.abs(input.y)>.04;
  if(this.landed){
   if(manual){const b=this.landed,normal=this.pos.clone().sub(b.pos).normalize();this.pos.addScaledVector(normal,.5);this.vel.copy(normal).multiplyScalar(2);this.landed=null;this.event={type:'launch',b}}
   else{this.vel.set(0,0,0);return}
  }
  if(!this.speedHold)this.vel.addScaledVector(forward,thrust*(input.boost?38:5)*dt).addScaledVector(right,input.x*4*dt).addScaledVector(up,input.y*4*dt);
  // Assisted flight damps sideways drift even while thrusting.
  if(this.assist&&!this.speedHold){const along=forward.clone().multiplyScalar(this.vel.dot(forward));this.vel.lerp(along,1-Math.exp(-dt*2));if(!manual)this.vel.multiplyScalar(Math.exp(-dt*1.5))}
  if(input.brake){this.throttle=0;this.vel.multiplyScalar(Math.exp(-dt*8))}
  if(this.speedHold)holdVelocity(this,dt,input,forward);const limit=input.boost?320:55;if(!this.speedHold&&this.vel.length()>limit)this.vel.multiplyScalar(Math.exp(-dt*.7));
  const near=this.nearest(),alt=this.pos.distanceTo(near.pos)-near.r;
  if(!this.assist&&alt<near.r*2&&alt>0)this.vel.addScaledVector(near.pos.clone().sub(this.pos).normalize(),Math.min(.5,near.r*.002)*dt);
  const before=this.pos.clone();this.pos.addScaledVector(this.vel,dt);this.collide(before);
 }
 collide(before,padding=clearance){
  // Segment/sphere sweep catches fast crossings, not only endpoints inside a world.
  for(const b of this.active){
   if(['NEBULA','STAR CLUSTER','GALAXY'].includes(b.type))continue;
   const entering=this.allowInterior&&((b.solid&&b.landable!==false)||/GAS GIANT|ICE GIANT/.test(b.type));const floor=(entering?atmosphereBoundary(b):b.r)+(entering?0:(typeof padding==='function'?padding(b):padding)),delta=this.pos.clone().sub(before),length=delta.length();
   let hit=null;
   if(before.distanceTo(b.pos)>floor&&length>0){const ray=new T.Ray(before,delta.clone().normalize());const p=ray.intersectSphere(new T.Sphere(b.pos,floor),V());if(p&&p.distanceTo(before)<=length)hit=p}
   if(this.pos.distanceTo(b.pos)<floor)hit=this.pos.clone();
   if(!hit)continue;
   if(b.type==='STAR'){this.nav=null;this.vel.set(0,0,0);this.throttle=0;this.cruiseSpeed=0;this.event={type:'starContact',b};return}
   const normal=hit.sub(b.pos).normalize();if(normal.lengthSq()<.1)normal.set(0,1,0);
   if(entering){this.nav=null;this.event={type:'enter',b,normal};return}
   this.pos.copy(b.pos).addScaledVector(normal,floor+.002);
   const normalSpeed=Math.max(0,-this.vel.dot(normal)),speed=this.vel.length();
   if(b.solid&&b.landable!==false&&this.gear&&normalSpeed<3&&speed<5){this.park(b);return}
   this.vel.addScaledVector(normal,normalSpeed+Math.min(3,Math.max(.5,normalSpeed*.2)));this.event={type:b.solid?'contact':'hazard',b};
  }
  if(!this.event)this.asteroidField?.collide(before,this);
 }
 park(b){const normal=this.pos.clone().sub(b.pos).normalize();if(normal.lengthSq()<.01)normal.set(0,1,0);this.pos.copy(b.pos).addScaledVector(normal,b.r+clearance);this.q.copy(surfaceAttitude(b,this.pos));this.vel.set(0,0,0);this.landed=b;this.nav=null;this.throttle=0;this.gear=true;this.event={type:'land',b}}
 stepNavigation(dt){
  const n=this.nav;
  if(n.kind==='warp'){
   n.elapsed+=dt;const t=T.MathUtils.clamp((n.elapsed-1)/(n.duration-1),0,1);n.progress=t;
   if(n.sourceSystem===n.b.system){const ease=t*t*(3-2*t);this.pos.lerpVectors(n.start,n.end,ease)}
   else if(t<.5){this.pos.copy(n.start).add(V(0,0,-1).applyQuaternion(this.q).multiplyScalar(t*1800))}
   else{if(!n.phase){this.system=n.b.system;n.phase=true}const v=(t-.5)*2,ease=v*v*(3-2*v);const start=n.end.clone().add(n.end.clone().sub(n.b.pos).normalize().multiplyScalar(15000));this.pos.lerpVectors(start,n.end,ease)}
   if(n.sourceSystem!==n.b.system&&n.transitQ&&t>=.2&&t<.85)this.q.copy(n.transitQ);else if(n.sourceSystem===n.b.system||n.phase)this.q.slerp(attitude(this.pos,n.b.pos),1-Math.exp(-dt*5));
   if(n.elapsed>=n.duration){this.pos.copy(n.end);this.vel.set(0,0,0);this.nav=null;this.event={type:'arrive',b:n.b};if(n.mode==='land'||n.mode==='approach')this.beginApproach(n.b,n.mode)}return;
  }
  const delta=n.end.clone().sub(this.pos),dist=delta.length();
  this.q.slerp(n.mode==='land'&&dist<20?surfaceAttitude(n.b,this.pos):attitude(this.pos,n.b.pos),1-Math.exp(-dt*3));
  if(dist<.04){this.pos.copy(n.end);if(n.mode==='land')this.park(n.b);else{this.nav=null;this.vel.set(0,0,0);this.event={type:'arrive',b:n.b}}return}
  const dir=delta.normalize();let waypoint=null;
  for(const b of this.active){if(b===n.b)continue;const p=new T.Ray(this.pos,dir).intersectSphere(new T.Sphere(b.pos,b.r+10),V());if(p&&p.distanceTo(this.pos)<dist){const radial=this.pos.clone().sub(b.pos).normalize(),side=V().crossVectors(radial,dir);if(side.lengthSq()<.01)side.set(0,1,0);waypoint=b.pos.clone().addScaledVector(radial,b.r+30).addScaledVector(side.normalize(),b.r*1.7);break}}
  const direction=waypoint?waypoint.sub(this.pos).normalize():dir;
  const max=n.mode==='land'?Math.min(35,Math.max(.2,dist*1.2)):Math.min(1500,Math.max(.5,dist*1.5));
  this.vel.copy(direction).multiplyScalar(Math.min(max,dist/dt));const before=this.pos.clone();this.pos.addScaledVector(this.vel,dt);
  this.collide(before);
 }
}
