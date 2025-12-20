import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let scene, camera, renderer, controls;
let raycaster, mouse;

const flowers = [];
const butterflies = [];

const clock = new THREE.Clock();

let hemiLight;
let stars;
let snowParticles;

let ground;
let riverMesh = null;
let riverCurve = null;
let dogModel = null;
let waterfallSystem = null;

// dog along river
let dogT = 0;
let dogDirection = 1;

// environment management
let currentMood = "morning"; // morning | sunset | night
let currentEnvironment = "valley"; // valley | forest | park
let environmentObjects = [];

// --- MUSIC ---
let audioContext = null;      // Web Audio API context
let audioBuffer = null;       // Current audio buffer
let audioSource = null;       // Current audio source node
let gainNode = null;          // Volume control
let bgAudio = null;           // HTML5 Audio fallback
let audioEnabled = false;     // becomes true after first click
let currentSongIndex = 0;     // track which song to play for current environment
let isPlaying = false;        // track playback state

// Removed old audioMap - using only the 6 specified songs now

// Environment-specific songs that change when scenery changes
// Valley: all the stars
// Forest: espresso
// Park: nadaaniyan
const environmentSongs = {
  valley: [
    "audio/all the stars.mp3",   // Exact match - with spaces
    "audio/all_the_stars.mp3"    // Fallback with underscores
  ],
  forest: [
    "audio/Espresso.mp3",         // Exact match - capital E
    "audio/espresso.mp3"           // Fallback lowercase
  ],
  park: [
    "audio/Nadaaniyan.mp3",        // Exact match - capital N
    "audio/nadaaniyan.mp3"         // Fallback lowercase
  ]
};

// Start intro sequence, then initialize
startIntroSequence();

function startIntroSequence() {
  const introScreen = document.getElementById('introScreen');
  const introImage = document.getElementById('introImage');
  const introTitle = document.getElementById('introTitle');
  const doorLeft = document.querySelector('.door-left');
  const doorRight = document.querySelector('.door-right');
  const canvas = document.querySelector('canvas');
  
  // Show image after a brief moment
  setTimeout(() => {
    introImage.classList.add('show');
  }, 500);
  
  // Show title after image appears
  setTimeout(() => {
    introTitle.classList.add('show');
  }, 1000);
  
  // Open doors after title is shown
  setTimeout(() => {
    doorLeft.classList.add('open-left');
    doorRight.classList.add('open-right');
  }, 2500);
  
  // Hide intro and show 3D scene after doors open
  setTimeout(() => {
    introScreen.classList.add('hidden');
    // Initialize the 3D scene after intro
    init();
    animate();
    // Show canvas after it's created
    setTimeout(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.style.opacity = '1';
      }
    }, 100);
  }, 4500);
}

/* -------------------- INIT -------------------- */

function init() {
  // SCENE
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x9fbfe0, 0.012);

  // CAMERA
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    400
  );
  camera.position.set(0, 4, 18);
  camera.lookAt(0, 3, -20);

  // RENDERER
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x9fd3ff);
  document.body.appendChild(renderer.domElement);
  // Canvas starts hidden, will be shown after intro
  renderer.domElement.style.opacity = '0';
  renderer.domElement.style.transition = 'opacity 1s ease-in';

  // CONTROLS
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 3, -20);

  // AUDIO
  bgAudio = new Audio();
  bgAudio.loop = true;
  bgAudio.volume = 0.4;

  // LIGHTS
  hemiLight = new THREE.HemisphereLight(0x9fd3ff, 0x27482a, 1.2);
  hemiLight.position.set(0, 40, 0);
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-25, 40, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 180;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  scene.add(sun);

  // GROUND (global)
  const gGeo = new THREE.PlaneGeometry(160, 160, 1, 1);
  const gMat = new THREE.MeshStandardMaterial({
    color: 0x2a6f32,
    emissive: 0x234f28,
    emissiveIntensity: 0.5,
    roughness: 0.95,
    metalness: 0.03
  });
  ground = new THREE.Mesh(gGeo, gMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  ground.name = "ground";
  scene.add(ground);

  // SKY ELEMENTS
  createStars();
  createSnowPetals();

  // first environment: valley
  buildEnvironment("valley");

  // INTERACTION
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  renderer.domElement.addEventListener("pointerdown", onPointerDown);

  // keyboard
  window.addEventListener("keydown", onKeyDown);

  // RESIZE
  window.addEventListener("resize", onResize);
}

