export function createContactShadow(THREE) {
  // Маленькая радиальная текстура даёт мягкую тень без тяжёлых теневых карт.
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot((x - center) / radius, (y - center) / radius);
      const alpha = Math.round(155 * Math.pow(Math.max(0, 1 - distance), 2.4));
      const index = (y * size + x) * 4;
      pixels[index] = 255;
      pixels[index + 1] = 255;
      pixels[index + 2] = 255;
      pixels[index + 3] = alpha;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const material = new THREE.MeshBasicMaterial({
    color: 0x31423c,
    map: texture,
    transparent: true,
    opacity: .62,
    depthWrite: false,
    toneMapped: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.6), material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .025;
  shadow.renderOrder = 1;
  return shadow;
}

export function createLaunchSpeedEffect(element, durationSeconds) {
  const streaks = [
    ['3vw','10vh','23vh','-13deg','46px','0s'], ['8vw','34vh','17vh','12deg','38px','.12s'],
    ['2vw','66vh','21vh','18deg','48px','.24s'], ['15vw','82vh','16vh','-9deg','34px','.06s'],
    ['20vw','19vh','24vh','-11deg','52px','.18s'], ['12vw','55vh','18vh','9deg','39px','.3s'],
    ['78vw','13vh','19vh','8deg','42px','.1s'], ['91vw','31vh','22vh','-15deg','49px','.22s'],
    ['97vw','64vh','19vh','11deg','43px','.02s'], ['82vw','80vh','23vh','-12deg','52px','.16s'],
    ['74vw','47vh','16vh','13deg','36px','.28s'], ['89vw','57vh','20vh','-8deg','44px','.08s'],
  ];
  element.replaceChildren(...streaks.map(([x,y,length,angle,travel,delay]) => {
    const line = document.createElement('i');
    line.style.setProperty('--x', x);
    line.style.setProperty('--y', y);
    line.style.setProperty('--length', length);
    line.style.setProperty('--angle', angle);
    line.style.setProperty('--travel', travel);
    line.style.setProperty('--delay', delay);
    return line;
  }));
  element.style.setProperty('--launch-burst-duration', `${durationSeconds}s`);
  let stopTimer = 0;
  const stop = () => {
    if (stopTimer) window.clearTimeout(stopTimer);
    stopTimer = 0;
    element.classList.remove('active');
  };
  const trigger = () => {
    stop();
    // Перезапуск CSS-анимации нужен для каждого нового заезда.
    void element.offsetWidth;
    element.classList.add('active');
    stopTimer = window.setTimeout(stop, durationSeconds * 1000);
  };
  return { trigger, stop };
}

export function createSlideTrail(THREE, scene, config) {
  const capacity = 32;
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: .72,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);

  const particles = Array.from({ length: capacity }, (_, index) => ({
    index, active: false, age: 0, life: config.slideTrailParticleLifetime,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, size: 0,
  }));
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let cursor = 0;
  let spawnClock = 0;

  function hideParticle(particle) {
    particle.active = false;
    dummy.position.set(0, -100, 0);
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    mesh.setMatrixAt(particle.index, dummy.matrix);
  }

  particles.forEach(hideParticle);
  mesh.instanceMatrix.needsUpdate = true;

  function spawn(cart, side) {
    const particle = particles[cursor];
    cursor = (cursor + 1) % capacity;
    particle.active = true;
    particle.age = 0;
    particle.life = config.slideTrailParticleLifetime;
    particle.x = cart.position.x + side * (.38 + Math.random() * .18);
    particle.y = cart.position.y + .08;
    particle.z = cart.position.z + .58 + Math.random() * .22;
    particle.vx = side * (.25 + Math.random() * .55);
    particle.vy = .55 + Math.random() * .55;
    particle.size = .09 + Math.random() * .09;
    const colors = [0x9a7954, 0xb8a17b, 0x788e62];
    tint.setHex(colors[Math.floor(Math.random() * colors.length)]);
    mesh.setColorAt(particle.index, tint);
    return particle;
  }

  function update(dt, cart, speed, airborne = false) {
    if (speed > 2.4 && !airborne) {
      spawnClock += dt;
      while (spawnClock >= config.slideTrailSpawnInterval) {
        spawnClock -= config.slideTrailSpawnInterval;
        spawn(cart, -1);
        spawn(cart, 1);
      }
    } else {
      spawnClock = 0;
    }

    for (const particle of particles) {
      if (!particle.active) continue;
      particle.age += dt;
      if (particle.age >= particle.life) {
        hideParticle(particle);
        continue;
      }
      const t = particle.age / particle.life;
      const puff = Math.sin(Math.PI * Math.min(1, t * 1.4));
      const scale = particle.size * (.18 + puff * .9) * (1 - t * .72);
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt - 1.5 * dt * dt;
      particle.vy -= 1.35 * dt;
      particle.z += speed * dt;
      dummy.position.set(particle.x, particle.y, particle.z);
      dummy.rotation.set(particle.age * 2.4, particle.age * 3.1, particle.age);
      dummy.scale.set(scale * 1.45, scale * .5, scale * .8);
      dummy.updateMatrix();
      mesh.setMatrixAt(particle.index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function reset() {
    spawnClock = 0;
    particles.forEach(hideParticle);
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { update, reset };
}
