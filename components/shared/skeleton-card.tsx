import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-muted', className)} />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  )
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex justify-between">
            <div className="animate-pulse rounded-md bg-muted h-3 w-20" />
            <div className="animate-pulse rounded-lg bg-muted h-8 w-8" />
          </div>
          <div className="animate-pulse rounded-md bg-muted h-8 w-12" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonPage({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">{title}</h2>
          <div className="animate-pulse rounded-md bg-muted h-3 w-16" />
        </div>
        <div className="animate-pulse rounded-lg bg-muted h-8 w-24" />
      </div>
      <SkeletonList />
    </div>
  )
}
