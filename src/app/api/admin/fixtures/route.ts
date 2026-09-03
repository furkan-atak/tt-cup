import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {getPrisma} from "@/lib/prisma";

export async function POST() {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const prisma = getPrisma();
    const [pendingCount, latestRound] = await Promise.all([
        prisma.match.count({where: {status: "PENDING"}}),
        prisma.match.aggregate({_max: {round: true}}),
    ]);
    if (pendingCount > 0) {
        return jsonError("Finish or void the current fixtures before drawing again.", 409);
    }

    const players = await prisma.player.findMany({
        where: {registrationStatus: "APPROVED", withdrawnAt: null, eliminatedAt: null},
        select: {id: true},
    });
    if (players.length < 2) {
        return jsonError(players.length === 1 ? "The tournament already has a champion." : "At least two active players are required.");
    }

    const shuffled = [...players];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    const fixtures = [];
    const round = (latestRound._max.round ?? 0) + 1;
    for (let index = 0; index + 1 < shuffled.length; index += 2) {
        fixtures.push({
            playerAId: shuffled[index].id,
            playerBId: shuffled[index + 1].id,
            gamesJson: "[]",
            status: "PENDING",
            round,
        });
    }

    await prisma.match.createMany({data: fixtures});
    return Response.json({
        created: fixtures.length,
        round,
        byePlayerId: shuffled.length % 2 ? shuffled.at(-1)?.id : null
    });
}
