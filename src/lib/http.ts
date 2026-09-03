import type {GameScore} from "@/lib/match-rules";
import {prisma} from "@/lib/prisma";

export function jsonError(message: string, status = 400) {
    return Response.json({error: message}, {status});
}

export async function findDuplicateName(
    firstNameNorm: string,
    lastNameNorm: string,
    exceptId?: string,
) {
    return prisma.player.findFirst({
        where: {
            firstNameNorm,
            lastNameNorm,
            ...(exceptId ? {id: {not: exceptId}} : {}),
        },
    });
}

export function parseGamePayload(input: unknown): GameScore[] | null {
    if (!Array.isArray(input)) {
        return null;
    }
    const games: GameScore[] = [];
    for (const item of input) {
        if (!item || typeof item !== "object") {
            return null;
        }
        const record = item as { a?: unknown; b?: unknown };
        const a = Number(record.a);
        const b = Number(record.b);
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
            return null;
        }
        games.push({a, b});
    }
    return games;
}
