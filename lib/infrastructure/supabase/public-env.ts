import { z } from "zod";

const publicSupabaseConfigSchema = z.object({
  url: z.url(),
  publishableKey: z.string().trim().min(1),
});

const siteUrlSchema = z.url();

export type PublicSupabaseConfig = z.infer<typeof publicSupabaseConfigSchema>;

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const result = publicSupabaseConfigSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    throw new Error(
      "Missing or invalid public Supabase configuration. See .env.example.",
    );
  }

  return result.data;
}

export function getSiteUrl(): string {
  const result = siteUrlSchema.safeParse(process.env.NEXT_PUBLIC_SITE_URL);

  if (!result.success) {
    throw new Error(
      "Missing or invalid NEXT_PUBLIC_SITE_URL. See .env.example.",
    );
  }

  return result.data;
}
