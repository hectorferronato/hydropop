export function ActionSpinner({
  className = "size-4",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent`}
    />
  );
}
