import {isAdmin} from "@/lib/cookies";
import {jsonError, parseGamePayload} from "@/lib/http";
import {
    matchWinnerFromGames,
    parseGames,
    validateBestOfThree,
} from "@/lib/match-rules";
import {prisma} from "@/lib/prisma";
import {recomputeRatings} from "@/lib/rating";
import {serializePlayer} from "@/lib/serialize";
import {z} from "zod";

const PAGE_SIZE = 20;

function serializeMatch(match: {
    id: string;
    status: string;
    gamesJson: string;
    winnerId: string | null;
    confirmedAt: Date | null;
    playedAt: Date;
    reportedByPlayerId: string | null;
    playerA: Parameters<typeof serializePlayer>[0];
    playerB: Parameters<typeof serializePlayer>[0];
}) {
    return {
        id: match.id,
        status: match.status,
        games: parseGames(match.gamesJson),
        winnerId: match.winnerId,
        confirmedAt: match.confirmedAt,
        playedAt: match.playedAt,
        reportedByPlayerId: match.reportedByPlayerId,
        playerA: serializePlayer(match.playerA),
        playerB: serializePlayer(match.playerB),
    };
}

export async function GET(request: Request) {
    const {searchParams} = new URL(request.url);
    const fixtures = searchParams.get("fixtures") === "1";
    const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? PAGE_SIZE) || PAGE_SIZE));

    if (fixtures) {
        const items = await prisma.match.findMany({
            where: {status: "PENDING"},
            orderBy: {createdAt: "asc"},
            include: {playerA: true, playerB: true},
        });
        return Response.json({items: items.map(serializeMatch)});
    }

    const where = {status: "CONFIRMED"};
    const [total, items] = await Promise.all([
        prisma.match.count({where}),
        prisma.match.findMany({
            where,
            orderBy: {confirmedAt: "desc"},
            skip: offset,
            take: limit,
            include: {playerA: true, playerB: true},
        }),
    ]);

    return Response.json({
        total,
        nextOffset: offset + items.length < total ? offset + items.length : null,
        items: items.map(serializeMatch),
    });
}

const reportSchema = z.object({
    opponentId: z.string().min(1),
    games: z.unknown(),
});

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

    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
        return jsonError("Opponent and game scores are required.");
    }

    const games = parseGamePayload(parsed.data.games);
    if (!games) {
        return jsonError("Game scores are invalid.");
    }
    const gamesError = validateBestOfThree(games);
    if (gamesError) {
        return jsonError(gamesError);
    }

    const winnerSide = matchWinnerFromGames(games);
    let playerAId: string | null = null;
    let playerBId = parsed.data.opponentId;
    if (typeof (body as { playerAId?: string }).playerAId === "string") {
        const adminBody = body as { playerAId: string; playerBId?: string };
        playerAId = adminBody.playerAId;
        playerBId = adminBody.playerBId ?? parsed.data.opponentId;
    }

    if (!playerAId || !playerBId) {
        return jsonError("Both players are required.");
    }
    if (playerAId === playerBId) {
        return jsonError("You cannot play yourself.");
    }

    const [playerA, playerB] = await Promise.all([
        prisma.player.findUnique({where: {id: playerAId}}),
        prisma.player.findUnique({where: {id: playerBId}}),
    ]);
    if (!playerA || !playerB || playerA.withdrawnAt || playerB.withdrawnAt) {
        return jsonError("Both players must be on the active list.");
    }

    const winnerId = winnerSide === "a" ? playerAId : playerBId;

    const match = await prisma.match.create({
        data: {
            playerAId,
            playerBId,
            reportedByPlayerId: null,
            winnerId,
            status: "CONFIRMED",
            gamesJson: JSON.stringify(games),
            confirmedAt: new Date(),
        },
        include: {playerA: true, playerB: true},
    });

    await recomputeRatings();

    return Response.json({match: serializeMatch(match)}, {status: 201});
}
