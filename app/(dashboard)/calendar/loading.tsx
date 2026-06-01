export default function CalendarLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg bg-muted h-8 w-16" />
          ))}
        </div>
        <div className="animate-pulse rounded-lg bg-muted h-8 w-32" />
      </div>
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-2 flex justify-center">
              <div className="animate-pulse rounded bg-muted h-3 w-4" />
            </div>
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, col) => (
              <div key={col} className="min-h-[90px] p-1.5 border-b border-l border-border">
                <div className="animate-pulse rounded bg-muted h-5 w-5 mb-1" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
