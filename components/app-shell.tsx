import { Brand } from "./brand";
import { DesktopNavigation, MobileNavigation } from "./app-navigation";
import { FormSubmitButton } from "./form-submit-button";
import { LogOutIcon } from "./icons";
import { NavigationFeedbackProvider } from "./navigation-feedback";

function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action="/auth/logout" method="post">
      <FormSubmitButton
        pendingLabel="Logging out…"
        className="text-brand-secondary/55 hover:text-brand-primary focus-visible:outline-brand-primary flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <LogOutIcon className="size-4" />
        <span className={compact ? "sr-only" : undefined}>Log out</span>
      </FormSubmitButton>
    </form>
  );
}

export function AppShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  return (
    <NavigationFeedbackProvider>
      <div className="min-h-screen">
        <aside className="border-brand-secondary/5 bg-brand-background/70 fixed inset-y-0 left-0 hidden w-64 border-r px-5 py-6 backdrop-blur-xl md:flex md:flex-col">
          <Brand />
          <DesktopNavigation />
          <div className="border-brand-secondary/5 mt-auto rounded-2xl border bg-white/70 p-3">
            <p className="text-brand-secondary/45 truncate px-3 text-xs font-medium">
              {userEmail}
            </p>
            <div className="mt-1">
              <LogoutButton />
            </div>
          </div>
        </aside>

        <div className="md:pl-64">
          <header className="border-brand-secondary/5 bg-brand-background/85 sticky top-0 z-40 flex h-18 items-center justify-between border-b px-5 backdrop-blur-xl md:hidden">
            <Brand />
            <LogoutButton compact />
          </header>
          <main className="mx-auto max-w-6xl px-5 pt-8 pb-28 sm:px-8 md:px-10 md:py-12">
            {children}
          </main>
        </div>

        <MobileNavigation />
      </div>
    </NavigationFeedbackProvider>
  );
}
