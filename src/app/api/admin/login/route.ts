import {z} from "zod";
import {adminCredentialsOk, setAdminSession} from "@/lib/cookies";
import {jsonError} from "@/lib/http";

const schema = z.object({
    username: z.string(),
    password: z.string(),
});

export async function POST(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return jsonError("Invalid JSON.");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return jsonError("Username and password are required.");
    }
    if (!adminCredentialsOk(parsed.data.username, parsed.data.password)) {
        return jsonError("Wrong username or password.", 401);
    }
    await setAdminSession();
    return Response.json({ok: true});
}
