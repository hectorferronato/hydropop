export default function TodayLoading() {
  return (
    <div role="status" className="animate-pulse">
      <div className="bg-brand-primary/10 h-3 w-28 rounded-full" />
      <div className="bg-brand-secondary/10 mt-5 h-10 w-72 rounded-xl" />
      <div className="bg-brand-secondary/5 mt-8 h-56 rounded-[2rem]" />
      <span className="sr-only">Loading today’s hydration dashboard…</span>
    </div>
  );
}