/* -------------------- ENVIRONMENT MANAGEMENT -------------------- */

function clearEnvironment() {
  environmentObjects.forEach(obj => scene.remove(obj));
  environmentObjects = [];

  for (let i = flowers.length - 1; i >= 0; i--) {
    scene.remove(flowers[i]);
  }
  flowers.length = 0;

  for (let i = butterflies.length - 1; i >= 0; i--) {
    scene.remove(butterflies[i]);
  }
  butterflies.length = 0;

  if (dogModel) {
    scene.remove(dogModel);
    dogModel = null;
  }

  riverMesh = null;
  riverCurve = null;

  if (waterfallSystem) {
    scene.remove(waterfallSystem);
    waterfallSystem = null;
  }
}

function buildEnvironment(mode) {
  clearEnvironment();
  currentEnvironment = mode;
  currentSongIndex = 0; // Reset song index when environment changes

  if (mode === "valley") {
    ground.material.color.setHex(0x2a6f32);
    ground.material.emissive.setHex(0x234f28);
    scene.fog.density = 0.012;

    createValleyMountains();
    createValleyRiver();
    createValleyTrees();
    scatterWildflowers(40, 220);
    createButterflies();
    createDog();
  } else if (mode === "forest") {
    ground.material.color.setHex(0x183820);
    ground.material.emissive.setHex(0x102815);
    scene.fog.density = 0.015;

    createForestHills();
    createForestTrees();
    createForestWaterfall();
    scatterWildflowers(32, 180);
    createButterflies();
  } else if (mode === "park") {
    ground.material.color.setHex(0x4f8b3d);
    ground.material.emissive.setHex(0x345b2a);
    scene.fog.density = 0.01;

    createParkPathAndBenches();
    createParkLamps();
    createParkTrees();
    createParkFlowerBeds();
    createButterflies();
  }
  
  // Play environment-specific music when scenery changes
  // Stop ALL current audio and start new environment's song
  if (audioEnabled) {
    // Stop all audio completely before starting new song
    stopAllAudio();
    // Start new environment's song - will play FULL song
    playEnvironmentSong();
  }
}

/* -------------------- 1) VALLEY -------------------- */

function createValleyMountains() {
  const group = new THREE.Group();

  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x68758b,
    roughness: 0.9,
    metalness: 0.06
  });

  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf8fbff,
    roughness: 0.55,
    metalness: 0.08
  });

  const baseGeo = new THREE.ConeGeometry(22, 32, 6);
  const sideGeo = new THREE.ConeGeometry(16, 26, 5);

  const main = new THREE.Mesh(baseGeo, mountainMat);
  main.position.set(-10, 15, -70);
  main.rotation.y = Math.PI / 7;
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);

  const mainSnow = new THREE.Mesh(
    new THREE.ConeGeometry(13, 10, 6),
    snowMat
  );
  mainSnow.position.set(-10, 23, -70);
  mainSnow.rotation.y = Math.PI / 7;
  mainSnow.receiveShadow = true;
  group.add(mainSnow);

  const right = new THREE.Mesh(sideGeo, mountainMat);
  right.position.set(18, 13, -62);
  right.rotation.y = -Math.PI / 9;
  right.castShadow = true;
  right.receiveShadow = true;
  group.add(right);

  const rightSnow = new THREE.Mesh(
    new THREE.ConeGeometry(9, 8, 5),
    snowMat
  );
  rightSnow.position.set(18, 18, -62);
  rightSnow.rotation.y = -Math.PI / 9;
  rightSnow.receiveShadow = true;
  group.add(rightSnow);

  const far = new THREE.Mesh(sideGeo, mountainMat);
  far.scale.set(1.1, 1.1, 1.1);
  far.position.set(-30, 12, -60);
  far.castShadow = true;
  far.receiveShadow = true;
  group.add(far);

  const farSnow = new THREE.Mesh(
    new THREE.ConeGeometry(9, 8, 5),
    snowMat
  );
  farSnow.position.set(-30, 17, -60);
  farSnow.receiveShadow = true;
  group.add(farSnow);

  scene.add(group);
  environmentObjects.push(group);
}

