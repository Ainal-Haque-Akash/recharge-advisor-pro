import { memo, useEffect, useRef, useState } from "react";

export const Panel = ({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => (
  <section
    className={`rounded-panel bg-panel ring-1 ring-black/5 ${className}`}
  >
    {children}
  </section>
);

export const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{children}</p>
);

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  tone?: "amber" | "sage";
  minLabel?: string;
  maxLabel?: string;
  badge?: React.ReactNode;
  onChange: (v: number) => void;
};

function SliderInner({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  tone = "amber",
  minLabel,
  maxLabel,
  badge,
  onChange,
}: SliderProps) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-muted">
          {label}
          {badge}
        </span>
        <span className="font-mono font-semibold tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        className={tone === "sage" ? "range-sage" : undefined}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="flex justify-between font-mono text-[10px] text-muted">
        <span>{minLabel ?? min}</span>
        <span>{maxLabel ?? max}</span>
      </div>
    </div>
  );
}

export const Slider = memo(SliderInner);

export const AnimatedNumber = memo(function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 450);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = a + (b - a) * eased;
      setShown(v);
      from.current = v;
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value]);

  return <>{format(shown)}</>;
});
