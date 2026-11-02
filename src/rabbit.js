import { ASSETS } from './assets.js';

export function createRabbit(THREE, parent, loadedModel = null) {
  const fallback = loadedModel ? null : ASSETS.rabbit.placeholder();
  const root = loadedModel || fallback.root;
  const model = loadedModel ? {
    root,
    body: root.getObjectByName('RabbitBodyPivot'),
    head: root.getObjectByName('RabbitHeadPivot'),
    ears: [root.getObjectByName('RabbitLeftEarPivot'), root.getObjectByName('RabbitRightEarPivot')].filter(Boolean),
    arms: [root.getObjectByName('RabbitLeftArmPivot'), root.getObjectByName('RabbitRightArmPivot')].filter(Boolean),
  } : fallback;
  if (loadedModel) {
    model.fx = new THREE.Group();
    const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd45c });
    const sparkGeometry = new THREE.OctahedronGeometry(.1, 0);
    for (let i = 0; i < 6; i++) model.fx.add(new THREE.Mesh(sparkGeometry, sparkMaterial));
    model.fx.visible = false;
    root.add(model.fx);
  }
  parent.add(model.root);
  let state = 'idle';
  let time = 0;
  const setState = next => {
    if (state !== next) {
      state = next; time = 0;
      if(model.fx) model.fx.visible=next==='crash'||next==='joy';
    }
  };
  function update(dt) {
    time += dt;
    if(state==='crash'&&time>1.05)setState('ride');
    const ride=state==='ride',jump=state==='jump',crash=state==='crash',joy=state==='joy';
    model.root.position.y = .95 + (ride ? .04+Math.abs(Math.sin(time*9))*.04 : jump ? .02 : crash ? Math.abs(Math.sin(time*15))*.12 : joy ? Math.abs(Math.sin(time*6))*.32 : Math.sin(time*2)*.015);
    model.root.rotation.z = ride ? Math.sin(time*2.2)*.1 : jump ? Math.sin(time*7)*.08 : crash ? Math.sin(time*16)*.3 : joy ? Math.sin(time*5)*.14 : 0;
    model.root.rotation.y = joy ? Math.sin(time*3)*.35 : 0;
    model.body.rotation.x = ride ? .3 : jump ? -.28 : crash ? .78 : joy ? -.12 : .08+Math.sin(time*1.3)*.025;
    model.head.rotation.x = ride ? -.18 : jump ? -.18 : crash ? .35 : joy ? -.18 : Math.sin(time*1.3)*.05;
    model.head.rotation.y = state==='idle' ? Math.sin(time*.7)*.25 : joy ? Math.sin(time*5)*.18 : 0;
    model.ears.forEach((ear,i) => {
      ear.rotation.x = ride ? .58+Math.sin(time*16+i)*.12 : jump ? .82+Math.sin(time*9+i)*.16 : crash ? -.65+Math.sin(time*18+i)*.3 : joy ? .12+Math.sin(time*12+i)*.24 : -Math.pow(Math.max(0,Math.sin(time*2.7+i)),12)*.28;
      ear.rotation.z = crash ? (i?-1:1)*.85 : joy ? (i?-1:1)*.22 : 0;
    });
    model.arms.forEach((arm,i) => { arm.rotation.x = ride ? -.12+Math.sin(time*9+i)*.06 : jump ? -1.15 : crash ? 1.2 : joy ? -1.3+Math.sin(time*11+i)*.25 : Math.sin(time*2)*.025; });
    if(model.fx&&model.fx.visible) model.fx.children.forEach((spark,i)=>{
      const angle=time*(joy?3.5:5)+i*Math.PI*2/model.fx.children.length;
      spark.position.set(Math.cos(angle)*.72,1.7+(i%3)*.26+Math.sin(time*4+i)*.12,Math.sin(angle)*.48);
      spark.rotation.set(time*2+i,time*3,0);spark.scale.setScalar(joy ? .8+Math.sin(time*8+i)*.2 : .65+Math.sin(time*14+i)*.35);
    });
  }
  return { root:model.root, setState, update };
}
