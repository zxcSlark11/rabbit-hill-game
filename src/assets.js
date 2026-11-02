import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';

const gltfLoader = new GLTFLoader();

async function loadScene(path) {
  try {
    return (await gltfLoader.loadAsync(new URL(path, import.meta.url).href)).scene;
  } catch (error) {
    console.warn(`Не удалось загрузить модель ${path}; включена запасная модель.`, error);
    return null;
  }
}

async function loadCart() {
  const root = await loadScene('../models/pumpkin-cart.glb');
  if (!root) return null;
  const tiers = Array.from({ length: CONFIG.maxVisualTiers.sled + 1 }, (_, level) => root.getObjectByName(`CartTier${level}`));
  root.setLevel = level => {
    const tier = Math.min(CONFIG.maxVisualTiers.sled, Math.floor(Math.max(0, level) / CONFIG.upgradeStepsPerTier));
    tiers.forEach((group, index) => { if (group) group.visible = index <= tier; });
    root.userData.styleTier = tier;
  };
  root.userData.setLevel = root.setLevel;
  root.setLevel(0);
  return root;
}

async function loadSlingshot() {
  const root = await loadScene('../models/slingshot.glb');
  if (!root) return null;
  const tiers = Array.from({ length: CONFIG.maxVisualTiers.sling + 1 }, (_, level) => root.getObjectByName(`SlingshotTier${level}`));
  root.setLevel = level => {
    const tier = Math.min(CONFIG.maxVisualTiers.sling, Math.floor(Math.max(0, level) / CONFIG.upgradeStepsPerTier));
    tiers.forEach((group, index) => { if (group) group.visible = index <= tier; });
    root.userData.styleTier = tier;
  };
  root.userData.setLevel = root.setLevel;
  root.setLevel(0);
  return root;
}

// Один реестр хранит имя, путь к GLB и запасную модель для каждого объекта.
export const ASSETS = {
  rabbit: { name: 'Кролик', path: './models/rabbit.glb', placeholder: makeRabbit, load: () => loadScene('../models/rabbit.glb') },
  pumpkinCart: { name: 'Тыквенные сани', path: './models/pumpkin-cart.glb', placeholder: makeCart, load: loadCart },
  slingshot: { name: 'Рогатка', path: './models/slingshot.glb', placeholder: makeSlingshot, load: loadSlingshot },
  forestMap: { name: 'Лесная трасса 3 км', path: './models/forest-map.glb', placeholder: () => null, load: () => loadScene('../models/forest-map.glb') },
};

