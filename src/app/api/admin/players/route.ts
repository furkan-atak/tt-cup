import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {prisma} from "@/lib/prisma";
import {serializePlayer} from "@/lib/serialize";

export async function GET() {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const players = await prisma.player.findMany({
        orderBy: [{withdrawnAt: "asc"}, {eliminatedAt: "asc"}, {lastName: "asc"}, {firstName: "asc"}],
    });

    return Response.json({items: players.map((player) => serializePlayer(player))});
}
