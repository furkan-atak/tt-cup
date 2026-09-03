import {getClaimedPlayerId} from "@/lib/cookies";
import {getPrisma} from "@/lib/prisma";
import {serializePlayer} from "@/lib/serialize";
import {getSettings} from "@/lib/settings";

export async function GET() {
    const prisma = getPrisma();
    const [settings, claimedId] = await Promise.all([
        getSettings(),
        getClaimedPlayerId(),
    ]);

    const me = claimedId
        ? await prisma.player.findUnique({where: {id: claimedId}})
        : null;

    return Response.json({
        settings: {
            eventName: settings.eventName,
            registrationOpen: settings.registrationOpen,
            startDate: settings.startDate,
            endDate: settings.endDate,
            joinCodeRequired: Boolean(process.env.TT_JOIN_CODE),
        },
        me: me?.registrationStatus === "APPROVED" ? serializePlayer(me) : null,
    });
}
