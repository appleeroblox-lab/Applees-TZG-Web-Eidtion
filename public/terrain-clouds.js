import * as T from './vendor/three.module.js';
import {cloudProfile} from './atmosphere-effects.js?v=142';
import {surfaceHeight} from './surface.js?v=142';
const hash=text=>{let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0)/4294967296};
// Reuse a fixed mesh pool. Owners are terrain chunks, never camera coordinates.
export class TerrainClouds{
 constructor(clouds,session){this.clouds=clouds;this.session=session;session.terrainClouds=clouds;this.clear()}
 clear(){for(const cloud of this.clouds){cloud.visible=false;cloud.userData.cloudOwner=null;cloud.userData.cloudChunk=null}}
 sync(chunks,pos,time,count){const body=this.session.body,profile=cloudProfile(body);if(!profile||!chunks.size){this.clear();return}const keys=[...chunks.keys()].sort((a,b)=>{const [ax,az]=a.split(',').map(Number),[bx,bz]=b.split(',').map(Number);return Math.hypot(ax*96-pos.x,az*96-pos.z)-Math.hypot(bx*96-pos.x,bz*96-pos.z)}).slice(0,count),owners=Array.from({length:Math.min(count,this.clouds.length)},(_,i)=>keys[i%keys.length]+'#'+Math.floor(i/keys.length)),wanted=new Set(owners);
 for(const cloud of this.clouds)if(!wanted.has(cloud.userData.cloudOwner)){cloud.visible=false;cloud.userData.cloudOwner=null;cloud.userData.cloudChunk=null}
 for(const owner of owners){const cloud=this.clouds.find(c=>c.userData.cloudOwner===owner)||this.clouds.find(c=>c.userData.cloudOwner===null);if(!cloud)continue;const key=owner.split('#')[0],[cx,cz]=key.split(',').map(Number),seed=hash(body.id+owner),phase=(seed+time*profile.wind/4096)%1,x=cx*96+(phase-.5)*4096,z=cz*96+(((hash(owner+'z')+time*profile.wind*.29/4096)%1)-.5)*4096,life=T.MathUtils.smoothstep(phase,0,.12)*(1-T.MathUtils.smoothstep(phase,.88,1)),veil=1-T.MathUtils.smoothstep(this.session.altitude||0,550,1200),env=this.session.earthEnvironment;cloud.userData.cloudOwner=owner;cloud.userData.cloudChunk=key;cloud.visible=true;cloud.position.set(x,surfaceHeight(cx*96,cz*96)+profile.height+Math.sin(seed*19)*18,z);cloud.scale.set(profile.width*1.7,16+seed*9,profile.width*(.55+seed*.2));cloud.material.opacity=(env?.18+env.cloud*.62:profile.opacity)*life*veil;}
 }
}
