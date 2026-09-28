/** Erkennt kurze numerische Einmalcodes nur in einem klaren Code-Kontext. */
export function extractOneTimeCode(subject: string, snippet: string): string | null {
  const text = `${subject}\n${snippet}`
  const context = /\b(?:verification|security|authentication|login|sign-in|one[- ]time|confirm(?:ation)?|2fa|otp|pin|code|verifizierung|bestätigung|sicherheit|anmeldung|einmal|zugang)(?:s|ungs|ing)?(?:[- ]?(?:code|number|nummer))?\b/giu
  const codes = [...text.matchAll(/(?<![\p{L}\p{N}])\d{4,8}(?![\p{L}\p{N}])/gu)]
  if (!codes.length) return null

  let best: { code: string; distance: number } | null = null
  for (const word of text.matchAll(context)) {
    const wordStart = word.index
    const wordEnd = wordStart + word[0].length
    for (const match of codes) {
      const start = match.index
      const end = start + match[0].length
      const distance = start >= wordEnd ? start - wordEnd : wordStart >= end ? wordStart - end : 0
      // Vierstellige Jahreszahlen/Bestellnummern nur direkt neben dem Hinweis akzeptieren.
      const limit = match[0].length === 4 ? 18 : 50
      if (distance > limit) continue
      if (!best || distance < best.distance) best = { code: match[0], distance }
    }
  }
  return best?.code ?? null
}
