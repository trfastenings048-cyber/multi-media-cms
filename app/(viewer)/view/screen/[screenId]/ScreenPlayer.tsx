'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { FileAudio, FileText, FileVideo, Globe2, Image as ImageIcon, Maximize2, Monitor, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import CloseButton from '../../[docId]/CloseButton'

type ScreenAsset = {
  id: string
  document: {
    id: string
    name: string
    mimeType: string
    s3Url: string
    websiteUrl?: string | null
    sourceType?: 'FILE' | 'WEBSITE'
  }
}

type ScreenPlayerProps = {
  screenName: string
  assets: ScreenAsset[]
  // Set by the desktop kiosk app: hides all player chrome and controls.
  kiosk?: boolean
}

function MediaControls({
  mediaRef,
  label,
}: {
  mediaRef: RefObject<HTMLMediaElement | null>
  label: string
}) {
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)

  useEffect(() => {
    const media = mediaRef.current
    if (!media) return

    const syncState = () => {
      setIsPlaying(!media.paused)
      setIsMuted(media.muted || media.volume === 0)
    }

    syncState()
    media.addEventListener('play', syncState)
    media.addEventListener('pause', syncState)
    media.addEventListener('volumechange', syncState)

    return () => {
      media.removeEventListener('play', syncState)
      media.removeEventListener('pause', syncState)
      media.removeEventListener('volumechange', syncState)
    }
  }, [mediaRef])

  function togglePlay() {
    const media = mediaRef.current
    if (!media) return

    if (media.paused) {
      media.play().catch(() => {})
    } else {
      media.pause()
    }
  }

  function toggleMute() {
    const media = mediaRef.current
    if (!media) return
    media.muted = !media.muted
  }

  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-xl bg-black/70 p-2 backdrop-blur">
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
        title={isPlaying ? 'Pause' : 'Play'}
        className="flex size-10 items-center justify-center rounded-lg text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <button
        type="button"
        onClick={toggleMute}
        aria-label={isMuted ? `Unmute ${label}` : `Mute ${label}`}
        title={isMuted ? 'Unmute' : 'Mute'}
        className="flex size-10 items-center justify-center rounded-lg text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {isMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
    </div>
  )
}

function AssetTypeBadge({ kind }: { kind: 'image' | 'video' | 'audio' | 'website' | 'pdf' | 'file' }) {
  const config = {
    image: { icon: ImageIcon, label: 'Image' },
    video: { icon: FileVideo, label: 'Video' },
    audio: { icon: FileAudio, label: 'Audio' },
    website: { icon: Globe2, label: 'Website' },
    pdf: { icon: FileText, label: 'PDF' },
    file: { icon: FileText, label: 'File' },
  }[kind]
  const Icon = config.icon

  return (
    <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
      <Icon className="size-4" aria-hidden="true" />
      <span>{config.label}</span>
    </div>
  )
}

function AssetStage({ asset, kiosk }: { asset: ScreenAsset; kiosk: boolean }) {
  const document = asset.document
  const url = document.websiteUrl || document.s3Url
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaName = `${document.name} ${url}`.toLowerCase()
  const isVideo = document.mimeType.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)(?:[?#]|$)/i.test(mediaName)
  const isAudio = document.mimeType.startsWith('audio/') || /\.(mp3|wav|aac|m4a|ogg|flac)(?:[?#]|$)/i.test(mediaName)

  if (!isVideo && !isAudio && document.mimeType.startsWith('image/')) {
    return (
      <div className="relative h-full w-full">
        <img src={url} alt={document.name} className="h-full w-full bg-black object-contain" />
        <AssetTypeBadge kind="image" />
      </div>
    )
  }

  if (isVideo) {
    return (
      <div className="relative h-full w-full">
        <video ref={videoRef} src={url} className="h-full w-full bg-black object-contain" controls={!kiosk} autoPlay loop />
        <AssetTypeBadge kind="video" />
        {kiosk && <MediaControls mediaRef={videoRef} label="video" />}
      </div>
    )
  }

  if (document.sourceType === 'WEBSITE' || document.websiteUrl) {
    return (
      <div className="relative h-full w-full">
        <iframe src={url} title={document.name} className="h-full w-full border-0 bg-white" />
        <AssetTypeBadge kind="website" />
      </div>
    )
  }

  if (isAudio) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-zinc-950 p-8 text-white">
        <FileAudio className="size-16 text-white/40" />
        <p className="max-w-xl text-center text-lg font-bold">{document.name}</p>
        <div className="relative w-full max-w-xl">
          <audio ref={audioRef} src={url} controls={!kiosk} autoPlay loop className="w-full" />
          <AssetTypeBadge kind="audio" />
          {kiosk && <MediaControls mediaRef={audioRef} label="audio" />}
        </div>
      </div>
    )
  }

  if (document.mimeType === 'application/pdf') {
    return (
      <div className="relative h-full w-full">
        <iframe src={url} title={document.name} className="h-full w-full border-0 bg-white" />
        <AssetTypeBadge kind="pdf" />
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-5 bg-zinc-950 p-8 text-center text-white">
      <FileText className="size-16 text-white/40" />
      <AssetTypeBadge kind="file" />
      <p className="max-w-xl text-lg font-bold">{document.name}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black hover:bg-zinc-200"
      >
        Open Asset
      </a>
    </div>
  )
}

export default function ScreenPlayer({ screenName, assets, kiosk = false }: ScreenPlayerProps) {
  const firstAsset = assets[0]

  function enterFullscreen() {
    const target = document.documentElement
    if (!document.fullscreenElement) {
      target.requestFullscreen().catch(() => {})
    }
  }

  if (!firstAsset) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-zinc-950 text-white select-none">
        <div className="max-w-md text-center p-8 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center border border-zinc-700">
            <Monitor className="size-8 text-zinc-500" />
          </div>
          <h2 className="text-lg font-bold text-white/90">{screenName}</h2>
          <p className="text-sm text-zinc-500">
            Drag an asset onto this screen from the main screen page to start playback.
          </p>
          {!kiosk && <CloseButton />}
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-dvh bg-black text-white">
      {!kiosk && (
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
          <button
            onClick={enterFullscreen}
            className="flex size-10 items-center justify-center rounded-full bg-black/65 text-white/80 ring-1 ring-white/15 backdrop-blur transition hover:bg-black hover:text-white"
            aria-label={`Make ${screenName} full screen`}
            title="Full screen"
          >
            <Maximize2 className="size-5" />
          </button>
        </div>
      )}
      <AssetStage asset={firstAsset} kiosk={kiosk} />
    </div>
  )
}
