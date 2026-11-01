import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {ShipCameraModes} from '../public/ship-camera-modes.js';
import {starVisualRadius} from '../public/star-size.js';
import {bodies} from '../public/catalog.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),q=new T.Quaternion(),m=new ShipCameraModes();
let last=m.up.clone();for(let i=0;i<600;i++){const up=V(Math.sin(i*.01),Math.cos(i*.01),0);m.align(q,up,1/60);assert(last.angleTo(m.up)<.06,'planet transport has no discontinuous flips');last.copy(m.up);assert(Math.abs(q.length()-1)<1e-9)}
for(let i=0;i<500;i++)m.align(q,V(0,-1,0),1/60);assert(m.up.dot(V(0,-1,0))>.999);
const camera=new T.PerspectiveCamera();camera.position.set(20,10,20);m.select('flyby');m.valid=false;m.blend=0;const subject=V(),origin=V(100000,0,0),velocity=V(0,0,-5),args={dt:1/60,subject,origin,velocity,forward:V(0,0,-1),context:'space'};m.apply(camera,args);const anchor=m.anchor.clone();for(let i=0;i<30;i++){origin.z-=.05;m.apply(camera,args);assert(m.anchor.distanceTo(anchor)<1e-7,'world anchor stays fixed while ship flies past')}
origin.z-=300;let frames=0;while(frames++<400){m.apply(camera,args);if(!m.repositioning)break}assert(frames<400,'flyby smoothly completes reposition');assert(m.anchor.distanceTo(anchor)>100);const settled=m.anchor.clone();m.apply(camera,args);assert(m.anchor.distanceTo(settled)<1e-7,'new shot holds stationary');
const snapshot=bodies.map(b=>[b.r,...b.pos.toArray()]);for(const star of bodies.filter(b=>b.type==='STAR'))assert(starVisualRadius(star,bodies)>=star.r);const sun=bodies.find(b=>b.name==='Sun'),jupiter=bodies.find(b=>b.name==='Jupiter');assert(starVisualRadius(sun,bodies)>jupiter.r*1.5);assert.deepEqual(bodies.map(b=>[b.r,...b.pos.toArray()]),snapshot,'star visuals never change catalog geometry/distances');
console.log('PASS gradual planet-up transport, antipodal alignment, absolute stationary flyby anchors, smooth repeated shots, display-only star sizes and unchanged catalog positions/radii.');
const transition=new ShipCameraModes(),view=new T.PerspectiveCamera(),options={dt:1/60,subject:V(),origin:V(),velocity:V(),forward:V(0,0,-1),context:'space'};view.position.set(0,0,16);transition.apply(view,options);const start=view.position.clone(),startQ=view.quaternion.clone();transition.select('space-orbit');const goal=V(16,0,0),goalQ=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(goal,V(),V(0,1,0)));view.position.copy(goal);view.quaternion.copy(goalQ);transition.apply(view,options);assert(view.position.equals(start),'transition begins at previous view');assert(view.quaternion.angleTo(startQ)<1e-7);for(let i=0;i<40;i++){const prior=view.position.clone();view.position.copy(goal);view.quaternion.copy(goalQ);transition.apply(view,options);assert(view.position.distanceTo(prior)<5,'camera transition avoids a positional snap')}assert(view.position.distanceTo(goal)<1e-7);assert(view.quaternion.angleTo(goalQ)<1e-7);console.log('PASS camera switches interpolate position/orientation and settle at the requested view.');

// At 200c a single render frame moves thousands of space units. Camera switches
// must interpolate the view around the moving subject, never its old world point.
for(const surface of [false,true])for(const hz of [12.5,30,60,144])for(const mode of ['chase','cockpit','orbit','planet-orbit','space-orbit']){
 const rig=new ShipCameraModes(),cam=new T.PerspectiveCamera(),ship=V(0,3,0),world=surface?V():V(1e12,2e12,-1e12),velocity=V(320000,0,-500000),offset=V(0,4,16),goal=V(12,3,0);
 const opts={dt:1/hz,subject:ship,origin:world,velocity,forward:V(0,0,-1),context:surface?'surface':'space'};
 cam.position.copy(ship).add(offset);rig.apply(cam,opts);rig.select(mode);
 for(let i=0;i<Math.ceil(hz);i++){
  (surface?ship:world).addScaledVector(velocity,opts.dt);cam.position.copy(ship).add(goal);rig.apply(cam,opts);
  assert(cam.position.distanceTo(ship)<20,`${mode} switch stays with fast ship at ${hz} Hz (${surface?'surface':'space'})`);
 }
 assert(cam.position.clone().sub(ship).distanceTo(goal)<1e-6,'switch settles at requested subject offset');
}
for(const hz of [12.5,30,60,144])for(const speed of [0,5,50,100,500,1000,10000,599584.916]){
 const rig=new ShipCameraModes(),cam=new T.PerspectiveCamera(),opts={dt:1/hz,subject:V(),origin:V(1e12,0,0),velocity:V(0,0,-speed),forward:V(0,0,-1),context:'space'};
 cam.position.set(0,4,16);rig.select('flyby');rig.apply(cam,opts);
 for(let i=0;i<hz*10;i++){
  opts.origin.addScaledVector(opts.velocity,opts.dt);rig.apply(cam,opts);
  assert(cam.position.distanceTo(opts.subject)<400,`flyby cannot strand ship outside shot at ${hz} Hz`);
  const projected=opts.subject.clone();cam.updateMatrixWorld();projected.project(cam);
  assert(Math.abs(projected.x)<1e-6&&Math.abs(projected.y)<1e-6,'flyby keeps looking at fast ship');
 }
}
console.log('PASS moving-subject switches and bounded 200c flyby shots at 12.5/30/60/144 Hz with large floating origins.');
