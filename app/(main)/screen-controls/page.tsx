import ScreenControlsPanel from '@/components/screen-controls/ScreenControlsPanel'

export default function ScreenControlsPage() {
  return (
    <div className="min-h-dvh bg-zinc-50 px-4 py-6 dark:bg-zinc-950 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Live display management</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Screen controls</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Control assigned video and website content in real time through the connected screen player.
          </p>
        </div>
        <ScreenControlsPanel />
      </div>
    </div>
  )
}
