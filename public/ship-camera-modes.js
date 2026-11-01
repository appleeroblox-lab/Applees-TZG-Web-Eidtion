import * as T from './vendor/three.module.js';
const V=()=>new T.Vector3(),UP=new T.Vector3(0,1,0);
export const SHIP_CAMERA_MODES=['chase','cockpit','orbit','planet-orbit','space-orbit','flyby'];
export const SHIP_CAMERA_NAMES=['Chase','Cockpit','Orbit','Orbit – Planet Aligned','Orbit – Space Aligned','Flyby – Cinematic'];
// Flyby anchors are absolute CPU coordinates. Switch offsets follow the subject,
// so floating-origin motion cannot drag a camera back to the previous ship position.
export class ShipCameraModes{
 constructor(){this.mode='chase';this.up=UP.clone();this.anchor=V();this.destination=V();this.previous=V();this.previousCenter=V();this.transitionOffset=V();this.previousQ=new T.Quaternion();this.transitionQ=new T.Quaternion();this.valid=false;this.blend=0;this.context=null;this.repositioning=false;this.shotValid=false}
 select(mode){if(!SHIP_CAMERA_MODES.includes(mode))return;this.mode=mode;this.blend=this.valid?1:0;this.transitionOffset.copy(this.previous);this.transitionQ.copy(this.previousQ);this.repositioning=false;this.shotValid=false}
 align(q,targetUp,dt){const target=targetUp||this.up,turn=new T.Quaternion().setFromUnitVectors(this.up,target),step=new T.Quaternion().slerp(turn,1-Math.exp(-dt*3));q.premultiply(step).normalize();this.up.applyQuaternion(step).normalize();return this.up}
 apply(camera,{dt,subject,origin,velocity,forward,context,clear}){
  if(this.context!==context||!this.valid){this.blend=0;this.context=context;this.repositioning=false;this.shotValid=false}
  if(this.mode==='flyby'){
   const center=subject.clone().add(origin),speed=velocity.length(),distance=T.MathUtils.clamp(24+speed*.65,24,180),direction=speed>.01?velocity.clone().normalize():forward.clone().normalize();
   if(!this.shotValid){this.anchor.copy(camera.position).add(origin);this.previousCenter.copy(center);this.shotValid=true}
   const travel=center.clone().sub(this.previousCenter);
   // Keep enough travel room for a 0.4-second shot at any frame rate. Track
   // faster ships rather than letting them outrun the stationary camera.
   if(speed*.4>distance||travel.length()>distance*.5){this.anchor.add(travel);this.destination.add(travel)}
   if(this.repositioning&&this.destination.distanceTo(center)>distance*1.7)this.repositioning=false;
   if(!this.repositioning&&(this.anchor.distanceTo(center)>distance*1.7||this.anchor.distanceTo(center)<6)){
    const side=V().crossVectors(direction,this.up);if(side.lengthSq()<.01)side.set(1,0,0);side.normalize();
    this.destination.copy(center).addScaledVector(direction,distance*.85).addScaledVector(side,distance*.65).addScaledVector(this.up,distance*.25);this.repositioning=true;
   }
   if(this.repositioning){this.anchor.lerp(this.destination,1-Math.exp(-dt*4));if(this.anchor.distanceTo(this.destination)<.2)this.repositioning=false}
   camera.position.copy(this.anchor).sub(origin);clear?.(camera.position,subject);this.anchor.copy(camera.position).add(origin);camera.up.copy(this.up);camera.lookAt(subject);this.previousCenter.copy(center);
  }
  if(this.blend>0&&this.valid){const goal=camera.position.clone().sub(subject);camera.position.copy(this.transitionOffset).lerp(goal,1-this.blend).add(subject);const goalQ=camera.quaternion.clone();camera.quaternion.copy(this.transitionQ).slerp(goalQ,1-this.blend);}
  this.blend=Math.max(0,this.blend-dt*2.5);
  clear?.(camera.position,subject);this.previous.copy(camera.position).sub(subject);this.previousQ.copy(camera.quaternion);this.valid=true;
 }
}
