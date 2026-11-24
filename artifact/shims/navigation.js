import { useContext } from 'react';
import { RotaCtx } from '../rotas.js';
export function useRouter() {
  const r = useContext(RotaCtx);
  return { push: r.ir, replace: r.ir, refresh: r.atualizar, back: () => r.ir('/painel'), prefetch() {} };
}
export const usePathname = () => useContext(RotaCtx).caminho;
export const useSearchParams = () => new URLSearchParams(useContext(RotaCtx).busca);
export function redirect() { throw new Error('redirect não disponível na demonstração'); }
