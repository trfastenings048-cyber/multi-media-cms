"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Download,
  FileText,
  LayoutDashboard,
  Monitor,
  Tv,
} from "lucide-react"

import BrandLogo from "@/components/BrandLogo"
import LogoutButton from "@/components/LogoutButton"
import { cn } from "@/lib/utils"

const navigationItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    matcher: (pathname: string) => pathname.startsWith("/dashboard"),
  },
  {
    label: "Documents",
    href: "/documents",
    icon: FileText,
    matcher: (pathname: string) => pathname === "/" || pathname.startsWith("/documents"),
  },
  {
    label: "Main Screen",
    href: "/main-screen",
    icon: Tv,
    matcher: (pathname: string) => pathname.startsWith("/main-screen"),
  },
  {
    label: "Screens",
    href: "/screens",
    icon: Monitor,
    matcher: (pathname: string) => pathname.startsWith("/screens"),
  },
]

type AppSidebarProps = {
  onNavigate?: () => void
  // Icon-only rail used on tablets.
  compact?: boolean
}

export default function AppSidebar({ onNavigate, compact = false }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-full flex-col bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className={cn("flex h-16 shrink-0 items-center border-b border-zinc-200 dark:border-zinc-800", compact ? "justify-center px-2" : "px-5")}>
        {compact ? <BrandLogo size="sm" className="[&>div:last-child]:hidden" /> : <BrandLogo size="sm" />}
      </div>

      <nav className={cn("flex-1 space-y-1 overflow-y-auto py-4", compact ? "px-2" : "px-3")}>
        {navigationItems.map((item) => {
          const isActive = item.matcher(pathname)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={compact ? item.label : undefined}
              aria-label={item.label}
              className={cn(
                "flex h-11 items-center gap-3 rounded-lg text-sm font-semibold transition-colors lg:h-10",
                compact ? "justify-center px-0" : "px-3",
                isActive
                  ? "bg-black text-white shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-50"
              )}
            >
              <Icon className="size-4" />
              {!compact && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className={cn("space-y-3 border-t border-zinc-200 dark:border-zinc-800 pb-safe", compact ? "p-2" : "p-4")}>
        {/* XOS is a Windows desktop app, so the download is hidden on phones and tablets. */}
        <a
          href="/XOS.exe"
          download="XOS.exe"
          title={compact ? "Download XOS (Windows)" : undefined}
          aria-label="Download XOS"
          className={cn(
            "hidden h-10 w-full items-center rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 lg:flex",
            compact ? "justify-center" : "gap-3 px-3"
          )}
        >
          <Download className="size-4" />
          {!compact && <span>Download XOS</span>}
        </a>
        {!compact && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 p-3">
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Media workspace</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Manage uploads, documents, and connected displays.
            </p>
          </div>
        )}
        <LogoutButton compact={compact} />
      </div>
    </aside>
  )
}
