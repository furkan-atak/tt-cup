import {getCloudflareContext} from "@opennextjs/cloudflare";
import type {D1Database} from "@cloudflare/workers-types";
import {PrismaD1} from "@prisma/adapter-d1";
import {PrismaClient} from "@prisma/client";

declare global {
    interface CloudflareEnv {
        DB: D1Database;
    }

    var localPrisma: PrismaClient | undefined;
}

export function getPrisma() {
    if (process.env.NODE_ENV === "development") {
        globalThis.localPrisma ??= new PrismaClient();
        return globalThis.localPrisma;
    }

    const adapter = new PrismaD1(getCloudflareContext().env.DB);
    return new PrismaClient({adapter});
}
