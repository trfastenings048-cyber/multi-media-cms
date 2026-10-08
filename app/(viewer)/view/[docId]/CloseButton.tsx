'use client'

export default function CloseButton() {
  return (
    <button
      onClick={() => window.close()}
      className="flex size-10 shrink-0 items-center justify-center text-white/40 hover:text-white transition-colors"
      aria-label="Close"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}
