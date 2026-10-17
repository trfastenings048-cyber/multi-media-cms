'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Monitor, Pause, Play, RefreshCw, Video, Volume2, VolumeX } from 'lucide-react'
import { Realtime } from 'ably'
import { toast } from 'sonner'

type Screen = { id: string; name: string; assets?: Array<{ document: { name?: string; mimeType: string; websiteUrl?: string | null; sourceType?: string } }> }

const buttonStyle = 'group flex min-h-24 w-full flex-col items-start justify-between rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-950/10 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-blue-700'

export default function ScreenControlsPanel() {
  const [screens, setScreens] = useState<Screen[]>([])
  const [screenId, setScreenId] = useState('')
  const [status, setStatus] = useState<'idle' | 'ready' | 'sent' | 'error'>('idle')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  async function loadScreens() {
    setLoading(true)
    try {
      const response = await fetch('/api/screens')
      if (!response.ok) throw new Error('Could not load screens')
      const data = await response.json()
      setScreens(Array.isArray(data) ? data : [])
    } catch { toast.error('Could not load screens') } finally { setLoading(false) }
  }

  // Initial screen discovery is a one-time external data load.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadScreens() }, [])

  const selected = useMemo(() => screens.find((screen) => screen.id === screenId), [screens, screenId])
  const asset = selected?.assets?.[0]?.document
  const isVideo = Boolean(asset?.mimeType.startsWith('video/'))

  async function send(action: string) {
    if (!screenId || sending) return
    setSending(true)
    try {
      const tokenResponse = await fetch(`/api/screens/${screenId}/controls/token?mode=publish`)
      if (!tokenResponse.ok) {
        const details = await tokenResponse.json().catch(() => null)
        throw new Error(details?.error || `Realtime authorization failed (${tokenResponse.status})`)
      }
      const token = await tokenResponse.json()
      const client = new Realtime({ token: token.token })
      await client.channels.get(token.channel).publish('control', { action, commandId: crypto.randomUUID() })
      client.close()
      setStatus('sent')
    } catch (error) { setStatus('error'); toast.error(error instanceof Error ? error.message : 'Command failed') } finally { setSending(false) }
  }

  const iconStyle = 'flex size-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950/60 dark:text-blue-300'
  const action = (icon: ReactNode, title: string, description: string, command: string) => <button disabled={sending} onClick={() => send(command)} className={buttonStyle}><span className={iconStyle}>{icon}</span><span className="font-bold text-zinc-900 dark:text-white">{title}</span><span className="text-xs text-zinc-500">{description}</span></button>

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/20">
      <div className="border-b border-zinc-200/80 bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white sm:p-7 dark:border-zinc-800">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><Monitor className="size-6" /></div><div><h2 className="text-xl font-extrabold tracking-tight">Choose a screen</h2><p className="mt-1 max-w-lg text-sm leading-6 text-blue-100">Send instant commands to a connected display through Ably.</p></div></div>
          <button onClick={loadScreens} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-bold transition hover:bg-white/20 active:scale-95 disabled:opacity-60"><RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />Refresh</button>
        </div>
        <label className="mt-6 block text-sm font-bold text-blue-50">Screen<select value={screenId} onChange={(event) => { setScreenId(event.target.value); setStatus(event.target.value ? 'ready' : 'idle') }} className="mt-2 h-12 w-full rounded-xl border border-white/20 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-lg outline-none transition focus:ring-4 focus:ring-white/25 dark:bg-zinc-950 dark:text-white"><option value="">Select a screen to control</option>{screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.name}</option>)}</select></label>
      </div>
      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/60"><div className="flex min-w-0 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">{isVideo ? <Video className="size-5" /> : <Monitor className="size-5" />}</div><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Assigned asset</p><p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{asset?.name || (asset ? 'Unsupported asset' : 'No asset assigned')}</p></div></div><div className="flex items-center gap-2 text-xs font-bold"><span className={`size-2 rounded-full ${status === 'error' ? 'bg-red-500' : status === 'sent' ? 'bg-emerald-500' : screenId ? 'bg-blue-500' : 'bg-zinc-300'}`} />{status === 'error' ? 'Command failed' : status === 'sent' ? 'Command sent' : screenId ? 'Ready to control' : 'Waiting for screen'}</div></div>
        <div className="mt-7"><div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="text-base font-extrabold text-zinc-900 dark:text-white">Available actions</h3><p className="mt-1 text-sm text-zinc-500">Controls are available for video assets only.</p></div>{sending && <Loader2 className="size-5 animate-spin text-blue-600" />}</div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{isVideo && <>{action(<Play className="size-4" />, 'Play video', 'Start playback', 'play')}{action(<Pause className="size-4" />, 'Pause video', 'Stop playback temporarily', 'pause')}{action(<VolumeX className="size-4" />, 'Mute audio', 'Silence the screen', 'mute')}{action(<Volume2 className="size-4" />, 'Unmute audio', 'Restore screen audio', 'unmute')}</>}</div>{!isVideo && <div className="mt-3 flex items-start gap-3 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500 dark:border-zinc-700"><AlertCircle className="mt-0.5 size-5 shrink-0" /><span>No controls are available for images, websites, PDFs, or other files.</span></div>}{status === 'sent' && <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-600"><CheckCircle2 className="size-4" />The command was delivered to Ably.</p>}</div>
      </div>
    </section>
  )
}
