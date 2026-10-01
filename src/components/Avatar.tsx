import { AvatarIcon } from '../lib/icons'

export default function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      <AvatarIcon name={name} size={Math.round(size * 0.52)} />
    </span>
  )
}
