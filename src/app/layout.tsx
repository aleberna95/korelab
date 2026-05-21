import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { Toaster } from '@/components/ui/sonner'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'

export const metadata: Metadata = {
  title: 'KoreLab',
  description: 'Dashboard operativa privata',
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

/** Inline script to set theme class before hydration — prevents FOUC */
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    var isDark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.add(isDark ? 'dark' : 'light');
  } catch(e) {}
})()
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-component */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased bg-[var(--color-bg)] text-[var(--color-fg)]">
        <ThemeProvider>
          {children}
          <InstallPrompt />
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}

