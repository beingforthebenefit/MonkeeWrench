export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { z } from "zod";
import { bus, EVENTS } from "@/lib/events";

// Accept: valid URL string OR "" OR null OR undefined -> normalize to undefined
const Url = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().url().optional()
);

const Body = z.object({
  title: z.string().trim().min(1),
  artist: z.string().trim().min(1),
  chartUrl: Url,
  lyricsUrl: Url,
  youtubeUrl: Url,
});

export const POST = async (req: Request) => {
  const admin = await requireAdmin();
  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new Response("Bad Request", { status: 400 });

  // compute next setlist order among APPROVED items
  const max = await prisma.proposal.aggregate({
    _max: { setlistOrder: true },
    where: { status: "APPROVED" },
  });
  const nextOrder =
    (typeof max._max?.setlistOrder === "number" ? max._max?.setlistOrder : 0) + 1;

  const p = await prisma.$transaction(async (tx) => {
    const created = await tx.proposal.create({
      data: {
        ...parsed.data,
        status: "APPROVED",
        proposerId: admin.id,
        setlistOrder: nextOrder,
      },
    });

    await tx.auditLog.create({
      data: { userId: admin.id, action: "ADMIN_EDIT", targetId: created.id },
    });

    return created;
  });

  try {
    bus.emit(EVENTS.PROPOSAL_CREATED, { id: p.id });
  } catch { /* non-fatal */ }

  return Response.json({ id: p.id });
};

export const GET = async () => {
  const all = await prisma.proposal.findMany({ orderBy: { createdAt: "desc" } });
  return Response.json(all);
};