const sphere = new THREE.SphereGeometry(1, 16, 12);
function ellipsoid(parent, material, scale, position) {
  const mesh = new THREE.Mesh(sphere, material);
  mesh.scale.set(...scale); mesh.position.set(...position); parent.add(mesh); return mesh;
}
function makeRabbit() {
  const root = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ color: 0xf3e7d8 });
  const cream = new THREE.MeshLambertMaterial({ color: 0xfff7ee });
  const pink = new THREE.MeshLambertMaterial({ color: 0xff9fb5 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
  const body = new THREE.Group(); root.add(body);
  ellipsoid(body, fur, [.5,.45,.62], [0,.62,0]);
  ellipsoid(body, cream, [.36,.3,.4], [0,.52,.2]);
  ellipsoid(body, cream, [.2,.2,.2], [0,.58,-.6]);
  for (const side of [-1,1]) {
    ellipsoid(body, fur, [.17,.12,.32], [side*.3,.12,.15]);
    ellipsoid(body, fur, [.2,.25,.3], [side*.38,.36,-.1]);
  }
  const head = new THREE.Group(); head.position.set(0,1.08,.38); body.add(head);
  ellipsoid(head, fur, [.4,.36,.38], [0,0,0]);
  ellipsoid(head, pink, [.1,.07,.06], [0,-.06,.36]);
  const eyes = [];
  const ears = [];
  for (const side of [-1,1]) {
    ellipsoid(head, pink, [.08,.06,.03], [side*.27,-.08,.27]);
    eyes.push(ellipsoid(head, dark, [.06,.09,.05], [side*.16,.06,.34]));
    const ear = new THREE.Group(); ear.position.set(side*.16,.28,-.02); head.add(ear);
    ellipsoid(ear, fur, [.1,.4,.06], [0,.38,0]);
    ellipsoid(ear, pink, [.055,.28,.03], [0,.36,.05]); ears.push(ear);
  }
  const arms = [-1,1].map(side => {
    const arm = new THREE.Group(); arm.position.set(side*.3,.8,.4); body.add(arm);
    ellipsoid(arm, fur, [.1,.22,.1], [0,-.16,0]); return arm;
  });
  const fx=new THREE.Group(),sparkMat=new THREE.MeshBasicMaterial({color:0xffd45c});
  const sparkGeo=new THREE.OctahedronGeometry(.1,0);
  for(let i=0;i<6;i++){const spark=new THREE.Mesh(sparkGeo,sparkMat);fx.add(spark);}
  fx.visible=false;root.add(fx);
  return { root, body, head, ears, eyes, arms, fx };
}
function makePumpkinGeometry() {
  const rows=12,segments=32,positions=[],indices=[];
  for(let row=0;row<=rows;row++) {
    const phi=Math.PI*row/rows,ring=Math.sin(phi),y=Math.cos(phi)*.5;
    for(let segment=0;segment<=segments;segment++) {
      const angle=Math.PI*2*segment/segments;
      const rib=1+.085*Math.cos(angle*8);
      positions.push(Math.cos(angle)*ring*rib*.78,y,Math.sin(angle)*ring*rib*1.02);
      if(row<rows&&segment<segments) {
        const a=row*(segments+1)+segment,b=a+segments+1;
        indices.push(a,b,a+1,a+1,b,b+1);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
const pumpkinGeometry=makePumpkinGeometry();
const pumpkinStyles=[
  {fruit:0xf47a32,trim:0x5d873f,metal:0x51463a},
  {fruit:0xf28a35,trim:0x598a43,metal:0xd9ab4b},
  {fruit:0xe96d2c,trim:0x4b894c,metal:0x78a9b8},
  {fruit:0xd9682c,trim:0x477d49,metal:0xe0bc61},
  {fruit:0xc95828,trim:0x386c43,metal:0xffd870},
  {fruit:0xe4772f,trim:0x327653,metal:0xf4c56b},
  {fruit:0xd95d28,trim:0x2d7547,metal:0xffe89a},
];
function makeCart() {
  const root=new THREE.Group(), decorations=new THREE.Group();root.add(decorations);
  root.userData.setLevel=level=>{
    decorations.clear();
    const tier=Math.min(6,Math.floor(Math.max(0,level)/CONFIG.upgradeStepsPerTier)),style=pumpkinStyles[tier];
    const orange=new THREE.MeshStandardMaterial({color:style.fruit,roughness:.78});
    const green=new THREE.MeshStandardMaterial({color:style.trim,roughness:.82});
    const metal=new THREE.MeshStandardMaterial({color:style.metal,metalness:.42,roughness:.38});
    const dark=new THREE.MeshStandardMaterial({color:0x393b39,roughness:.85});
    const fruit=new THREE.Mesh(pumpkinGeometry,orange);fruit.position.y=.57;fruit.castShadow=true;decorations.add(fruit);
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.075,.12,.24,8),green);stem.position.set(0,1.04,-.06);decorations.add(stem);
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(.17,8,6),green);leaf.scale.set(1,.25,2);leaf.position.set(.13,.99,-.1);leaf.rotation.y=-.5;decorations.add(leaf);
    const runners=[];
    for(const side of [-1,1]){
      const runner=new THREE.Mesh(new THREE.CapsuleGeometry(.085,.9,3,7),tier>=3?metal:green);
      runner.rotation.x=Math.PI/2;runner.position.set(side*.55,.12,0);decorations.add(runner);runners.push(runner);
    }
    if(tier>=1){
      const band=new THREE.Mesh(new THREE.TorusGeometry(.67,.045,6,28),metal);band.rotation.x=Math.PI/2;band.position.y=.55;band.scale.z=1.25;decorations.add(band);
      for(const side of [-1,1]){const clasp=new THREE.Mesh(new THREE.BoxGeometry(.12,.2,.11),metal);clasp.position.set(side*.7,.58,.1);decorations.add(clasp);}
    }
    if(tier>=2){
      for(const side of [-1,1]){
        const wheel=new THREE.Mesh(new THREE.TorusGeometry(.22,.07,7,14),dark);wheel.rotation.y=Math.PI/2;wheel.position.set(side*.78,.26,0);decorations.add(wheel);
        const hub=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.1,8),metal);hub.rotation.z=Math.PI/2;hub.position.set(side*.79,.26,0);decorations.add(hub);
        const fender=new THREE.Mesh(new THREE.ConeGeometry(.19,.48,5),green);fender.rotation.z=side*Math.PI/2;fender.position.set(side*.81,.55,-.12);decorations.add(fender);
      }
    }
    if(tier>=3){
      for(const side of [-1,1]){
        const rail=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.9,6),metal);rail.rotation.x=Math.PI/2;rail.position.set(side*.47,.86,-.28);decorations.add(rail);
        const lamp=new THREE.Mesh(new THREE.SphereGeometry(.095,8,6),new THREE.MeshBasicMaterial({color:0xffe58c}));lamp.position.set(side*.57,.61,.67);decorations.add(lamp);
      }
    }
    if(tier>=4){
      const crest=new THREE.Mesh(new THREE.ConeGeometry(.23,.4,7),metal);crest.position.set(0,1.08,.12);decorations.add(crest);
      const jewel=new THREE.Mesh(new THREE.SphereGeometry(.11,8,8),new THREE.MeshStandardMaterial({color:0x8ce2ce,metalness:.25,roughness:.25}));jewel.position.set(0,.72,.88);decorations.add(jewel);
    }
    if(tier>=5){
      for(const side of [-1,1]){
        const lamp=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),new THREE.MeshBasicMaterial({color:0xffd878}));lamp.position.set(side*.83,.82,.18);decorations.add(lamp);
        const leaf=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),green);leaf.scale.set(.55,.25,1.2);leaf.position.set(side*.66,1.02,-.18);leaf.rotation.z=side*.45;decorations.add(leaf);
      }
    }
    if(tier>=6){
      for(let i=-2;i<=2;i++){
        const spike=new THREE.Mesh(new THREE.ConeGeometry(.10,.28,6),metal);spike.position.set(i*.16,1.28,.08);spike.rotation.x=-.25;decorations.add(spike);
      }
      const star=new THREE.Mesh(new THREE.OctahedronGeometry(.16,0),new THREE.MeshStandardMaterial({color:0x8ce2e2,metalness:.2,roughness:.22}));star.position.set(0,1.02,1.00);decorations.add(star);
    }
    root.userData.styleTier=tier;
  };
  root.setLevel=root.userData.setLevel;
  root.setLevel(0);
  return root;
}

