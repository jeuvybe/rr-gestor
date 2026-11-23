import './globals.css';

export const metadata = {
  title: { default: 'RR Gestor — clientes e cobranças pelo WhatsApp', template: '%s · RR Gestor' },
  description: 'Cadastre seus clientes, controle o financeiro e envie cobranças automáticas pelo WhatsApp.',
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0A1F3A' };

const temaInicial = `try{var t=localStorage.getItem('rr-tema');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaInicial }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
