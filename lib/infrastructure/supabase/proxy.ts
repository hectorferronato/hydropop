import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicSupabaseConfig } from "./public-env";

function redirectWithRefreshedCookies(
  request: NextRequest,
  sessionResponse: NextResponse,
): NextResponse {
  const redirectResponse = NextResponse.redirect(
    new URL("/auth/login", request.url),
  );

  for (const cookie of sessionResponse.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}

export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let sessionResponse = NextResponse.next({ request });
  const { publishableKey, url } = getPublicSupabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        sessionResponse = NextResponse.next({ request });

        for (const { name, options, value } of cookiesToSet) {
          sessionResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data: claimsData, error } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (error || !claims?.sub) {
    return redirectWithRefreshedCookies(request, sessionResponse);
  }

  return sessionResponse;
}
