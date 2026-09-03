import {z} from "zod";
import {getClaimedPlayerId, isAdmin} from "@/lib/cookies";
import {findDuplicateName, jsonError} from "@/lib/http";
import {cleanNamePart, isValidNamePart, normalizeNamePart} from "@/lib/names";
import {prisma} from "@/lib/prisma";
import {serializePlayer} from "@/lib/serialize";

async function canMutate(playerId: string) {
    if (await isAdmin()) {
        return true;
    }
    const claimed = await getClaimedPlayerId();
    return claimed === playerId;
}

export async function GET(
    _request: Request,
    ctx: RouteContext<"/api/players/[id]">,
) {
    const {id} = await ctx.params;
    const player = await prisma.player.findUnique({where: {id}});
    if (!player) {
        return jsonError("Player not found.", 404);
    }

    const [ratingEvents, matches] = await Promise.all([
        prisma.ratingEvent.findMany({
            where: {playerId: id},
            orderBy: {match: {confirmedAt: "asc"}},
            include: {match: true},
        }),
        prisma.match.findMany({
            where: {
                status: "CONFIRMED",
                OR: [{playerAId: id}, {playerBId: id}],
            },
            orderBy: {confirmedAt: "desc"},
            take: 20,
            include: {playerA: true, playerB: true, winner: true},
        }),
    ]);

    return Response.json({
        player: serializePlayer(player),
        ratingHistory: ratingEvents.map((event) => ({
            matchId: event.matchId,
            eloBefore: event.eloBefore,
            eloAfter: event.eloAfter,
        })),
        recentMatches: matches.map((match) => ({
            id: match.id,
            playerA: serializePlayer(match.playerA),
            playerB: serializePlayer(match.playerB),
            winnerId: match.winnerId,
            gamesJson: match.gamesJson,
            confirmedAt: match.confirmedAt,
        })),
    });
}

const updateSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    department: z.string().nullable().optional(),
    withdrawn: z.boolean().optional(),
});

export async function PATCH(
    request: Request,
    ctx: RouteContext<"/api/players/[id]">,
) {
    const {id} = await ctx.params;
    if (!(await canMutate(id))) {
        return jsonError("You can only edit your own listing.", 403);
    }

    const player = await prisma.player.findUnique({where: {id}});
    if (!player) {
        return jsonError("Player not found.", 404);
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return jsonError("Invalid JSON.");
    }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
        return jsonError("Invalid update.");
    }

    const firstName = parsed.data.firstName
        ? cleanNamePart(parsed.data.firstName)
        : player.firstName;
    const lastName = parsed.data.lastName
        ? cleanNamePart(parsed.data.lastName)
        : player.lastName;
    if (!isValidNamePart(firstName) || !isValidNamePart(lastName)) {
        return jsonError("Enter a first and last name (2–40 characters each).");
    }

    const firstNameNorm = normalizeNamePart(firstName);
    const lastNameNorm = normalizeNamePart(lastName);
    if (await findDuplicateName(firstNameNorm, lastNameNorm, id)) {
        return jsonError("That name is already on the list.");
    }

    const department =
        parsed.data.department === undefined
            ? player.department
            : parsed.data.department?.trim() || null;

    let withdrawnAt = player.withdrawnAt;
    if (parsed.data.withdrawn === true) {
        withdrawnAt = new Date();
    }
    if (parsed.data.withdrawn === false) {
        withdrawnAt = null;
    }

    const updated = await prisma.player.update({
        where: {id},
        data: {
            firstName,
            lastName,
            firstNameNorm,
            lastNameNorm,
            department,
            withdrawnAt,
        },
    });

    return Response.json({player: serializePlayer(updated)});
}

export async function DELETE(
    _request: Request,
    ctx: RouteContext<"/api/players/[id]">,
) {
    const {id} = await ctx.params;
    if (!(await canMutate(id))) {
        return jsonError("You can only remove your own listing.", 403);
    }

    const player = await prisma.player.findUnique({where: {id}});
    if (!player) {
        return jsonError("Player not found.", 404);
    }

    const updated = await prisma.player.update({
        where: {id},
        data: {withdrawnAt: new Date()},
    });

    return Response.json({player: serializePlayer(updated)});
}
