import { AppShell } from "@/components/app-shell";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";

export default async function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAllowedUser();

  return <AppShell userEmail={user.email}>{children}</AppShell>;
}
