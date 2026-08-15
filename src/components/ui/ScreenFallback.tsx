import './screen-fallback.css'

export function ScreenFallback() {
  return (
    <div className="screen-fallback" role="status">
      <span className="screen-fallback__label">Loading</span>
    </div>
  )
}
