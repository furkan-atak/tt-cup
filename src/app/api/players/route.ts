import {z} from "zod";
import {getClaimedPlayerId, isAdmin} from "@/lib/cookies";
import {findDuplicateName, jsonError} from "@/lib/http";
import {cleanNamePart, isValidNamePart, normalizeNamePart} from "@/lib/names";
import {prisma} from "@/lib/prisma";
import {serializePlayer} from "@/lib/serialize";
import {getSettings} from "@/lib/settings";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
    const {searchParams} = new URL(request.url);
    const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? PAGE_SIZE) || PAGE_SIZE));

    const where = {registrationStatus: "APPROVED", withdrawnAt: null};
    const [total, players] = await Promise.all([
        prisma.player.count({where}),
        prisma.player.findMany({
            where,
            orderBy: [{eliminatedAt: "asc"}, {lastName: "asc"}, {firstName: "asc"}],
            skip: offset,
            take: limit,
        }),
    ]);

    return Response.json({
        total,
        nextOffset: offset + players.length < total ? offset + players.length : null,
        items: players.map(serializePlayer),
    });
}

const registerSchema = z.object({
    firstName: z.string(),
    lastName: z.string(),
    department: z.string().optional(),
    joinCode: z.string().optional(),
    approveImmediately: z.boolean().optional(),
});

export async function POST(request: Request) {
    const admin = await isAdmin();
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return jsonError("Invalid JSON.");
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
        return jsonError("First name and last name are required.");
    }

    const approveImmediately = parsed.data.approveImmediately === true && admin;
    const settings = await getSettings();
    if (!settings.registrationOpen && !approveImmediately) {
        return jsonError("Registration is closed.", 403);
    }

    const firstName = cleanNamePart(parsed.data.firstName);
    const lastName = cleanNamePart(parsed.data.lastName);
    if (!isValidNamePart(firstName) || !isValidNamePart(lastName)) {
        return jsonError("Enter a first and last name (2–40 characters each).");
    }

    const claimedId = approveImmediately ? null : await getClaimedPlayerId();
    if (claimedId) {
        const existingMe = await prisma.player.findUnique({where: {id: claimedId}});
        if (existingMe?.registrationStatus === "PENDING") {
            return jsonError("This browser already has a registration awaiting review.", 409);
        }
        if (existingMe?.registrationStatus === "APPROVED" && !existingMe.withdrawnAt) {
            return jsonError("This browser is already listed. Edit your name instead.", 409);
        }
    }

    const firstNameNorm = normalizeNamePart(firstName);
    const lastNameNorm = normalizeNamePart(lastName);
    if (await findDuplicateName(firstNameNorm, lastNameNorm)) {
        return jsonError("That name is already on the list.");
    }

    const department = parsed.data.department?.trim() || null;

    const player = await prisma.player.create({
        data: {
            firstName,
            lastName,
            firstNameNorm,
            lastNameNorm,
            department,
            registrationStatus: approveImmediately ? "APPROVED" : "PENDING",
        },
    });

    if (!approveImmediately) {
        return Response.json({message: "Registration request received."}, {status: 202});
    }
    return Response.json({player: serializePlayer(player)}, {status: 201});
}
