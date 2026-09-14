import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ImageKit — Client-Side Image Processor & Compressor',
  description:
    'Batch resize, compress, convert to WebP/PNG/JPEG, and download locally in your browser. 100% private, zero uploads.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full bg-slate-900 text-slate-100 antialiased selection:bg-rose-500/30 selection:text-rose-200`}>
        {children}
      </body>
    </html>
  )
}
