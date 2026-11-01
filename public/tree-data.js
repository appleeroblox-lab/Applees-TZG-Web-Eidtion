import {insideBase} from './planet-base-layout.js?v=100';
import {onSurfaceRoad} from './surface-roads.js?v=142';
import {earthBiome} from './earth-biomes.js?v=122';
import * as T from './vendor/three.module.js';
import {settlementContains} from './settlements.js?v=142';
import {surfaceHeight} from './surface.js?v=142';
import {PAD_RADIUS,PAD_SIGN} from './surface-layout.js';
export const TREE_HP=100,TREE_REACH=6;
export const hasAlienTrees=body=>!!(body?.solid&&/EXOPLANET|SIMULATED PLANET/.test(body.type||''));
export function sceneryPoints(body,cx,cz,count){const seed=Math.sin(cx*127.1+cz*311.7+body.id.length*43)*43758.5453,random=i=>{const n=Math.sin(seed+i*78.233)*43758.5453;return n-Math.floor(n)},out=[];for(let i=0;i<count;i++){const x=cx*96+(random(i*3)-.5)*90,z=cz*96+(random(i*3+1)-.5)*90;if(insideBase(body,x,z,3)||onSurfaceRoad(body,x,z,3)||settlementContains(body,x,z,4)||Math.hypot(x,z)<PAD_RADIUS+8||Math.hypot(x-PAD_SIGN.x,z-PAD_SIGN.z)<6||body.name==='Earth'&&Math.abs(x)<40&&z<0&&z>-60)continue;out.push({id:body.id+'@tree:'+cx+':'+cz+':'+i,i,x,z,y:surfaceHeight(x,z),size:.5+random(i*3+2)*1.2,alien:hasAlienTrees(body)&&i%3!==0,vegetation:body.name==='Earth'?earthBiome(x,z).tree:null,tree:(body.name==='Earth'&&earthBiome(x,z).tree!=='cactus'||hasAlienTrees(body))&&i%3!==0})}return out}
export function treeFromId(id,body){if(!body?.solid||body.name!=='Earth'&&!hasAlienTrees(body)||typeof id!=='string'||!id.startsWith(body.id+'@tree:'))return null;const parts=id.slice((body.id+'@tree:').length).split(':').map(Number);if(parts.length!==3||parts.some(n=>!Number.isSafeInteger(n))||Math.abs(parts[0])>1e7||Math.abs(parts[1])>1e7||parts[2]<0||parts[2]>31)return null;const p=sceneryPoints(body,parts[0],parts[1],parts[2]+1).find(p=>p.id===id&&p.tree);return p?{...p,pos:new T.Vector3(p.x,p.y+1.7,p.z),maxHp:TREE_HP}:null}
