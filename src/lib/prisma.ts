import {getCloudflareContext} from "@opennextjs/cloudflare";
import type {D1Database} from "@cloudflare/workers-types";
import {PrismaD1} from "@prisma/adapter-d1";
import {PrismaClient} from "@prisma/client";

declare global {
    interface CloudflareEnv {
        DB: D1Database;
    }
}

export function getPrisma() {
    const adapter = new PrismaD1(getCloudflareContext().env.DB);
    return new PrismaClient({adapter});
}
