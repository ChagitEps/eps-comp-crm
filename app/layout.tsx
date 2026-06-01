import type { Metadata } from 'next'
import { Assistant } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  variable: '--font-assistant',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'EPS COMP — מערכת ניהול',
  description: 'מערכת CRM/ERP לניהול עסק טכנאות מחשבים ותקשורת',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EPS COMP',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} h-full`}>
      <body className="min-h-full bg-background text-foreground antialiased font-[family-name:var(--font-assistant)]">
        {children}
        <Toaster
          position="bottom-right"
          dir="rtl"
          richColors
          closeButton
          duration={4000}
        />
      </body>
    </html>
  )
}
