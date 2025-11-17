import type React from "react"
import type { Metadata } from "next"

import "./globals.css"
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google"

// Initialize fonts
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-sans",
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "스마트 쉼터",
  description: "",
    generator: ''
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${ibmPlexSans.variable} ${jetBrainsMono.variable} font-sans antialiased`}>{children}</body>
    </html>
  )
}
