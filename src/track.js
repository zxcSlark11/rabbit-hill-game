import { CONFIG } from './config.js';

// Центр трассы мягко меняет направление и высоту: короткие волны чередуют
// пологие подъёмы, спуски и более длинные холмы.
export function trackAt(z) {
  const bendAt=value=>Math.sin((value+5)/CONFIG.bendLength*Math.PI*2)*CONFIG.bendAmplitude
    +Math.sin((value+18)/(CONFIG.bendLength*1.9)*Math.PI*2)*.72;
  const bend=bendAt(z)-bendAt(CONFIG.rabbitZ);
  const hill=value=>Math.sin((value+3)/CONFIG.hillLength*Math.PI*2)
    +.38*Math.sin((value+14)/(CONFIG.hillLength*1.8)*Math.PI*2);
  const distance=CONFIG.rabbitZ-z;
  let bigHill=0;
  for(const feature of CONFIG.bigHills) {
    const climbEnd=feature.start+feature.climbLength;
    const crestEnd=climbEnd+feature.crestLength;
    const descentEnd=crestEnd+feature.descentLength;
    if(distance>=feature.start&&distance<climbEnd) {
      const t=(distance-feature.start)/feature.climbLength;
      bigHill+=feature.rise*(.5-.5*Math.cos(Math.PI*t));
    } else if(distance>=climbEnd&&distance<crestEnd) bigHill+=feature.rise;
    else if(distance>=crestEnd&&distance<descentEnd) {
      const t=(distance-crestEnd)/feature.descentLength;
      bigHill+=feature.rise*(.5+.5*Math.cos(Math.PI*t));
    }
  }
  const y=-CONFIG.downhillGrade*(z-CONFIG.rabbitZ)
    +(hill(z)-hill(CONFIG.rabbitZ))*CONFIG.hillAmplitude+bigHill;
  return {x:bend,y};
}

