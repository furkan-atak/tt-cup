import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {getPrisma} from "@/lib/prisma";
import {serializeRegistrationRequest} from "@/lib/serialize";

export async function GET() {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    const prisma = getPrisma();

    const requests = await prisma.player.findMany({
        where: {registrationStatus: "PENDING"},
        orderBy: {createdAt: "asc"},
    });

    return Response.json({items: requests.map(serializeRegistrationRequest)});
}
