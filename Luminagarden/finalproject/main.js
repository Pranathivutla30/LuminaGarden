import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
// GLTFLoader import is no longer used, but you can leave it or remove it.
// import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let scene, camera, renderer, controls;
let raycaster, mouse;

const flowers = [];
const clock = new THREE.Clock();

let hemiLight;
let stars;
let snowParticles;
let butterflies = [];
let dogModel = null;
let riverMesh = null;
let riverCurve = null;

// audio
let audioListener;
let bgMusic;
let musicStarted = false;
let musicReady = false;
let musicRequested = false;

init();
animate();

/* -------------------- INIT -------------------- */

function init() {
  // SCENE
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xbfd1e5, 0.012);

  // CAMERA
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    400
  );
  camera.position.set(0, 3.5, 16);
  camera.lookAt(0, 2, -20);

  // RENDERER
  const canvas = document.querySelector("canvas");
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    canvas: canvas || undefined
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x87c9ff);
  document.body.appendChild(renderer.domElement);

  // CONTROLS
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // LIGHTS
  hemiLight = new THREE.HemisphereLight(0x87c9ff, 0x24502a, 1.0);
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.position.set(-18, 35, -10);
  scene.add(sun);

  // AUDIO
  setupAudio();

  // GROUND
  const gGeo = new THREE.PlaneGeometry(120, 120);
  const gMat = new THREE.MeshStandardMaterial({
    color: 0x3a8b3b,
    emissive: 0x245428,
    emissiveIntensity: 0.8,
    roughness: 0.95,
    metalness: 0.02
  });
  const ground = new THREE.Mesh(gGeo, gMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.name = "ground";
  scene.add(ground);

  // WORLD ELEMENTS
  createMountains();
  createCurvedRiver();
  createTrees();
  scatterWildflowers();   // textured flower sprites
  createStars();
  createSnowPetals();
  createButterflies();    // textured butterflies
  createDog();            // cute box dog

  // INTERACTION
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  window.addEventListener("pointerdown", onPointerDown);

  // RESIZE
  window.addEventListener("resize", onResize);
}

/* -------------------- AUDIO -------------------- */

function setupAudio() {
  audioListener = new THREE.AudioListener();
  camera.add(audioListener);

  bgMusic = new THREE.Audio(audioListener);
  const audioLoader = new THREE.AudioLoader();

  // your file: assets/nadaaniyan.mp3
  audioLoader.load(
    "assets/nadaaniyan.mp3",
    buffer => {
      bgMusic.setBuffer(buffer);
      bgMusic.setLoop(true);
      bgMusic.setVolume(0.4);
      musicReady = true;

      // If user already clicked before it finished loading, start now
      if (musicRequested && !musicStarted) {
        bgMusic.play();
        musicStarted = true;
      }
    },
    undefined,
    err => {
      console.warn("Could not load background music:", err);
    }
  );
}

/* -------------------- MOUNTAINS -------------------- */

function createMountains() {
  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x708090,
    roughness: 0.9,
    metalness: 0.05
  });

  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf4f6ff,
    roughness: 0.6,
    metalness: 0.05
  });

  const baseGeo = new THREE.ConeGeometry(18, 26, 4);
  const sideGeo = new THREE.ConeGeometry(12, 20, 5);

  const main = new THREE.Mesh(baseGeo, mountainMat);
  main.position.set(0, 13, -60);
  main.rotation.y = Math.PI / 4;
  scene.add(main);

  const mainSnow = new THREE.Mesh(
    new THREE.ConeGeometry(11, 10, 4),
    snowMat
  );
  mainSnow.position.set(0, 20, -60);
  mainSnow.rotation.y = Math.PI / 4;
  scene.add(mainSnow);

  const left = new THREE.Mesh(sideGeo, mountainMat);
  left.position.set(-22, 11, -55);
  left.rotation.y = Math.PI / 5;
  scene.add(left);

  const leftSnow = new THREE.Mesh(
    new THREE.ConeGeometry(7.5, 7, 5),
    snowMat
  );
  leftSnow.position.set(-22, 16, -55);
  leftSnow.rotation.y = Math.PI / 5;
  scene.add(leftSnow);

  const right = new THREE.Mesh(sideGeo, mountainMat);
  right.position.set(22, 10, -52);
  right.rotation.y = -Math.PI / 6;
  scene.add(right);

  const rightSnow = new THREE.Mesh(
    new THREE.ConeGeometry(7.5, 7, 5),
    snowMat
  );
  rightSnow.position.set(22, 15, -52);
  rightSnow.rotation.y = -Math.PI / 6;
  scene.add(rightSnow);
}

/* -------------------- CURVED RIVER -------------------- */

