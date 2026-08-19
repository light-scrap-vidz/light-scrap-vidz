import * as React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  style?: React.CSSProperties;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, style, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border',
          className,
        )}
        style={style}
        {...props}
      >
        {children}
      </span>
    );
  },
);
Badge.displayName = 'Badge';

export { Badge };
