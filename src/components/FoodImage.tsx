import { useState } from 'react'
import type { ImgHTMLAttributes } from 'react'

type Props = ImgHTMLAttributes<HTMLImageElement> & { fallback?: string }

export function FoodImage({ src, alt, fallback = '/images/classic.webp', ...props }: Props) {
  const [failed, setFailed] = useState(false)
  return <img {...props} src={failed ? fallback : src} alt={alt} onError={() => setFailed(true)} />
}