function createCurvedRiver() {
  const points = [
    new THREE.Vector3(-18, 0, 15),
    new THREE.Vector3(-10, 0, 5),
    new THREE.Vector3(0, 0, -2),
    new THREE.Vector3(8, 0, -10),
    new THREE.Vector3(16, 0, -18),
    new THREE.Vector3(20, 0, -28)
  ];
  riverCurve = new THREE.CatmullRomCurve3(points);

  const tubularSegments = 200;
  const radius = 1.5;
  const radialSegments = 8;
  const closed = false;

  const tubeGeo = new THREE.TubeGeometry(
    riverCurve,
    tubularSegments,
    radius,
    radialSegments,
    closed
  );
  tubeGeo.scale(1, 0.12, 1); // flatten it into a shallow river

  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x4fa3ff,
    emissive: 0x4fa3ff,
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.7
  });

  riverMesh = new THREE.Mesh(tubeGeo, riverMat);
  riverMesh.position.y = 0.03;
  scene.add(riverMesh);
}

/* -------------------- TREES -------------------- */

function createTrees() {
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a2e1a,
    roughness: 0.9
  });

  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x215533,
    emissive: 0x184427,
    emissiveIntensity: 0.6,
    roughness: 0.8
  });

  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.25, 2.4, 10);
  const coneGeo = new THREE.ConeGeometry(1.2, 3.2, 10);

  const positions = [
    [-10, -10],
    [-14, -2],
    [-16, -15],
    [-6, -18],
    [10, -11],
    [15, -4],
    [17, -15],
    [7, -18]
  ];

  positions.forEach(([x, z]) => {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1.2, z);
    scene.add(trunk);

    const cone1 = new THREE.Mesh(coneGeo, foliageMat);
    cone1.position.set(x, 3, z);
    scene.add(cone1);

    const cone2 = new THREE.Mesh(
      new THREE.ConeGeometry(1.0, 2.5, 10),
      foliageMat
    );
    cone2.position.set(x, 4.5, z);
    scene.add(cone2);
  });
}

/* -------------------- FLOWER TEXTURE -------------------- */

function createFlowerTexture(baseColor) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);

  const petalRadius = 26;
  const petalWidth = 16;

  const petalColor = baseColor;
  const centerColor = "#fffad5";

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const px = Math.cos(angle) * petalRadius;
    const py = Math.sin(angle) * petalRadius;

    const grad = ctx.createRadialGradient(
      px,
      py,
      2,
      px,
      py,
      petalWidth
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, petalColor);

    ctx.beginPath();
    ctx.ellipse(px, py, petalWidth, petalWidth * 1.2, angle, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  const gradC = ctx.createRadialGradient(0, 0, 2, 0, 0, 12);
  gradC.addColorStop(0, "#fffbe0");
  gradC.addColorStop(1, centerColor);
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fillStyle = gradC;
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/* -------------------- WILDFLOWERS (SPRITES) -------------------- */

function scatterWildflowers() {
  const palette = [0xffc94c, 0xff7bb8, 0x7fd0ff, 0xc88bff, 0xfff6a3];

  const flowerTextures = palette.map(c => {
    const hex = "#" + c.toString(16).padStart(6, "0");
    return createFlowerTexture(hex);
  });

  const flowerMaterials = flowerTextures.map(
    tex =>
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true
      })
  );

  // general meadow
  for (let i = 0; i < 220; i++) {
    const mat =
      flowerMaterials[Math.floor(Math.random() * flowerMaterials.length)];
    const sprite = new THREE.Sprite(mat);

    const radius = 40 * Math.random();
    const theta = Math.random() * Math.PI * 2;

    sprite.position.set(
      Math.cos(theta) * radius,
      0.05,
      Math.sin(theta) * radius
    );
    const size = 0.6 + Math.random() * 0.4;
    sprite.scale.set(size, size, 1);
    scene.add(sprite);
  }

  // extra flowers along riverbanks
  if (riverCurve) {
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const center = riverCurve.getPoint(t);
      const tangent = riverCurve.getTangent(t);
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      for (const sideSign of [-1, 1]) {
        const offset = side.clone().multiplyScalar(2.2 * sideSign);
        const base = center.clone().add(offset);

        const mat =
          flowerMaterials[Math.floor(Math.random() * flowerMaterials.length)];
        const sprite = new THREE.Sprite(mat);
        sprite.position.set(base.x, 0.05, base.z);
        const size = 0.7 + Math.random() * 0.4;
        sprite.scale.set(size, size, 1);
        scene.add(sprite);
      }
    }
  }
}

/* -------------------- STARS & SNOW -------------------- */

function createStars() {
  const starGeo = new THREE.BufferGeometry();
  const starCount = 200;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 200;
    positions[i3 + 1] = Math.random() * 80 + 40;
    positions[i3 + 2] = (Math.random() - 0.5) * 200;
  }

  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const starMat = new THREE.PointsMaterial({
    size: 0.4,
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  });

  stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
}

