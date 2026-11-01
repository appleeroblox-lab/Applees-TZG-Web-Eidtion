import * as T from './vendor/three.module.js';
import {loadBlenderModel} from './models.js?v=100';
import {surfaceHeight} from './surface.js?v=142';
import {padHeightAt} from './surface-layout.js';
export const SHIP_STATION={x:12,z:0,range:4};
export function applyShipBlast(surface,event){
 if(!surface.active||!surface.body?.solid||event.body!==surface.body.id||surface.shipBlastGrace>0)return false;
 const upright=['parked','countdown'].includes(surface.phase),local=event.pos.clone().sub(surface.pos);
 if(!upright)local.applyQuaternion(surface.flight.q.clone().invert());
 const min=upright?new T.Vector3(-3.95,-4.23,-1.9):new T.Vector3(-3.7,-1.95,-4.5),max=upright?new T.Vector3(3.95,4.5,2.45):new T.Vector3(3.7,1.95,4.5);
 if(local.distanceTo(local.clone().clamp(min,max))>event.radius)return false;
 // Return only the ship. An on-foot player keeps their location and camera.
 surface.pos.set(0,0,0);surface.pos.y=surface.floor;surface.vel.set(0,0,0);surface.phase='parked';surface.remaining=0;surface.launchElapsed=null;surface.landingTarget=null;surface.event=null;surface.shipBlastGrace=2;
 const f=surface.flight;f.q.identity();f.vel.set(0,0,0);f.nav=null;f.cruiseSpeed=0;f.speedCapHeld=0;f.throttle=0;f.gear=true;f.boostHeld=false;f.boostWindow=false;return true;
}
export function respawnParkedShip(surface,crew){
 if(!surface.active||!surface.body?.solid||!crew.onFoot||Math.hypot(crew.pos.x-SHIP_STATION.x,crew.pos.z-SHIP_STATION.z)>SHIP_STATION.range)return false;
 // The character keeps its position, view, walking state and velocity.
 surface.pos.set(0,0,0);surface.pos.y=surface.floor;surface.vel.set(0,0,0);surface.phase='parked';surface.remaining=0;surface.launchElapsed=null;surface.event=null;
 const f=surface.flight;f.q.identity();f.vel.set(0,0,0);f.nav=null;f.cruiseSpeed=0;f.speedCapHeld=0;f.throttle=0;f.gear=true;f.boostHeld=false;f.boostWindow=false;return true;
}
export class ShipRespawnStation{
 constructor(surface,crew,scene,{toast=()=>{},save=()=>{}}={}){Object.assign(this,{surface,crew,toast,save});this.group=new T.Group();this.group.name='Ship respawn station';scene.add(this.group);const stand=new T.Mesh(new T.CylinderGeometry(.85,1,1.1,12),new T.MeshStandardMaterial({color:'#277ca8',roughness:.7}));stand.position.y=.55;this.group.add(stand);const ring=new T.Mesh(new T.CylinderGeometry(.95,.95,.12,16),new T.MeshStandardMaterial({color:'#dcecf4'}));ring.position.y=1.15;this.group.add(ring);const model=new T.Group();model.position.y=1.4;model.rotation.x=Math.PI/2;model.scale.setScalar(.22);this.group.add(model);this.model=model;this.ready=loadBlenderModel(model,'player-ship').then(ok=>{if(ok){const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());model.scale.setScalar(.22*1.7/Math.max(size.x,size.y,size.z));model.updateMatrixWorld(true);const fitted=new T.Box3().setFromObject(model);model.position.y+=this.group.position.y+1.35-fitted.min.y;}return ok});this.prompt=document.createElement('button');this.prompt.id='respawnShipPrompt';this.prompt.type='button';this.prompt.className='proximityPrompt shipRespawnPrompt';this.prompt.innerHTML='<kbd>E</kbd><span><small>Launch Pad</small><b>Respawn ship</b></span>';this.prompt.hidden=true;this.prompt.onclick=()=>this.activate();document.body.append(this.prompt)}
 near(){return this.surface.active&&this.surface.body?.solid&&this.crew.onFoot&&Math.hypot(this.crew.pos.x-SHIP_STATION.x,this.crew.pos.z-SHIP_STATION.z)<=SHIP_STATION.range&&Math.abs(this.crew.pos.y-(surfaceHeight(SHIP_STATION.x,SHIP_STATION.z)+padHeightAt(SHIP_STATION.x,SHIP_STATION.z)))<4}
 activate(){if(this.prompt.hidden||!this.near()||!respawnParkedShip(this.surface,this.crew))return false;this.prompt.querySelector('b').textContent='Ship at launch pad';this.save();this.toast('Ship returned to the launch pad.');return true}
 update(camera,blocked=false){this.group.visible=!!(this.surface.active&&this.surface.body?.solid);this.group.position.set(SHIP_STATION.x,surfaceHeight(SHIP_STATION.x,SHIP_STATION.z)+padHeightAt(SHIP_STATION.x,SHIP_STATION.z),SHIP_STATION.z);const p=this.group.position.clone().add(new T.Vector3(0,2.7,0));const front=p.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert()).z<0;p.project(camera);this.prompt.hidden=blocked||!this.near()||!front||Math.abs(p.x)>1||Math.abs(p.y)>1;if(!this.prompt.hidden){this.prompt.querySelector('b').textContent=Math.hypot(this.surface.pos.x,this.surface.pos.z)<.1&&this.surface.onGround?'Ship at launch pad':'Respawn ship';this.prompt.style.left=(p.x*.5+.5)*innerWidth+'px';this.prompt.style.top=(-p.y*.5+.5)*innerHeight+'px'}}
 hide(){this.group.visible=false;this.prompt.hidden=true}
}
