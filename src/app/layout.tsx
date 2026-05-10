import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Command Center — Alessio Bernardini',
  description: 'Private operational dashboard',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  )
}
