// Logo RR Tecnologia, redesenhado a partir da arte oficial (mesmas proporções e espaçamento)
export default function Logo({ className = 'h-8 w-10', claro }) {
  const cor = claro ? 'stroke-white' : 'stroke-brand-navy dark:stroke-white';
  return (
    <svg viewBox="320 446 344 260" className={className} aria-label="RR Tecnologia" role="img" preserveAspectRatio="xMidYMid meet">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="43.5">
        <path d="M342.5 683V468h67.75a54.25 54.25 0 0 1 0 108.5H342.5M402.5 576.5l56 106.5" className={cor} />
        <path d="M519 683V468h67.75a54.25 54.25 0 0 1 0 108.5H519" className={cor} />
        <path d="M578.5 576.5l58 106.5" stroke="#00B8D9" />
      </g>
    </svg>
  );
}
