import * as THREE from 'three';
import { CONFIG } from './config.js';
import { ASSETS } from './assets.js';
import { createRabbit } from './rabbit.js';
import { createTrack, trackAt } from './track.js';
import { createSlingshot } from './slingshot.js';
import { createContactShadow, createLaunchSpeedEffect, createSlideTrail } from './effects.js';
import { createUI } from './ui.js';
import { TEXTS } from './texts.js';
import { createSkyDecor } from './sky.js';

const canvas=document.querySelector('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
const scene=new THREE.Scene(); scene.background=new THREE.Color(CONFIG.biomes[0].sky); scene.fog=new THREE.Fog(CONFIG.biomes[0].sky,42,180);
const skyDecor=createSkyDecor(THREE,scene);
const camera=new THREE.PerspectiveCamera(48,1,.1,100);
camera.position.set(0,CONFIG.cameraY,CONFIG.cameraZ); camera.lookAt(0,.7,-8);
scene.add(new THREE.HemisphereLight(0xffffff,0x73945e,1.3));
const sun=new THREE.DirectionalLight(0xffffff,.75); sun.position.set(-4,9,5); scene.add(sun);
const [loadedRabbit,loadedCart,loadedSlingshot,loadedForestMap]=await Promise.all([ASSETS.rabbit.load(),ASSETS.pumpkinCart.load(),ASSETS.slingshot.load(),ASSETS.forestMap.load()]);
const track=createTrack(THREE,scene,loadedForestMap);
const cart=loadedCart||ASSETS.pumpkinCart.placeholder(); cart.position.set(0,0,CONFIG.rabbitZ); scene.add(cart);
const contactShadow=createContactShadow(THREE); scene.add(contactShadow);
const slideTrail=createSlideTrail(THREE,scene,CONFIG);
const launchSpeedEffect=createLaunchSpeedEffect(document.querySelector('#launch-speed'),CONFIG.launchSpeedEffectSeconds);
const slingshot=createSlingshot(THREE,scene,loadedSlingshot);
const rabbit=createRabbit(THREE,cart,loadedRabbit); rabbit.root.position.y=.95; rabbit.root.scale.setScalar(.78);

function loadProgress() {
  try {
    const old=JSON.parse(localStorage.getItem('rabbitHillProgress')||'{}')||{};
    const resetRecordKey='rabbitHillBestDistanceResetV1';
    const shouldResetRecord=localStorage.getItem(resetRecordKey)!=='done';
    if(shouldResetRecord){old.bestDistance=0;localStorage.setItem('rabbitHillProgress',JSON.stringify(old));localStorage.setItem(resetRecordKey,'done');}
    const progress={carrots:Math.max(0,Number(old.carrots??old.coins)||0),bestDistance:shouldResetRecord?0:Math.max(0,Number(old.bestDistance)||0),slingLevel:0,sledLevel:0,incomeLevel:0};
    progress.slingLevel=Math.min(CONFIG.maxUpgradeLevels.sling,Math.max(0,Number(old.slingLevel)||Number(old.speedLevel)||0));
    progress.sledLevel=Math.min(CONFIG.maxUpgradeLevels.sled,Math.max(0,Number(old.sledLevel)||0));
    progress.incomeLevel=Math.min(CONFIG.maxUpgradeLevels.income,Math.max(0,Number(old.incomeLevel)||0));
    return progress;
  } catch { return {carrots:CONFIG.startingCarrots,bestDistance:0,slingLevel:0,sledLevel:0,incomeLevel:0}; }
}
const progress=loadProgress();
function saveProgress(){try{localStorage.setItem('rabbitHillProgress',JSON.stringify(progress));}catch{/* Можно играть и без localStorage. */}}
function costFor(type){const level=progress[`${type}Level`];return level>=CONFIG.maxUpgradeLevels[type]?null:CONFIG.upgradeCosts[type][level];}
let mode='menu',charge=0,speed=0,distance=0,steer=0,jumpVelocity=0,jumpHeight=0;
let ui;
function upgrade(type){const cost=costFor(type);if(cost===null||progress.carrots<cost)return;progress.carrots-=cost;progress[`${type}Level`]++;if(type==='sled')cart.setLevel(progress.sledLevel);if(type==='sling')slingshot.setLevel(progress.slingLevel);saveProgress();ui.showMenu(progress,{sling:costFor('sling'),sled:costFor('sled'),income:costFor('income')});}
function showMenu(){mode='menu';launchSpeedEffect.stop();slideTrail.reset();rabbit.setState('idle');ui.showMenu(progress,{sling:costFor('sling'),sled:costFor('sled'),income:costFor('income')});}
function beginCharge(){if(mode!=='menu')return;mode='charging';launchSpeedEffect.stop();slideTrail.reset();charge=0;slingshot.setVisible(true);slingshot.setCharge(0);cart.position.set(0,0,CONFIG.rabbitZ);ui.showCharge();}
function launch(){if(mode!=='charging')return;const power=Math.max(.12,charge);mode='running';
  const slingFactor=1+progress.slingLevel*CONFIG.slingPowerPerLevel;
  speed=(CONFIG.startSpeed+CONFIG.chargeSpeedBonus*power)*slingFactor;
  cart.position.z=CONFIG.rabbitZ;slingshot.release();launchSpeedEffect.trigger();slideTrail.reset();
  distance=0;steer=cart.position.x;jumpVelocity=0;jumpHeight=0;track.resetTrackEvents();rabbit.setState('ride');ui.startRun();
}
function finishRun(){if(mode!=='running')return;mode='result';launchSpeedEffect.stop();slideTrail.reset();rabbit.setState('joy');
  const multiplier=1+progress.incomeLevel*CONFIG.incomeMultiplierPerLevel;
  const reward=Math.floor(distance*CONFIG.rewardPerMeter*multiplier);
  progress.bestDistance=Math.max(progress.bestDistance,distance);
  progress.carrots+=reward;saveProgress();
  cart.position.set(0,0,CONFIG.rabbitZ);camera.position.set(0,CONFIG.cameraY,CONFIG.cameraZ);camera.lookAt(0,.7,-8);steer=0;jumpVelocity=0;jumpHeight=0;track.resetScenery();track.updateBiome(0,scene);slingshot.setVisible(true);slingshot.setCharge(0);
  ui.showResult(distance,multiplier,reward,progress.bestDistance);
}
ui=createUI({onPlay:beginCharge,onContinue:showMenu,onUpgrade:upgrade,onChargeStart:()=>{if(mode==='charging')charge=0;},onChargeEnd:launch});
showMenu();
cart.setLevel(progress.sledLevel);
slingshot.setLevel(progress.slingLevel);

function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w/h<.65?52:58;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);resize();
let pointer=null;
canvas.addEventListener('pointerdown',e=>{if(mode==='running'){pointer=e.clientX;canvas.setPointerCapture(e.pointerId);}});
canvas.addEventListener('pointermove',e=>{if(pointer!==null){steer=Math.max(-CONFIG.laneLimit,Math.min(CONFIG.laneLimit,steer+(e.clientX-pointer)/innerWidth*8));pointer=e.clientX;}});
for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>pointer=null);
window.addEventListener('keydown',e=>{if(e.code==='Space'){if(mode==='menu')beginCharge();else if(mode==='charging')launch();}});
const clock=new THREE.Clock();
function frame(){
  const dt=Math.min(clock.getDelta(),.04);
  skyDecor.update(dt);
  if(mode==='charging'){charge=Math.min(1,charge+dt/CONFIG.chargeDuration);cart.position.z=CONFIG.rabbitZ+charge*1.15;slingshot.setCharge(charge);ui.setCharge(charge);}
  if(mode==='running'){
    const z=CONFIG.rabbitZ-distance;
    const route=trackAt(z);
    const grade=(trackAt(z+.1).y-trackAt(z-.1).y)/.2;
    const uphillAcceleration=jumpHeight>0?0:Math.max(0,-grade)*CONFIG.gravityAcceleration;
    const downhillAcceleration=jumpHeight>0?0:Math.max(0,grade)*CONFIG.gravityAcceleration;
    const sledFactor=1/(1+progress.sledLevel*CONFIG.sledFrictionReduction);
    const rollingFriction=jumpHeight>0?CONFIG.airFriction:CONFIG.friction*sledFactor;
    speed=Math.min(CONFIG.maxRunSpeed,Math.max(0,speed+(downhillAcceleration-uphillAcceleration-rollingFriction)*dt));
    distance+=speed*dt;
    cart.position.x+=(route.x+steer-cart.position.x)*Math.min(1,dt*4);
    cart.position.y=route.y+jumpHeight;
    camera.position.x=route.x;camera.position.y=CONFIG.cameraY+route.y;camera.lookAt(route.x,route.y+.7,-8);
    const biome=track.updateBiome(distance,scene);
    ui.updateRun(distance,speed,biome,progress.bestDistance,CONFIG.mapLength);
    track.updateTrackEvents(distance,cart.position.x-route.x,()=>{speed=Math.max(0,speed-CONFIG.hazardSpeedLoss);rabbit.setState('crash');ui.showEvent(TEXTS.obstacle);},()=>{jumpVelocity=CONFIG.springLaunchVelocity;speed=Math.min(CONFIG.maxRunSpeed,speed+CONFIG.springSpeedBoost);rabbit.setState('jump');ui.showEvent(TEXTS.spring);});
    if(jumpHeight>0||jumpVelocity>0){jumpHeight=Math.max(0,jumpHeight+jumpVelocity*dt);jumpVelocity-=CONFIG.springGravity*dt;if(jumpHeight===0){jumpVelocity=0;rabbit.setState('ride');}}
    track.updateScenery(dt,speed);
    slideTrail.update(dt,cart,speed,jumpHeight>.12);
    if(speed<=0.01||distance>=CONFIG.mapLength)finishRun();
  }
  contactShadow.position.set(cart.position.x,cart.position.y-jumpHeight+.025,cart.position.z);
  contactShadow.material.opacity=.62/(1+jumpHeight*.7);
  contactShadow.scale.set(1+jumpHeight*.08,1+jumpHeight*.12,1);
  slingshot.update(dt);rabbit.update(dt);renderer.render(scene,camera);requestAnimationFrame(frame);
}
frame();
