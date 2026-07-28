export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-7 w-56" />
        <div className="skeleton h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass-card rounded-card p-4 shadow-sm">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-3 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="glass-card rounded-card p-4 shadow-sm">
        <div className="skeleton h-4 w-40" />
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-14 w-40" />
          ))}
        </div>
      </div>
      <div className="glass-card rounded-card p-4 shadow-sm">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
