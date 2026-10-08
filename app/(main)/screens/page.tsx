'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, Copy, ExternalLink, Info, Monitor, PlusCircle, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatDate } from '@/components/main-screen/shared'

type AssignedAsset = {
  id: string
  document: {
    id: string
    name: string
    mimeType: string
    sourceType?: 'FILE' | 'WEBSITE'
    websiteUrl?: string | null
  }
}

type Screen = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  assets?: AssignedAsset[]
}

export default function ScreensDashboard() {
  const [screens, setScreens] = useState<Screen[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'NAME'>('NEWEST')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedDetailScreen, setSelectedDetailScreen] = useState<Screen | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)

  const loadScreens = useCallback(async () => {
    try {
      const res = await fetch('/api/screens')
      if (!res.ok) {
        toast.error('Failed to load screens')
        return
      }
      const data = await res.json()
      setScreens(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load screens')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadScreens()
  }, [loadScreens])

  const filteredScreens = screens
    .filter((screen) => screen.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'NEWEST') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortBy === 'OLDEST') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return a.name.localeCompare(b.name)
    })

  const handleAddScreen = async () => {
    setIsCreating(true)
    try {
      const res = await fetch('/api/screens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        toast.error('Failed to create screen')
        return
      }

      const newScreen = await res.json()
      setScreens((prev) => [...prev, newScreen])
      toast.success(`Screen "${newScreen.name}" created successfully`)
    } catch {
      toast.error('Failed to create screen')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteScreen = async (id: string) => {
    try {
      const res = await fetch(`/api/screens/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Failed to delete screen')
        return
      }

      setScreens((prev) => prev.filter((screen) => screen.id !== id))
      setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id))
      toast.success('Screen deleted successfully')
    } catch {
      toast.error('Failed to delete screen')
    } finally {
      setDeleteConfirmId(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    try {
      for (const id of selectedIds) {
        await fetch(`/api/screens/${id}`, { method: 'DELETE' })
      }
      setScreens((prev) => prev.filter((screen) => !selectedIds.includes(screen.id)))
      setSelectedIds([])
      toast.success('Selected screens deleted')
    } catch {
      toast.error('Bulk deletion encountered errors')
    } finally {
      setIsBulkDeleteOpen(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredScreens.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredScreens.map((screen) => screen.id))
    }
  }

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    )
  }

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id)
    toast.success('Screen ID copied to clipboard')
  }

  // Background: white at the top, light sea blue in the middle, dark blue at the bottom.
  return (
    <div className="bg-[linear-gradient(to_top,#0a1f5c_0%,#1d4ed8_22%,#5cc8e0_52%,#d6f4fa_78%,#ffffff_100%)] dark:bg-[linear-gradient(to_top,#020617_0%,#0f172a_50%,#1e293b_100%)] min-h-dvh px-3 py-5 sm:px-5 sm:py-8 lg:px-8 lg:py-10 3xl:px-12 flex flex-col gap-8 antialiased">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sky-100 dark:border-zinc-800 pb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Screens</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Register and monitor display endpoints.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative w-full sm:w-auto">
            <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3 top-3.5 sm:top-2.5" />
            <input
              type="text"
              placeholder="Search screens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 sm:py-2 text-base sm:text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white w-full sm:w-60 transition-all shadow-sm"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0 sm:flex-none rounded-xl px-3 py-2.5 sm:py-2 text-sm sm:text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white cursor-pointer shadow-sm"
          >
            <option value="NEWEST">Newest Created</option>
            <option value="OLDEST">Oldest Created</option>
            <option value="NAME">Screen Name (A-Z)</option>
          </select>

          <Button
            onClick={handleAddScreen}
            disabled={isCreating}
            className="bg-black dark:bg-white hover:bg-zinc-900 dark:hover:bg-zinc-200 text-white dark:text-black font-semibold text-xs h-10 sm:h-auto py-2 px-4 rounded-xl shadow-md cursor-pointer flex flex-1 sm:flex-none items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Add Screen
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:gap-5 shrink-0">
        <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 p-4 rounded-2xl flex flex-col gap-2.5 shadow-lg">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Screens</span>
            <Monitor className="w-4 h-4 text-zinc-500" />
          </div>
          <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 leading-none">{screens.length}</h3>
          <p className="text-[10px] text-zinc-400">Registered displays</p>
        </div>

        <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 p-4 rounded-2xl flex flex-col gap-2.5 shadow-lg">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Recently Added</span>
            <Clock className="w-4 h-4 text-zinc-500" />
          </div>
          <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 leading-none">
            {screens.filter((screen) => Date.now() - new Date(screen.createdAt).getTime() <= 24 * 60 * 60 * 1000).length}
          </h3>
          <p className="text-[10px] text-zinc-400">Created in the last 24 hours</p>
        </div>
      </section>

      {selectedIds.length > 0 && (
        <div className="bg-black text-white px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl flex items-center justify-between shadow-lg shrink-0">
          <span className="text-xs font-semibold">
            {selectedIds.length} screen{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-xs font-semibold rounded-xl transition-all cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" /> Delete Selected
              </button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-zinc-950 rounded-2xl p-6">
              <DialogHeader>
                <DialogTitle>Confirm Bulk Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete these {selectedIds.length} selected screens?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)} className="text-xs">Cancel</Button>
                <Button onClick={handleBulkDelete} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-4 py-2">Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <section className="flex-1 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 rounded-2xl shadow-lg overflow-hidden flex flex-col">
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : filteredScreens.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center mb-4">
              <Monitor className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
            </div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">No screens found</h3>
            <p className="text-xs text-zinc-400 max-w-xs mt-1 leading-relaxed">
              Create a screen to start tracking display endpoints.
            </p>
            <Button onClick={handleAddScreen} className="mt-6 bg-black dark:bg-white hover:bg-zinc-900 dark:hover:bg-zinc-200 text-white dark:text-black font-semibold text-xs py-2 px-5 rounded-xl cursor-pointer">
              Add Screen
            </Button>
          </div>
        ) : (
          <>
          {/* Phone layout: cards instead of a table. */}
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60 md:hidden">
            {filteredScreens.map((screen) => {
              const isSelected = selectedIds.includes(screen.id)
              const assignedAsset = screen.assets?.[0]?.document
              return (
                <li key={screen.id} className={`flex items-start gap-3 p-3 ${isSelected ? 'bg-zinc-50/80 dark:bg-zinc-800/50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectRow(screen.id)}
                    aria-label={`Select ${screen.name}`}
                    className="mt-3 size-4 shrink-0 accent-black cursor-pointer"
                  />
                  <button type="button" onClick={() => setSelectedDetailScreen(screen)} className="min-w-0 flex-1 space-y-1 text-left">
                    <span className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                      <Monitor className="size-4 shrink-0 text-zinc-500" />
                      <span className="truncate">{screen.name}</span>
                    </span>
                    <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {assignedAsset ? assignedAsset.name : 'No asset assigned'}
                    </span>
                    <span className="block text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(screen.createdAt)}</span>
                  </button>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      onClick={() => window.open(`/view/screen/${screen.id}`, '_blank', 'noopener,noreferrer')}
                      className="flex size-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      aria-label={`Open ${screen.name}`}
                    >
                      <ExternalLink className="size-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(screen.id)}
                      className="flex size-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
                      aria-label={`Delete ${screen.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="hidden flex-1 overflow-y-auto md:block">
          <Table>
            <TableHeader className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredScreens.length && filteredScreens.length > 0}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 accent-black rounded cursor-pointer mt-1"
                  />
                </TableHead>
                <TableHead className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest p-4">Screen Name</TableHead>
                <TableHead className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest p-4">Assigned Asset</TableHead>
                <TableHead className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest p-4 hidden lg:table-cell">Created Date</TableHead>
                <TableHead className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest p-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScreens.map((screen) => {
                const isSelected = selectedIds.includes(screen.id)
                const assignedAsset = screen.assets?.[0]?.document
                return (
                  <TableRow key={screen.id} className={`border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors ${isSelected ? 'bg-zinc-50/80 dark:bg-zinc-800/50' : ''}`}>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(screen.id)}
                        className="w-3.5 h-3.5 accent-black rounded cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="p-4 font-semibold text-zinc-800 dark:text-zinc-100 text-xs">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-zinc-500" />
                        <span>{screen.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-4 text-xs">
                      {assignedAsset ? (
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="max-w-[180px] lg:max-w-[260px] 3xl:max-w-md truncate font-semibold text-zinc-800 dark:text-zinc-100" title={assignedAsset.name}>
                            {assignedAsset.name}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                            {assignedAsset.sourceType === 'WEBSITE' || assignedAsset.websiteUrl ? 'Website' : assignedAsset.mimeType}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Nothing</span>
                      )}
                    </TableCell>
                    <TableCell className="p-4 hidden lg:table-cell text-xs text-zinc-500 dark:text-zinc-400">{formatDate(screen.createdAt)}</TableCell>
                    <TableCell className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedDetailScreen(screen)}
                          className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                          aria-label={`View ${screen.name}`}
                          title="Screen info"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.open(`/view/screen/${screen.id}`, '_blank', 'noopener,noreferrer')}
                          className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                          aria-label={`Open ${screen.name}`}
                          title="Open screen URL"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopyId(screen.id)}
                          className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                          aria-label={`Copy ID for ${screen.name}`}
                          title="Copy Screen ID"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(screen.id)}
                          className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-all cursor-pointer"
                          aria-label={`Delete ${screen.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          </div>
          </>
        )}
      </section>

      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="bg-white dark:bg-zinc-950 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this screen? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="text-xs">Cancel</Button>
            <Button
              onClick={() => deleteConfirmId && handleDeleteScreen(deleteConfirmId)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-4 py-2"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={selectedDetailScreen !== null} onOpenChange={(open) => !open && setSelectedDetailScreen(null)}>
        <SheetContent className="w-full sm:max-w-md bg-white dark:bg-zinc-950 p-4 sm:p-6 overflow-y-auto shadow-2xl flex flex-col gap-6">
          {selectedDetailScreen && (
            <>
              <SheetHeader className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <SheetTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-black dark:text-white" />
                  {selectedDetailScreen.name}
                </SheetTitle>
                <SheetDescription className="text-xs text-zinc-400 dark:text-zinc-500">
                  Screen registration details.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-zinc-400 dark:text-zinc-500 font-medium">Created</span>
                  <span className="col-span-2 text-zinc-800 dark:text-zinc-100 font-semibold">{formatDate(selectedDetailScreen.createdAt)}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-zinc-400 dark:text-zinc-500 font-medium">Updated</span>
                  <span className="col-span-2 text-zinc-800 dark:text-zinc-100 font-semibold">{formatDate(selectedDetailScreen.updatedAt)}</span>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