function createValleyRiver() {
  const points = [
    new THREE.Vector3(-8, 0, -46),
    new THREE.Vector3(-4, 0, -32),
    new THREE.Vector3(0, 0, -18),
    new THREE.Vector3(6, 0, -6),
    new THREE.Vector3(12, 0, 6),
    new THREE.Vector3(20, 0, 18)
  ];
  riverCurve = new THREE.CatmullRomCurve3(points);

  const tubularSegments = 260;
  const radius = 1.7;
  const radialSegments = 14;

  const tubeGeo = new THREE.TubeGeometry(
    riverCurve,
    tubularSegments,
    radius,
    radialSegments,
    false
  );
  tubeGeo.scale(1, 0.1, 1);

  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x4aa7ff,
    emissive: 0x4aa7ff,
    emissiveIntensity: 0.45,
    roughness: 0.12,
    metalness: 0.85
  });

  riverMesh = new THREE.Mesh(tubeGeo, riverMat);
  riverMesh.position.y = 0.03;
  riverMesh.receiveShadow = true;

  scene.add(riverMesh);
  environmentObjects.push(riverMesh);
}

function createValleyTrees() {
  const group = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a2e1a,
    roughness: 0.9
  });

  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x1f4c2f,
    emissive: 0x163b24,
    emissiveIntensity: 0.7,
    roughness: 0.82
  });

  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.32, 2.8, 10);
  const coneGeo = new THREE.ConeGeometry(1.4, 3.4, 10);

  const positions = [
    [-18, -10],
    [-22, -2],
    [-25, -16],
    [-12, -18],
    [-4, -9],
    [6, -12],
    [14, -5],
    [18, -15],
    [10, -20]
  ];

  positions.forEach(([x, z]) => {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1.4, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const cone1 = new THREE.Mesh(coneGeo, foliageMat);
    cone1.position.set(x, 3.2, z);
    cone1.castShadow = true;
    cone1.receiveShadow = true;
    group.add(cone1);

    const cone2 = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 2.6, 10),
      foliageMat
    );
    cone2.position.set(x, 4.7, z);
    cone2.castShadow = true;
    cone2.receiveShadow = true;
    group.add(cone2);
  });

  scene.add(group);
  environmentObjects.push(group);
}

/* -------------------- 2) FOREST -------------------- */

function createForestHills() {
  const group = new THREE.Group();

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x404a57,
    roughness: 0.88,
    metalness: 0.04
  });

  const hillGeo = new THREE.ConeGeometry(18, 18, 6);
  const hill1 = new THREE.Mesh(hillGeo, rockMat);
  hill1.position.set(-10, 9, -40);
  hill1.castShadow = true;
  hill1.receiveShadow = true;
  group.add(hill1);

  const hill2 = new THREE.Mesh(hillGeo, rockMat);
  hill2.position.set(12, 9, -38);
  hill2.castShadow = true;
  hill2.receiveShadow = true;
  group.add(hill2);

  scene.add(group);
  environmentObjects.push(group);
}

function createForestTrees() {
  const group = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3a2514,
    roughness: 0.9
  });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x18492a,
    emissive: 0x12321d,
    emissiveIntensity: 0.8,
    roughness: 0.85
  });

  const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 4.2, 10);
  const coneGeo = new THREE.ConeGeometry(2, 4.6, 12);

  for (let i = 0; i < 30; i++) {
    const x = (Math.random() - 0.5) * 60;
    const z = -10 + (Math.random() - 0.5) * 40;

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 2.1, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const cone = new THREE.Mesh(coneGeo, foliageMat);
    cone.position.set(x, 4.9, z);
    cone.castShadow = true;
    cone.receiveShadow = true;
    group.add(cone);
  }

  scene.add(group);
  environmentObjects.push(group);
}

function createForestWaterfall() {
  // bright water sheet behind particles
  const sheetGeo = new THREE.PlaneGeometry(4, 10);
  const sheetMat = new THREE.MeshStandardMaterial({
    color: 0x4dd9ff,
    emissive: 0x4dd9ff,
    emissiveIntensity: 0.9,
    metalness: 0.9,
    roughness: 0.05,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });
  const sheet = new THREE.Mesh(sheetGeo, sheetMat);
  sheet.position.set(0, 6, -20.01);
  sheet.receiveShadow = true;
  scene.add(sheet);
  environmentObjects.push(sheet);

  // pool
  const poolGeo = new THREE.CylinderGeometry(6, 6, 0.2, 32);
  const poolMat = new THREE.MeshStandardMaterial({
    color: 0x3da8ff,
    emissive: 0x3da8ff,
    emissiveIntensity: 0.7,
    metalness: 0.9,
    roughness: 0.15
  });
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.position.set(0, 0.12, -16);
  pool.receiveShadow = true;
  scene.add(pool);
  environmentObjects.push(pool);

  // particles
  const count = 900;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 3;
    positions[i3 + 1] = Math.random() * 12;
    positions[i3 + 2] = 0;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.22,
    color: 0xe6fbff,
    transparent: true,
    opacity: 1.0
  });

  waterfallSystem = new THREE.Points(geo, mat);
  waterfallSystem.userData.basePositions = positions.slice();
  waterfallSystem.position.set(0, 6, -20);

  scene.add(waterfallSystem);
  environmentObjects.push(waterfallSystem);
}

