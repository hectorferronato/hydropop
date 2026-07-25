import { NextResponse } from "next/server";

import { createClient } from "@/lib/infrastructure/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/auth/login", request.url), 303);
}
