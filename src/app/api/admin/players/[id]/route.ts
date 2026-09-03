import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {getPrisma} from "@/lib/prisma";

export async function DELETE(
    _request: Request,
    ctx: RouteContext<"/api/admin/players/[id]">,
) {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const prisma = getPrisma();
    const {id} = await ctx.params;
    const player = await prisma.player.findUnique({where: {id}, select: {id: true}});
    if (!player) {
        return jsonError("Player not found.", 404);
    }

    await prisma.match.deleteMany({
        where: {
            OR: [
                {playerAId: id},
                {playerBId: id},
                {reportedByPlayerId: id},
                {winnerId: id},
            ],
        },
    });
    await prisma.player.delete({where: {id}});

    return Response.json({ok: true});
}
