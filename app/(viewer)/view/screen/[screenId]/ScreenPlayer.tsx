'use client'

import { FileText, Maximize2, Monitor } from 'lucide-react'
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

function AssetStage({ asset, kiosk }: { asset: ScreenAsset; kiosk: boolean }) {
  const document = asset.document
  const url = document.websiteUrl || document.s3Url

  if (document.mimeType.startsWith('image/')) {
    return <img src={url} alt={document.name} className="h-full w-full bg-black object-contain" />
  }

  if (document.mimeType.startsWith('video/')) {
    return <video src={url} className="h-full w-full bg-black object-contain" controls={!kiosk} autoPlay muted loop />
  }

  if (document.sourceType === 'WEBSITE' || document.websiteUrl) {
    return <iframe src={url} title={document.name} className="h-full w-full border-0 bg-white" />
  }

  if (document.mimeType.startsWith('audio/')) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-zinc-950 p-8 text-white">
        <FileText className="size-16 text-white/40" />
        <p className="max-w-xl text-center text-lg font-bold">{document.name}</p>
        <audio src={url} controls={!kiosk} autoPlay loop className="w-full max-w-xl" />
      </div>
    )
  }

  if (document.mimeType === 'application/pdf') {
    return <iframe src={url} title={document.name} className="h-full w-full border-0 bg-white" />
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-zinc-950 p-8 text-center text-white">
      <FileText className="size-16 text-white/40" />
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
