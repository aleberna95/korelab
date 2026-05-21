import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { NetworkOnly, StaleWhileRevalidate, Serwist } from 'serwist'

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[]
  }
}

declare const self: ServiceWorkerGlobalScope

// Firebase API domains must always go to the network — never cache auth or Firestore
const firebaseDomains = [
  'firestore.googleapis.com',
  'securetoken.googleapis.com',
  'identitytoolkit.googleapis.com',
  'firebase.googleapis.com',
]

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }: { request: Request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
  runtimeCaching: [
    // Firebase APIs — NetworkOnly, never cache
    ...firebaseDomains.map(domain => ({
      matcher: ({ url }: { url: URL }) => url.hostname === domain,
      handler: new NetworkOnly(),
    })),
    // Admin shell pages — StaleWhileRevalidate for fast navigation
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith('/admin'),
      handler: new StaleWhileRevalidate({
        cacheName: 'admin-shell',
      }),
    },
    // Default cache strategy for everything else
    ...defaultCache,
  ],
})

serwist.addEventListeners()
