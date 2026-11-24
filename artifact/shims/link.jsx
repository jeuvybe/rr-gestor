import { useContext } from 'react';
import { RotaCtx } from '../rotas.js';
export default function Link({ href, children, onClick, prefetch, ...p }) {
  const r = useContext(RotaCtx);
  const destino = typeof href === 'string' ? href : href?.pathname || '/';
  return (
    <a href={destino} {...p} onClick={(e) => { onClick?.(e); if (e.defaultPrevented || /^https?:/.test(destino)) return; e.preventDefault(); r.ir(destino); }}>{children}</a>
  );
}
