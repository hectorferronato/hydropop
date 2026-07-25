import { SparkleIcon } from "./icons";

export function PlaceholderPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-brand-secondary/5 mt-8 overflow-hidden rounded-[1.75rem] border bg-white p-6 shadow-[0_24px_70px_rgba(62,41,255,0.08)] sm:p-8">
      <div className="bg-brand-primary/10 text-brand-primary flex size-11 items-center justify-center rounded-2xl">
        <SparkleIcon className="size-5" />
      </div>
      <h2 className="text-brand-secondary mt-5 text-xl font-bold tracking-tight">
        {title}
      </h2>
      <p className="text-brand-secondary/50 mt-2 max-w-xl text-sm leading-6">
        {description}
      </p>
      {children}
    </section>
  );
}
