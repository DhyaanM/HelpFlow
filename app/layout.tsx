import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

import './globals.css'

const _inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HelpFlow - Classroom Help Queue',
  description: 'A modern classroom help queue management application for teachers and students.',
}

export const viewport: Viewport = {
  themeColor: '#2D9389',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased min-h-screen flex flex-col" suppressHydrationWarning>
        <main className="flex-1">
          {children}
        </main>
        <footer className="py-4 text-center text-sm text-muted-foreground/60">
          Made By Dhyaan Manganahalli
        </footer>
      </body>
    </html>
  )
}
