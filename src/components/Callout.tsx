interface CalloutProps {
  type?: 'info' | 'warning' | 'tip'
  children: React.ReactNode
}

const styles: Record<string, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  tip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

const labels: Record<string, string> = {
  info: 'Info',
  warning: 'Warning',
  tip: 'Tip',
}

export function Callout({ type = 'info', children }: CalloutProps) {
  return (
    <div className={`my-6 rounded-lg border px-4 py-3 text-sm ${styles[type]}`}>
      <span className="font-semibold">{labels[type]}: </span>
      {children}
    </div>
  )
}
