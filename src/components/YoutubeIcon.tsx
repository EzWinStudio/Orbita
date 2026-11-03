interface YoutubeIconProps {
  size?: number;
  className?: string;
}

export function YoutubeIcon({ size = 16, className }: YoutubeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="2.6"
        y="5.1"
        width="18.8"
        height="13.8"
        rx="4.1"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M10.1 9.2 15.5 12l-5.4 2.8V9.2Z" fill="currentColor" />
    </svg>
  );
}
