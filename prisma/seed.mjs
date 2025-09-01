import { PrismaClient, ProposalStatus } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_ARTIST = "The Monkees";

function parseAllowlist() {
  const raw = process.env.ADMIN_ALLOWLIST || "";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

async function main() {
  // Idempotent settings seed
  const threshold = Number(process.env.VOTE_THRESHOLD || 2);
  const allowlist = parseAllowlist();

  await prisma.settings.upsert({
    where: { id: 1 },
    update: { voteThreshold: threshold, adminAllowlist: allowlist },
    create: { id: 1, voteThreshold: threshold, adminAllowlist: allowlist }
  });

  const existing = await prisma.proposal.count();
  if (existing > 0) return;

  // Seed a few proposals
  const demo = [
    { title: "I'm a Believer", artist: DEFAULT_ARTIST, youtubeUrl: "https://www.youtube.com/watch?v=XfuBREMXxts" },
    { title: "Daydream Believer", artist: DEFAULT_ARTIST, youtubeUrl: "https://www.youtube.com/watch?v=sUzs5dlLrm0" },
    { title: "Pleasant Valley Sunday", artist: DEFAULT_ARTIST },
    { title: "Last Train to Clarksville", artist: DEFAULT_ARTIST }
  ];

  // Create a synthetic user as proposer of seed items
  const seedUser = await prisma.user.upsert({
    where: { email: "seed@monkee.wrench" },
    update: {},
    create: { email: "seed@monkee.wrench", name: "Seeder" }
  });

  const created = await Promise.all(demo.map(d =>
    prisma.proposal.create({ data: { ...d, proposerId: seedUser.id } })
  ));

  // Mark a couple as approved to demo Setlist
  if (created[0]) await prisma.proposal.update({ where: { id: created[0].id }, data: { status: ProposalStatus.APPROVED } });
  if (created[1]) await prisma.proposal.update({ where: { id: created[1].id }, data: { status: ProposalStatus.APPROVED } });
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());