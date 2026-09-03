import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {matchWinnerFromGames, parseGames, validateBestOfThree} from "@/lib/match-rules";
import {getPrisma} from "@/lib/prisma";
import {recomputeTournamentState} from "@/lib/tournament";

export async function POST(
    _request: Request,
    ctx: RouteContext<"/api/matches/[id]/void">,
) {
    const {id} = await ctx.params;
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const prisma = getPrisma();
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
        data: {status: "VOID", winnerId: null},
    });
    await recomputeTournamentState();

    return Response.json({ok: true});
}

export async function DELETE(
    _request: Request,
    ctx: RouteContext<"/api/matches/[id]/void">,
) {
    const {id} = await ctx.params;
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const prisma = getPrisma();
    const match = await prisma.match.findUnique({where: {id}});
    if (!match) {
        return jsonError("Match not found.", 404);
    }
    if (match.status !== "VOID") {
        return jsonError("Only a voided match can be restored.");
    }
    if (match.round) {
        const laterRoundExists = await prisma.match.count({where: {round: {gt: match.round}}});
        if (laterRoundExists > 0) {
            return jsonError("A match cannot be restored after the next round has been drawn.", 409);
        }
    }

    const games = parseGames(match.gamesJson);
    const gamesError = validateBestOfThree(games);
    if (gamesError) {
        return jsonError("This match does not have a valid result to restore.", 409);
    }

    const winnerId = matchWinnerFromGames(games) === "a" ? match.playerAId : match.playerBId;
    await prisma.match.update({
        where: {id},
        data: {
            status: "CONFIRMED",
            winnerId,
            confirmedAt: match.confirmedAt ?? match.playedAt,
        },
    });
    await recomputeTournamentState();

    return Response.json({ok: true});
}