function createSnowPetals() {
  const count = 400;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 120;
    positions[i3 + 1] = Math.random() * 15 + 5;
    positions[i3 + 2] = (Math.random() - 0.5) * 120;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.25,
    color: 0xffffff,
    transparent: true,
    opacity: 0.9
  });

  snowParticles = new THREE.Points(geo, mat);
  snowParticles.userData.basePositions = positions.slice();
  scene.add(snowParticles);
}

/* -------------------- BUTTERFLY TEXTURES -------------------- */

function createButterflyTexture(type) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);

  let mainColor, edgeColor, accentColor;
  if (type === "morpho") {
    mainColor = "#4fb3ff";
    edgeColor = "#0b1e3a";
    accentColor = "#aee6ff";
  } else if (type === "monarch") {
    mainColor = "#ff9b2f";
    edgeColor = "#221115";
    accentColor = "#ffe7c0";
  } else {
    // swallowtail
    mainColor = "#ffe27a";
    edgeColor = "#1c1309";
    accentColor = "#fffce6";
  }

  function drawWing(sign) {
    ctx.save();
    ctx.scale(sign, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(80, -40, 90, -10, 90, 20);
    ctx.bezierCurveTo(80, 80, 40, 90, 10, 60);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, -40, 90, 80);
    grad.addColorStop(0, accentColor);
    grad.addColorStop(1, mainColor);

    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = edgeColor;
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = edgeColor + "aa";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(60, -10);
    ctx.moveTo(0, 0);
    ctx.lineTo(70, 30);
    ctx.moveTo(0, 0);
    ctx.lineTo(40, 60);
    ctx.stroke();

    ctx.restore();
  }

  drawWing(1);
  drawWing(-1);

  ctx.beginPath();
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.strokeStyle = edgeColor;
  ctx.moveTo(0, -30);
  ctx.lineTo(0, 40);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/* -------------------- BUTTERFLIES (SPRITES) -------------------- */

function createButterflies() {
  const texMorpho = createButterflyTexture("morpho");
  const texMonarch = createButterflyTexture("monarch");
  const texSwallow = createButterflyTexture("swallow");

  const mats = [
    new THREE.SpriteMaterial({ map: texMorpho, transparent: true }),
    new THREE.SpriteMaterial({ map: texMonarch, transparent: true }),
    new THREE.SpriteMaterial({ map: texSwallow, transparent: true })
  ];

  for (let i = 0; i < 20; i++) {
    const mat = mats[Math.floor(Math.random() * mats.length)];
    const sprite = new THREE.Sprite(mat);

    sprite.position.set(
      (Math.random() - 0.5) * 16,
      1.2 + Math.random() * 1.2,
      -4 + (Math.random() - 0.5) * 10
    );
    const size = 0.9 + Math.random() * 0.4;
    sprite.scale.set(size, size * 0.7, 1);

    sprite.userData.offset = Math.random() * Math.PI * 2;
    butterflies.push(sprite);
    scene.add(sprite);
  }
}

/* -------------------- CUTE BOX DOG -------------------- */

function createDog() {
  const dog = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xb8793b,
    roughness: 0.8,
    metalness: 0.1
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a20,
    roughness: 0.8
  });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.6, 0.5),
    bodyMat
  );
  body.position.set(0, 0.5, 0);
  dog.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.5),
    bodyMat
  );
  head.position.set(0.9, 0.75, 0);
  dog.add(head);

  // Nose
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.3),
    noseMat
  );
  nose.position.set(1.2, 0.7, 0);
  dog.add(nose);

  // Ears
  const earGeo = new THREE.BoxGeometry(0.15, 0.25, 0.1);
  const earL = new THREE.Mesh(earGeo, darkMat);
  earL.position.set(0.8, 1.0, 0.2);
  const earR = new THREE.Mesh(earGeo, darkMat);
  earR.position.set(0.8, 1.0, -0.2);
  dog.add(earL, earR);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.18, 0.5, 0.18);
  const legOffsets = [
    [-0.6, 0.25, 0.2],
    [-0.6, 0.25, -0.2],
    [0.4, 0.25, 0.2],
    [0.4, 0.25, -0.2]
  ];
  legOffsets.forEach(o => {
    const leg = new THREE.Mesh(legGeo, darkMat);
    leg.position.set(o[0], o[1], o[2]);
    dog.add(leg);
  });

  // Tail
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.5, 0.1),
    darkMat
  );
  tail.position.set(-0.9, 0.9, 0);
  tail.rotation.z = Math.PI / 6;
  dog.add(tail);

  // Position near river
  dog.position.set(-4, 0.0, -4);

  scene.add(dog);
  dogModel = dog;
}

