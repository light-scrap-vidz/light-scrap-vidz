interface SpinnerProps {
  size?: number;
  thickness?: number;
  /** `accent` on dark surfaces, `ink` on the lime buttons. */
  tone?: 'accent' | 'ink';
}

export function Spinner({ size = 18, thickness = 2.5, tone = 'accent' }: SpinnerProps) {
  const ring =
    tone === 'ink'
      ? 'color-mix(in srgb, var(--accent-ink) 30%, transparent)'
      : 'color-mix(in srgb,var(--accent) 25%,transparent)';
  const head = tone === 'ink' ? 'var(--accent-ink)' : 'var(--accent)';
  return (
    <span
      className="lsv-spin shrink-0 rounded-full inline-block"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        border: `${thickness}px solid ${ring}`,
        borderTopColor: head,
      }}
    />
  );
}
