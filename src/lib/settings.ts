import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "default";

export async function getSettings() {
  const existing = await prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) {
    return existing;
  }
  return prisma.settings.create({
    data: {
      id: SETTINGS_ID,
      eventName: "Office Table Tennis Cup",
      registrationOpen: true,
    },
  });
}

export async function updateSettings(data: {
  eventName?: string;
  registrationOpen?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
}) {
  await getSettings();
  return prisma.settings.update({
    where: { id: SETTINGS_ID },
    data,
  });
}
