export function createSkyDecor(THREE, scene) {
  const cloudGeometry = new THREE.SphereGeometry(1, 8, 6);
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cloudPuffs = [
    [-1.05, 0, 0, 1.1, .48, .14],
    [-.34, .26, -.02, .88, .67, .14],
    [.48, .12, 0, 1.12, .56, .15],
    [1.12, -.03, -.01, .74, .4, .13],
    [.03, -.12, .08, 1.12, .32, .16],
  ];
  const cloudSeeds = [
    { x: -2.6, y: 12.5, z: -42, speed: .12, phase: .2 },
    { x: 2.2, y: 15.3, z: -58, speed: -.09, phase: 1.4 },
    { x: -.4, y: 10.4, z: -34, speed: .08, phase: 2.6 },
    { x: 4.7, y: 13.8, z: -72, speed: -.11, phase: 3.4 },
    { x: -4.8, y: 16.1, z: -68, speed: .07, phase: 4.5 },
    { x: 1.1, y: 18.2, z: -88, speed: -.06, phase: 5.1 },
  ];
  const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, cloudSeeds.length * cloudPuffs.length);
  clouds.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let index = 0;
  for (let cloudIndex = 0; cloudIndex < cloudSeeds.length; cloudIndex++) {
    const cloud = cloudSeeds[cloudIndex];
    cloud.firstInstance = index;
    for (let puffIndex = 0; puffIndex < cloudPuffs.length; puffIndex++) {
      const [offsetX, offsetY, offsetZ, scaleX, scaleY, scaleZ] = cloudPuffs[puffIndex];
      dummy.position.set(cloud.x + offsetX, cloud.y + offsetY, cloud.z + offsetZ);
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();
      clouds.setMatrixAt(index, dummy.matrix);
      tint.setHex(puffIndex === 4 ? 0xdcebf0 : (cloudIndex % 2 ? 0xf1f7f6 : 0xf8fbf8));
      clouds.setColorAt(index, tint);
      index++;
    }
  }
  clouds.instanceMatrix.needsUpdate = true;
  if (clouds.instanceColor) clouds.instanceColor.needsUpdate = true;
  scene.add(clouds);

  const birdMaterial = new THREE.MeshBasicMaterial({ color: 0x526878, side: THREE.DoubleSide, toneMapped: false });
  const bodyGeometry = new THREE.SphereGeometry(1, 6, 4);
  const wingGeometry = new THREE.BufferGeometry();
  wingGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, .72, .16, 0, .32, -.12, 0,
  ], 3));
  wingGeometry.setIndex([0, 2, 1]);
  wingGeometry.computeVertexNormals();
  const birds = [
    { x: -2.8, y: 9.1, z: -31, direction: 1, speed: .64, phase: .1 },
    { x: 1.6, y: 11.2, z: -43, direction: -1, speed: .48, phase: 1.8 },
    { x: -.2, y: 8.3, z: -27, direction: 1, speed: .72, phase: 3.2 },
    { x: 3.4, y: 12.4, z: -52, direction: -1, speed: .56, phase: 4.6 },
  ].map(data => {
    const root = new THREE.Group();
    const body = new THREE.Mesh(bodyGeometry, birdMaterial);
    body.scale.set(.16, .09, .08);
    root.add(body);

    const leftWing = new THREE.Group();
    leftWing.scale.x = -1;
    const leftShape = new THREE.Mesh(wingGeometry, birdMaterial);
    leftWing.add(leftShape);
    root.add(leftWing);

    const rightWing = new THREE.Group();
    const rightShape = new THREE.Mesh(wingGeometry, birdMaterial);
    rightWing.add(rightShape);
    root.add(rightWing);

    root.position.set(data.x, data.y, data.z);
    scene.add(root);
    return { ...data, root, leftWing, rightWing };
  });

  let time = 0;
  function update(dt) {
    time += dt;
    for (let cloudIndex = 0; cloudIndex < cloudSeeds.length; cloudIndex++) {
      const cloud = cloudSeeds[cloudIndex];
      cloud.x += cloud.speed * dt;
      if (cloud.x > 8.5) cloud.x = -8.5;
      if (cloud.x < -8.5) cloud.x = 8.5;
      for (let puffIndex = 0; puffIndex < cloudPuffs.length; puffIndex++) {
        const [offsetX, offsetY, offsetZ, scaleX, scaleY, scaleZ] = cloudPuffs[puffIndex];
        const bob = Math.sin(time * .42 + cloud.phase) * .1;
        dummy.position.set(cloud.x + offsetX, cloud.y + offsetY + bob, cloud.z + offsetZ);
        dummy.scale.set(scaleX, scaleY, scaleZ);
        dummy.updateMatrix();
        clouds.setMatrixAt(cloud.firstInstance + puffIndex, dummy.matrix);
      }
    }
    clouds.instanceMatrix.needsUpdate = true;

    for (const bird of birds) {
      bird.root.position.x += bird.direction * bird.speed * dt;
      if (bird.root.position.x > 6.5) bird.direction = -1;
      if (bird.root.position.x < -6.5) bird.direction = 1;
      bird.root.position.y = bird.y + Math.sin(time * 1.8 + bird.phase) * .2;
      const flap = .12 + Math.sin(time * 9 + bird.phase) * .4;
      bird.leftWing.rotation.z = -flap;
      bird.rightWing.rotation.z = flap;
      bird.root.rotation.y = bird.direction < 0 ? Math.PI : 0;
    }
  }

  return { update };
}