/* -------------------- 3) PARK -------------------- */

function createParkPathAndBenches() {
  const group = new THREE.Group();

  const pathGeo = new THREE.PlaneGeometry(6, 70);
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0xc0c5c9,
    roughness: 0.8,
    metalness: 0.1
  });
  const path = new THREE.Mesh(pathGeo, pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.02, 0);
  path.receiveShadow = true;
  group.add(path);

  function makeBench() {
    const bench = new THREE.Group();
    const seatMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.8
    });
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.7
    });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.5), seatMat);
    seat.position.set(0, 0.4, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    bench.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 0.1), seatMat);
    back.position.set(0, 0.9, -0.2);
    back.castShadow = true;
    back.receiveShadow = true;
    bench.add(back);

    const legGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    const legOffsets = [
      [-0.9, 0.2, 0.18],
      [0.9, 0.2, 0.18],
      [-0.9, 0.2, -0.18],
      [0.9, 0.2, -0.18]
    ];
    legOffsets.forEach(o => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(o[0], o[1], o[2]);
      leg.castShadow = true;
      leg.receiveShadow = true;
      bench.add(leg);
    });

    return bench;
  }

  const bench1 = makeBench();
  bench1.position.set(-4, 0, -10);
  bench1.rotation.y = Math.PI / 6;
  group.add(bench1);

  const bench2 = makeBench();
  bench2.position.set(4, 0, 10);
  bench2.rotation.y = -Math.PI / 5;
  group.add(bench2);

  scene.add(group);
  environmentObjects.push(group);
}

function createParkLamps() {
  const group = new THREE.Group();

  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.6
  });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfffff2,
    emissive: 0xfff2cc,
    emissiveIntensity: 2.0,
    roughness: 0.2
  });

  function makeLamp(x, z) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 3, 8),
      poleMat
    );
    pole.position.set(x, 1.5, z);
    pole.castShadow = true;
    pole.receiveShadow = true;
    group.add(pole);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 16),
      lampMat
    );
    head.position.set(x, 3.2, z);
    head.castShadow = true;
    group.add(head);
  }

  makeLamp(-2.5, -14);
  makeLamp(2.5, -4);
  makeLamp(-2.5, 6);
  makeLamp(2.5, 16);

  scene.add(group);
  environmentObjects.push(group);
}

function createParkTrees() {
  const group = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a2e1a,
    roughness: 0.9
  });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x215b32,
    emissive: 0x163921,
    emissiveIntensity: 0.8,
    roughness: 0.8
  });

  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.35, 3.0, 8);
  const coneGeo = new THREE.ConeGeometry(1.3, 3.4, 10);

  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const radius = 30 + Math.random() * 8;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1.5, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const foliage = new THREE.Mesh(coneGeo, foliageMat);
    foliage.position.set(x, 3.2, z);
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    group.add(foliage);
  }

  scene.add(group);
  environmentObjects.push(group);

  // pond
  const pondGeo = new THREE.CircleGeometry(4, 32);
  const pondMat = new THREE.MeshStandardMaterial({
    color: 0x6fb9ff,
    emissive: 0x6fb9ff,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.8
  });
  const pond = new THREE.Mesh(pondGeo, pondMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-12, 0.03, 12);
  pond.receiveShadow = true;
  scene.add(pond);
  environmentObjects.push(pond);
}

function createParkFlowerBeds() {
  scatterWildflowers(12, 80, new THREE.Vector3(-6, 0, -10));
  scatterWildflowers(12, 80, new THREE.Vector3(6, 0, 8));
}

/* -------------------- WILDFLOWERS -------------------- */

