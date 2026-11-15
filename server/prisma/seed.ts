import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/security.js";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") throw new Error("Synthetic seed is disabled in production");
const participantPassword = process.env.SEED_PARTICIPANT_PASSWORD;
const organizerPassword = process.env.SEED_ORGANIZER_PASSWORD;
if (!participantPassword || !organizerPassword) throw new Error("Set SEED_PARTICIPANT_PASSWORD and SEED_ORGANIZER_PASSWORD in the ignored local environment");
const accounts = [
  { loginIdentifier: "participant@example.test", displayName: "Demo Participant", role: Role.PARTICIPANT, password: participantPassword },
  { loginIdentifier: "organizer@example.test", displayName: "Demo Organizer", role: Role.ORGANIZER, password: organizerPassword },
];

for (const account of accounts) {
  await prisma.user.upsert({
    where: { loginIdentifier: account.loginIdentifier },
    update: { displayName: account.displayName, role: account.role, passwordHash: await hashPassword(account.password) },
    create: { loginIdentifier: account.loginIdentifier, displayName: account.displayName, role: account.role, passwordHash: await hashPassword(account.password) },
  });
}

await prisma.$disconnect();
