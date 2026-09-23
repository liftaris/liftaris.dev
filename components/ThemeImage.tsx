export interface ThemeImageProps {
  lightSrc: string;
  darkSrc: string;
  alt?: string;
}

export function ThemeImage({ lightSrc, darkSrc, alt = "" }: ThemeImageProps) {
  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={darkSrc} />
      <img src={lightSrc} alt={alt} loading="lazy" decoding="async" />
    </picture>
  );
}
