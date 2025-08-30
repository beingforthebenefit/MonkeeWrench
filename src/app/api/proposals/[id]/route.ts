export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";

export const PATCH = async (req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin();
  const body = await req.json();
  const data: any = {};
  if (body.title) data.title = String(body.title);
  if (body.artist) data.artist = String(body.artist);
  if (body.status && ["PENDING","APPROVED","ARCHIVED"].includes(body.status)) data.status = body.status;
  if (body.chartUrl !== undefined) data.chartUrl = body.chartUrl || null;
  if (body.lyricsUrl !== undefined) data.lyricsUrl = body.lyricsUrl || null;
  if (body.youtubeUrl !== undefined) data.youtubeUrl = body.youtubeUrl || null;
  await prisma.proposal.update({ where: { id: params.id }, data });
  return new Response(null, { status: 204 });
};

export const DELETE = async (_req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin();
  // Cascade deletes votes via schema
  await prisma.proposal.delete({ where: { id: params.id } });
  return new Response(null, { status: 204 });
};