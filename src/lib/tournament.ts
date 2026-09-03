import {getPrisma} from "@/lib/prisma";

type PlayerState = {
    wins: number;
    losses: number;
    eliminatedAt: Date | null;
};

export async function recomputeTournamentState() {
    const prisma = getPrisma();
    const players = await prisma.player.findMany({
        where: {registrationStatus: "APPROVED"},
        select: {id: true},
    });
    const matches = await prisma.match.findMany({
        where: {status: "CONFIRMED", round: {not: null}},
        orderBy: [{round: "asc"}, {confirmedAt: "asc"}, {createdAt: "asc"}],
    });

    const state = new Map<string, PlayerState>(
        players.map((player) => [player.id, {wins: 0, losses: 0, eliminatedAt: null}]),
    );

    for (const match of matches) {
        if (!match.winnerId) continue;
        const winner = state.get(match.winnerId);
        const loserId = match.winnerId === match.playerAId ? match.playerBId : match.playerAId;
        const loser = state.get(loserId);
        if (!winner || !loser) continue;

        winner.wins += 1;
        loser.losses += 1;
        loser.eliminatedAt = match.confirmedAt ?? match.playedAt;
    }

    await Promise.all(
        [...state.entries()].map(([id, stats]) => prisma.player.update({where: {id}, data: stats})),
    );
}
