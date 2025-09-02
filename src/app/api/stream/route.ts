import {EVENTS, bus} from '@/lib/events'
import {requireSession} from '@/lib/guard'

export const GET = async () => {
  await requireSession()

  // Use a cancellable underlying source so we can unsubscribe cleanly
  const source: {
    start: (controller: ReadableStreamDefaultController) => void
    cancel?: (reason?: unknown) => void
    _cleanup?: () => void
  } = {
    start(controller) {
      const send = (type: string, payload: unknown) => {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({type, payload})}\n\n`,
          ),
        )
      }
      const onUpdate = (p: unknown) => send(EVENTS.PROPOSAL_UPDATED, p)
      const onCreate = (p: unknown) => send(EVENTS.PROPOSAL_CREATED, p)
      bus.on(EVENTS.PROPOSAL_UPDATED, onUpdate)
      bus.on(EVENTS.PROPOSAL_CREATED, onCreate)
      // Initial tick
      send('hello', {})
      source._cleanup = () => {
        bus.off(EVENTS.PROPOSAL_UPDATED, onUpdate)
        bus.off(EVENTS.PROPOSAL_CREATED, onCreate)
      }
    },
    cancel() {
      try {
        source._cleanup?.()
      } catch {}
    },
  }

  const stream = new ReadableStream(source as UnderlyingDefaultSource<any>)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
