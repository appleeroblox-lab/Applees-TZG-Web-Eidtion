import * as T from './vendor/three.module.js';
import {surfaceHeight} from './surface.js?v=142';
import {biomeColor} from './earth-biomes.js?v=122';
import {terrainColor} from './surface-palette.js';
export const DISTANT_TERRAIN_RADIUS=60000;
const rings=[0,48,96,144,192,240,288,384,512,768,1024,1536,2048,3072,4096,6144,8192,12288,16384,24576,32768,45000,DISTANT_TERRAIN_RADIUS],segments=96;
// One low-detail draw, no collision/scenery copies; detail chunks keep their existing budgets.
export class DistantTerrain{
 constructor(scene){this.scene=scene;this.mesh=null;this.key=''}
 update(body,pos){if(!body?.solid){this.clear();return}const cx=Math.round(pos.x/512)*512,cz=Math.round(pos.z/512)*512,key=body.id+':'+cx+':'+cz;if(key===this.key)return;this.key=key;const positions=[],colors=[],indices=[];
 for(const radius of rings)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,x=cx+Math.cos(a)*radius,z=cz+Math.sin(a)*radius;positions.push(x,surfaceHeight(x,z)-2,z);const c=body.name==='Earth'?new T.Color(biomeColor(x,z)):terrainColor(body,x,z);colors.push(c.r,c.g,c.b)}
 for(let ring=0;ring<rings.length-1;ring++)for(let i=0;i<segments;i++){const a=ring*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b)}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();if(this.mesh){this.mesh.geometry.dispose();this.mesh.geometry=geometry}else{this.mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1,fog:true}));this.mesh.name='Extended low-detail world terrain';this.mesh.userData.terrain=true;this.scene.add(this.mesh)}}
 clear(){if(this.mesh){this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh=null}this.key=''}
}
