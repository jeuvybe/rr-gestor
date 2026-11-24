import { createContext } from 'react';
// Roteador próprio: a página publicada não pode usar o endereço do navegador
export const RotaCtx = createContext({ caminho: '/', busca: '', ir: () => {}, atualizar: () => {} });
