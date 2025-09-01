import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const bodySchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  chartUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  lyricsUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  youtubeUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? "";
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { email } });
  if (!me?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.format() }, { status: 400 });
  }

  const { title, artist, chartUrl, lyricsUrl, youtubeUrl } = parsed.data;

  // Create as APPROVED, not archived.
  const created = await prisma.proposal.create({
    data: {
      title,
      artist,
      chartUrl: chartUrl ?? null,
      lyricsUrl: lyricsUrl ?? null,
      youtubeUrl: youtubeUrl ?? null,
      status: "APPROVED",
      proposer: { connect: { id: me.id } },
    },
    select: { id: true },
  });

  // Optional: notify live clients if you have an event bus/SSE trigger
  // globalThis.__mwEmit?.("refresh"); // <- keep if you wired this earlier

  return NextResponse.json({ id: created.id }, { status: 201 });
}
