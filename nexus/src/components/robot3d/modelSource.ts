import { useEffect, useState } from 'react';

/*
 * Where the 3D model lives, and how NEXUS decides whether to use it.
 *
 * Drop a browser-ready GLB at `nexus/public/models/robot-lower-body.glb` and
 * the Overview switches to it on the next load. Nothing else needs changing:
 * no import to edit, no rebuild of the component tree.
 *
 * Export a `.glb` from Fusion 360 (or convert via glTF tooling). `.f3d` and
 * `.f3z` cannot be rendered in a browser and are not looked for.
 *
 * While no model is present the three.js bundle is never fetched at all —
 * the loader is a dynamic import guarded by this probe — so the SVG
 * schematic stays the zero-cost default.
 */

export const ROBOT_MODEL_URL = '/models/robot-lower-body.glb';

export type ModelAvailability = 'checking' | 'present' | 'absent';

/**
 * Probes for the model with a HEAD request.
 *
 * A dev server that answers every path with index.html would make a naive
 * `res.ok` check lie, so the content type is checked too: an HTML response
 * means "no model here".
 */
export function useModelAvailability(url: string = ROBOT_MODEL_URL): ModelAvailability {
  const [availability, setAvailability] = useState<ModelAvailability>('checking');

  useEffect(() => {
    let cancelled = false;

    async function probe(): Promise<void> {
      try {
        const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        const type = response.headers.get('content-type') ?? '';
        const looksLikeHtml = type.includes('text/html');
        if (!cancelled) {
          setAvailability(response.ok && !looksLikeHtml ? 'present' : 'absent');
        }
      } catch {
        if (!cancelled) {
          setAvailability('absent');
        }
      }
    }

    void probe();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return availability;
}
