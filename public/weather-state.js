import {cloudProfile} from './atmosphere-effects.js?v=142';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const base={cloud:0,rain:0,snow:0,fog:0,wind:0};
export const weatherPresets=Object.fromEntries(Object.entries({Clear:{},Cloudy:{cloud:.8,fog:.12},Rain:{cloud:1,rain:1,fog:.4,wind:.25},Fog:{cloud:.5,fog:1},Thunderstorm:{cloud:1,rain:1.4,fog:.6,wind:.8},Drizzle:{cloud:.75,rain:.3,fog:.25,wind:.1},'Heavy Rain':{cloud:1,rain:1.5,fog:.65,wind:.55},Windy:{cloud:.4,fog:.08,wind:1}}).map(([name,p])=>[name,{...base,...p}]));
// Preserve the established first three automatic phases, then visit new weather.
export const weatherSchedule=['Clear','Cloudy','Rain','Thunderstorm','Cloudy','Fog','Windy','Drizzle','Heavy Rain','Clear'];
export function weatherPolicy(quality='Medium'){return ({Low:{rain:180,snow:96,splashes:12,patches:16},Medium:{rain:720,snow:350,splashes:24,patches:32},High:{rain:1200,snow:650,splashes:40,patches:48}})[quality]||weatherPolicy('Medium')}
export function precipitationCeiling(){const p=cloudProfile({name:'Earth'});return p.height-22-16}
export const underWeatherClouds=y=>y<precipitationCeiling();
export function advanceGroundWeather(env,dt){const rain=env.current.rain||0,snow=rain,angle=(env.hour-6)/24*Math.PI*2,day=clamp(Math.sin(angle)),afternoon=env.hour>=12&&env.hour<=19,sun=day*(1-(env.current.cloud||0)*.8),melt=(afternoon?.00125:.00015)*sun;
 env.wetness=clamp(env.wetness+dt*(rain*.003+melt*env.snowCover*.6-.0018*sun-.00015));
 env.puddles=clamp(env.puddles+dt*(rain*Math.max(0,env.wetness-.6)*.0018-(rain>.02?.0001:.003)-.0012*sun));
 env.snowCover=clamp(env.snowCover+dt*(snow*.004-melt-(snow>.02?0:.0008)));env.snowShade=clamp(env.snowShade+dt*(snow*.003-melt*.14-(snow>.02?0:.0003)));
}
export const groundWeatherDefaults=()=>({wetness:0,puddles:0,snowCover:0,snowShade:0});

export const normalizeWeather=name=>({Snow:'Rain',Blizzard:'Heavy Rain',Sleet:'Rain'})[name]||name;

// Uneven storm cells, wind gusts and paired flashes; stable across reloads.
export function stormActivity(time){const period=Math.floor(time/17),seed=Math.sin(period*127.1+43)*43758.5453,offset=3+(seed-Math.floor(seed))*9,t=time-period*17-offset;return {id:period,lightning:t>=0&&t<.09||t>.23&&t<.29?1:0,thunder:t>.75&&t<3,gust:.75+.25*Math.sin(time*.47)*Math.sin(time*.13)}}
