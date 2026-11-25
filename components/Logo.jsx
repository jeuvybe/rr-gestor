// Logo RR Tecnologia (marca nova): traços retos, pernas em paralelogramo, a do segundo R em ciano
export const LOGO_VIEWBOX = '194 284 697 471';
export const LOGO_R = 'M194 284H377.5A147.5 147.5 0 0 1 377.5 579H273V755H194ZM273 363V500H377.5A68.5 68.5 0 0 0 377.5 363Z';
export const LOGO_PERNA = 'M345.5 594H437.5L531 755H439Z';
export const LOGO_R2 = 'M554 284H737.5A147.5 147.5 0 0 1 737.5 579H633V755H554ZM633 363V500H737.5A68.5 68.5 0 0 0 737.5 363Z';
export const LOGO_PERNA_CIANO = 'M705.5 594H797.5L891 755H799Z';

export default function Logo({ className = 'h-8 w-auto', claro }) {
  const cor = claro ? 'fill-white' : 'fill-brand-navy dark:fill-white';
  return (
    <svg viewBox={LOGO_VIEWBOX} className={className} style={{ aspectRatio: '697 / 471' }} aria-label="RR Tecnologia" role="img">
      <g className={cor} fillRule="evenodd">
        <path d={LOGO_R} />
        <path d={LOGO_PERNA} />
        <path d={LOGO_R2} />
      </g>
      <path d={LOGO_PERNA_CIANO} fill="#00B8D9" />
    </svg>
  );
}
