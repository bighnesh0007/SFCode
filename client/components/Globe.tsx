"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Cities with big Salesforce communities; arcs link them like a live network. */
const HUBS: [string, number, number][] = [
  ["San Francisco", 37.77, -122.42], ["New York", 40.71, -74.0], ["Toronto", 43.65, -79.38], ["São Paulo", -23.55, -46.63],
  ["London", 51.5, -0.12], ["Dublin", 53.35, -6.26], ["Paris", 48.85, 2.35], ["Dubai", 25.2, 55.27],
  ["Bangalore", 12.97, 77.59], ["Hyderabad", 17.38, 78.48], ["Pune", 18.52, 73.85], ["Singapore", 1.35, 103.82],
  ["Tokyo", 35.68, 139.69], ["Sydney", -33.87, 151.21],
];
const LINKS: [number, number][] = [[0, 8], [0, 4], [1, 4], [2, 9], [4, 7], [5, 10], [6, 11], [8, 11], [9, 12], [11, 13], [3, 1], [12, 0], [10, 4], [7, 8], [13, 0]];
const ARC_COLORS = ["#38bdf8", "#818cf8", "#22d3ee", "#a78bfa"];

type Ring = [number, number][];
interface Country {
  type: string;
  id?: string;
  properties: unknown;
  geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] } | null;
}

/**
 * The hex layer (h3) throws on degenerate polygons (world-atlas 110m has a
 * zero-width sliver in North Korea), and the throw aborts the rest of the
 * drawing. Drop zero-area pieces; leave Antarctica (id 010) off for looks.
 */
function drawable(features: Country[]): Country[] {
  const fits = (poly: Ring[]) => {
    const ring = poly[0] ?? [];
    const span = (vals: number[]) => (vals.length ? Math.max(...vals) - Math.min(...vals) : 0);
    return ring.length >= 4 && span(ring.map(([lng]) => lng)) > 0.01 && span(ring.map(([, lat]) => lat)) > 0.01;
  };
  return features.flatMap((f): Country[] => {
    if (f.id === "010" || !f.geometry) return [];
    if (f.geometry.type === "Polygon") return fits(f.geometry.coordinates) ? [f] : [];
    const parts = f.geometry.coordinates.filter(fits);
    return parts.length ? [{ ...f, geometry: { type: "MultiPolygon", coordinates: parts } }] : [];
  });
}

/**
 * A rotating 3D globe (three.js + three-globe). Everything heavy is imported
 * only in the browser, after first paint; rendering pauses off-screen and in
 * background tabs, and it doesn't spin for people who prefer reduced motion.
 */
export function Globe({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let cleanup = () => {};

    void (async () => {
      const [THREE, { default: ThreeGlobe }, { OrbitControls }, topo, { feature }] = await Promise.all([
        import("three"),
        import("three-globe"),
        import("three/examples/jsm/controls/OrbitControls.js"),
        import("world-atlas/countries-110m.json"),
        import("topojson-client"),
      ]);
      if (cancelled) return;
      const topology = (topo as { default?: unknown }).default ?? topo;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- topojson's generic types don't fit a JSON import
      const countries = feature(topology as any, (topology as any).objects.countries) as unknown as { features: Country[] };

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const globe = new ThreeGlobe({ waitForGlobeReady: true, animateIn: !reduceMotion })
        .hexPolygonsData(drawable(countries.features))
        .hexPolygonResolution(3)
        .hexPolygonMargin(0.65)
        .hexPolygonUseDots(true)
        .hexPolygonColor(() => "rgba(186, 230, 253, 0.85)")
        .showAtmosphere(true)
        .atmosphereColor("#38bdf8")
        .atmosphereAltitude(0.18)
        .arcsData(LINKS.map(([a, b], i) => ({ startLat: HUBS[a]?.[1], startLng: HUBS[a]?.[2], endLat: HUBS[b]?.[1], endLng: HUBS[b]?.[2], color: ARC_COLORS[i % ARC_COLORS.length] })))
        .arcColor("color")
        .arcAltitudeAutoScale(0.4)
        .arcStroke(0.55)
        .arcDashLength(0.5)
        .arcDashGap(1.2)
        .arcDashInitialGap(() => Math.random() * 2)
        .arcDashAnimateTime(reduceMotion ? 0 : 2600)
        .ringsData(HUBS.map(([, lat, lng]) => ({ lat, lng })))
        .ringColor(() => (t: number) => `rgba(56, 189, 248, ${1 - t})`)
        .ringMaxRadius(3.2)
        .ringPropagationSpeed(reduceMotion ? 0 : 2.4)
        .ringRepeatPeriod(1400)
        .pointsData(HUBS.map(([name, lat, lng]) => ({ name, lat, lng })))
        .pointColor(() => "#e0f2fe")
        .pointAltitude(0.01)
        .pointRadius(0.45);
      const material = globe.globeMaterial() as InstanceType<typeof THREE.MeshPhongMaterial>;
      material.color = new THREE.Color("#0b1b4d");
      material.emissive = new THREE.Color("#0a1440");
      material.emissiveIntensity = 0.35;
      material.shininess = 0.8;

      const scene = new THREE.Scene();
      scene.add(globe);
      scene.add(new THREE.AmbientLight("#bbd4ff", 1.6));
      const key = new THREE.DirectionalLight("#ffffff", 1.4);
      key.position.set(-400, 300, 400);
      scene.add(key);
      const rim = new THREE.PointLight("#818cf8", 1.2);
      rim.position.set(300, -200, -300);
      scene.add(rim);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      el.appendChild(renderer.domElement);
      const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000);
      camera.position.set(0, 60, 320);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.autoRotate = !reduceMotion;
      controls.autoRotateSpeed = 0.7;
      controls.minPolarAngle = Math.PI / 3.2;
      controls.maxPolarAngle = Math.PI - Math.PI / 3;
      // Start over India/Europe rather than the Pacific.
      globe.rotation.y = -Math.PI / 2.4;

      const resize = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(el);

      let visible = true;
      const io = new IntersectionObserver(([entry]) => (visible = entry?.isIntersecting ?? false));
      io.observe(el);
      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!visible || document.hidden) return;
        controls.update();
        renderer.render(scene, camera);
      };
      tick();
      setReady(true);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        controls.dispose();
        renderer.dispose();
        scene.traverse((o) => {
          const m = o as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
          m.geometry?.dispose();
          for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) mat.dispose();
        });
        renderer.domElement.remove();
      };
    })().catch(() => {
      // No WebGL or a failed chunk: the page still works; the glow stays as decoration.
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return (
    <div className={cn("relative aspect-square", className)} aria-hidden="true">
      <div className="absolute inset-[12%] rounded-full bg-sky-500/20 blur-3xl" />
      <div ref={host} className={cn("absolute inset-0 transition-opacity duration-1000", ready ? "opacity-100" : "opacity-0")} />
    </div>
  );
}
