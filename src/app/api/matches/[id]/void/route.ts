import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {prisma} from "@/lib/prisma";
import {recomputeRatings} from "@/lib/rating";

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

    await prisma.match.update({
        where: {id},
        data: {status: "VOID", confirmedAt: null, winnerId: null},
    });
    await recomputeRatings();

    return Response.json({ok: true});
}
