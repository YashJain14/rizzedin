import { type Metadata } from 'next'
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ConvexClientProvider } from '@/providers/ConvexClientProvider'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Toaster } from 'sonner'
import { Navigation } from '@/components/navigation'
import { MainWrapper } from '@/components/main-wrapper'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'RizzedIn - Professional Dating Platform',
  description: 'Connect with professionals on RizzedIn',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConvexClientProvider>
            <header className="fixed top-0 left-0 right-0 flex justify-between items-center p-4 gap-4 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
              <div className="flex items-center">
                <h1 className="text-xl font-bold">RizzedIn</h1>
              </div>
              <div className="flex items-center gap-2 md:gap-4">
                <ThemeToggle />
                <SignedOut>
                  <SignInButton>
                    <Button variant="ghost" size="sm">Sign In</Button>
                  </SignInButton>
                  <SignUpButton>
                    <Button size="sm">Sign Up</Button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <UserButton />
                </SignedIn>
              </div>
            </header>
            <Navigation />
            <MainWrapper>
              {children}
            </MainWrapper>
            <Toaster richColors position="top-center" />
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
