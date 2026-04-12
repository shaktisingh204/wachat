'use client';

/**
 * Ambient Three.js scene for the SabNode landing page.
 *
 * - Soft mint/emerald background with matching fog
 * - Floating 3D "word" planes with the app's module names (canvas-textured)
 * - Gentle dust particles
 * - GSAP ScrollTrigger drifts the camera as the user scrolls
 *
 * The text planes are built from a CanvasTexture so we don't have to load a
 * three.js font. Each module name appears a couple of times, scattered in
 * depth, rotating and drifting slowly.
 */

import * as React from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const MODULES = [
  'Inbox',
  'WhatsApp',
  'Chatbot',
  'CRM',
  'Flows',
  'Broadcasts',
  'Templates',
  'Contacts',
  'Automations',
  'Integrations',
  'Webhooks',
  'Analytics',
  'AI',
  'Campaigns',
  'Support',
  'E-commerce',
];

const WORD_COLORS = [
  '#059669',
  '#10b981',
  '#047857',
  '#0d9488',
  '#14b8a6',
  '#22c55e',
  '#16a34a',
  '#065f46',
];

function createTextTexture(
  text: string,
  colorHex: string
): { texture: THREE.CanvasTexture; aspect: number } {
  const pad = 80;
  const fontSize = 200;
  const font = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif`;

  // First pass — measure
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  measureCtx.font = font;
  const metrics = measureCtx.measureText(text);
  const textWidth = Math.ceil(metrics.width);
  const width = textWidth + pad * 2;
  const height = fontSize + pad * 2;

  // Second pass — render
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);

  // Subtle vertical gradient for depth
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, colorHex);
  grad.addColorStop(1, shade(colorHex, -24));

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = grad;
  // soft emerald shadow
  ctx.shadowColor = 'rgba(6, 78, 59, 0.25)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  ctx.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return { texture, aspect: width / height };
}

function shade(hex: string, percent: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(h, 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00ff) + percent;
  let b = (num & 0x0000ff) + percent;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function Scene() {
  const mountRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mount = mountRef.current;
    if (!mount) return;

    const isMobile = window.innerWidth < 768;
    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    /* ---------- scene setup ---------- */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f0fdf4');
    scene.fog = new THREE.Fog('#ecfdf5', 18, 70);

    const camera = new THREE.PerspectiveCamera(
      58,
      mount.clientWidth / mount.clientHeight,
      0.1,
      200
    );
    camera.position.set(0, 0, 12);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    /* ---------- lights ---------- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 8, 6);
    scene.add(dirLight);

    const emeraldLight = new THREE.PointLight(0x10b981, 1.5, 40);
    emeraldLight.position.set(-8, 4, 4);
    scene.add(emeraldLight);

    const mintLight = new THREE.PointLight(0x6ee7b7, 1.2, 40);
    mintLight.position.set(8, -3, 4);
    scene.add(mintLight);

    /* ---------- floating module words ---------- */
    type WordMesh = {
      mesh: THREE.Mesh;
      baseY: number;
      baseX: number;
      baseZ: number;
      speed: number;
      offset: number;
      rotSpeed: number;
    };
    const words: WordMesh[] = [];

    // Each module appears 1–2 times so the sky is covered
    const instances: string[] = [];
    for (const m of MODULES) {
      instances.push(m);
      if (!isMobile && Math.random() > 0.35) instances.push(m);
    }

    instances.forEach((name, i) => {
      const color = WORD_COLORS[i % WORD_COLORS.length];
      const { texture, aspect } = createTextTexture(name, color);
      const height = 1.1 + Math.random() * 0.9;
      const width = height * aspect;
      const geo = new THREE.PlaneGeometry(width, height);
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        opacity: 0.55 + Math.random() * 0.3,
        roughness: 0.6,
        metalness: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 36,
        (Math.random() - 0.5) * 26,
        -Math.random() * 38 - 2
      );
      mesh.rotation.z = (Math.random() - 0.5) * 0.25;
      mesh.rotation.y = (Math.random() - 0.5) * 0.4;
      scene.add(mesh);

      words.push({
        mesh,
        baseY: mesh.position.y,
        baseX: mesh.position.x,
        baseZ: mesh.position.z,
        speed: 0.25 + Math.random() * 0.5,
        offset: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.08,
      });
    });

    /* ---------- dust particles ---------- */
    const pCount = isMobile ? 400 : 1000;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 60;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 50;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 70 - 10;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x10b981,
      size: 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    /* ---------- animation loop ---------- */
    let last = performance.now();
    let elapsed = 0;
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!reduceMotion) elapsed += dt;

      for (const w of words) {
        w.mesh.position.y =
          w.baseY + Math.sin(elapsed * w.speed + w.offset) * 0.7;
        w.mesh.position.x =
          w.baseX + Math.cos(elapsed * w.speed * 0.5 + w.offset) * 0.35;
        w.mesh.rotation.z += w.rotSpeed * dt;
        // Keep text roughly facing the camera (slight parallax wobble)
        w.mesh.rotation.y =
          Math.sin(elapsed * 0.2 + w.offset) * 0.15;
      }
      particles.rotation.y += dt * 0.01;

      renderer.render(scene, camera);
    };
    tick();

    /* ---------- GSAP camera scrub ---------- */
    const scrollCtx = gsap.context(() => {
      gsap.to(camera.position, {
        y: -8,
        z: 16,
        ease: 'none',
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.4,
          invalidateOnRefresh: true,
        },
      });
      gsap.to(camera.rotation, {
        x: -0.1,
        ease: 'none',
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.4,
          invalidateOnRefresh: true,
        },
      });
    });

    const onResize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        last = performance.now();
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      scrollCtx.revert();
      for (const w of words) {
        w.mesh.geometry.dispose();
        const mat = w.mesh.material as THREE.MeshStandardMaterial;
        mat.map?.dispose();
        mat.dispose();
      }
      pGeo.dispose();
      pMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={mountRef} className="absolute inset-0">
      {/* Ambient soft glows layered over the 3D canvas */}
      <div
        className="absolute -top-40 -left-40 h-[640px] w-[640px] rounded-full opacity-45 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #a7f3d0, transparent 65%)' }}
      />
      <div
        className="absolute -bottom-40 -right-40 h-[640px] w-[640px] rounded-full opacity-45 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #6ee7b7, transparent 65%)' }}
      />
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full opacity-35 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #d1fae5, transparent 65%)' }}
      />
    </div>
  );
}
