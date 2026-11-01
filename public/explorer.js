import {nearbyPlanetUp,stabilizeCameraHorizon} from './camera-horizon.js';
import * as T from './vendor/three.module.js';
import {surfacePadding} from './terrain.js';
import {V,attitude,clearance} from './flight.js?v=142';
export class Explorer {
 constructor(flight){this.flight=flight;this.enabled=true;this.exponent=.4;this.orbit=null;this.pendingOrbit=null;this.fov=60;this.exposure=1.05;this.labels=true;this.paths=false;this.timeScale=1;this.adaptive=true;this.effectiveSpeed=0}
 get speed(){return 10**this.exponent}
 changeSpeed(amount){this.exponent=T.MathUtils.clamp(this.exponent+amount,-5,14)}
 cancelOrbit(){this.orbit=null;this.pendingOrbit=null}
 beginOrbit(b){if(this.flight?.surface?.active)return false;
  const f=this.flight;this.cancelOrbit();
  if(b.system!==f.system||f.pos.distanceTo(b.pos)>b.r*40){this.pendingOrbit=b;if(!f.navigate(b,'warp')){this.pendingOrbit=null;return false}return true}
  f.cancel();f.landed=null;const offset=f.pos.clone().sub(b.pos);this.orbit={b,offset,radius:offset.length()};return true;
 }
 stabilizeHorizon(dt){const up=nearbyPlanetUp(this.flight.active,this.flight.pos);if(up)stabilizeCameraHorizon(this.flight.q,up,dt)}
 step(dt){
  const f=this.flight,i=f.input;f.event=null;
  if(f.nav){f.step(dt);if(!f.nav&&this.pendingOrbit){const b=this.pendingOrbit;this.pendingOrbit=null;this.beginOrbit(b)}return}
  if(this.orbit){
   if(Math.abs(i.x)+Math.abs(i.y)+Math.abs(i.z)+Math.abs(f.throttle)>.05){this.cancelOrbit()}
   else{const o=this.orbit;o.offset.applyAxisAngle(V(0,1,0),dt*.075);f.pos.copy(o.b.pos).add(o.offset);f.q.copy(attitude(f.pos,o.b.pos));f.vel.set(0,0,0);return}
  }
  f.landed=null;
  f.q.multiply(new T.Quaternion().setFromEuler(new T.Euler(i.pitch*dt*1.1*f.sensitivity,i.yaw*dt*1.2*f.sensitivity,i.roll*dt,'YXZ'))).normalize();
  this.stabilizeHorizon(dt);
  const direction=V(i.x,i.y,-T.MathUtils.clamp(i.z+f.throttle,-1,1));if(direction.length()>1)direction.normalize();direction.applyQuaternion(f.q);
  const b=f.nearest(),normal=f.pos.clone().sub(b.pos).normalize(),height=f.pos.distanceTo(b.pos)-b.r-surfacePadding(b,normal);let speed=this.speed;if(this.adaptive&&b.solid&&height<b.r*.3)speed=Math.min(speed,Math.max(.000005,height*.7));speed*=i.boost?5:1;this.effectiveSpeed=speed;f.vel.copy(direction).multiplyScalar(speed);
  if(i.brake){f.vel.set(0,0,0);f.throttle=0}
  const before=f.pos.clone();f.pos.addScaledVector(f.vel,dt);
  // Spectator movement stops just above solid objects and hazardous stars.
  const gear=f.gear;f.gear=false;f.collide(before,b=>surfacePadding(b,f.pos.clone().sub(b.pos).normalize()));f.gear=gear;if(f.event?.type==='contact'||f.event?.type==='hazard'){f.vel.set(0,0,0);f.event=null}
 }
}
export function formatSpeed(units){const km=units*100,c=299792.458;if(km>=c)return(km/c).toLocaleString(undefined,{maximumFractionDigits:2})+' c';if(km<1)return(km*1000).toFixed(1)+' m/s';return km.toLocaleString(undefined,{maximumFractionDigits:1})+' km/s'}
