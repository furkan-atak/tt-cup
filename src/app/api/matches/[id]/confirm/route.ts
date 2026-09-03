import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {parseGames} from "@/lib/match-rules";
import {prisma} from "@/lib/prisma";
import {recomputeRatings} from "@/lib/rating";
import {serializePlayer} from "@/lib/serialize";

export async function POST(
    _request: Request,
    ctx: RouteContext<"/api/matches/[id]/confirm">,
) {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const {id} = await ctx.params;
    const match = await prisma.match.findUnique({
        where: {id},
        include: {playerA: true, playerB: true},
    });
    if (!match) {
        return jsonError("Match not found.", 404);
    }
    if (match.status !== "PENDING") {
        return jsonError("This match is not waiting for confirmation.");
    }

    const updated = await prisma.match.update({
        where: {id},
        data: {status: "CONFIRMED", confirmedAt: new Date()},
        include: {playerA: true, playerB: true},
    });
    await recomputeRatings();

    return Response.json({
        match: {
            id: updated.id,
            status: updated.status,
            games: parseGames(updated.gamesJson),
            winnerId: updated.winnerId,
            confirmedAt: updated.confirmedAt,
            playedAt: updated.playedAt,
            reportedByPlayerId: updated.reportedByPlayerId,
            playerA: serializePlayer(updated.playerA),
            playerB: serializePlayer(updated.playerB),
        },
    });
}
