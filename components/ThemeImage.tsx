export interface ThemeImageProps {
  lightSrc: string;
  darkSrc: string;
  alt?: string;
  width?: number;
  height?: number;
}

export function ThemeImage({ lightSrc, darkSrc, alt = "", width, height }: ThemeImageProps) {
  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={darkSrc} />
      <img src={lightSrc} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
    </picture>
  );
}