function scatterWildflowers(radius = 40, count = 220, center = null) {
  const group = new THREE.Group();

  const colors = [0xffe3a3, 0xff9bcc, 0x88d9ff, 0xcda5ff, 0xfdf7b5];
  const materials = colors.map(
    c =>
      new THREE.MeshStandardMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: 0.3,
        roughness: 0.7,
        metalness: 0.1
      })
  );

  const flowerGeo = new THREE.SphereGeometry(0.14, 16, 16);

  for (let i = 0; i < count; i++) {
    const cluster = new THREE.Group();

    const baseRadius = radius * (0.3 + Math.random() * 0.7);
    const theta = Math.random() * Math.PI * 2;

    const cx = Math.cos(theta) * baseRadius;
    const cz = Math.sin(theta) * baseRadius;

    cluster.position.set(
      (center ? center.x : 0) + cx,
      0.04,
      (center ? center.z : 0) + cz
    );

    const blossoms = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < blossoms; j++) {
      const mat = materials[Math.floor(Math.random() * materials.length)];
      const flower = new THREE.Mesh(flowerGeo, mat);
      flower.position.set(
        (Math.random() - 0.5) * 0.4,
        0.05 + Math.random() * 0.05,
        (Math.random() - 0.5) * 0.4
      );
      flower.castShadow = true;
      flower.receiveShadow = true;
      cluster.add(flower);
    }

    group.add(cluster);
  }

  scene.add(group);
  environmentObjects.push(group);
}

/* -------------------- STARS & SNOW -------------------- */

function createStars() {
  const starGeo = new THREE.BufferGeometry();
  const starCount = 260;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 220;
    positions[i3 + 1] = Math.random() * 90 + 50;
    positions[i3 + 2] = (Math.random() - 0.5) * 220;
  }

  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const starMat = new THREE.PointsMaterial({
    size: 0.55,
    sizeAttenuation: true,
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    depthWrite: false
  });

  stars = new THREE.Points(starGeo, starMat);
  stars.userData.basePositions = positions.slice();
  scene.add(stars);
}

function createSnowPetals() {
  const count = 420;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 130;
    positions[i3 + 1] = Math.random() * 16 + 6;
    positions[i3 + 2] = (Math.random() - 0.5) * 130;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.26,
    color: 0xffffff,
    transparent: true,
    opacity: 0.85
  });

  snowParticles = new THREE.Points(geo, mat);
  snowParticles.userData.basePositions = positions.slice();
  scene.add(snowParticles);
}

/* -------------------- BUTTERFLIES -------------------- */

function createButterflies() {
  const texMorpho = createButterflyTexture("morpho");
  const texMonarch = createButterflyTexture("monarch");
  const texSwallow = createButterflyTexture("swallow");

  const mats = [
    new THREE.SpriteMaterial({ map: texMorpho, transparent: true }),
    new THREE.SpriteMaterial({ map: texMonarch, transparent: true }),
    new THREE.SpriteMaterial({ map: texSwallow, transparent: true })
  ];

  for (let i = 0; i < 22; i++) {
    const mat = mats[Math.floor(Math.random() * mats.length)];
    const sprite = new THREE.Sprite(mat);

    sprite.position.set(
      (Math.random() - 0.5) * 18,
      1.6 + Math.random() * 1.4,
      -4 + (Math.random() - 0.5) * 10
    );
    const size = 0.9 + Math.random() * 0.45;
    sprite.scale.set(size, size * 0.7, 1);

    sprite.userData.offset = Math.random() * Math.PI * 2;
    butterflies.push(sprite);
    scene.add(sprite);
    environmentObjects.push(sprite);
  }
}

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

/* -------------------- DOG -------------------- */

function createDog() {
  const dog = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xb8793b,
    roughness: 0.78,
    metalness: 0.1
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a20,
    roughness: 0.82
  });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.6, 0.5),
    bodyMat
  );
  body.position.set(0, 0.5, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  dog.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.5),
    bodyMat
  );
  head.position.set(0.9, 0.75, 0);
  head.castShadow = true;
  head.receiveShadow = true;
  dog.add(head);

  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.3),
    noseMat
  );
  nose.position.set(1.2, 0.7, 0);
  nose.castShadow = true;
  dog.add(nose);

  const earGeo = new THREE.BoxGeometry(0.15, 0.25, 0.1);
  const earL = new THREE.Mesh(earGeo, darkMat);
  earL.position.set(0.8, 1.0, 0.2);
  const earR = new THREE.Mesh(earGeo, darkMat);
  earR.position.set(0.8, 1.0, -0.2);
  earL.castShadow = earR.castShadow = true;
  dog.add(earL, earR);

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
    leg.castShadow = true;
    leg.receiveShadow = true;
    dog.add(leg);
  });

  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.5, 0.1),
    darkMat
  );
  tail.position.set(-0.9, 0.9, 0);
  tail.rotation.z = Math.PI / 6;
  tail.castShadow = true;
  dog.add(tail);

  dog.position.set(-10, 0.0, -30);

  scene.add(dog);
  dogModel = dog;
  environmentObjects.push(dog);
}

