'use client'

import { useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

// Touch / pen drag-and-drop. Native HTML5 drag events never fire for touch,
// so documents are picked up with a long-press and dropped on any element
// carrying `data-drop-screen="<id>"`. Mouse users keep using native drag.
// Components talk through window events so the panels stay decoupled.

export const TOUCH_HOVER_EVENT = 'touchdrag:hover'
export const TOUCH_DROP_EVENT = 'touchdrag:drop'
export const ASSIGN_REQUEST_EVENT = 'document:assign-request'

export type TouchHoverDetail = { screenId: string | null }
export type TouchDropDetail<T = unknown> = { screenId: string; payload: T }

const LONG_PRESS_MS = 320
const MOVE_TOLERANCE = 10
const EDGE_SIZE = 56
const SCROLL_STEP = 12

// True when the primary input is a mouse (native drag should be enabled).
export function useFinePointer() {
  const [fine, setFine] = useState(true)
  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setFine(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return fine
}

export function startTouchDrag(event: ReactPointerEvent<HTMLElement>, payload: unknown, label: string) {
  if (event.pointerType === 'mouse') return

  const source = event.currentTarget
  const pointerId = event.pointerId
  const startX = event.clientX
  const startY = event.clientY
  let x = startX
  let y = startY
  let active = false
  let ghost: HTMLDivElement | null = null
  let hover: string | null = null
  let frame = 0

  const setHover = (screenId: string | null) => {
    if (screenId === hover) return
    hover = screenId
    window.dispatchEvent(new CustomEvent<TouchHoverDetail>(TOUCH_HOVER_EVENT, { detail: { screenId } }))
  }

  const tick = () => {
    if (!active) return
    if (ghost) ghost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -130%)`

    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-screen]')
    setHover(target?.dataset.dropScreen ?? null)

    // Scroll any marked container when the finger hovers near its edge.
    document.querySelectorAll<HTMLElement>('[data-autoscroll]').forEach((box) => {
      const rect = box.getBoundingClientRect()
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return
      if (x < rect.left + EDGE_SIZE) box.scrollLeft -= SCROLL_STEP
      else if (x > rect.right - EDGE_SIZE) box.scrollLeft += SCROLL_STEP
      if (y < rect.top + EDGE_SIZE) box.scrollTop -= SCROLL_STEP
      else if (y > rect.bottom - EDGE_SIZE) box.scrollTop += SCROLL_STEP
    })

    frame = requestAnimationFrame(tick)
  }

  const activate = () => {
    active = true
    navigator.vibrate?.(15)
    try {
      source.setPointerCapture(pointerId)
    } catch {
      // Pointer may already be gone; the drag will end via pointercancel.
    }

    ghost = document.createElement('div')
    ghost.textContent = label
    ghost.style.cssText =
      'position:fixed;top:0;left:0;z-index:100;pointer-events:none;max-width:220px;overflow:hidden;' +
      'text-overflow:ellipsis;white-space:nowrap;padding:8px 12px;border-radius:12px;background:#000;color:#fff;' +
      'font:600 12px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);opacity:.95;'
    document.body.appendChild(ghost)
    document.documentElement.style.userSelect = 'none'
    frame = requestAnimationFrame(tick)
  }

  const timer = window.setTimeout(activate, LONG_PRESS_MS)

  const blockScroll = (e: TouchEvent) => {
    if (active && e.cancelable) e.preventDefault()
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    x = e.clientX
    y = e.clientY
    // Moving before the long-press fires means the user is scrolling.
    if (!active && Math.hypot(x - startX, y - startY) > MOVE_TOLERANCE) cleanup()
  }

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    if (active) {
      if (hover) {
        window.dispatchEvent(
          new CustomEvent<TouchDropDetail>(TOUCH_DROP_EVENT, { detail: { screenId: hover, payload } }),
        )
      }
      // Swallow the click the browser fires after the pointer is released on the card.
      const swallow = (ev: Event) => {
        ev.preventDefault()
        ev.stopPropagation()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400)
    }
    cleanup()
  }

  const onCancel = (e: PointerEvent) => {
    if (e.pointerId === pointerId) cleanup()
  }

  function cleanup() {
    window.clearTimeout(timer)
    cancelAnimationFrame(frame)
    ghost?.remove()
    ghost = null
    active = false
    document.documentElement.style.userSelect = ''
    setHover(null)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('touchmove', blockScroll)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('touchmove', blockScroll, { passive: false })
}
