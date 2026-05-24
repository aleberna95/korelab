import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { NetworkOnly, Serwist } from 'serwist'

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
    // Admin routes — NetworkOnly: pages are server-rendered with auth checks.
    // NEVER cache admin routes. Next.js App Router navigation (RSC) returns
    // status 200 even when redirect('/login') is called — the redirect lives
    // inside the RSC payload, not the HTTP status. StaleWhileRevalidate would
    // cache a "redirect to login" payload and replay it on every subsequent
    // navigation to that URL, causing a persistent login loop.
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith('/admin'),
      handler: new NetworkOnly(),
    },
    // Default cache strategy for everything else
    ...defaultCache,
  ],
})

serwist.addEventListeners()
