import * as T from './vendor/three.module.js';
import {loadBlenderModel} from './models.js?v=100';
import {baseSite} from './planet-base-layout.js?v=100';
import {surfaceHeight} from './surface.js?v=142';
function dispose(root){root.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});root.removeFromParent()}
export class PlanetBases{
 constructor(scene,session){this.scene=scene;this.session=session;this.target=null;this.generation=0}
 build(body){const generation=++this.generation;if(this.target)dispose(this.target);this.target=null;this.session.baseModel=null;this.session.baseColliders=[];this.session.baseRevision=(this.session.baseRevision||0)+1;const site=baseSite(body);if(!site)return;const target=new T.Group();target.name=body.name+' surface base';target.position.set(site.x,surfaceHeight(site.x,site.z),site.z);this.target=target;this.session.baseModel=target;this.scene.add(target);this.ready=loadBlenderModel(target,site.model).then(ok=>{if(generation!==this.generation){dispose(target);return false}if(ok){this.session.baseColliders=(target.children[0].userData.colliders||[]).map(b=>({min:{x:b.min[0]+target.position.x,y:b.min[1]+target.position.y,z:b.min[2]+target.position.z},max:{x:b.max[0]+target.position.x,y:b.max[1]+target.position.y,z:b.max[2]+target.position.z},kind:body.name+' base'}));this.session.baseRevision++}return ok})}
}
