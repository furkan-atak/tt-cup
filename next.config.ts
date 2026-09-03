import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;

import {initOpenNextCloudflareForDev} from "@opennextjs/cloudflare";
void initOpenNextCloudflareForDev();
