import { cn } from '@/lib/utils'

/**
 * @param {import('react').HTMLAttributes<HTMLDivElement>} props
 */
function Skeleton({ className, ...props }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

export { Skeleton }
