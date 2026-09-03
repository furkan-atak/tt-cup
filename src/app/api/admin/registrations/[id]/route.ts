import {z} from "zod";
import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {prisma} from "@/lib/prisma";

const reviewSchema = z.object({
    decision: z.enum(["APPROVED", "REJECTED"]),
});

export async function PATCH(
    request: Request,
    ctx: RouteContext<"/api/admin/registrations/[id]">,
) {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return jsonError("Invalid JSON.");
    }
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
        return jsonError("Invalid registration decision.");
    }

    const {id} = await ctx.params;
    const result = parsed.data.decision === "APPROVED"
        ? await prisma.player.updateMany({
            where: {id, registrationStatus: "PENDING"},
            data: {registrationStatus: "APPROVED"},
        })
        : await prisma.player.deleteMany({
            where: {id, registrationStatus: "PENDING"},
        });
    if (result.count === 0) {
        return jsonError("Registration request not found.", 404);
    }

    return Response.json({ok: true});
}
