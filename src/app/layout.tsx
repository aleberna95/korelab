import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Command Center — Alessio Bernardini',
  description: 'Dashboard operativa privata',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="antialiased bg-white text-gray-900">{children}</body>
    </html>
  )
}
