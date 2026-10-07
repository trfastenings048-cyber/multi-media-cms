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
}

export default function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-full flex-col bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="flex h-16 items-center border-b border-zinc-200 dark:border-zinc-800 px-5">
        <BrandLogo size="sm" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigationItems.map((item) => {
          const isActive = item.matcher(pathname)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-black text-white shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-50"
              )}
            >
              <Icon className="size-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 p-4">
        <a
          href="/XOS.exe"
          download="XOS.exe"
          className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Download className="size-4" />
          <span>Download XOS</span>
        </a>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 p-3">
          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Media workspace</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Manage uploads, documents, and connected displays.
          </p>
        </div>
        <LogoutButton />
      </div>
    </aside>
  )
}
