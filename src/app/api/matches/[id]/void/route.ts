import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {prisma} from "@/lib/prisma";
import {recomputeTournamentState} from "@/lib/tournament";

export async function POST(
    _request: Request,
    ctx: RouteContext<"/api/matches/[id]/void">,
) {
    const {id} = await ctx.params;
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const match = await prisma.match.findUnique({where: {id}});
    if (!match) {
        return jsonError("Match not found.", 404);
    }
    if (match.round) {
        const laterRoundExists = await prisma.match.count({where: {round: {gt: match.round}}});
        if (laterRoundExists > 0) {
            return jsonError("A match cannot be voided after the next round has been drawn.", 409);
        }
    }

    await prisma.match.update({
        where: {id},
        data: {status: "VOID", confirmedAt: null, winnerId: null},
    });
    await recomputeTournamentState();

    return Response.json({ok: true});
}
