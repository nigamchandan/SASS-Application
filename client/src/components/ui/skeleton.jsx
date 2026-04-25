import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-slate-200/70',
        className
      )}
      {...props}
    />
  );
}

export default Skeleton;
