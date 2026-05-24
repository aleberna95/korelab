import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

// Skip the serwist plugin entirely in development to avoid Turbopack startup
// errors: @serwist/next reads routes-manifest.json at request time even when
// disabled, but Turbopack doesn't generate that file during `next dev`.
if (process.env.NODE_ENV === 'development') {
  module.exports = nextConfig
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const withSerwistInit = require('@serwist/next')
  const withSerwist = (withSerwistInit.default ?? withSerwistInit)({
    swSrc: 'src/app/sw.ts',
    swDest: 'public/sw.js',
    reloadOnOnline: true,
  })

  // Serwist injects sw-entry.mjs (which imports @serwist/window, a browser-only
  // module) into the main-app entry for BOTH client and server webpack passes.
  // This produces an undefined module factory in the server bundle and crashes
  // the prerender of every page. Fix: strip the sw-entry injection from the
  // server-side compilation while leaving the client side untouched.
  const serwistConfig = withSerwist(nextConfig)
  const originalWebpack = serwistConfig.webpack
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serwistConfig.webpack = function (config: any, options: any) {
    const result = originalWebpack(config, options)
    if (options.isServer) {
      const origEntry = result.entry
      result.entry = async function () {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entries: Record<string, any> = await origEntry()
        for (const key of Object.keys(entries)) {
          if (Array.isArray(entries[key])) {
            entries[key] = entries[key].filter((e: string) => !e.includes('sw-entry'))
          }
        }
        return entries
      }
    }
    return result
  }

  module.exports = serwistConfig
}
