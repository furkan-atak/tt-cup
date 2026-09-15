import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {getPrisma} from "@/lib/prisma";
import {PLACEHOLDER_STATUS} from "@/lib/placeholders";
import {recomputeTournamentState} from "@/lib/tournament";
import {z} from "zod";

const updateMatchSchema = z.object({
    playerAId: z.string().min(1),
    playerBId: z.string().min(1),
}).strict();

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/matches/[id]">) {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return jsonError("Invalid JSON.");
    }
    const parsed = updateMatchSchema.safeParse(body);
    if (!parsed.success) {
        return jsonError("Both players are required.");
    }
    const {playerAId, playerBId} = parsed.data;
    if (playerAId === playerBId) {
        return jsonError("A player cannot play against themselves.");
    }

    const prisma = getPrisma();
    const {id} = await ctx.params;
    const match = await prisma.match.findUnique({where: {id}});
    if (!match) {
        return jsonError("Match not found.", 404);
    }
    if (playerAId === match.playerAId && playerBId === match.playerBId) {
        return Response.json({ok: true});
    }
    if (match.round && match.status !== "PENDING") {
        const laterRoundExists = await prisma.match.count({where: {round: {gt: match.round}}});
        if (laterRoundExists > 0) {
            return jsonError("A completed match cannot be changed after the next round has been drawn.", 409);
        }
    }

    const players = await prisma.player.findMany({
        where: {id: {in: [playerAId, playerBId]}},
        select: {id: true, registrationStatus: true, withdrawnAt: true, eliminatedAt: true},
    });
    if (players.length !== 2 || players.some((player) => {
        const isCurrentParticipant = match.status === "CONFIRMED"
            && (player.id === match.playerAId || player.id === match.playerBId);
        return player.registrationStatus !== "APPROVED"
            || (!isCurrentParticipant && Boolean(player.withdrawnAt || player.eliminatedAt));
    })) {
        return jsonError("New match players must be active.");
    }

    if (match.round) {
        const duplicateParticipation = await prisma.match.count({
            where: {
                id: {not: id},
                round: match.round,
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
    }

    const hadResult = match.status === "CONFIRMED";
    await prisma.match.update({
        where: {id},
        data: {
            playerAId,
            playerBId,
            gamesJson: "[]",
            winnerId: null,
            reportedByPlayerId: null,
            status: "PENDING",
            confirmedAt: null,
        },
    });
    if (hadResult) {
        await recomputeTournamentState();
    }

    return Response.json({ok: true});
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/matches/[id]">) {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const prisma = getPrisma();
    const {id} = await ctx.params;
    const match = await prisma.match.findUnique({where: {id}});
    if (!match) {
        return jsonError("Match not found.", 404);
    }
    if (match.round && match.status !== "PENDING") {
        const laterRoundExists = await prisma.match.count({where: {round: {gt: match.round}}});
        if (laterRoundExists > 0) {
            return jsonError("A completed match cannot be deleted after the next round has been drawn.", 409);
        }
    }

    await prisma.match.delete({where: {id}});
    if (match.status === "CONFIRMED") {
        await recomputeTournamentState();
    }
    await deleteUnusedPlaceholders([match.playerAId, match.playerBId]);

    return Response.json({ok: true});
}

async function deleteUnusedPlaceholders(playerIds: string[]) {
    if (playerIds.length === 0) return;
    const prisma = getPrisma();
    const placeholders = await prisma.player.findMany({
        where: {
            id: {in: playerIds},
            registrationStatus: PLACEHOLDER_STATUS,
            matchesA: {none: {}},
            matchesB: {none: {}},
        },
        select: {id: true},
    });
    if (placeholders.length > 0) {
        await prisma.player.deleteMany({where: {id: {in: placeholders.map((player) => player.id)}}});
    }
}
