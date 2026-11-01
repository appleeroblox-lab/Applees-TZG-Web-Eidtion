import * as T from './vendor/three.module.js';
const V=()=>new T.Vector3(),UP=new T.Vector3(0,1,0);
export const SHIP_CAMERA_MODES=['chase','cockpit','orbit','flyby'];
export const SHIP_CAMERA_NAMES=['Chase','Cockpit','Orbit','Flyby – Cinematic'];
// Flyby anchors are absolute CPU coordinates. Switch offsets follow the subject,
// so floating-origin motion cannot drag a camera back to the previous ship position.
export class ShipCameraModes{
 constructor(){this.mode='chase';this.up=UP.clone();this.anchor=V();this.destination=V();this.previous=V();this.previousCenter=V();this.transitionOffset=V();this.previousQ=new T.Quaternion();this.transitionQ=new T.Quaternion();this.valid=false;this.blend=0;this.context=null;this.repositioning=false;this.shotValid=false}
 select(mode){if(!SHIP_CAMERA_MODES.includes(mode))return;this.mode=mode;this.blend=this.valid?1:0;this.transitionOffset.copy(this.previous);this.transitionQ.copy(this.previousQ);this.repositioning=false;this.shotValid=false}
 align(q,targetUp,dt){const target=targetUp||this.up,turn=new T.Quaternion().setFromUnitVectors(this.up,target),step=new T.Quaternion().slerp(turn,1-Math.exp(-dt*3));q.premultiply(step).normalize();this.up.applyQuaternion(step).normalize();return this.up}
 apply(camera,{dt,subject,origin,velocity,forward,context,clear,shipRadius=5}){
  if(this.context!==context||!this.valid){this.blend=0;this.context=context;this.repositioning=false;this.shotValid=false}
  if(this.mode==='flyby'){
   const center=subject.clone().add(origin),speed=velocity.length(),radius=Math.max(1,shipRadius),minimum=Math.max(48,radius*10),maximum=Math.max(minimum*3,Math.min(480,radius*60)),distance=T.MathUtils.clamp(minimum+speed*.12,minimum*1.3,maximum*.6),direction=speed>.01?velocity.clone().normalize():forward.clone().normalize();
   const place=()=>{const side=V().crossVectors(direction,this.up);if(side.lengthSq()<.01)side.set(1,0,0);side.normalize();this.destination.copy(center).addScaledVector(direction,distance*.7).addScaledVector(side,distance*.7).addScaledVector(this.up,distance*.2)};
   const gap=this.anchor.distanceTo(center),travel=speed*Math.max(0,dt),shotBudget=Math.max(0,maximum-distance);
   // A fast ship may cross the whole shot between render frames. Start a new
   // camera shot immediately in that case; never carry an out-of-range anchor.
   if(!this.shotValid||gap<minimum||gap+travel>maximum){
    place();const duration=Math.min(.18,shotBudget/Math.max(1,speed*3));
    this.repositioning=this.shotValid&&gap>=minimum&&gap<maximum&&duration>dt*2;
    if(this.repositioning){this.shotStart=this.anchor.clone();this.shotBlend=0;this.shotDuration=duration}else this.anchor.copy(this.destination);
    this.shotValid=true;this.shotTime=0;this.shotId=(this.shotId||0)+1;
   }
   if(this.repositioning){this.shotBlend=Math.min(1,this.shotBlend+dt/this.shotDuration);const t=this.shotBlend*this.shotBlend*(3-2*this.shotBlend);this.anchor.lerpVectors(this.shotStart,this.destination,t);if(this.shotBlend===1)this.repositioning=false}
   const offset=this.anchor.clone().sub(center),length=offset.length();
   if(length<minimum||length>maximum){if(length<1e-8)offset.copy(direction).negate();this.anchor.copy(center).add(offset.setLength(T.MathUtils.clamp(length,minimum,maximum)));this.repositioning=false}
   this.minimumDistance=minimum;this.maximumDistance=maximum;
   camera.position.copy(this.anchor).sub(origin);clear?.(camera.position,subject);this.anchor.copy(camera.position).add(origin);camera.up.copy(this.up);camera.lookAt(subject);this.previousCenter.copy(center);
  }
  if(this.mode!=='flyby'&&this.blend>0&&this.valid){const goal=camera.position.clone().sub(subject);camera.position.copy(this.transitionOffset).lerp(goal,1-this.blend).add(subject);const goalQ=camera.quaternion.clone();camera.quaternion.copy(this.transitionQ).slerp(goalQ,1-this.blend);}
  this.blend=Math.max(0,this.blend-dt*2.5);
  clear?.(camera.position,subject);this.previous.copy(camera.position).sub(subject);this.previousQ.copy(camera.quaternion);this.valid=true;
 }
}
