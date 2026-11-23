export default function Logo({ className = 'h-8 w-10', claro }) {
  return (
    <svg viewBox="0 0 120 92" className={className} aria-label="RR Tecnologia" role="img">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="14">
        <path d="M10 84V9h26a19 19 0 0 1 0 38H10M32 47l18 37" className={claro ? 'stroke-white' : 'stroke-brand-navy dark:stroke-white'} />
        <path d="M66 84V9h26a19 19 0 0 1 0 38H66" className={claro ? 'stroke-white' : 'stroke-brand-navy dark:stroke-white'} />
        <path d="M86 47l18 37" stroke="#00B8D9" />
      </g>
    </svg>
  );
}