/* -------------------- MUSIC -------------------- */

// Load audio file - use HTML5 Audio (most reliable)
async function loadAudioFile(url) {
  // Check if file exists
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
      if (response.status === 404) {
        console.error(`❌ File not found: ${url}`);
        return { type: 'error', url: url, error: 'File not found (404)' };
      }
    }
  } catch (e) {
    // Continue anyway - might work
  }

  // Always use HTML5 Audio - most reliable
  return { type: 'html5', url: url };
}

// Stop all audio playback completely - ensures only one song plays
function stopAllAudio() {
  // Stop Web Audio API source
  if (audioSource) {
    try {
      audioSource.stop();
      audioSource.disconnect();
      audioSource = null;
    } catch (e) {
      // Source might already be stopped
    }
  }
  
  // Stop and remove HTML5 Audio element completely
  if (bgAudio) {
    try {
      bgAudio.pause();
      bgAudio.currentTime = 0;
      bgAudio.onended = null; // Remove event listeners
      bgAudio.onerror = null;
      bgAudio.src = ''; // Clear source
      bgAudio.load(); // Reset audio element
    } catch (e) {
      console.warn("Error stopping audio:", e);
    }
    bgAudio = null; // Remove reference
  }
  
  isPlaying = false;
  console.log("✓ All audio stopped completely");
}

// Play audio using Web Audio API - plays full song without interruption
async function playAudioBuffer(buffer) {
  if (!audioContext || !buffer) return;

  // ALWAYS stop any current playback first - ensure only one song plays
  stopAllAudio();

  // Create new source
  audioSource = audioContext.createBufferSource();
  audioSource.buffer = buffer;
  audioSource.connect(gainNode);
  
  // Set up to play next song when this one ends NATURALLY (full song plays)
  // But since each environment has only one song, it will just loop back to the same song
  audioSource.onended = () => {
    console.log("Song finished playing completely");
    isPlaying = false;
    // Restart the same song for this environment (loop)
    setTimeout(() => {
      playEnvironmentSong();
    }, 500);
  };

  try {
    audioSource.start(0);
    isPlaying = true;
    audioBuffer = buffer;
    const duration = buffer.duration;
    console.log(`Playing full song (duration: ${duration.toFixed(2)}s)`);
  } catch (e) {
    console.error("Failed to start audio:", e);
  }
}

// HTML5 Audio playback - plays full song without interruption (MOST RELIABLE)
function playHTML5Audio(url) {
  // ALWAYS stop any current playback first
  stopAllAudio();
  
  // Create new audio element for each song to avoid conflicts
  bgAudio = new Audio();
  bgAudio.loop = false; // Don't loop - play full song once
  bgAudio.volume = 0.4;
  bgAudio.preload = 'auto';

  bgAudio.src = url;
  bgAudio.currentTime = 0;

  // Play same song again when current one ends (loop for this environment)
  bgAudio.onended = () => {
    console.log("Song finished playing completely, restarting...");
    isPlaying = false;
    // Restart the same song for this environment
    setTimeout(() => {
      playEnvironmentSong();
    }, 500);
  };

  // Handle errors
  bgAudio.onerror = (e) => {
    console.error(`Audio error for ${url}:`, e);
    isPlaying = false;
  };

  // Play the song
  const playPromise = bgAudio.play();
  
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        isPlaying = true;
        console.log(`✓ Playing full song (HTML5): ${url}`);
        // Log duration when metadata loads
        bgAudio.addEventListener('loadedmetadata', () => {
          console.log(`  Song duration: ${bgAudio.duration.toFixed(2)}s`);
        }, { once: true });
      })
      .catch(err => {
        console.error(`❌ Audio play failed for ${url}:`, err);
        isPlaying = false;
      });
  }
}

// Resume audio context if suspended
async function resumeAudioContext() {
  if (audioContext && audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
      console.log("Audio context resumed");
    } catch (e) {
      console.warn("Failed to resume audio context:", e);
    }
  }
}

