import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/infrastructure/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/today/:path*",
    "/setup/:path*",
    "/settings",
    "/settings/:path*",
    "/calendar/:path*",
    "/device/:path*",
    "/t/:path*",
  ],
};
