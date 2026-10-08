import type {MetadataRoute} from 'next'
import {THEME_COLORS} from '@/lib/theme'

/** Lets "Add to Home Screen" install the app with the band's monkey icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Monkee Wrench',
    short_name: 'Monkee Wrench',
    description: 'Charts, setlists and rehearsals for Monkee Business',
    start_url: '/songs',
    scope: '/',
    display: 'standalone',
    background_color: THEME_COLORS.dark,
    theme_color: THEME_COLORS.dark,
    icons: [
      {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png'},
      {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png'},
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
