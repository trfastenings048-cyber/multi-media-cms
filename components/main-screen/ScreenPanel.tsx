'use client'

import { useEffect, useState } from 'react'
import type { DragEvent } from 'react'
import { ExternalLink, FileText, Globe2, Monitor, Plus, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { FileIcon, iconBg } from './shared'
import { PreviewSkeleton, ScreenGridSkeleton } from './skeletons'
import {
  ASSIGN_REQUEST_EVENT,
  TOUCH_DROP_EVENT,
  TOUCH_HOVER_EVENT,
  type TouchDropDetail,
  type TouchHoverDetail,
} from './touch-drag'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type DocumentAsset = {
  id: string
  name: string
  size: number
  mimeType: string
  s3Url?: string | null
  cloudinaryUrl?: string | null
  websiteUrl?: string | null
  sourceType?: 'FILE' | 'WEBSITE'
  status: string
  createdAt?: string
}

type ScreenAsset = {
  id: string
  screenId: string
  documentId: string
  position: number
  document: DocumentAsset
}

type Screen = {
  id: string
  name: string
  createdAt: string
  assets?: ScreenAsset[]
}

function getAssetUrl(document: DocumentAsset) {
  return document.websiteUrl || document.s3Url || document.cloudinaryUrl || ''
}

function AssetPreview({ document }: { document: DocumentAsset }) {
  const url = getAssetUrl(document)
  // Errors count as "loaded" too, so a broken asset doesn't shimmer forever.
  const [loaded, setLoaded] = useState(false)
  const markLoaded = () => setLoaded(true)

  if (document.mimeType.startsWith('image/') && url) {
    return (
      <div className="relative h-full w-full">
        <img src={url} alt={document.name} onLoad={markLoaded} onError={markLoaded} className="h-full w-full object-cover" />
        {!loaded && <PreviewSkeleton />}
      </div>
    )
  }

  if (document.mimeType.startsWith('video/') && url) {
    return (
      <div className="relative h-full w-full">
        <video
          src={url}
          onLoadedData={markLoaded}
          onError={markLoaded}
          className="pointer-events-none h-full w-full object-cover"
          preload="metadata"
          muted
        />
        {!loaded && <PreviewSkeleton />}
      </div>
    )
  }

  if (document.sourceType === 'WEBSITE' || document.websiteUrl) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-white dark:bg-zinc-950">
        {/* Shown underneath in case the site refuses to be framed. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800">
            <Globe2 className="size-6 text-zinc-700 dark:text-zinc-300" />
          </div>
          <p className="line-clamp-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{document.name}</p>
        </div>
        {/* Render at 4x size and scale down so the card shows a desktop-width thumbnail.
            pointer-events-none keeps drag events on the card instead of the iframe. */}
        <iframe
          src={url}
          title={document.name}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          tabIndex={-1}
          onLoad={markLoaded}
          className="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-25 border-0"
        />
        {!loaded && <PreviewSkeleton />}
      </div>
    )
  }

  if (document.mimeType === 'application/pdf') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-red-50 p-4 text-center">
        <FileText className="size-10 text-red-500" />
        <p className="line-clamp-2 text-xs font-semibold text-red-700">{document.name}</p>
      </div>
    )
  }

  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center ${iconBg(document.mimeType)}`}>
      <FileIcon mimeType={document.mimeType} className="size-10" />
      <p className="line-clamp-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{document.name}</p>
    </div>
  )
}

// Pulls an http(s) URL out of a drop from another tab, the address bar or a dragged image.
function extractUrl(dataTransfer: DataTransfer) {
  const uriList = dataTransfer.getData('text/uri-list')
  const fromUriList = uriList.split('\n').map((line) => line.trim()).find((line) => line && !line.startsWith('#'))
  const fromHtml = dataTransfer.getData('text/html').match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]
  const candidate = (fromUriList || fromHtml || dataTransfer.getData('text/plain')).trim()

  try {
    const url = new URL(candidate)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

export default function ScreenPanel() {
  const [screens, setScreens] = useState<Screen[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  // Touch-friendly alternatives to dragging.
  const [pickDocument, setPickDocument] = useState<DocumentAsset | null>(null)
  const [addTargetId, setAddTargetId] = useState<string | null>(null)
  const [linkValue, setLinkValue] = useState('')

  useEffect(() => {
    fetch('/api/screens')
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setScreens(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Failed to load screens'))
      .finally(() => setLoading(false))
  }, [])

  async function addScreen() {
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
      setScreens((prev) => [...prev, { ...newScreen, assets: [] }])
      toast.success(`Screen "${newScreen.name}" created`)
    } catch {
      toast.error('Failed to create screen')
    } finally {
      setIsCreating(false)
    }
  }

  async function removeScreen(id: string) {
    try {
      const res = await fetch(`/api/screens/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Failed to remove screen')
        return
      }

      setScreens((prev) => prev.filter((screen) => screen.id !== id))
      toast.success('Screen removed')
    } catch {
      toast.error('Failed to remove screen')
    }
  }

  async function removeAsset(screenId: string, assetId: string) {
    try {
      const res = await fetch(`/api/screens/${screenId}/assets/${assetId}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Failed to remove asset')
        return
      }

      setScreens((prev) => prev.map((screen) => (
        screen.id === screenId
          ? { ...screen, assets: (screen.assets || []).filter((asset) => asset.id !== assetId) }
          : screen
      )))
      toast.success('Asset removed from screen')
    } catch {
      toast.error('Failed to remove asset')
    }
  }

  async function assignAsset(screenId: string, document: DocumentAsset) {
    setAssigningId(screenId)
    try {
      const res = await fetch(`/api/screens/${screenId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || 'Failed to assign asset')
        return
      }

      const asset = await res.json()
      setScreens((prev) => prev.map((screen) => {
        if (screen.id !== screenId) return screen
        return { ...screen, assets: [asset] }
      }))
      toast.success(`Assigned "${document.name}" to screen`)
    } catch {
      toast.error('Failed to assign asset')
    } finally {
      setAssigningId(null)
      setDragOverId(null)
    }
  }

  // Uploads a file dropped from the computer, then assigns it.
  async function assignFile(screenId: string, file: File) {
    setAssigningId(screenId)
    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const folder = "rubenius/documents";
      const signRes = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: { timestamp, folder } })
      });
      if (!signRes.ok) throw new Error("Failed to get signature");
      const { signature, apiKey, cloudName } = await signRes.json();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", apiKey);
      formData.append("timestamp", timestamp.toString());
      formData.append("signature", signature);
      formData.append("folder", folder);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: "POST",
        body: formData
      });
      if (!uploadRes.ok) throw new Error("Cloudinary upload failed");
      const res = await uploadRes.json();

      const uploadedFiles = [{
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        url: res.secure_url,
        publicId: res.public_id,
      }];

      const saveRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: uploadedFiles })
      });
      
      const data = await saveRes.json().catch(() => null)
      const document = data?.documents?.[0] as DocumentAsset | undefined
      if (!saveRes.ok || !document) {
        toast.error(data?.error || `Failed to upload "${file.name}"`)
        return
      }
      window.dispatchEvent(new Event('documents:changed'))
      await assignAsset(screenId, document)
    } catch {
      toast.error(`Failed to upload "${file.name}"`)
    } finally {
      setAssigningId(null)
      setDragOverId(null)
    }
  }

  // Saves a link (website, or an image/video URL dragged from a browser) as a document, then assigns it.
  async function assignLink(screenId: string, url: string) {
    setAssigningId(screenId)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.id) {
        toast.error(data?.error || 'Failed to save link')
        return
      }
      window.dispatchEvent(new Event('documents:changed'))
      await assignAsset(screenId, data as DocumentAsset)
    } catch {
      toast.error('Failed to save link')
    } finally {
      setAssigningId(null)
      setDragOverId(null)
    }
  }

  // Touch/pen drags (see touch-drag.ts) and the "Assign to screen" button arrive as window events.
  useEffect(() => {
    const onHover = (event: Event) => {
      setDragOverId((event as CustomEvent<TouchHoverDetail>).detail.screenId)
    }
    const onDrop = (event: Event) => {
      const { screenId, payload } = (event as CustomEvent<TouchDropDetail<DocumentAsset>>).detail
      if (payload?.id) assignAsset(screenId, payload)
    }
    const onAssignRequest = (event: Event) => {
      setPickDocument((event as CustomEvent<{ document: DocumentAsset }>).detail.document)
    }

    window.addEventListener(TOUCH_HOVER_EVENT, onHover)
    window.addEventListener(TOUCH_DROP_EVENT, onDrop)
    window.addEventListener(ASSIGN_REQUEST_EVENT, onAssignRequest)
    return () => {
      window.removeEventListener(TOUCH_HOVER_EVENT, onHover)
      window.removeEventListener(TOUCH_DROP_EVENT, onDrop)
      window.removeEventListener(ASSIGN_REQUEST_EVENT, onAssignRequest)
    }
  }, [])

  async function submitLink() {
    const target = addTargetId
    const value = linkValue.trim()
    if (!target || !value) return
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
      setAddTargetId(null)
      setLinkValue('')
      await assignLink(target, url.toString())
    } catch {
      toast.error('Enter a valid link')
    }
  }

  function handleFilePicked(file: File | undefined) {
    const target = addTargetId
    if (!file || !target) return
    setAddTargetId(null)
    assignFile(target, file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, screenId: string) {
    event.preventDefault()
    const { dataTransfer } = event

    // 1. A document dragged from the Documents panel.
    const payload = dataTransfer.getData('application/json')
    if (payload) {
      try {
        const document = JSON.parse(payload) as DocumentAsset
        if (!document.id) throw new Error('Missing document id')
        assignAsset(screenId, document)
      } catch {
        toast.error('Could not read dragged asset')
        setDragOverId(null)
      }
      return
    }

    // 2. A file (photo, video, PDF…) dragged from the computer. One asset per screen.
    const file = dataTransfer.files[0]
    if (file) {
      if (dataTransfer.files.length > 1) toast.info('A screen shows one asset — using the first file')
      assignFile(screenId, file)
      return
    }

    // 3. A link or image dragged from a browser tab or address bar.
    const url = extractUrl(dataTransfer)
    if (url) {
      assignLink(screenId, url)
      return
    }

    toast.error('Drop a document, file, photo or link')
    setDragOverId(null)
  }

  return (
    <section className="order-1 flex h-[44%] min-h-[240px] shrink-0 flex-col md:order-2 md:h-auto md:min-h-0 md:min-w-0 md:flex-1 rounded-2xl bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-lg shadow-blue-950/10 dark:shadow-black/40 flex flex-col overflow-hidden">
      <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-100 dark:border-zinc-800 shrink-0 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 tracking-widest uppercase">
          Screens
        </h2>
        <button
          onClick={addScreen}
          disabled={isCreating}
          className="flex items-center gap-1.5 text-xs font-semibold text-white dark:text-black bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 px-3 py-2 md:py-1.5 rounded-lg cursor-pointer transition-colors"
        >
          <Plus className="size-3.5" />
          Add Screen
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5" data-autoscroll>
        {loading ? (
          <ScreenGridSkeleton />
        ) : screens.length === 0 ? (
          <div className="h-full min-h-64 flex flex-col items-center justify-center text-center text-gray-400 dark:text-zinc-500 gap-3">
            <Monitor className="size-10" />
            <p className="text-sm font-medium">No screens registered.</p>
            <p className="text-xs">Add a screen to track display endpoints.</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto snap-x pb-2 md:grid md:grid-cols-1 md:overflow-visible md:pb-0 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 md:gap-4 lg:gap-5" data-autoscroll>
            {screens.map((screen) => {
              const assets = screen.assets || []
              const latestAsset = assets[0]
              const isActiveDrop = dragOverId === screen.id

              return (
                <div
                  key={screen.id}
                  data-drop-screen={screen.id}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'copy'
                    setDragOverId(screen.id)
                  }}
                  onDragLeave={(event) => {
                    // Ignore leave events fired when moving between the card's own children.
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverId(null)
                  }}
                  onDrop={(event) => handleDrop(event, screen.id)}
                  className={`group relative aspect-square w-48 shrink-0 snap-start overflow-hidden sm:w-52 md:w-auto rounded-2xl border bg-zinc-50 dark:bg-zinc-900 transition-all ${
                    isActiveDrop
                      ? 'border-black dark:border-white ring-4 ring-black/10 dark:ring-white/10'
                      : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-sm'
                  }`}
                >
                  <div className="absolute inset-0">
                    {latestAsset ? (
                      <AssetPreview key={latestAsset.id + latestAsset.documentId} document={latestAsset.document} />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-gray-400 dark:text-zinc-500">
                        <Monitor className="size-12" />
                        <p className="text-xs font-medium">Drag a document here, or tap + to add</p>
                      </div>
                    )}
                  </div>

                  <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 max-sm:flex-col-reverse max-sm:items-stretch bg-gradient-to-b from-white/95 dark:from-zinc-900/95 to-white/0 dark:to-zinc-900/0 p-2.5 sm:p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-zinc-950 dark:text-zinc-100">{screen.name}</p>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {latestAsset ? '1 asset assigned' : 'No asset assigned'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1 max-sm:justify-end">
                      <button
                        onClick={() => setAddTargetId(screen.id)}
                        className="flex size-9 md:size-8 items-center justify-center rounded-lg bg-white/90 dark:bg-zinc-800/90 text-zinc-500 dark:text-zinc-400 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700 transition hover:text-black dark:hover:text-white"
                        aria-label={`Add a file or link to ${screen.name}`}
                        title="Add file or link"
                      >
                        <Plus className="size-4" />
                      </button>
                      <button
                        onClick={() => window.open(`/view/screen/${screen.id}`, '_blank', 'noopener,noreferrer')}
                        className="flex size-9 md:size-8 items-center justify-center rounded-lg bg-white/90 dark:bg-zinc-800/90 text-zinc-500 dark:text-zinc-400 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700 transition hover:text-black dark:hover:text-white"
                        aria-label={`Open ${screen.name}`}
                        title="Open screen URL"
                      >
                        <ExternalLink className="size-4" />
                      </button>
                      <button
                        onClick={() => removeScreen(screen.id)}
                        className="flex size-9 md:size-8 items-center justify-center rounded-lg bg-white/90 dark:bg-zinc-800/90 text-zinc-400 dark:text-zinc-500 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700 transition hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-600 dark:hover:text-rose-400"
                        aria-label={`Remove ${screen.name}`}
                        title="Remove screen"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {isActiveDrop ? (
                    <div className="absolute inset-3 flex items-center justify-center rounded-xl border-2 border-dashed border-black dark:border-white bg-white/80 dark:bg-zinc-900/80 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Drop to assign
                    </div>
                  ) : null}

                  {assigningId === screen.id ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-zinc-900/80 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Saving...
                    </div>
                  ) : null}

                  {latestAsset ? (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-black/0 p-2.5 pt-10 sm:p-4 sm:pt-12">
                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white">{latestAsset.document.name}</p>
                          <p className="mt-0.5 text-[10px] font-medium uppercase text-white/60">
                            {latestAsset.document.mimeType === 'text/uri-list' ? 'Website' : latestAsset.document.mimeType}
                          </p>
                        </div>
                        <button
                          onClick={() => removeAsset(screen.id, latestAsset.id)}
                          className="flex size-8 md:size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
                          aria-label={`Remove ${latestAsset.document.name}`}
                          title="Remove assigned asset"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* "Assign to screen" picker for a document chosen in the Documents panel. */}
      <Sheet open={pickDocument !== null} onOpenChange={(open) => !open && setPickDocument(null)}>
        <SheetContent side="bottom" className="mx-auto gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="p-4 pr-12">
            <SheetTitle className="truncate">Assign to screen</SheetTitle>
            <SheetDescription className="truncate">{pickDocument?.name}</SheetDescription>
          </SheetHeader>
          <div className="max-h-[50dvh] space-y-2 overflow-y-auto px-4 pb-4">
            {screens.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">No screens yet. Add a screen first.</p>
            ) : (
              screens.map((screen) => (
                <button
                  key={screen.id}
                  onClick={() => {
                    if (pickDocument) assignAsset(screen.id, pickDocument)
                    setPickDocument(null)
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-zinc-200 px-4 text-left text-sm font-semibold transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <Monitor className="size-4 shrink-0 text-zinc-500" />
                  <span className="min-w-0 flex-1 truncate">{screen.name}</span>
                  <span className="shrink-0 text-xs font-medium text-zinc-400">
                    {screen.assets?.[0] ? 'Replace asset' : 'Empty'}
                  </span>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Add a file from the device or a link to one screen (no dragging needed). */}
      <Sheet open={addTargetId !== null} onOpenChange={(open) => !open && setAddTargetId(null)}>
        <SheetContent side="bottom" className="mx-auto gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="p-4 pr-12">
            <SheetTitle>Add to {screens.find((screen) => screen.id === addTargetId)?.name ?? 'screen'}</SheetTitle>
            <SheetDescription>Upload a photo, video or file, or paste a link.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4">
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white dark:bg-white dark:text-black">
              <Upload className="size-4" />
              Choose from device
              <input
                type="file"
                className="sr-only"
                onChange={(event) => {
                  handleFilePicked(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                submitLink()
              }}
              className="flex gap-2"
            >
              <input
                type="url"
                inputMode="url"
                value={linkValue}
                onChange={(event) => setLinkValue(event.target.value)}
                placeholder="https://example.com"
                className="h-12 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
              />
              <button
                type="submit"
                disabled={!linkValue.trim()}
                className="h-12 rounded-xl border border-zinc-200 px-4 text-sm font-semibold disabled:opacity-50 dark:border-zinc-800"
              >
                Add link
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
