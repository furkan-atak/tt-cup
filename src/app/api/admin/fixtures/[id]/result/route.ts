import {isAdmin} from "@/lib/cookies";
import {jsonError, parseGamePayload} from "@/lib/http";
import {matchWinnerFromGames, validateBestOfThree} from "@/lib/match-rules";
import {PLACEHOLDER_STATUS} from "@/lib/placeholders";
import {getPrisma} from "@/lib/prisma";
import {recomputeTournamentState} from "@/lib/tournament";
import {z} from "zod";

const resultSchema = z.object({games: z.unknown()});

export async function POST(request: Request, ctx: RouteContext<"/api/admin/fixtures/[id]/result">) {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const prisma = getPrisma();
    const {id} = await ctx.params;
    const match = await prisma.match.findUnique({
        where: {id},
        include: {playerA: {select: {registrationStatus: true}}, playerB: {select: {registrationStatus: true}}},
    });
    if (!match) {
        return jsonError("Match not found.", 404);
    }
    if (match.status !== "PENDING") {
        return jsonError("Only pending fixtures can receive a result.");
    }
    if (match.playerA.registrationStatus === PLACEHOLDER_STATUS
        || match.playerB.registrationStatus === PLACEHOLDER_STATUS) {
        return jsonError("Replace winner placeholders with the actual players before saving a result.", 409);
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return jsonError("Invalid JSON.");
    }
    const parsed = resultSchema.safeParse(body);
    const games = parsed.success ? parseGamePayload(parsed.data.games) : null;
    if (!games) {
        return jsonError("Game scores are invalid.");
    }
    const gamesError = validateBestOfThree(games);
    if (gamesError) {
        return jsonError(gamesError);
    }

    const winnerId = matchWinnerFromGames(games) === "a" ? match.playerAId : match.playerBId;
    await prisma.match.update({
        where: {id},
        data: {
            gamesJson: JSON.stringify(games),
            winnerId,
            status: "CONFIRMED",
            playedAt: new Date(),
            confirmedAt: new Date(),
        },
    });
    await recomputeTournamentState();

    return Response.json({ok: true});
}
