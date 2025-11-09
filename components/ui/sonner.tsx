"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        style: {
          background: 'rgba(247, 39, 152, 0.15)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(247, 39, 152, 0.3)',
          color: '#ededed',
          fontFamily: 'var(--font-geist-mono), monospace',
        },
        className: 'toast',
      }}
      {...props}
    />
  )
}

export { Toaster }
