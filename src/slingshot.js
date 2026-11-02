import { ASSETS } from './assets.js';

const SLINGSHOT_Z = 3.65;

export function createSlingshot(THREE, scene, loadedModel = null) {
  const rig = loadedModel || ASSETS.slingshot.placeholder();
  rig.position.set(0, 0, SLINGSHOT_Z);
  scene.add(rig);

  let pouch = rig.getObjectByName('SlingshotPouchPivot');
  if (!pouch) {
    pouch = new THREE.Group();
    pouch.name = 'SlingshotPouchPivot';
    pouch.position.set(0, .78, 0);
    const pad = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 10),
      new THREE.MeshStandardMaterial({ color: 0x713844, roughness: .82 }),
    );
    pad.scale.set(.24, .15, .09);
    pouch.add(pad);
    rig.add(pouch);
  }

  const tip = side => {
    const name = side < 0 ? 'SlingshotLeftTip' : 'SlingshotRightTip';
    let object = rig.getObjectByName(name);
    if (!object) {
      object = new THREE.Object3D();
      object.name = name;
      object.position.set(side * 1.47, 1.48, 0);
      rig.add(object);
    }
    return object;
  };
  const tips = [tip(-1), tip(1)];

  const elastic = new THREE.MeshStandardMaterial({ color: 0xa66b3f, roughness: .58 });
  const bandGeometry = new THREE.CylinderGeometry(.05, .06, 1, 9, 1, false);
  const bands = tips.map(() => {
    const band = new THREE.Mesh(bandGeometry, elastic);
    rig.add(band);
    return band;
  });
  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  let draw = 0;
  let targetDraw = 0;
  let releaseDraw = 0;
  let releaseTime = 0;
  let releasing = false;
  let time = 0;
  const restZ = pouch.position.z;

  function stretchBand(band, start, end) {
    direction.subVectors(end, start);
    const length = direction.length();
    band.position.copy(start).add(end).multiplyScalar(.5);
    band.quaternion.setFromUnitVectors(up, direction.normalize());
    band.scale.set(1, Math.max(.01, length), 1);
  }

  function update(dt) {
    time += dt;
    if (releasing) {
      releaseTime += dt;
      draw = releaseDraw * Math.exp(-9 * releaseTime) * Math.cos(23 * releaseTime);
      if (releaseTime >= .58) {
        releasing = false;
        draw = 0;
        targetDraw = 0;
        rig.visible = false;
      }
    } else {
      draw += (targetDraw - draw) * (1 - Math.exp(-dt * 14));
    }

    rig.position.y = Math.sin(time * 1.7) * .008;
    rig.rotation.z = Math.sin(time * 1.35) * .006;
    pouch.position.z = restZ + draw;
    pouch.rotation.x = Math.sin(time * 9) * Math.min(.12, Math.abs(draw) * .12);

    rig.updateMatrixWorld(true);
    const startPoints = tips.map(object => rig.worldToLocal(object.getWorldPosition(new THREE.Vector3())));
    const ends = [-1, 1].map(side => {
      const world = pouch.localToWorld(new THREE.Vector3(side * .17, 0, 0));
      return rig.worldToLocal(world);
    });
    stretchBand(bands[0], startPoints[0], ends[0]);
    stretchBand(bands[1], startPoints[1], ends[1]);
  }

  return {
    update,
    setLevel(level) { rig.setLevel?.(level); },
    setCharge(value) {
      releasing = false;
      rig.visible = true;
      targetDraw = Math.max(0, Math.min(1, value)) * 1.15;
    },
    release() {
      releaseDraw = draw;
      releaseTime = 0;
      targetDraw = 0;
      releasing = true;
    },
    setVisible(value) {
      rig.visible = value;
      if (value) {
        releasing = false;
        draw = targetDraw = 0;
        pouch.position.z = restZ;
      }
    },
  };
}
