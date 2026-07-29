import { Brand } from "@/components/brand";
import { PageLoadingSkeleton } from "@/components/page-loading-skeleton";

export default function NfcScanLoading() {
  return (
    <main className="min-h-dvh w-full max-w-full overflow-x-clip px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-lg min-w-0 rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_30px_100px_rgba(62,41,255,0.14)] sm:p-8">
        <Brand />
        <div className="mt-8">
          <PageLoadingSkeleton />
        </div>
      </section>
    </main>
  );
}