/* -------------------- CLICK HANDLER -------------------- */

function onPointerDown(e) {
  // remember user interacted
  musicRequested = true;

  // start music if ready
  if (musicReady && !musicStarted && bgMusic) {
    bgMusic.play();
    musicStarted = true;
  }

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  const hit = raycaster.ray.intersectPlane(groundPlane, point);

  if (hit) {
    spawnFlower(point);
  }
}

/* -------------------- GLOWING LIGHT-FLOWER -------------------- */

function spawnFlower(pos) {
  const group = new THREE.Group();
  group.position.copy(pos);
  group.position.y = 0.03;

  const petalGeo = new THREE.SphereGeometry(0.14, 16, 16);
  const petalMat = new THREE.MeshStandardMaterial({
    emissive: 0xffb6ff,
    emissiveIntensity: 1.6,
    metalness: 0.4,
    roughness: 0.25
  });

  const petals = 10;
  const radius = 0.42;

  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2;
    const mesh = new THREE.Mesh(petalGeo, petalMat);
    mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    group.add(mesh);
  }

  const coreGeo = new THREE.SphereGeometry(0.18, 18, 18);
  const coreMat = new THREE.MeshStandardMaterial({
    emissive: 0xfff19c,
    emissiveIntensity: 2.4,
    metalness: 0.7,
    roughness: 0.18
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  group.userData.birth = clock.getElapsedTime();
  group.userData.duration = 3.8;

  scene.add(group);
  flowers.push(group);
}

/* -------------------- ANIMATION HELPERS -------------------- */

function animateFlowers(t) {
  for (let i = flowers.length - 1; i >= 0; i--) {
    const f = flowers[i];
    const age = t - f.userData.birth;
    const alpha = age / f.userData.duration;

    const scale = Math.sin(alpha * Math.PI);
    f.scale.setScalar(scale);

    f.position.y = 0.03 + alpha * 0.5;

    if (age > f.userData.duration) {
      scene.remove(f);
      flowers.splice(i, 1);
    }
  }
}

function animateSky(t) {
  const slow = (Math.sin(t * 0.03) + 1) * 0.5;

  const top = new THREE.Color().setHSL(
    0.58 - slow * 0.08,
    0.65,
    0.65
  );
  const bottom = new THREE.Color().setHSL(
    0.12 + slow * 0.12,
    0.7,
    0.55
  );

  hemiLight.color.copy(top);
  hemiLight.groundColor.copy(bottom);

  renderer.setClearColor(top.getHex());
}

function animateStars(t) {
  if (!stars) return;
  const posAttr = stars.geometry.getAttribute("position");
  const count = posAttr.count;

  for (let i = 0; i < count; i++) {
    const y = posAttr.getY(i);
    const flicker = Math.sin(t * 0.8 + i * 0.37) * 0.3;
    posAttr.setY(i, y + flicker);
  }
  posAttr.needsUpdate = true;
}

function animateSnow(t) {
  if (!snowParticles) return;
  const posAttr = snowParticles.geometry.getAttribute("position");
  const base = snowParticles.userData.basePositions;
  const count = posAttr.count;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const x = base[i3];
    const y = base[i3 + 1];
    const z = base[i3 + 2];

    const fall = (t * 0.8 + i * 0.05) % 20;
    posAttr.setXYZ(i, x, y - fall, z);
  }
  posAttr.needsUpdate = true;
}

function animateButterflies(t) {
  butterflies.forEach(b => {
    const offset = b.userData.offset || 0;

    // float gently
    b.position.y = 1.4 + Math.sin(t * 2 + offset) * 0.3;
    b.position.x += Math.sin(t * 0.4 + offset) * 0.002;
    b.position.z += Math.cos(t * 0.4 + offset) * 0.002;

    // flap by scaling
    const flap = 0.9 + Math.sin(t * 12 + offset) * 0.2;
    b.scale.x = flap;

    // always look at camera
    b.lookAt(camera.position);
  });
}

function animateDog(t) {
  if (!dogModel) return;
  dogModel.position.y = 0.02 + Math.sin(t * 1.5) * 0.03; // bob a bit
  dogModel.rotation.y =
    Math.PI / 2 + Math.sin(t * 0.3) * 0.2; // tiny head turn
}

/* -------------------- MAIN LOOP -------------------- */

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // camera orbit around the valley
  camera.position.x = Math.sin(t * 0.12) * 12;
  camera.position.z = 16 + Math.cos(t * 0.12) * 6;
  camera.lookAt(0, 4, -25);

  controls.update();
  animateFlowers(t);
  animateSky(t);
  animateStars(t);
  animateSnow(t);
  animateButterflies(t);
  animateDog(t);

  renderer.render(scene, camera);
}

/* -------------------- RESIZE -------------------- */

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
