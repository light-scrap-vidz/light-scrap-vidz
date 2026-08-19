import * as React from 'react';
import { cn } from '@/lib/utils';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 backdrop-blur-sm',
          'focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400/50',
          'disabled:cursor-not-allowed disabled:opacity-40',
          'cursor-pointer transition-all duration-200',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';

export { Select };
