import { EVENTS, bus } from "@/lib/events";
import { requireSession } from "@/lib/guard";

export const GET = async () => {
  await requireSession();
  const stream = new ReadableStream({
    start(controller) {
      const send = (type: string, payload: unknown) => {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type, payload })}\n\n`));
      };
      const onUpdate = (p: unknown) => send(EVENTS.PROPOSAL_UPDATED, p);
      const onCreate = (p: unknown) => send(EVENTS.PROPOSAL_CREATED, p);
      bus.on(EVENTS.PROPOSAL_UPDATED, onUpdate);
      bus.on(EVENTS.PROPOSAL_CREATED, onCreate);
      // Initial tick
      send("hello", {});
      return () => {
        bus.off(EVENTS.PROPOSAL_UPDATED, onUpdate);
        bus.off(EVENTS.PROPOSAL_CREATED, onCreate);
      };
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
};