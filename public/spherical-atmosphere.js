import {atmosphereProfile} from './atmosphere-profiles.js?v=119';
import * as T from './vendor/three.module.js';
import {hasAtmosphere,PLANET_VIEW_RADIUS} from './atmospheric-flight.js?v=142';
const bindings=new WeakMap();
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
export function atmosphereFogRange(height,near=45,far=158){const cover=smooth(450,1500,height);return {near:near*(1-cover)+height*.12*cover,far:far*(1-cover)+Math.max(far,height*.72)*cover}}
export function makeAirUniforms(){return {airCenter:{value:new T.Vector3(0,-PLANET_VIEW_RADIUS,0)},airRadius:{value:PLANET_VIEW_RADIUS},airMeters:{value:1},airColor:{value:new T.Color('#c4e7f6')},airWeather:{value:0},airSamples:{value:3},airEye:{value:new T.Vector3()},airSunDirection:{value:new T.Vector3(0,1,0)},airOverrideEye:{value:0}}}
export function airColor(body,state){return state?.horizon||new T.Color(atmosphereProfile(body)?.air[1]||'#b8dcf2')}
export function airDensity(height,weather=0){const h=Math.max(0,height);return (Math.exp(-h/950)*.00032+Math.exp(-h/65)*weather*.025)*(1-smooth(5700,6500,h))}
// Physical-height sampling is identical for local metres and the scaled space globe.
export function opticalDepth(eye,point,center,radius,meters=1,weather=0,samples=6){const delta=point.clone().sub(eye),distance=delta.length();if(distance<1e-8)return 0;const direction=delta.divideScalar(distance),offset=eye.clone().sub(center),outer=radius+6500/meters,b=offset.dot(direction),disc=b*b-offset.lengthSq()+outer*outer;if(disc<=0)return 0;const root=Math.sqrt(disc),start=Math.max(0,-b-root),end=Math.min(distance,-b+root);if(end<=start)return 0;let sum=0;const p=new T.Vector3();for(let i=0;i<samples;i++){const u=(i+.5)/samples,t=1-(1-u)*(1-u);p.copy(eye).addScaledVector(direction,start+(end-start)*t);sum+=airDensity((p.distanceTo(center)-radius)*meters,weather)*2*(1-u)}return Math.min(20,sum*(end-start)*meters/samples)}
const airFragment=`
uniform vec3 airCenter;uniform float airRadius;uniform float airMeters;uniform vec3 airColor;uniform float airWeather;uniform int airSamples;uniform vec3 airEye;uniform float airOverrideEye;uniform vec3 airSunDirection;varying vec3 airWorldPoint;
float airSmooth(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
float airExtinction(vec3 eye,vec3 point){vec3 ray=point-eye;float distance=length(ray);if(distance<.00001)return 0.;vec3 direction=ray/distance;vec3 offset=eye-airCenter;float outer=airRadius+6500./airMeters;float b=dot(offset,direction);float disc=b*b-dot(offset,offset)+outer*outer;if(disc<=0.)return 0.;float root=sqrt(disc);float start=max(0.,-b-root);float finish=min(distance,-b+root);if(finish<=start)return 0.;float density=0.;for(int i=0;i<6;i++){if(i>=airSamples)break;float u=(float(i)+.5)/float(airSamples);float t=1.-(1.-u)*(1.-u);vec3 p=eye+direction*mix(start,finish,t);float h=max(0.,(length(p-airCenter)-airRadius)*airMeters);density+=(exp(-h/950.)*.00032+exp(-h/65.)*airWeather*.025)*(1.-airSmooth(5700.,6500.,h))*2.*(1.-u);}return 1.-exp(-min(20.,density*(finish-start)*airMeters/float(airSamples)));}
`;
export function installAirMaterial(material,uniforms){if(!material||material.userData.terrainCloud||(!material.isMeshStandardMaterial&&!material.isMeshBasicMaterial)||bindings.has(material))return;bindings.set(material,uniforms);material.fog=true;const before=material.onBeforeCompile,key=material.customProgramCacheKey();material.onBeforeCompile=function(shader,renderer){before.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);shader.vertexShader='varying vec3 airWorldPoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
vec4 airVertex=vec4(transformed,1.);
#ifdef USE_BATCHING
airVertex=batchingMatrix*airVertex;
#endif
#ifdef USE_INSTANCING
airVertex=instanceMatrix*airVertex;
#endif
airWorldPoint=(modelMatrix*airVertex).xyz;`);shader.fragmentShader=airFragment+'\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`#include <fog_fragment>
float airAmount=airExtinction(mix(cameraPosition,airEye,airOverrideEye),airWorldPoint);float airSun=airSmooth(-.12,.35,dot(normalize(airWorldPoint-airCenter),normalize(airSunDirection)));
float airCeiling=max(gl_FragColor.r,max(gl_FragColor.g,gl_FragColor.b));vec3 litAir=min(airColor*airSun,vec3(airCeiling));gl_FragColor.rgb=mix(gl_FragColor.rgb,litAir,airAmount);`)};material.customProgramCacheKey=()=>key+'-shared-spherical-atmosphere';material.needsUpdate=true}
export function getAirUniforms(material){return bindings.get(material)}
function bindRoot(root,uniforms){root.traverse(o=>{if(o.material?.isShaderMaterial&&o.material.uniforms?.sunsetTint){o.visible=false;return}for(const material of Array.isArray(o.material)?o.material:[o.material])installAirMaterial(material,uniforms)})}
function samples(quality,mobile){return mobile?quality==='Low'?2:3:({Low:2,Medium:3,High:4,Ultra:5,'Ultra+':6}[quality]||3)}
export function updateSurfaceAir(view){const s=view.session;if(!s.body?.solid||!hasAtmosphere(s.body))return;const u=view.airUniforms??=makeAirUniforms(),state=s.earthEnvironment;u.airCenter.value.set(s.pos.x,(view.transition?.globe?.position.y??-PLANET_VIEW_RADIUS),s.pos.z);u.airRadius.value=PLANET_VIEW_RADIUS;u.airMeters.value=1;u.airColor.value.copy(airColor(s.body,state));u.airWeather.value=state?.fog||0;u.airSamples.value=samples(view.quality,view.mobile);u.airSunDirection.value.copy(state?.sun||view.sun?.position||new T.Vector3(0,1,0)).normalize();u.airOverrideEye.value=0;for(const root of view.scene.children)if(root!==view.celestial?.group&&root!==view.transition?.globe)bindRoot(root,u)}
const spaceAir=new WeakMap();
export function updateSpaceAir(body,origin,state,quality,mobile,star){if(!body.mesh?.visible||!body.solid||!hasAtmosphere(body))return;let u=spaceAir.get(body.mesh);if(!u){u=makeAirUniforms();spaceAir.set(body.mesh,u);bindRoot(body.mesh,u)}u.airCenter.value.copy(body.pos).sub(origin);u.airRadius.value=body.r;u.airMeters.value=PLANET_VIEW_RADIUS/body.r;u.airColor.value.copy(airColor(body,body.name==='Earth'?state:null));u.airWeather.value=body.name==='Earth'?state?.fog||0:0;u.airSamples.value=samples(quality,mobile);if(star?.pos)u.airSunDirection.value.copy(star.pos).sub(body.pos).normalize();else u.airSunDirection.value.set(0,1,0);u.airOverrideEye.value=1;u.airEye.value.set(0,0,0)}
