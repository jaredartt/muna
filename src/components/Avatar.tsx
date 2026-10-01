import { AppIcon } from '../lib/icons'

export default function Avatar({ name, color = 'peach', size = 44 }: { name: string; color?: string; size?: number }) {
  return (
    <span className={`avatar c-${color}`} style={{ width: size, height: size }}>
      <AppIcon name={name} size={Math.round(size * 0.55)} />
    </span>
  )
}
