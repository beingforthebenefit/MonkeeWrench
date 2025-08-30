export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
export const GET = async () => {
  const items = await prisma.proposal.findMany({ where: { status: "APPROVED" }, orderBy: { updatedAt: "desc" } });
  return Response.json(items);
};