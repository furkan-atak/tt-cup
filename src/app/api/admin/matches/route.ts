import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {parseGames} from "@/lib/match-rules";
import {prisma} from "@/lib/prisma";
import {serializePlayer} from "@/lib/serialize";

export async function GET() {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const items = await prisma.match.findMany({
        orderBy: {createdAt: "desc"},
        include: {playerA: true, playerB: true},
    });

    return Response.json({
        items: items.map((match) => ({
            id: match.id,
            status: match.status,
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
