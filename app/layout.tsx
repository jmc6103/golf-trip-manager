import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Golf Trip Manager',
  description: 'Create private golf trip scoring sites for groups, teams, and outings.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