function createRibbon(THREE,width,startZ,endZ,steps,material,lift,lateralOffset=0) {
  const positions=[],colors=[],indices=[];
  for(let i=0;i<=steps;i++) {
    const z=startZ+(endZ-startZ)*i/steps,p=trackAt(z),ahead=trackAt(z+.1);
    const dx=(ahead.x-p.x)/.1,norm=Math.hypot(1,dx),nx=1/norm,nz=-dx/norm;
    for(const edge of [-1,1]) {
      positions.push(p.x+nx*(lateralOffset+width*.5*edge),p.y+lift,z+nz*(lateralOffset+width*.5*edge));
      const shade=.86+.1*Math.sin(z*.11)+Math.abs(edge)*.025;
      colors.push(shade,shade*.96,shade*.87);
    }
    if(i<steps){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;return mesh;
}

export function createTrack(THREE,scene,forestMap=null) {
  const startZ=-CONFIG.mapLength,endZ=18;
  const world=new THREE.Group();scene.add(world);
  if(forestMap) { forestMap.name='ForestMap3km'; world.add(forestMap); }
  const terrainMaterial=new THREE.MeshLambertMaterial({color:CONFIG.biomes[0].ground,side:THREE.DoubleSide,vertexColors:true,flatShading:true});
  const roadMaterial=new THREE.MeshLambertMaterial({color:CONFIG.biomes[0].path,side:THREE.DoubleSide,vertexColors:true,flatShading:true});

  function groundAt(x,z,route=trackAt(z)) {
    const lateral=x-route.x,side=Math.abs(lateral);
    let profile;
    if(side<=7) profile=-.28;
    else if(side<=11) {const t=(side-7)/4;profile=-.28+.40*t*t*(3-2*t);}
    else if(side<=23) profile=.12+.65*(side-11)/12;
    else if(side<=40) profile=.77+.85*(side-23)/17;
    else profile=1.62+1.90*Math.min(1,(side-40)/18);
    const distance=CONFIG.rabbitZ-z;
    const wave=(Math.sin(distance*.014+lateral*.15)*.28+Math.sin(distance*.006-lateral*.20)*.18)*Math.min(1,Math.max(0,(side-8)/9));
    return route.y+profile+wave;
  }

  // Широкая сетка ландшафта с невысокими волнами по краям от дороги.
  const columns=40,rows=Math.ceil(CONFIG.mapLength/3),minX=-CONFIG.trackWidth/2,maxX=CONFIG.trackWidth/2;
  const terrainPositions=[],terrainColors=[],terrainIndices=[];
  for(let row=0;row<=rows;row++) {
    const z=startZ+(endZ-startZ)*row/rows,route=trackAt(z);
    for(let col=0;col<=columns;col++) {
      const x=minX+(maxX-minX)*col/columns;
      const y=groundAt(x,z,route);
      terrainPositions.push(x,y,z);
      const shade=.82+.12*Math.sin(x*.31+z*.017)+.06*Math.cos(x*.13-z*.02);
      terrainColors.push(shade,shade*1.04,shade*.9);
      if(row<rows&&col<columns) {
        const a=row*(columns+1)+col,b=a+columns+1;
        terrainIndices.push(a,b,a+1,a+1,b,b+1);
      }
    }
  }
  const terrainGeometry=new THREE.BufferGeometry();
  terrainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(terrainPositions,3));
  terrainGeometry.setAttribute('color',new THREE.Float32BufferAttribute(terrainColors,3));
  terrainGeometry.setIndex(terrainIndices);terrainGeometry.computeVertexNormals();
  const terrain=new THREE.Mesh(terrainGeometry,terrainMaterial);terrain.frustumCulled=false;terrain.visible=!forestMap;world.add(terrain);

  const road=createRibbon(THREE,CONFIG.roadWidth,startZ,endZ,Math.ceil(CONFIG.mapLength/2.5),roadMaterial,.025);road.frustumCulled=false;road.visible=!forestMap;world.add(road);
  const rutMaterial=new THREE.MeshLambertMaterial({color:0x624a35,side:THREE.DoubleSide,transparent:true,opacity:.27,depthWrite:false});
  for(const offset of [-2.25,2.25]) {
    const rut=createRibbon(THREE,.22,startZ,endZ,Math.ceil(CONFIG.mapLength/2.5),rutMaterial,.055,offset);
    rut.frustumCulled=false;rut.visible=!forestMap;world.add(rut);
  }

  function addForestGate(distance,finish=false) {
    const z=CONFIG.rabbitZ-distance,route=trackAt(z),ahead=trackAt(z-.2);
    const gate=new THREE.Group();gate.position.set(route.x,route.y,z);
    gate.rotation.y=Math.atan2(ahead.x-route.x,.2);world.add(gate);
    const wood=new THREE.MeshLambertMaterial({color:finish?0x76503a:0x79543a});
    const bark=new THREE.MeshLambertMaterial({color:0x9a704c});
    const leaves=new THREE.MeshLambertMaterial({color:finish?0xe6b95b:0x4d8145});
    const postGeo=new THREE.CylinderGeometry(.28,.48,8.3,7);
    for(const side of [-1,1]) {
      const post=new THREE.Mesh(postGeo,wood);post.position.set(side*9,4.15,0);gate.add(post);
      const foot=new THREE.Mesh(new THREE.CylinderGeometry(.68,.8,.5,7),bark);foot.position.set(side*9,.25,0);gate.add(foot);
      for(let i=0;i<3;i++) {
        const cluster=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),leaves);
        cluster.scale.set(1.7-i*.24,1.2,1.15);cluster.position.set(side*(8.2-i*.55),7.25+i*.26,0);gate.add(cluster);
      }
    }
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.38,.58,18.8,8),wood);beam.rotation.z=Math.PI/2;beam.position.y=8.1;gate.add(beam);
    const plaque=new THREE.Mesh(new THREE.BoxGeometry(4.2,.72,.3),bark);plaque.position.set(0,8.05,.12);gate.add(plaque);
    const leafGeo=new THREE.ConeGeometry(.45,1.4,5);
    for(let i=0;i<9;i++) {
      const leaf=new THREE.Mesh(leafGeo,leaves);leaf.rotation.z=(i%2?-.8:.8);leaf.position.set((i-4)*1.7,7.65+Math.sin(i)*.35,.22);gate.add(leaf);
    }
  }
  if(!forestMap) {
    addForestGate(48,false);
    addForestGate(1460,false);
    addForestGate(CONFIG.mapLength-38,true);
  }

  // Небольшой деревянный мост через лесной ручей — ориентир в середине карты.
  if(!forestMap) {
    const distance=CONFIG.bridgeDistance,z=CONFIG.rabbitZ-distance,route=trackAt(z),ahead=trackAt(z-.2);
    const bridge=new THREE.Group();bridge.position.set(route.x,route.y,z);bridge.rotation.y=Math.atan2(ahead.x-route.x,.2);world.add(bridge);
    const water=new THREE.Mesh(new THREE.PlaneGeometry(34,18),new THREE.MeshLambertMaterial({color:0x5b9c9a}));
    water.rotation.x=-Math.PI/2;water.position.y=-.32;bridge.add(water);
    const wood=new THREE.MeshLambertMaterial({color:0x9a704b}),darkWood=new THREE.MeshLambertMaterial({color:0x73513a});
    const deck=new THREE.Mesh(new THREE.BoxGeometry(15,.35,8),darkWood);deck.position.y=.05;bridge.add(deck);
    for(let i=0;i<13;i++) {
      const plank=new THREE.Mesh(new THREE.BoxGeometry(14.5,.11,.48),wood);plank.position.set(0,.28,-3.55+i*.59);bridge.add(plank);
    }
    for(const side of [-1,1]) {
      for(const zPost of [-3.5,3.5]) {const post=new THREE.Mesh(new THREE.CylinderGeometry(.11,.15,1.2,6),darkWood);post.position.set(side*6.8,.75,zPost);bridge.add(post);}
      const rail=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,7.7,6),wood);rail.rotation.x=Math.PI/2;rail.position.set(side*6.8,1.18,0);bridge.add(rail);
    }
  }

  // Старые великаны образуют заметный лесной коридор вокруг дальнего участка.
  {
    const trunk=new THREE.MeshLambertMaterial({color:0x684a35}),crown=new THREE.MeshLambertMaterial({color:0x416f42});
    for(const [distance,side] of [[2040,-1],[2070,1],[2380,-1],[2420,1]]) {
      const z=CONFIG.rabbitZ-distance,route=trackAt(z),x=route.x+side*22;
      const tree=new THREE.Group();tree.position.set(x,groundAt(x,z,route),z);world.add(tree);
      const bole=new THREE.Mesh(new THREE.CylinderGeometry(1.35,2.15,13,8),trunk);bole.position.y=6.5;tree.add(bole);
      const canopy=new THREE.Mesh(new THREE.ConeGeometry(7,15,7),crown);canopy.position.y=15;tree.add(canopy);
      const upper=new THREE.Mesh(new THREE.ConeGeometry(5,12,7),crown);upper.position.y=21;tree.add(upper);
    }
  }

  // Общие геометрии и материалы: сотни деталей рисуются небольшим числом вызовов.
  const treeCount=1000,rockCount=340,mushroomCount=150,grassCount=520,roadDetailCount=360,shrubCount=820,ridgeCount=42,logCount=150;
  const trunkMat=new THREE.MeshLambertMaterial({color:0x79583b,flatShading:true});
  const birchMat=new THREE.MeshLambertMaterial({color:0xd8d2b5,flatShading:true});
  const birchMarkMat=new THREE.MeshLambertMaterial({color:0x4c4b42,flatShading:true});
  const leafMat=new THREE.MeshLambertMaterial({color:CONFIG.biomes[0].leaves,flatShading:true});
  const broadLeafMat=new THREE.MeshLambertMaterial({color:0x527d48,flatShading:true});
  const rockMat=new THREE.MeshLambertMaterial({color:0x9aa99a,flatShading:true});
  const stemMat=new THREE.MeshLambertMaterial({color:0xf1e1cf,flatShading:true});
  const capMat=new THREE.MeshLambertMaterial({color:0xe47756,flatShading:true});
  const grassMat=new THREE.MeshLambertMaterial({color:0x689959,flatShading:true});
  const shrubMat=new THREE.MeshLambertMaterial({color:0x507644,flatShading:true});
  const ridgeMat=new THREE.MeshLambertMaterial({color:0x526d4c,flatShading:true});
  const logMat=new THREE.MeshLambertMaterial({color:0x765339,flatShading:true});
  const roadDetailMat=new THREE.MeshLambertMaterial({color:0xb6a789});
  const trunkGeo=new THREE.CylinderGeometry(.12,.22,1,6);
  const coneGeo=new THREE.ConeGeometry(1,1,6);
  const rockGeo=new THREE.DodecahedronGeometry(1,0);
  const stemGeo=new THREE.CylinderGeometry(.11,.16,.48,7);
  const capGeo=new THREE.SphereGeometry(1,8,6);
  const grassGeo=new THREE.ConeGeometry(.12,.62,4);
  const roadDetailGeo=new THREE.DodecahedronGeometry(.28,0);
  const broadCanopyGeo=new THREE.DodecahedronGeometry(1,0);
  const shrubGeo=new THREE.DodecahedronGeometry(1,0);
  const ridgeGeo=new THREE.DodecahedronGeometry(1,1);
  const birchMarkGeo=new THREE.CylinderGeometry(.07,.07,.16,5);
  const logGeo=new THREE.CylinderGeometry(.18,.24,1,6);logGeo.rotateX(Math.PI/2);
  const hazardRockGeo=new THREE.DodecahedronGeometry(.52,0);
  const stumpGeo=new THREE.CylinderGeometry(.33,.42,.65,8);
  const springPadGeo=new THREE.CylinderGeometry(.58,.72,.18,8);
  const makeBatch=(geo,mat,count,visible=true)=>{const mesh=new THREE.InstancedMesh(geo,mat,count);mesh.visible=visible;world.add(mesh);return mesh;};
  const staticVisible=true;
  const trunks=makeBatch(trunkGeo,trunkMat,treeCount,staticVisible);
  const birchTrunks=makeBatch(trunkGeo,birchMat,treeCount,staticVisible),birchMarks=makeBatch(birchMarkGeo,birchMarkMat,treeCount,staticVisible);
  const leavesLow=makeBatch(coneGeo,leafMat,treeCount,staticVisible),leavesMid=makeBatch(coneGeo,leafMat,treeCount,staticVisible),leavesTop=makeBatch(coneGeo,leafMat,treeCount,staticVisible);
  const broadCanopies=makeBatch(broadCanopyGeo,broadLeafMat,treeCount,staticVisible),broadCanopiesTop=makeBatch(broadCanopyGeo,broadLeafMat,treeCount,staticVisible);
  const rocks=makeBatch(rockGeo,rockMat,rockCount,staticVisible);
  const mushroomStems=makeBatch(stemGeo,stemMat,mushroomCount,staticVisible),mushroomCaps=makeBatch(capGeo,capMat,mushroomCount,staticVisible);
  const grasses=makeBatch(grassGeo,grassMat,grassCount,staticVisible);
  const shrubs=makeBatch(shrubGeo,shrubMat,shrubCount,staticVisible),ridges=makeBatch(ridgeGeo,ridgeMat,ridgeCount,staticVisible);
  const logs=makeBatch(logGeo,logMat,logCount,staticVisible);
  const roadDetails=makeBatch(roadDetailGeo,roadDetailMat,roadDetailCount,staticVisible);
  const hazardRockCount=Math.ceil(CONFIG.obstacleCount/2),hazardStumpCount=Math.floor(CONFIG.obstacleCount/2);
  const hazardRocks=makeBatch(hazardRockGeo,new THREE.MeshLambertMaterial({color:0x878b82}),hazardRockCount);
  const hazardStumps=makeBatch(stumpGeo,new THREE.MeshLambertMaterial({color:0x885636}),hazardStumpCount);
  const springZones=CONFIG.springDistances.map((distance,index)=>({distance,lane:[0,-2.5,2.5,0,2.5][index%5],active:true}));
  const springPads=makeBatch(springPadGeo,new THREE.MeshLambertMaterial({color:0x62b95f}),springZones.length);
  const dummy=new THREE.Object3D();
  let seed=7219;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const trees=Array.from({length:treeCount},(_,i)=>({
    z:endZ-((i*.61803398875)%1)*CONFIG.mapLength,
    lane:(i%2?1:-1)*(CONFIG.roadWidth*.5+2+random()*13),
    scale:.8+random()*.8,turn:random()*Math.PI*2,variant:i%5,
  }));
  const shrubProps=Array.from({length:shrubCount},(_,i)=>({
    z:endZ-random()*CONFIG.mapLength,
    lane:(i%2?1:-1)*(CONFIG.roadWidth*.5+1+random()*10),
    scale:.65+random()*1.2,turn:random()*6,
  }));
  const ridgeProps=Array.from({length:ridgeCount},()=>({
    z:endZ-random()*CONFIG.mapLength,
    lane:(random()<.5?-1:1)*(42+random()*12),
    sx:2.5+random()*3.5,sy:2.5+random()*3.8,sz:4+random()*5,turn:random()*6,
  }));
  const fallenLogs=Array.from({length:logCount},()=>({
    z:endZ-random()*CONFIG.mapLength,
    lane:(random()<.5?-1:1)*(CONFIG.roadWidth*.5+2+random()*12),
    scale:2+random()*4,thickness:.75+random()*.8,turn:(random()-.5)*.9,
  }));
  const stoneProps=Array.from({length:rockCount},()=>({z:endZ-random()*CONFIG.mapLength,lane:(random()<.5?-1:1)*(CONFIG.roadWidth*.5+1.5+random()*17),scale:.18+random()*.72,turn:random()*6,active:true}));
  const mushrooms=Array.from({length:mushroomCount},(_,i)=>({z:endZ-random()*CONFIG.mapLength,lane:(i%2?1:-1)*(CONFIG.roadWidth*.5+random()*9),scale:.55+random()*1.35,turn:random()*6,active:true}));
  const grass=Array.from({length:grassCount},(_,i)=>({z:endZ-random()*CONFIG.mapLength,lane:(i%2?1:-1)*(CONFIG.roadWidth*.5+random()*.9),scale:.55+random()*.8,turn:random()*6,active:true}));
  const roadMarks=Array.from({length:roadDetailCount},()=>({z:endZ-random()*CONFIG.mapLength,lane:(random()*2-1)*3.9,scale:.25+random()*.8,turn:random()*6,active:true}));
  const hazards=[];
  const lanes=[-2.5,0,2.5];
  for(let i=0;i<CONFIG.obstacleCount;i++) hazards.push({distance:82+i*(CONFIG.mapLength-150)/CONFIG.obstacleCount,lane:lanes[(i*2+1)%3],index:i,active:true});
  function place(mesh,index,x,y,z,sx,sy,sz,rotation=0) {
    dummy.position.set(x,y,z);dummy.rotation.set(0,rotation,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
  }
  function placeHazard(item,visible=true) {
    const z=CONFIG.rabbitZ-item.distance,route=trackAt(z),x=route.x+item.lane;
    const unit=visible?1:0;
    if(item.index%2===0) place(hazardRocks,Math.floor(item.index/2),x,route.y+.4,z,unit*.85,unit*.72,unit,item.index);
    else place(hazardStumps,Math.floor(item.index/2),x,route.y+.33,z,unit,unit,unit,item.index*.4);
  }
  for(const item of hazards) placeHazard(item);
  for(const batch of [hazardRocks,hazardStumps]) batch.instanceMatrix.needsUpdate=true;
  function placeSprings() {
    springZones.forEach((zone,index)=>{
      const z=CONFIG.rabbitZ-zone.distance,route=trackAt(z),scale=zone.active?1:0;
      place(springPads,index,route.x+zone.lane,route.y+.1,z,scale,scale,scale,0);
    });
    springPads.instanceMatrix.needsUpdate=true;
  }
  placeSprings();
  function updateTrackEvents(distance,playerOffset,onObstacle,onSpring) {
    for(const item of hazards) {
      if(!item.active) continue;
      const delta=distance-item.distance;
      if(Math.abs(delta)<CONFIG.hazardCollisionDistance&&Math.abs(playerOffset-item.lane)<1.3) {
        item.active=false;placeHazard(item,false);onObstacle();
      } else if(delta>CONFIG.hazardCollisionDistance) { item.active=false;placeHazard(item,false); }
    }
    for(const zone of springZones) {
      if(zone.active&&Math.abs(distance-zone.distance)<CONFIG.hazardCollisionDistance&&Math.abs(playerOffset-zone.lane)<1.35) {
        zone.active=false;placeSprings();onSpring();
      } else if(distance>zone.distance+CONFIG.hazardCollisionDistance) { zone.active=false;placeSprings(); }
    }
    for(const batch of [hazardRocks,hazardStumps]) batch.instanceMatrix.needsUpdate=true;
  }
  function resetTrackEvents() {
    for(const item of hazards){item.active=true;placeHazard(item);}
    for(const zone of springZones) zone.active=true;
    placeSprings();
    for(const batch of [hazardRocks,hazardStumps]) batch.instanceMatrix.needsUpdate=true;
  }
  function buildBatch(mesh,items,kind) {
    for(let i=0;i<items.length;i++) {
      const item=items[i];
      const route=trackAt(item.z),x=route.x+item.lane,ground=groundAt(x,item.z,route);
      if(kind==='rock') place(mesh,i,x,route.y+item.scale*.5,item.z,item.scale,item.scale*.75,item.scale*1.2,item.turn);
      else if(kind==='mushroom') {
        const s=item.scale;place(mushroomStems,i,x,ground+.24*s,item.z,.8*s,s,.8*s,item.turn);
        place(mushroomCaps,i,x,ground+.57*s,item.z,.48*s,.25*s,.48*s,item.turn);
      } else if(kind==='grass') place(grasses,i,x,ground+.28*item.scale,item.z,.7*item.scale,item.scale,.7*item.scale,item.turn);
      else if(kind==='shrub') place(shrubs,i,x,ground+.55*item.scale,item.z,1.45*item.scale,item.scale,1.2*item.scale,item.turn);
      else if(kind==='ridge') place(ridges,i,x,ground+item.sy*.48,item.z,item.sx,item.sy,item.sz,item.turn);
      else if(kind==='log') place(logs,i,x,ground+.2*item.thickness,item.z,item.thickness*.7,item.thickness*.7,item.scale,item.turn);
      else place(roadDetails,i,x,route.y+.08,item.z,item.scale,.09,item.scale*1.6,item.turn);
    }
    mesh.instanceMatrix.needsUpdate=true;
  }
  function buildTreeBatches() {
    for(let i=0;i<trees.length;i++) {
      const item=trees[i],route=trackAt(item.z),x=route.x+item.lane,ground=groundAt(x,item.z,route),s=item.scale;
      const pine=item.variant<3,birch=item.variant===4,broad=!pine;
      place(trunks,i,x,ground+.52*s,item.z,birch?0:.22*s,birch?0:1*s,birch?0:.22*s,item.turn);
      place(birchTrunks,i,x,ground+.52*s,item.z,birch ? .22*s : 0,birch ? 1*s : 0,birch ? .22*s : 0,item.turn);
      place(birchMarks,i,x+.12*s,ground+.82*s,item.z-.05,birch ? .18*s : 0,birch ? .12*s : 0,birch ? .2*s : 0,birch ? item.turn : 0);
      place(leavesLow,i,x,ground+1.05*s,item.z,pine ? .86*s : 0,pine ? .95*s : 0,pine ? .86*s : 0,item.turn);
      place(leavesMid,i,x,ground+1.7*s,item.z,pine ? .66*s : 0,pine ? .78*s : 0,pine ? .66*s : 0,item.turn);
      place(leavesTop,i,x,ground+2.25*s,item.z,pine ? .43*s : 0,pine ? .62*s : 0,pine ? .43*s : 0,item.turn);
      const canopyScale=birch ? .86 : 1.2,topScale=birch ? .62 : .82;
      place(broadCanopies,i,x,ground+1.9*s,item.z,broad?canopyScale*s:0,broad?canopyScale*.88*s:0,broad?canopyScale*s:0,item.turn);
      place(broadCanopiesTop,i,x,ground+2.55*s,item.z,broad?topScale*s:0,broad?topScale*.95*s:0,broad?topScale*s:0,item.turn);
    }
    for(const batch of [trunks,birchTrunks,birchMarks,leavesLow,leavesMid,leavesTop,broadCanopies,broadCanopiesTop]) batch.instanceMatrix.needsUpdate=true;
  }
  if(staticVisible) {
    buildTreeBatches();buildBatch(rocks,stoneProps,'rock');
    buildBatch(mushroomStems,mushrooms,'mushroom');buildBatch(mushroomCaps,mushrooms,'mushroom');
    buildBatch(grasses,grass,'grass');buildBatch(shrubs,shrubProps,'shrub');buildBatch(ridges,ridgeProps,'ridge');buildBatch(logs,fallenLogs,'log');buildBatch(roadDetails,roadMarks,'road');
  }
  function updateScenery(dt,speed) { world.position.z+=speed*dt; }
  function resetScenery() { world.position.z=0; }

  let currentBiome=-1;
  function updateBiome(distance,activeScene) {
    const index=0;
    if(index!==currentBiome) {
      currentBiome=index;const biome=CONFIG.biomes[index];
      terrainMaterial.color.setHex(biome.ground);roadMaterial.color.setHex(biome.path);roadDetailMat.color.setHex(biome.ground);leafMat.color.setHex(biome.leaves);
      activeScene.background.setHex(biome.sky);activeScene.fog.color.setHex(biome.sky);
    }
    return CONFIG.biomes[index].name;
  }
  updateScenery(0,0);
  return {terrain,road,trackAt,updateScenery,updateBiome,resetScenery,updateTrackEvents,resetTrackEvents};
}
