import {PrismaClient} from "@prisma/client";
import {nextElo, STARTING_ELO} from "../src/lib/elo";
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
    await prisma.ratingEvent.deleteMany();
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

    const players = [];
    for (const [firstName, lastName, department] of names) {
        players.push(
            await prisma.player.create({
                data: {
                    firstName,
                    lastName,
                    firstNameNorm: normalizeNamePart(firstName),
                    lastNameNorm: normalizeNamePart(lastName),
                    department,
                },
            }),
        );
    }

    const pairings: [number, number, [number, number][], number][] = [
        [0, 1, [[11, 7], [11, 9]], 0],
        [2, 3, [[9, 11], [11, 8], [11, 6]], 2],
        [4, 5, [[11, 13], [11, 9], [12, 10]], 4],
        [0, 2, [[11, 5], [9, 11], [11, 8]], 0],
        [6, 7, [[11, 4], [11, 6]], 6],
        [1, 3, [[7, 11], [11, 13]], 3],
    ];

    const state = new Map(players.map((p) => [p.id, {elo: STARTING_ELO, wins: 0, losses: 0, streak: 0}]));

    for (const [ai, bi, games, winnerIndex] of pairings) {
        const playerA = players[ai];
        const playerB = players[bi];
        const winner = players[winnerIndex];
        const confirmedAt = new Date();
        const match = await prisma.match.create({
            data: {
                playerAId: playerA.id,
                playerBId: playerB.id,
                winnerId: winner.id,
                status: "CONFIRMED",
                gamesJson: JSON.stringify(games.map(([a, b]) => ({a, b}))),
                confirmedAt,
            },
        });

        const a = state.get(playerA.id)!;
        const b = state.get(playerB.id)!;
        const aWon = winner.id === playerA.id;
        const nextA = nextElo(a.elo, b.elo, aWon);
        const nextB = nextElo(b.elo, a.elo, !aWon);

        await prisma.ratingEvent.createMany({
            data: [
                {matchId: match.id, playerId: playerA.id, eloBefore: a.elo, eloAfter: nextA},
                {matchId: match.id, playerId: playerB.id, eloBefore: b.elo, eloAfter: nextB},
            ],
        });

        a.elo = nextA;
        b.elo = nextB;
        if (aWon) {
            a.wins += 1;
            a.streak = a.streak > 0 ? a.streak + 1 : 1;
            b.losses += 1;
            b.streak = b.streak < 0 ? b.streak - 1 : -1;
        } else {
            b.wins += 1;
            b.streak = b.streak > 0 ? b.streak + 1 : 1;
            a.losses += 1;
            a.streak = a.streak < 0 ? a.streak - 1 : -1;
        }
    }

    for (const [id, stats] of state) {
        await prisma.player.update({where: {id}, data: stats});
    }

    console.log("Seeded 8 players and 6 matches.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
