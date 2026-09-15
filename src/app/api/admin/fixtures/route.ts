import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {normalizeNamePart} from "@/lib/names";
import {PLACEHOLDER_STATUS, placeholderRoundMarker} from "@/lib/placeholders";
import {getPrisma} from "@/lib/prisma";
import {displayName} from "@/lib/utils";

type Candidate = {
    id: string;
    placeholder: false;
} | {
    id: string;
    placeholder: true;
    firstName: string;
    lastName: string;
    firstNameNorm: string;
    lastNameNorm: string;
    department: string;
    registrationStatus: string;
};

export async function POST() {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const prisma = getPrisma();
    const latestRoundResult = await prisma.match.aggregate({_max: {round: true}});
    const latestRound = latestRoundResult._max.round;

    if (latestRound === null) {
        const players = await prisma.player.findMany({
            where: {registrationStatus: "APPROVED", withdrawnAt: null, eliminatedAt: null},
            select: {id: true},
        });
        if (players.length < 2) {
            return jsonError(players.length === 1
                ? "The tournament already has a champion."
                : "At least two active players are required.");
        }

        const shuffled = shuffle(players);
        const fixtures = pairPlayers(shuffled.map((player) => player.id), 1);
        await prisma.match.createMany({data: fixtures});
        return Response.json({
            created: fixtures.length,
            round: 1,
            byePlayerId: shuffled.length % 2 ? shuffled.at(-1)?.id : null,
        });
    }

    const latestMatches = await prisma.match.findMany({
        where: {round: latestRound, status: {not: "VOID"}},
        orderBy: [{createdAt: "asc"}, {id: "asc"}],
        include: {playerA: true, playerB: true},
    });
    if (latestMatches.length === 0) {
        return jsonError("The latest round has no active matches.", 409);
    }
    if (latestMatches.some((match) =>
        match.playerA.registrationStatus === PLACEHOLDER_STATUS
        || match.playerB.registrationStatus === PLACEHOLDER_STATUS
    )) {
        return jsonError("Replace all winner placeholders before drawing another round.", 409);
    }
    const latestRoundWasPreDrawn = await prisma.player.count({
        where: {
            registrationStatus: PLACEHOLDER_STATUS,
            department: placeholderRoundMarker(latestRound),
        },
    });
    if (latestRoundWasPreDrawn > 0 && latestMatches.some((match) => match.status === "PENDING")) {
        return jsonError("Finish the pre-drawn round before drawing another round.", 409);
    }
    await deleteUnusedPlaceholders();

    const participantIds = latestMatches.flatMap((match) => [match.playerAId, match.playerBId]);
    const byePlayers = await prisma.player.findMany({
        where: {
            registrationStatus: "APPROVED",
            withdrawnAt: null,
            eliminatedAt: null,
            id: {notIn: participantIds},
        },
        select: {id: true},
    });

    const placeholders: Candidate[] = [];
    for (const match of latestMatches) {
        if (match.status === "CONFIRMED" && match.winnerId) {
            placeholders.push({id: match.winnerId, placeholder: false});
            continue;
        }
        const firstName = `${displayName(match.playerA.firstName, match.playerA.lastName)} - ${displayName(match.playerB.firstName, match.playerB.lastName)}`;
        const lastName = "Maçının Galibi";
        placeholders.push({
            id: crypto.randomUUID(),
            placeholder: true,
            firstName,
            lastName,
            firstNameNorm: normalizeNamePart(firstName),
            lastNameNorm: `${normalizeNamePart(lastName)}-${match.id}`,
            department: placeholderRoundMarker(latestRound + 1),
            registrationStatus: PLACEHOLDER_STATUS,
        });
    }

    const candidates = shuffle([
        ...placeholders.map((placeholder) => placeholder.id),
        ...byePlayers.map((player) => player.id),
    ]);
    if (candidates.length % 2) {
        const knownPlayerIndex = candidates.findIndex((id) =>
            !placeholders.some((placeholder) => placeholder.id === id && placeholder.placeholder),
        );
        if (knownPlayerIndex === -1) {
            return jsonError("Finish one match before drawing a round that needs a bye.", 409);
        }
        [candidates[knownPlayerIndex], candidates[candidates.length - 1]] = [
            candidates[candidates.length - 1],
            candidates[knownPlayerIndex],
        ];
    }
    const fixtures = pairPlayers(candidates, latestRound + 1);
    const placeholderData = placeholders.flatMap((placeholder) =>
        placeholder.placeholder ? [{
            id: placeholder.id,
            firstName: placeholder.firstName,
            lastName: placeholder.lastName,
            firstNameNorm: placeholder.firstNameNorm,
            lastNameNorm: placeholder.lastNameNorm,
            department: placeholder.department,
            registrationStatus: placeholder.registrationStatus,
        }] : [],
    );
    await prisma.$transaction([
        prisma.player.createMany({data: placeholderData}),
        prisma.match.createMany({data: fixtures}),
    ]);

    return Response.json({
        created: fixtures.length,
        round: latestRound + 1,
        byePlayerId: candidates.length % 2 ? candidates.at(-1) : null,
    });

    async function deleteUnusedPlaceholders() {
        const unused = await prisma.player.findMany({
            where: {
                registrationStatus: PLACEHOLDER_STATUS,
                matchesA: {none: {}},
                matchesB: {none: {}},
            },
            select: {id: true},
        });
        if (unused.length > 0) {
            await prisma.player.deleteMany({where: {id: {in: unused.map((player) => player.id)}}});
        }
    }
}

function pairPlayers(playerIds: string[], round: number) {
    const fixtures = [];
    for (let index = 0; index + 1 < playerIds.length; index += 2) {
        fixtures.push({
            playerAId: playerIds[index],
            playerBId: playerIds[index + 1],
            gamesJson: "[]",
            status: "PENDING",
            round,
        });
    }
    return fixtures;
}

function shuffle<T>(items: T[]) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}
