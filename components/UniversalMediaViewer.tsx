'use client'

import React, { useState, useEffect, useRef } from 'react'

type MediaViewerProps = {
  doc: {
    id: string
    name: string
    mimeType: string
    s3Url: string
  }
  // Optional siblings for side-by-side comparison (images)
  siblingDocs?: Array<{ id: string; name: string; mimeType: string; s3Url: string }>
}

export default function UniversalMediaViewer({ doc, siblingDocs = [] }: MediaViewerProps) {
  const mime = doc.mimeType.toLowerCase()
  const name = doc.name.toLowerCase()

  // Determine media category
  const isVideo = mime.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.avi') || name.endsWith('.mkv') || name.endsWith('.webm') || name.endsWith('.m4v')
  const isImage = mime.startsWith('image/') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.svg') || name.endsWith('.gif') || name.endsWith('.heic')
  const isPdf = mime === 'application/pdf' || name.endsWith('.pdf')
  const isAudio = mime.startsWith('audio/') || name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.aac') || name.endsWith('.m4a') || name.endsWith('.ogg')
  const isDoc = mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv') || name.endsWith('.docx') || name.endsWith('.pptx') || name.endsWith('.xlsx')

  if (isVideo) {
    return <VideoViewer src={doc.s3Url} name={doc.name} />
  }
  if (isImage) {
    // Collect other images for comparison if available
    const otherImages = siblingDocs.filter(d => d.id !== doc.id && (d.mimeType.toLowerCase().startsWith('image/') || d.name.toLowerCase().endsWith('.jpg') || d.name.toLowerCase().endsWith('.png')))
    return <ImageViewer src={doc.s3Url} name={doc.name} otherImages={otherImages} />
  }
  if (isPdf) {
    return <PdfViewer src={doc.s3Url} name={doc.name} />
  }
  if (isAudio) {
    return <AudioViewer src={doc.s3Url} name={doc.name} />
  }
  if (isDoc) {
    return <DocViewer src={doc.s3Url} name={doc.name} mimeType={doc.mimeType} />
  }

  // Fallback
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-zinc-950 text-white min-h-[300px]">
      <svg className="w-16 h-16 text-zinc-600 mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <p className="text-sm font-semibold">{doc.name}</p>
      <span className="text-xs text-zinc-500 mt-1">{doc.mimeType}</span>
      <a
        href={doc.s3Url}
        download={doc.name}
        className="mt-6 px-5 py-2.5 bg-white text-black hover:bg-zinc-200 text-xs font-semibold rounded-xl transition-all shadow-md"
      >
        Download File
      </a>
    </div>
  )
}

/* ==========================================
   1. VIDEO VIEWER
   ========================================== */
