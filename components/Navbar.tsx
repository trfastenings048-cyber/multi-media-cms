"use client"

import { ThemeToggle } from "@/components/theme-toggle"

type NavbarProps = {
  menuControl?: React.ReactNode
}

export default function Navbar({ menuControl }: NavbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/95 dark:border-zinc-800 dark:bg-zinc-950/95 px-3 pt-safe backdrop-blur sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {menuControl}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-zinc-950 dark:text-zinc-50">TR Fastenings Multimedia</p>
          <p className="hidden truncate text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:block">
            Streaming media management
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="hidden text-xs font-semibold text-zinc-500 dark:text-zinc-400 lg:block">
          Documents and screens
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
