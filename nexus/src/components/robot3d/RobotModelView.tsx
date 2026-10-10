import { useEffect, useRef, useState } from 'react';
import './robot3d.css';

/*
 * Static GLB viewer.
 *
 * This module is only ever reached through a dynamic import, so three.js is
 * downloaded exclusively when a model file actually exists.
 *
 * Deliberately static: the model is displayed at its exported pose. Joint
 * transforms are NOT driven from telemetry yet. Posing the model from raw
 * servo values before the joint mapping and calibration are verified would
 * show a pose the robot is not in, which is the one thing this application
 * must never do. That mapping is its own milestone.
 */

interface RobotModelViewProps {
  url: string;
  /** A slow camera drift. Off under prefers-reduced-motion. */
  idleDrift?: boolean;
  onError: (message: string) => void;
}

export default function RobotModelView({
  url,
  idleDrift = true,
  onError,
}: RobotModelViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let disposed = false;
    let frame = 0;
    let cleanup: (() => void) | undefined;

    async function start(): Promise<void> {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      if (disposed || !host) {
        return;
      }

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);

      // Dusk light to match the scene: cool violet key, warm low fill.
      const key = new THREE.DirectionalLight(0xc9b6ff, 2.4);
      key.position.set(2.5, 4, 3);
      const fill = new THREE.DirectionalLight(0xffc98a, 0.8);
      fill.position.set(-3, 1, -2);
      const ambient = new THREE.HemisphereLight(0x9fb6c9, 0x0a0f13, 1.1);
      scene.add(key, fill, ambient);

      const pivot = new THREE.Group();
      scene.add(pivot);

      function resize(): void {
        if (!host) return;
        const { clientWidth, clientHeight } = host;
        if (clientWidth === 0 || clientHeight === 0) return;
        renderer.setSize(clientWidth, clientHeight, false);
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
      }

      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();

      let loaded: import('three').Group | null = null;

      try {
        const gltf = await new GLTFLoader().loadAsync(url);
        if (disposed) {
          return;
        }
        loaded = gltf.scene;

        // Centre the model on the origin and frame it regardless of the units
        // it was exported in.
        const box = new THREE.Box3().setFromObject(loaded);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        const extent = Math.max(size.x, size.y, size.z) || 1;

        loaded.position.sub(centre);
        pivot.add(loaded);

        const distance = extent / (2 * Math.tan((camera.fov * Math.PI) / 360));
        camera.position.set(0, extent * 0.12, distance * 1.75);
        camera.lookAt(0, 0, 0);

        setReady(true);
      } catch (error) {
        if (!disposed) {
          onError(error instanceof Error ? error.message : String(error));
        }
        observer.disconnect();
        renderer.dispose();
        renderer.domElement.remove();
        return;
      }

      const started = performance.now();
      function tick(): void {
        frame = requestAnimationFrame(tick);
        if (idleDrift) {
          // ±7 degrees over roughly half a minute: enough to read as depth,
          // slow enough to ignore while reading numbers.
          const seconds = (performance.now() - started) / 1000;
          pivot.rotation.y = Math.sin(seconds / 9) * 0.12;
        }
        renderer.render(scene, camera);
      }
      tick();

      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        loaded?.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const material = object.material;
            if (Array.isArray(material)) {
              material.forEach((entry) => entry.dispose());
            } else {
              material.dispose();
            }
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    }

    void start();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [url, idleDrift, onError]);

  return (
    <div className="nx-robot3d">
      <div className="nx-robot3d__host" ref={hostRef} />
      {!ready && (
        <span className="nx-robot3d__loading nx-mono">LOADING MODEL…</span>
      )}
    </div>
  );
}
