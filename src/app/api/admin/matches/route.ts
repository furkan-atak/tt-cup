import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {parseGames} from "@/lib/match-rules";
import {getPrisma} from "@/lib/prisma";
import {serializePlayer} from "@/lib/serialize";
import {z} from "zod";

const createMatchSchema = z.object({
    playerAId: z.string().min(1),
    playerBId: z.string().min(1),
}).strict();

export async function GET() {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const prisma = getPrisma();
    const items = await prisma.match.findMany({
        orderBy: {createdAt: "desc"},
        include: {playerA: true, playerB: true},
    });

    return Response.json({
        items: items.map((match) => ({
            id: match.id,
            status: match.status,
            round: match.round,
            games: parseGames(match.gamesJson),
            winnerId: match.winnerId,
            confirmedAt: match.confirmedAt,
            playedAt: match.playedAt,
            reportedByPlayerId: match.reportedByPlayerId,
            playerA: serializePlayer(match.playerA),
            playerB: serializePlayer(match.playerB),
        })),
    });
}

export async function POST(request: Request) {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return jsonError("Invalid JSON.");
    }
    const parsed = createMatchSchema.safeParse(body);
    if (!parsed.success) {
        return jsonError("Both players are required.");
    }
    const {playerAId, playerBId} = parsed.data;
    if (playerAId === playerBId) {
        return jsonError("A player cannot play against themselves.");
    }

    const prisma = getPrisma();
    const players = await prisma.player.findMany({
        where: {id: {in: [playerAId, playerBId]}},
        select: {id: true, registrationStatus: true, withdrawnAt: true, eliminatedAt: true},
    });
    if (players.length !== 2 || players.some((player) =>
        player.registrationStatus !== "APPROVED" || player.withdrawnAt || player.eliminatedAt
    )) {
        return jsonError("Both players must be active.");
    }

    const [pendingRounds, latestRound] = await Promise.all([
        prisma.match.findMany({
            where: {status: "PENDING", round: {not: null}},
            distinct: ["round"],
            select: {round: true},
        }),
        prisma.match.aggregate({_max: {round: true}}),
    ]);
    if (pendingRounds.length > 1) {
        return jsonError("Pending fixtures span multiple rounds.", 409);
    }
    const round = pendingRounds[0]?.round ?? (latestRound._max.round ?? 0) + 1;
    const duplicateParticipation = await prisma.match.count({
        where: {
            round,
            status: {not: "VOID"},
            OR: [
                {playerAId: {in: [playerAId, playerBId]}},
                {playerBId: {in: [playerAId, playerBId]}},
            ],
        },
    });
    if (duplicateParticipation > 0) {
        return jsonError("A selected player already has a match in this round.", 409);
    }

    const match = await prisma.match.create({
        data: {playerAId, playerBId, round, gamesJson: "[]", status: "PENDING"},
        select: {id: true},
    });
    return Response.json({id: match.id, round}, {status: 201});
}
