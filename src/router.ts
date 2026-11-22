import { useEffect, useState } from 'react';

export type Route = { name: 'home' } | { name: 'edit'; id: string };

export function parseHash(hash: string = location.hash): Route {
  const h = hash.replace(/^#/, '');
  const m = h.match(/^\/edit\/([^/?#]+)/);
  if (m) return { name: 'edit', id: decodeURIComponent(m[1]) };
  return { name: 'home' };
}

export function navigate(path: string): void {
  if (location.hash === `#${path}`) return;
  location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash());
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
