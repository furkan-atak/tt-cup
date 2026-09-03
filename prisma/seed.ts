import {PrismaClient} from "@prisma/client";
import {normalizeNamePart} from "../src/lib/names";

const prisma = new PrismaClient();

const names = [
    ["Can", "Yılmaz", "Platform"],
    ["Elif", "Kaya", "Design"],
    ["Mert", "Demir", "Backend"],
    ["Ayşe", "Koç", "Product"],
    ["Deniz", "Arslan", "QA"],
    ["Burak", "Sahin", "Mobile"],
    ["Zeynep", "Aydin", "Data"],
    ["Emre", "Celik", "Support"],
] as const;

async function main() {
    await prisma.match.deleteMany();
    await prisma.player.deleteMany();
    await prisma.settings.deleteMany();

    await prisma.settings.create({
        data: {
            id: "default",
            eventName: "Office Table Tennis Cup",
            registrationOpen: true,
            startDate: new Date("2026-09-08"),
            endDate: new Date("2026-10-10"),
        },
    });

    for (const [firstName, lastName, department] of names) {
        await prisma.player.create({
            data: {
                firstName,
                lastName,
                firstNameNorm: normalizeNamePart(firstName),
                lastNameNorm: normalizeNamePart(lastName),
                department,
            },
        });
    }

    console.log("Seeded 8 players ready for an elimination draw.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
