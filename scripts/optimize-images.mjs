import sharp from 'sharp'
import { readdir } from 'node:fs/promises'

// Run after replacing the original photos. Keep transparency on ingredient cutouts.
const files = (await readdir('assets/originals')).filter((name) => /\.(jpg|png)$/.test(name))
await Promise.all(
  files.map(async (name) => {
    if (name === 'sauce.png') return
    const ingredient = name.endsWith('.png')
    let image = sharp(`assets/originals/${name}`).rotate()
    if (name === 'sauce-photo.jpg') {
      // Isolate the round bowl from the original CC0 photo.
      image = image
        .extract({ left: 140, top: 32, width: 644, height: 565 })
        .resize(240, 210)
        .composite([
          {
            input: Buffer.from(
              '<svg width="240" height="210"><ellipse cx="120" cy="105" rx="119" ry="104" fill="white"/></svg>',
            ),
            blend: 'dest-in',
          },
        ])
      await image.webp({ quality: 85 }).toFile('public/images/sauce.webp')
    } else {
      await image
        .resize({
          width: ingredient ? 256 : 1000,
          height: ingredient ? 256 : undefined,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: ingredient ? 90 : 82 })
        .toFile(`public/images/${name.replace(/\.(jpg|png)$/, '.webp')}`)
    }
  }),
)
console.log('Optimized photos and transparent ingredients saved as WebP.')
