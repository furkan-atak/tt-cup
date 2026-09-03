import {z} from "zod";
import {isAdmin} from "@/lib/cookies";
import {jsonError} from "@/lib/http";
import {getSettings, updateSettings} from "@/lib/settings";

export async function GET() {
    const settings = await getSettings();
    return Response.json({
        eventName: settings.eventName,
        registrationOpen: settings.registrationOpen,
        startDate: settings.startDate,
        endDate: settings.endDate,
    });
}

const patchSchema = z.object({
    eventName: z.string().min(2).max(80).optional(),
    registrationOpen: z.boolean().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
});

export async function PATCH(request: Request) {
    if (!(await isAdmin())) {
        return jsonError("Admin only.", 403);
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return jsonError("Invalid JSON.");
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
        return jsonError("Invalid settings.");
    }

    const settings = await updateSettings({
        eventName: parsed.data.eventName,
        registrationOpen: parsed.data.registrationOpen,
        startDate:
            parsed.data.startDate === undefined
                ? undefined
                : parsed.data.startDate
                    ? new Date(parsed.data.startDate)
                    : null,
        endDate:
            parsed.data.endDate === undefined
                ? undefined
                : parsed.data.endDate
                    ? new Date(parsed.data.endDate)
                    : null,
    });

    return Response.json(settings);
}
