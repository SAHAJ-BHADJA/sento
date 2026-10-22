// Seed a few example public ATS boards to monitor. These are illustrative —
// edit them (or add your own) via the dashboard or here. Boards that don't
// resolve are simply skipped at discovery time.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXAMPLE_COMPANIES = [
  { name: "Vercel", atsType: "GREENHOUSE", atsIdentifier: "vercel" },
  { name: "Ramp", atsType: "ASHBY", atsIdentifier: "ramp" },
  { name: "Netflix", atsType: "LEVER", atsIdentifier: "netflix" },
] as const;

async function main() {
  for (const c of EXAMPLE_COMPANIES) {
    await prisma.company.upsert({
      where: { atsType_atsIdentifier: { atsType: c.atsType, atsIdentifier: c.atsIdentifier } },
      create: { name: c.name, atsType: c.atsType, atsIdentifier: c.atsIdentifier },
      update: {},
    });
  }
  console.log(`Seeded ${EXAMPLE_COMPANIES.length} example companies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
