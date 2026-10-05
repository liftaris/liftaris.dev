export function ThingLabel({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={`thing-label text-xs leading-[1.3] text-center select-none [overflow-wrap:anywhere] line-clamp-2 group-hover:not-[[aria-disabled=true]]:underline group-hover:underline-offset-4 group-hover:decoration-2 group-focus-visible:not-[[aria-disabled=true]]:underline group-focus-visible:underline-offset-4 group-focus-visible:decoration-2 group-data-[visited=true]:group-hover:decoration-visited-purple group-data-[visited=true]:group-focus-visible:decoration-visited-purple ${className}`}
    >
      {name}
    </span>
  );
}
