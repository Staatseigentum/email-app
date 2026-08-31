import { avatarColor, initials } from '../lib/format'

export function Avatar({
  name,
  seed,
  size = 40
}: {
  name: string
  seed?: string
  size?: number
}): JSX.Element {
  const bg = avatarColor(seed || name)
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
        fontSize: size * 0.38
      }}
    >
      {initials(name)}
    </div>
  )
}
