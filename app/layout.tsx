import { AnimatedFooter } from "@/components/animated-footer"

// ... imports ...

// ... metadata ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased min-h-screen flex flex-col bg-background" suppressHydrationWarning>
        <main className="flex-1 relative">
          {children}
        </main>
        <AnimatedFooter />
      </body>
    </html>
  )
}
