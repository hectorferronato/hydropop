export default function CalendarLoading() {
  return (
    <div role="status" className="animate-pulse">
      <div className="bg-brand-primary/10 h-3 w-24 rounded-full" />
      <div className="bg-brand-secondary/10 mt-5 h-10 w-64 rounded-xl" />
      <div className="bg-brand-secondary/5 mt-8 h-[30rem] rounded-[2rem]" />
      <span className="sr-only">Loading hydration calendar…</span>
    </div>
  );
}
