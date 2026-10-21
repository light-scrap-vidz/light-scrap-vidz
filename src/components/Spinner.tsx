interface SpinnerProps {
  size?: number;
  thickness?: number;
  /** `accent` on dark surfaces, `ink` on the lime buttons. */
  tone?: 'accent' | 'ink';
}

export function Spinner({ size = 18, thickness = 2.5, tone = 'accent' }: SpinnerProps) {
  const ring = tone === 'ink' ? 'rgba(20,20,12,0.3)' : 'rgba(201,242,94,0.25)';
  const head = tone === 'ink' ? 'var(--accent-ink)' : 'var(--accent)';
  return (
    <span
      className="lsv-spin"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        border: `${thickness}px solid ${ring}`,
        borderTopColor: head,
        display: 'inline-block',
      }}
    />
  );
}
