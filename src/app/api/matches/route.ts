import {parseGames} from "@/lib/match-rules";
import {prisma} from "@/lib/prisma";
import {serializePlayer} from "@/lib/serialize";

const PAGE_SIZE = 20;

function serializeMatch(match: {
    id: string;
    status: string;
    round: number | null;
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
        round: match.round,
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
