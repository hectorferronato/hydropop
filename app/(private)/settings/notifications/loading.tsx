export default function NotificationSettingsLoading() {
  return (
    <div className="animate-pulse" aria-label="Loading notification settings">
      <div className="bg-brand-primary/10 h-3 w-24 rounded-full" />
      <div className="bg-brand-secondary/10 mt-4 h-9 w-72 max-w-full rounded-xl" />
      <div className="bg-brand-secondary/5 mt-8 h-64 rounded-[2rem]" />
    </div>
  );
}