// Try to play a song file - ensures full playback
async function tryPlaySong(src) {
  try {
    const audioData = await loadAudioFile(src);
    
    if (audioData.type === 'error') {
      console.error(`Cannot play ${src}: ${audioData.error}`);
      return false;
    }
    
    // Use HTML5 Audio (most reliable)
    if (audioData.type === 'html5') {
      playHTML5Audio(audioData.url);
      return true;
    }
    
    // Fallback to Web Audio API if available
    if (audioData.type === 'webaudio' && audioData.buffer) {
      await resumeAudioContext();
      await playAudioBuffer(audioData.buffer);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Failed to play ${src}:`, error.message);
    return false;
  }
}

// Play environment-specific songs - ensures full song plays, only ONE at a time
async function playEnvironmentSong() {
  if (!audioEnabled) {
    console.log("Audio not enabled yet - waiting for user interaction");
    return;
  }

  // ALWAYS stop any current playback first - ensure only one song plays
  stopAllAudio();

  // Ensure audio context is ready
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = 0.4;
      console.log("✓ Web Audio API context created");
    } catch (e) {
      console.error("❌ Failed to create audio context:", e);
    }
  }

  await resumeAudioContext();

  const env = currentEnvironment;
  const songs = environmentSongs[env];
  if (!songs || songs.length === 0) {
    console.warn("No songs found for environment:", env);
    return;
  }

  // Try each file in the list (usually just one song per environment)
  const uniqueSongs = [...new Set(songs)];
  for (let i = 0; i < uniqueSongs.length; i++) {
    const src = uniqueSongs[i]; // Always use first available song for this environment
    
    if (!src) continue;
    
    console.log(`Loading song for ${env}: ${src}`);
    
    const success = await tryPlaySong(src);
    
    if (success) {
      const statusEl = document.getElementById('audioStatus');
      if (statusEl) {
        statusEl.style.display = 'none';
      }
      console.log(`✓ Successfully playing song for ${env}: ${src}`);
      return;
    }
  }
  
  // All files failed
  console.error("❌ No audio files found for environment:", env);
  const statusEl = document.getElementById('audioStatus');
  if (statusEl) {
    statusEl.innerHTML = `<strong>⚠ Audio Files Missing</strong><br>
      <span style="font-size: 11px;">Check console (F12) for details</span>`;
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(255, 165, 0, 0.9)';
  }
}

/* -------------------- INPUT -------------------- */

function onPointerDown(e) {
  // enable audio after first click
  if (!audioEnabled) {
    audioEnabled = true;
    console.log("Audio enabled - starting playback");
    
    // Initialize audio context if needed
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = 0.4;
        console.log("✓ Audio context created");
      } catch (e) {
        console.warn("Web Audio API not available, using HTML5 Audio");
      }
    }
    
    // Start playing environment song
    playEnvironmentSong();
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

function onKeyDown(e) {
  let changed = false;

  if (e.key === "1") {
    currentMood = "morning";
    changed = true;
  }
  if (e.key === "2") {
    currentMood = "sunset";
    changed = true;
  }
  if (e.key === "3") {
    currentMood = "night";
    changed = true;
  }

  if (e.key === "4") {
    buildEnvironment("valley");
    changed = true;
  }
  if (e.key === "5") {
    buildEnvironment("forest");
    changed = true;
  }
  if (e.key === "6") {
    buildEnvironment("park");
    changed = true;
  }

  if (changed) {
    // Play environment-specific songs when environment changes
    if (e.key === "4" || e.key === "5" || e.key === "6") {
      playEnvironmentSong();
    }
  }
}

/* -------------------- CLICK LIGHT-FLOWER -------------------- */

function spawnFlower(pos) {
  const group = new THREE.Group();
  group.position.copy(pos);
  group.position.y = 0.03;

  const petalGeo = new THREE.SphereGeometry(0.14, 16, 16);
  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
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
    mesh.castShadow = true;
    group.add(mesh);
  }

  const coreGeo = new THREE.SphereGeometry(0.18, 18, 18);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff19c,
    emissiveIntensity: 2.4,
    metalness: 0.7,
    roughness: 0.18
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.castShadow = true;
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

    const scale = Math.max(0, Math.sin(alpha * Math.PI));
    f.scale.setScalar(scale);

    f.position.y = 0.03 + alpha * 0.6;

    if (age > f.userData.duration) {
      scene.remove(f);
      flowers.splice(i, 1);
    }
  }
}

function animateSky(t) {
  const top = new THREE.Color();
  const bottom = new THREE.Color();
  const pulse = (Math.sin(t * 0.15) + 1) * 0.5;

  let snowOpacity = 0.7;

  if (currentMood === "morning") {
    top.setHSL(0.55, 0.55, 0.7 + 0.03 * pulse);
    bottom.setHSL(0.28, 0.7, 0.55);
    snowOpacity = 0.7;
    if (stars) stars.material.opacity = 0.0;
  } else if (currentMood === "sunset") {
    top.setHSL(0.02 + 0.02 * pulse, 0.85, 0.62);
    bottom.setHSL(0.10, 0.8, 0.47);
    snowOpacity = 0.6;
    if (stars) stars.material.opacity = 0.25;
  } else {
    top.setHSL(0.65, 0.6, 0.23 + 0.04 * pulse);
    bottom.setHSL(0.69, 0.8, 0.12);
    snowOpacity = 0.4;
    if (stars) stars.material.opacity = 0.85;
  }

  hemiLight.color.copy(top);
  hemiLight.groundColor.copy(bottom);

  renderer.setClearColor(top.getHex());
  if (scene.fog) scene.fog.color.copy(top);

  if (snowParticles) {
    snowParticles.material.opacity = snowOpacity;
  }
}

function animateStars(t) {
  if (!stars) return;
  const posAttr = stars.geometry.getAttribute("position");
  const base = stars.userData.basePositions;
  const count = posAttr.count;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const x = base[i3];
    const y = base[i3 + 1];
    const z = base[i3 + 2];

    const flicker = Math.sin(t * 0.8 + i * 0.37) * 0.9;
    posAttr.setXYZ(i, x, y + flicker, z);
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
    const x0 = base[i3];
    const y0 = base[i3 + 1];
    const z0 = base[i3 + 2];

    const fall = (t * 0.7 + i * 0.03) % 22;
    const sway = Math.sin(t * 0.8 + i * 0.15) * 0.4;

    posAttr.setXYZ(i, x0 + sway, y0 - fall, z0);
  }
  posAttr.needsUpdate = true;
}

function animateButterflies(t) {
  butterflies.forEach(b => {
    const offset = b.userData.offset || 0;

    b.position.y = 1.6 + Math.sin(t * 2.2 + offset) * 0.35;
    b.position.x += Math.sin(t * 0.45 + offset) * 0.003;
    b.position.z += Math.cos(t * 0.45 + offset) * 0.003;

    const flap = 0.9 + Math.sin(t * 12 + offset) * 0.22;
    b.scale.x = flap;

    b.lookAt(camera.position);
  });
}

function animateDog(t) {
  if (!dogModel || !riverCurve || currentEnvironment !== "valley") return;

  dogT += dogDirection * 0.0009;
  if (dogT > 1) {
    dogT = 1;
    dogDirection = -1;
  }
  if (dogT < 0) {
    dogT = 0;
    dogDirection = 1;
  }

  const center = riverCurve.getPoint(dogT);
  const tangent = riverCurve.getTangent(dogT);
  const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

  const offsetDist = 2.4;
  const pos = center.clone().add(side.multiplyScalar(offsetDist));

  dogModel.position.set(pos.x, 0.05 + Math.sin(t * 6) * 0.03, pos.z);
  const angle = Math.atan2(tangent.x * dogDirection, tangent.z * dogDirection);
  dogModel.rotation.y = angle;
}

function animateWaterfall(t) {
  if (!waterfallSystem) return;
  const posAttr = waterfallSystem.geometry.getAttribute("position");
  const base = waterfallSystem.userData.basePositions;
  const count = posAttr.count;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const x0 = base[i3];
    const y0 = base[i3 + 1];
    const z0 = base[i3 + 2];

    const fall = (t * 2.0 + i * 0.08) % 12;
    posAttr.setXYZ(i, x0, y0 - fall, z0);
  }
  posAttr.needsUpdate = true;
}

/* -------------------- MAIN LOOP -------------------- */

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  const radius = 26;
  camera.position.x = Math.sin(t * 0.06) * radius;
  camera.position.z = 6 + Math.cos(t * 0.06) * radius;
  camera.position.y = 5 + Math.sin(t * 0.05) * 1.2;
  camera.lookAt(0, 3.0, -18);

  controls.update();
  animateFlowers(t);
  animateSky(t);
  animateStars(t);
  animateSnow(t);
  animateButterflies(t);
  animateDog(t);
  animateWaterfall(t);

  renderer.render(scene, camera);
}

/* -------------------- RESIZE -------------------- */

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
