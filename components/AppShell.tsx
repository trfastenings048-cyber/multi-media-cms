"use client"

import { useState } from "react"
import { Menu } from "lucide-react"

import AppSidebar from "@/components/AppSidebar"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"

// Navigation: drawer on phones, icon rail on tablets, full sidebar on desktops.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 md:flex">
      {/* Tablet rail */}
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:block md:w-[72px] md:border-r md:border-zinc-200 dark:md:border-zinc-800 lg:hidden">
        <AppSidebar compact />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64 lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800">
        <AppSidebar />
      </div>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col md:pl-[72px] lg:pl-64">
        <Navbar
          menuControl={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 md:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
          }
        />

        {/* Phone drawer */}
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-72 max-w-[85vw] gap-0 bg-white p-0 dark:bg-zinc-900 md:hidden"
          >
            <SheetTitle className="sr-only">Main navigation</SheetTitle>
            <SheetDescription className="sr-only">Navigate between dashboard pages</SheetDescription>
            <AppSidebar onNavigate={() => setIsSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}