function makeSlingshot() {
  const root = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8c5733, roughness: .68 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xdba951, metalness: .35, roughness: .42 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x713844, roughness: .82 });
  for (const side of [-1, 1]) {
    const x = side * 1.65;
    const base = new THREE.Mesh(new THREE.BoxGeometry(.72, .2, .76), wood);
    base.position.set(x, .20, 0); root.add(base);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.17, .25, 1.45, 12), wood);
    post.position.set(x, .83, 0); root.add(post);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .09, 12), trim);
    cap.position.set(x, 1.58, 0); root.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.21, .03, 6, 16), trim);
    ring.rotation.x = Math.PI / 2; ring.position.set(x, 1.36, 0); root.add(ring);
    const tip = new THREE.Object3D(); tip.name = side < 0 ? 'SlingshotLeftTip' : 'SlingshotRightTip';
    tip.position.set(side * 1.47, 1.48, 0); root.add(tip);
    const badge = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 8), new THREE.MeshStandardMaterial({ color: 0x73a84d }));
    badge.scale.set(.75, 1.25, .2); badge.position.set(x, .9, .19); root.add(badge);
  }
  const pouch = new THREE.Group(); pouch.name = 'SlingshotPouchPivot'; pouch.position.set(0, .81, -.65); root.add(pouch);
  const leatherPad = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), leather);
  leatherPad.scale.set(.24, .15, .09); pouch.add(leatherPad);
    const tiers = [null, new THREE.Group(), new THREE.Group(), new THREE.Group()];
    tiers.slice(1).forEach((group,index)=>{group.name=`SlingshotTier${index+1}`;root.add(group);});
    for(const side of [-1,1]){
      const trimRing=new THREE.Mesh(new THREE.TorusGeometry(.20,.025,6,16),trim);trimRing.rotation.x=Math.PI/2;trimRing.position.set(side*1.65,1.28,0);tiers[1].add(trimRing);
      const leaf=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),new THREE.MeshStandardMaterial({color:0x75a94e}));leaf.scale.set(.65,1.2,.2);leaf.position.set(side*1.65,.96,.19);tiers[1].add(leaf);
    }
    const crank = new THREE.Mesh(new THREE.TorusGeometry(.16, .025, 6, 20), trim);
    crank.position.set(1.98, .83, .2); tiers[2].add(crank);
    for(const side of [-1,1]){
      const glow=new THREE.Mesh(new THREE.SphereGeometry(.10,10,8),new THREE.MeshBasicMaterial({color:0xffd878}));glow.position.set(side*1.65,1.64,.08);tiers[3].add(glow);
    }
    root.setLevel=level=>{
      const tier=Math.min(3,Math.floor(Math.max(0,level)/CONFIG.upgradeStepsPerTier));
      tiers.slice(1).forEach((group,index)=>group.visible=index+1<=tier);
      root.userData.styleTier=tier;
    };
    root.userData.setLevel=root.setLevel;
    root.setLevel(0);
  return root;
}
