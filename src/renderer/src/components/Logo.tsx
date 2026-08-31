import { Icon } from './Icon'

/** Logo-Kachel: violettes Quadrat mit mail-check-Glyph. */
export function LogoTile({ size = 22 }: { size?: number }): JSX.Element {
  return (
    <div
      className="grid shrink-0 place-items-center bg-accent text-accent-on"
      style={{ width: size, height: size, borderRadius: size >= 40 ? 8 : 3 }}
    >
      <Icon name="mail-check" size={Math.round(size * 0.6)} strokeWidth={2.25} />
    </div>
  )
}

/** Wortmarke „MailWave" – Sora 600, „Wave" im Akzent. */
export function Wordmark({ size = 13 }: { size?: number }): JSX.Element {
  return (
    <span
      className="font-display font-semibold tracking-[-0.012em] text-ink"
      style={{ fontSize: size }}
    >
      Mail<span className="text-accent-strong">Wave</span>
    </span>
  )
}
