export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="max-w-2xl">
      <p className="text-brand-primary text-xs font-bold tracking-[0.18em] uppercase">
        {eyebrow}
      </p>
      <h1 className="text-brand-secondary mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
        {title}
      </h1>
      <p className="text-brand-secondary/55 mt-3 text-[0.95rem] leading-7">
        {description}
      </p>
    </header>
  );
}
