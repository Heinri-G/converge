export function ScreenFallback() {
  return (
    <div className="flex min-h-[var(--touch-min)] items-center justify-center py-4" role="status">
      <span className="text-sm text-muted-foreground">Loading</span>
    </div>
  )
}
