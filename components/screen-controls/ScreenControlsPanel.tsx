'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, RefreshCw, ScrollText, Volume2, VolumeX } from 'lucide-react'
import { Realtime } from 'ably'
import { toast } from 'sonner'

type Screen = { id: string; name: string; assets?: Array<{ document: { mimeType: string; websiteUrl?: string | null; sourceType?: string } }> }

export default function ScreenControlsPanel() {
  const [screens, setScreens] = useState<Screen[]>([])
  const [screenId, setScreenId] = useState('')
  const [status, setStatus] = useState('Select a screen')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetch('/api/screens').then((response) => response.json()).then((data) => setScreens(Array.isArray(data) ? data : [])).catch(() => toast.error('Could not load screens'))
  }, [])

  const selected = useMemo(() => screens.find((screen) => screen.id === screenId), [screens, screenId])
  const document = selected?.assets?.[0]?.document
  const isVideo = Boolean(document?.mimeType.startsWith('video/'))
  const isWebsite = document?.sourceType === 'WEBSITE' || Boolean(document?.websiteUrl)

  async function send(action: string) {
    if (!screenId) return
    setSending(true)
    try {
      const tokenResponse = await fetch(`/api/screens/${screenId}/controls/token?mode=publish`)
      if (!tokenResponse.ok) throw new Error('Realtime authorization failed')
      const token = await tokenResponse.json()
      const client = new Realtime({ token: token.token })
      await client.channels.get(token.channel).publish('control', { action, commandId: crypto.randomUUID(), issuedAt: Date.now() })
      client.close()
      setStatus('Command sent')
    } catch (error) {
      setStatus('Unable to reach screen')
      toast.error(error instanceof Error ? error.message : 'Command failed')
    } finally {
      setSending(false)
    }
  }

  const controlButton = 'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div><h2 className="text-lg font-bold">Screen controls</h2><p className="mt-1 text-sm text-zinc-500">Send live commands through Ably without polling.</p></div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">{status}</span>
      </div>
      <label className="block text-sm font-semibold">Screen<select value={screenId} onChange={(event) => { setScreenId(event.target.value); setStatus('Ready') }} className="mt-2 h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"><option value="">Select a screen</option>{screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.name}</option>)}</select></label>
      <p className="mt-3 text-sm text-zinc-500">Asset: {document ? (isVideo ? 'Video' : isWebsite ? 'Website' : 'Unsupported') : 'None assigned'}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {isVideo && <><button disabled={sending} onClick={() => send('play')} className={controlButton}><Play className="size-4" />Play</button><button disabled={sending} onClick={() => send('pause')} className={controlButton}><Pause className="size-4" />Pause</button><button disabled={sending} onClick={() => send('mute')} className={controlButton}><VolumeX className="size-4" />Mute</button><button disabled={sending} onClick={() => send('unmute')} className={controlButton}><Volume2 className="size-4" />Unmute</button></>}
        {isWebsite && <><button disabled={sending} onClick={() => send('scroll-up')} className={controlButton}><ScrollText className="size-4" />Scroll up</button><button disabled={sending} onClick={() => send('scroll-down')} className={controlButton}><ScrollText className="size-4 rotate-180" />Scroll down</button></>}
        {!isVideo && !isWebsite && <span className="text-sm text-zinc-500">No controls available for this asset.</span>}
      </div>
      <button onClick={() => { setScreens([]); fetch('/api/screens').then((response) => response.json()).then((data) => setScreens(Array.isArray(data) ? data : [])) }} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><RefreshCw className="size-3" />Refresh screens</button>
    </section>
  )
}
