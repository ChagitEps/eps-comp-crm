import { SkeletonStats, SkeletonList } from '@/components/shared/skeleton-card'

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="animate-pulse rounded-md bg-muted h-7 w-32" />
        <div className="animate-pulse rounded-md bg-muted h-3 w-48" />
      </div>
      <SkeletonStats />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="animate-pulse rounded-md bg-muted h-4 w-24" />
          <SkeletonList count={3} />
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="animate-pulse rounded-md bg-muted h-4 w-32" />
          <SkeletonList count={4} />
        </div>
      </div>
    </div>
  )
}