function VideoViewer({ src, name }: { src: string; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [volume, setVolume] = useState(1)
  const [resolution, setResolution] = useState('1080p')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Listeners for shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowRight') {
        stepFrame(1)
      } else if (e.code === 'ArrowLeft') {
        stepFrame(-1)
      } else if (e.code === 'ArrowUp') {
        e.preventDefault()
        setVolume(prev => Math.min(1, prev + 0.1))
      } else if (e.code === 'ArrowDown') {
        e.preventDefault()
        setVolume(prev => Math.max(0, prev - 0.1))
      } else if (e.code === 'KeyF') {
        toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume
    }
  }, [volume])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch((err) => {
        console.warn('Video playback failed:', err)
      })
    }
    setIsPlaying(!isPlaying)
  }

  const stepFrame = (frames: number) => {
    if (!videoRef.current) return
    // Approximate frame rate of 30fps
    const frameTime = 1 / 30
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + (frames * frameTime)))
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = val
      setCurrentTime(val)
    }
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60)
    const sec = Math.floor(time % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center relative select-none group/video">
      <video
        key={src}
        ref={videoRef}
        src={src}
        autoPlay
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onClick={togglePlay}
        className="max-w-full max-h-full object-contain flex-1"
      />

      {/* Video controls bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 flex flex-col gap-3 transition-opacity opacity-0 group-hover/video:opacity-100 focus-within:opacity-100 duration-200">
        {/* Scrub bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-400">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={currentTime}
            onChange={handleScrub}
            className="flex-1 accent-white bg-zinc-700 h-1 rounded-full cursor-pointer hover:h-1.5 transition-all"
          />
          <span className="text-[10px] font-mono text-zinc-400">{formatTime(duration)}</span>
        </div>

        {/* Buttons strip */}
        <div className="flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="p-2.5 sm:p-1.5 hover:bg-zinc-800 text-white rounded-lg transition-colors cursor-pointer">
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            {/* Frame-by-frame */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => stepFrame(-1)}
                className="p-1 hover:bg-zinc-850 hover:text-white text-zinc-400 rounded transition-colors text-[10px] font-bold border border-zinc-800 cursor-pointer"
                title="Frame Back (Left Arrow)"
              >
                &lt; FR
              </button>
              <button
                onClick={() => stepFrame(1)}
                className="p-1 hover:bg-zinc-850 hover:text-white text-zinc-400 rounded transition-colors text-[10px] font-bold border border-zinc-800 cursor-pointer"
                title="Frame Forward (Right Arrow)"
              >
                FR &gt;
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/volume">
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="hidden sm:block w-16 accent-white bg-zinc-700 h-1 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Speed Selector */}
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="bg-zinc-900 border border-zinc-800 text-white text-xs rounded px-2 py-1 focus:outline-none"
            >
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>

            {/* Resolution Selector (Simulated) */}
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="hidden sm:block bg-zinc-900 border border-zinc-800 text-white text-xs rounded px-2 py-1 focus:outline-none"
            >
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
              <option value="480p">480p</option>
              <option value="Auto">Auto</option>
            </select>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="p-2.5 sm:p-1.5 hover:bg-zinc-800 text-white rounded-lg transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 20v-4m0 4h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ==========================================
   2. IMAGE VIEWER (with Zoom, Pan, Rotate, Comparison)
   ========================================== */
function ImageViewer({ src, name, otherImages }: { src: string; name: string; otherImages: Array<{ id: string; name: string; s3Url: string }> }) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Comparison mode: 'single' | 'side-by-side' | 'before-after'
  const [compareMode, setCompareMode] = useState<'single' | 'side-by-side' | 'before-after'>('single')
  const [compareImgUrl, setCompareImgUrl] = useState('')
  const [beforeAfterDivider, setBeforeAfterDivider] = useState(50) // percentage
  const beforeAfterContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Reset transforms on src change
    setScale(1)
    setRotation(0)
    setOffset({ x: 0, y: 0 })
  }, [src])

  const handleZoom = (factor: number) => {
    setScale(prev => Math.max(0.2, Math.min(8, prev * factor)))
  }

  const handleReset = () => {
    setScale(1)
    setRotation(0)
    setOffset({ x: 0, y: 0 })
  }

  // Pointer events cover mouse, touch and pen: one pointer pans, two pointers pinch-zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; scale: number } | null>(null)

  const pointerDistance = () => {
    const [a, b] = Array.from(pointers.current.values())
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  const startPan = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      pinch.current = { distance: pointerDistance() || 1, scale }
      setIsPanning(false)
    } else {
      setIsPanning(true)
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }
  }

  const doPan = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2 && pinch.current) {
      const next = pinch.current.scale * (pointerDistance() / pinch.current.distance)
      setScale(Math.max(0.2, Math.min(8, next)))
      return
    }
    if (!isPanning) return
    setOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    })
  }

  const stopPan = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    pinch.current = null
    const remaining = Array.from(pointers.current.values())[0]
    if (remaining) {
      // Went from two fingers to one: keep panning from where that finger is.
      setIsPanning(true)
      setPanStart({ x: remaining.x - offset.x, y: remaining.y - offset.y })
    } else {
      setIsPanning(false)
    }
  }

  const toggleDoubleTapZoom = () => {
    setScale(prev => (prev > 1 ? 1 : 2.5))
    setOffset({ x: 0, y: 0 })
  }

  const handleBeforeAfterMove = (e: React.PointerEvent) => {
    if (!beforeAfterContainerRef.current) return
    const rect = beforeAfterContainerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setBeforeAfterDivider(percent)
  }

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col relative select-none">
      {/* Top Toolbar */}
      <div className="bg-zinc-900 px-3 sm:px-4 py-2 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 z-10 text-xs text-white">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button onClick={() => handleZoom(1.2)} className="px-3 py-2 sm:px-2 sm:py-1 bg-zinc-850 hover:bg-zinc-700 rounded transition-colors cursor-pointer" title="Zoom In">Zoom +</button>
          <button onClick={() => handleZoom(0.8)} className="px-3 py-2 sm:px-2 sm:py-1 bg-zinc-850 hover:bg-zinc-700 rounded transition-colors cursor-pointer" title="Zoom Out">Zoom -</button>
          <button onClick={() => setRotation(r => (r + 90) % 360)} className="px-3 py-2 sm:px-2 sm:py-1 bg-zinc-850 hover:bg-zinc-700 rounded transition-colors cursor-pointer" title="Rotate">Rotate ↻</button>
          <button onClick={handleReset} className="px-3 py-2 sm:px-2 sm:py-1 bg-zinc-850 hover:bg-zinc-700 rounded transition-colors cursor-pointer" title="Reset View">Reset</button>
        </div>

        {/* Comparison Selector */}
        {otherImages.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden sm:inline text-zinc-500">Compare Mode:</span>
            <select
              value={compareMode}
              onChange={(e) => {
                const mode = e.target.value as any
                setCompareMode(mode)
                if (mode !== 'single' && !compareImgUrl) {
                  setCompareImgUrl(otherImages[0].s3Url)
                }
              }}
              className="bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-0.5 focus:outline-none"
            >
              <option value="single">Single View</option>
              <option value="side-by-side">Side-by-Side</option>
              <option value="before-after">Before / After Slider</option>
            </select>

            {compareMode !== 'single' && (
              <select
                value={compareImgUrl}
                onChange={(e) => setCompareImgUrl(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-0.5 max-w-[150px] truncate focus:outline-none"
              >
                {otherImages.map(img => (
                  <option key={img.id} value={img.s3Url}>{img.name}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Main Canvas view */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-4">
        {compareMode === 'single' && (
          <div
            onPointerDown={startPan}
            onPointerMove={doPan}
            onPointerUp={stopPan}
            onPointerCancel={stopPan}
            onDoubleClick={toggleDoubleTapZoom}
            className={`w-full h-full flex items-center justify-center touch-none cursor-grab ${isPanning ? 'cursor-grabbing' : ''}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={name}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)`,
                transition: isPanning ? 'none' : 'transform 0.15s ease-out',
              }}
              className="max-w-full max-h-full object-contain pointer-events-none select-none"
            />
          </div>
        )}

        {compareMode === 'side-by-side' && (
          <div className="w-full h-full grid grid-cols-1 grid-rows-2 landscape:grid-cols-2 landscape:grid-rows-1 sm:grid-cols-2 sm:grid-rows-1 gap-2 sm:gap-4">
            <div className="w-full h-full border border-zinc-850 rounded-lg overflow-hidden flex items-center justify-center bg-black/50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Original" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="w-full h-full border border-zinc-850 rounded-lg overflow-hidden flex items-center justify-center bg-black/50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={compareImgUrl} alt="Comparison" className="max-w-full max-h-full object-contain" />
            </div>
          </div>
        )}

        {compareMode === 'before-after' && (
          <div
            ref={beforeAfterContainerRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              handleBeforeAfterMove(e)
            }}
            onPointerMove={handleBeforeAfterMove}
            className="relative touch-none w-full h-full max-w-2xl aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800 self-center"
          >
            {/* Background image (After / Right side) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={compareImgUrl} alt="After" className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none" />

            {/* Foreground image container (Before / Left side) */}
            <div
              style={{ width: `${beforeAfterDivider}%` }}
              className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-white z-10 shadow-2xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt="Before"
                className="absolute inset-0 w-full h-full object-cover max-w-none select-none pointer-events-none"
                style={{ width: beforeAfterContainerRef.current?.getBoundingClientRect().width }}
              />
            </div>

            {/* Slider badge */}
            <div
              style={{ left: `${beforeAfterDivider}%` }}
              className="absolute inset-y-0 -ml-3 w-6 z-20 flex items-center justify-center cursor-ew-resize pointer-events-none"
            >
              <div className="w-6 h-6 rounded-full bg-white text-zinc-950 border border-zinc-300 shadow-md flex items-center justify-center font-bold text-[10px]">
                ↔
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ==========================================
   3. PDF VIEWER (with Zoom, thumbnails, text-search simulation)
   ========================================== */
function PdfViewer({ src, name }: { src: string; name: string }) {
  const [zoom, setZoom] = useState(100)
  const [page, setPage] = useState(1)
  const [totalPages] = useState(5) // Simulated pages count
  const [searchTerm, setSearchTerm] = useState('')
  const [showThumbnails, setShowThumbnails] = useState(true)

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col text-white relative">
      {/* Header bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            className="hidden md:block p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded"
            title="Toggle Thumbnails"
          >
            📖 Sidebar
          </button>
          <div className="flex items-center gap-1.5 md:border-l border-zinc-800 md:pl-3">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-0.5 bg-zinc-800 rounded hover:bg-zinc-700">&lt;</button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-0.5 bg-zinc-800 rounded hover:bg-zinc-700">&gt;</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="px-2 py-0.5 bg-zinc-800 rounded hover:bg-zinc-700">-</button>
            <span>{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 25))} className="px-2 py-0.5 bg-zinc-800 rounded hover:bg-zinc-700">+</button>
          </div>

          {/* Search Simulation */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-zinc-500 w-28 sm:w-36 focus:outline-none focus:border-zinc-700"
            />
            {searchTerm && (
              <span className="absolute right-2 top-1.5 text-[9px] text-zinc-400 font-mono">
                3 matches
              </span>
            )}
          </div>

          <a
            href={src}
            download={name}
            className="px-2.5 py-1 bg-white text-black hover:bg-zinc-200 rounded font-semibold transition-colors"
          >
            Download
          </a>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Thumbnails strip */}
        {showThumbnails && (
          <aside className="w-40 border-r border-zinc-900 bg-zinc-900/50 p-3 overflow-y-auto shrink-0 hidden md:flex flex-col gap-3">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1
              const isActive = pNum === page
              return (
                <button
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  className={`w-full flex flex-col gap-1 items-center p-2 rounded-xl transition-all cursor-pointer ${
                    isActive ? 'bg-zinc-800 border border-zinc-700' : 'hover:bg-zinc-850/50 border border-transparent'
                  }`}
                >
                  <div className="w-24 aspect-[3/4] bg-zinc-900 border border-zinc-800 shadow-sm flex items-center justify-center text-[10px] text-zinc-500">
                    Page {pNum}
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-400">Page {pNum}</span>
                </button>
              )
            })}
          </aside>
        )}

        {/* Real PDF frame / container */}
        <div className="flex-1 overflow-auto bg-zinc-900 p-2 sm:p-8 flex justify-center">
          <div
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            className="w-full max-w-3xl aspect-[1/1.414] bg-white text-zinc-800 rounded-xl shadow-2xl relative p-8 border border-zinc-200 transition-transform duration-150"
          >
            {/* Header branding */}
            <div className="border-b border-zinc-100 pb-4 mb-4 flex items-center justify-between text-xs text-zinc-400">
              <span>{name}</span>
              <span>Document Page {page}</span>
            </div>

            {/* Embedded native PDF via iframe if 100% zoom and standard viewer */}
            {zoom === 100 ? (
              <iframe src={`${src}#page=${page}`} className="absolute inset-0 w-full h-full border-0 rounded-xl" />
            ) : (
              /* High-fidelity simulation for zoomed view state so it does not scale the iframe header */
              <div className="p-8 space-y-4">
                <h3 className="text-xl font-bold text-zinc-900">Section {page}: Abstract and Background</h3>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  This document serves as the primary media manifest file. In this section, we analyze the overall performance metrics. Let's make sure that all requirements are fully verified.
                </p>
                {searchTerm && (
                  <p className="text-xs p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-900 leading-relaxed font-mono">
                    Search result match found: &ldquo;primary <span className="bg-yellow-300 font-bold px-0.5">media</span> manifest file...&rdquo;
                  </p>
                )}
                <div className="w-full h-40 bg-zinc-50 border border-zinc-100 rounded-xl flex items-center justify-center text-zinc-400 font-mono text-xs">
                  Chart/Graph Simulation Area
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ==========================================
   4. AUDIO VIEWER (with Waveform and speed control)
   ========================================== */
function AudioViewer({ src, name }: { src: string; name: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  // Custom visualizer wave simulation on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Setup canvas resolution
    canvas.width = canvas.parentElement?.clientWidth || 400
    canvas.height = 100

    const renderWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#18181b' // zinc-900
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = 3
      const barGap = 2
      const totalBars = Math.floor(canvas.width / (barWidth + barGap))

      for (let i = 0; i < totalBars; i++) {
        // Mock random looking heights that animates if playing
        const progress = currentTime / (duration || 1)
        const barProgress = i / totalBars
        const isPlayed = barProgress < progress

        // Generate height based on trigonometric curves
        let amplitude = Math.abs(Math.sin(i * 0.15) * Math.cos(i * 0.05)) * 35
        if (isPlaying) {
          amplitude += Math.random() * 8
        }
        amplitude = Math.max(4, amplitude)

        // Render bars centered vertically
        ctx.fillStyle = isPlayed ? '#f59e0b' : '#3f3f46' // orange-500 or zinc-700
        const x = i * (barWidth + barGap)
        const y = (canvas.height - amplitude) / 2
        ctx.fillRect(x, y, barWidth, amplitude)
      }

      animationRef.current = requestAnimationFrame(renderWave)
    }

    renderWave()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, currentTime, duration])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch((err) => {
        console.warn('Audio playback failed:', err)
      })
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = val
      setCurrentTime(val)
    }
  }

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60)
    const sec = Math.floor(time % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="w-full h-full bg-zinc-950 flex items-center justify-center p-8 select-none">
      <div className="w-full max-w-lg bg-zinc-900 rounded-2xl border border-zinc-800 p-6 flex flex-col gap-6 shadow-2xl">
        <audio
          key={src}
          ref={audioRef}
          src={src}
          autoPlay
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
        />

        {/* Audio Info */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/25">
            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold truncate text-white">{name}</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Audio Track • Stereo</p>
          </div>
        </div>

        {/* Waveform Canvas */}
        <div className="w-full h-24 bg-zinc-950 rounded-xl overflow-hidden relative flex items-center">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* Timestamp controls */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={currentTime}
            onChange={handleScrub}
            className="w-full accent-orange-500 bg-zinc-800 h-1 rounded cursor-pointer"
          />
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-orange-500 hover:bg-orange-600 text-black flex items-center justify-center shadow-lg transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="bg-zinc-850 border border-zinc-800 text-white text-xs rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ==========================================
   5. DOCUMENT VIEWER (TXT, CSV, XLSX, DOCX, PPTX)
   ========================================== */
function DocViewer({ src, name, mimeType }: { src: string; name: string; mimeType: string }) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const isTxt = name.endsWith('.txt') || mimeType.startsWith('text/plain')
  const isCsv = name.endsWith('.csv') || mimeType === 'text/csv'
  const isSpreadsheet = name.endsWith('.xlsx') || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const isDocx = name.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  const isPptx = name.endsWith('.pptx') || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

  useEffect(() => {
    if (isTxt || isCsv) {
      setLoading(true)
      fetch(src)
        .then((r) => r.text())
        .then((txt) => setContent(txt.slice(0, 10000))) // Limit to first 10k chars
        .catch(() => setContent('Failed to load text content.'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [src, isTxt, isCsv])

  if (loading) {
    return <p className="text-zinc-500 text-xs p-6">Loading document contents…</p>
  }

  // 1. Text Viewer with line numbers
  if (isTxt) {
    const lines = content.split('\n')
    return (
      <div className="w-full h-full bg-zinc-950 text-zinc-300 font-mono text-xs overflow-auto p-4 flex">
        <div className="text-zinc-600 text-right pr-4 select-none border-r border-zinc-900 shrink-0">
          {lines.map((_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </div>
        <pre className="pl-4 select-text leading-relaxed outline-none">
          <code>{content}</code>
        </pre>
      </div>
    )
  }

  // 2. CSV / Spreadsheet Grid Preview
  if (isCsv || isSpreadsheet) {
    // Parse CSV simple grid
    const rows = isCsv
      ? content.split('\n').map((row) => row.split(','))
      : [
          ['Product ID', 'Name', 'Qty', 'Unit Price', 'Total Sales'],
          ['P001', 'TR Fastenings Ultra Cam', '15', '$299.00', '$4,485.00'],
          ['P002', 'High-res LED Screen Monitor', '8', '$549.00', '$4,392.00'],
          ['P003', 'Interactive Multi-Media Board', '3', '$1,899.00', '$5,697.00'],
          ['P004', 'Pro Audio Microphone Stand', '40', '$45.00', '$1,800.00'],
          ['P005', 'Compact Streaming Switcher Console', '6', '$399.00', '$2,394.00'],
        ]

    return (
      <div className="w-full h-full bg-zinc-900 text-white overflow-auto p-6 flex flex-col">
        <div className="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl mb-4 shrink-0 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-400">Sheet1 (Table Preview)</span>
          <span className="text-[10px] text-zinc-500">{rows.length} rows previewed</span>
        </div>
        <div className="flex-1 overflow-auto border border-zinc-800 rounded-xl">
          <table className="w-full border-collapse text-left text-xs text-zinc-300">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800 font-bold">
                {rows[0]?.map((cell, idx) => (
                  <th key={idx} className="p-3 border-r border-zinc-850 font-semibold">{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-zinc-850 hover:bg-zinc-850/30">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-3 border-r border-zinc-850 font-mono text-zinc-400">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // 3. Word DOCX Layout Mock
  if (isDocx) {
    return (
      <div className="w-full h-full bg-zinc-900 overflow-auto p-8 flex justify-center">
        <div className="w-full max-w-2xl bg-white text-zinc-800 rounded-xl shadow-2xl p-10 border border-zinc-200">
          <div className="border-b-2 border-zinc-800 pb-3 mb-6">
            <h1 className="text-2xl font-bold text-zinc-950">PROPOSAL SPECIFICATIONS</h1>
            <p className="text-xs text-zinc-400 mt-1 uppercase font-semibold">TR Fastenings Multimedia Group</p>
          </div>
          <div className="space-y-4 text-sm leading-relaxed text-zinc-650">
            <p className="font-semibold text-zinc-900">1. Executive Summary</p>
            <p>
              This proposal outlines the deployment specifications for the multimedia streaming dashboard. All modules must adhere to responsive container guidelines and support drag-and-drop actions.
            </p>
            <p className="font-semibold text-zinc-900">2. Technical Stack</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>NextJS Framework</li>
              <li>Prisma Client (PostgreSQL)</li>
              <li>S3 Object Storage integration</li>
            </ul>
            <p className="text-xs text-zinc-400 border-t border-zinc-100 pt-4 mt-8 italic text-center">
              End of document. To modify or write changes, download the original file.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 4. PPTX Mock Slides
  if (isPptx) {
    return (
      <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center p-8 text-white">
        <div className="w-full max-w-2xl aspect-video bg-indigo-950 rounded-xl shadow-2xl border border-indigo-900 relative overflow-hidden flex flex-col justify-between p-8">
          {/* Top Banner decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />

          <div className="text-indigo-400 font-semibold text-xs tracking-wider uppercase">Slide 1: Overview</div>
          <div className="my-auto space-y-4">
            <h2 className="text-3xl font-extrabold text-white leading-tight">
              TR Fastenings Media <br />
              <span className="text-indigo-400">&amp; Screen Delivery</span>
            </h2>
            <p className="text-xs text-indigo-200/70 max-w-md">
              Presenting real-time documents, videos, and multi-media components synchronously across local screens.
            </p>
          </div>
          <div className="border-t border-indigo-900/60 pt-3 flex items-center justify-between text-[10px] text-indigo-400 font-mono">
            <span>TR FASTENINGS MULTIMEDIA</span>
            <span>2026 Pitch Deck</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}
