import type { SVGProps } from "react";

export function BrandLogoSvg({ id, ...props }: { id: string } & SVGProps<SVGSVGElement>) {
  const letter = id.charAt(0).toUpperCase();

  switch (id) {
    case "netflix":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <path d="M72.2 11.2L72 89H58.6L36.3 36.3V89H25V11h13.2l22.7 54.1V11h11.3z" fill="#E50914" />
        </svg>
      );
    case "spotify":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <circle cx="50" cy="50" r="50" fill="#1DB954" />
          <path d="M72.8 72.3c-1.1 1.6-3.1 2.2-4.8 1.1-13-8-29.4-9.8-48.8-5.3-2 .5-3.8-1-4.3-2.9-.5-2 1-3.8 2.9-4.3 21.6-5.1 39.8-3 54.1 5.8 1.8 1 2.2 3.1 1.1 4.8zm2-10.8c-1.3 2.1-4 2.8-6 1.4-15.1-9.3-38.4-12-55.5-6.6-2.3.7-4.8-.5-5.5-2.8-.7-2.3.5-4.8 2.8-5.5 20.3-6.4 46.5-3.3 64.1 7.6 2.1 1.1 2.8 3.8 1.5 6zm.6-11.2C57.6 39.4 33.4 38.3 19.5 42.6c-2.8.9-5.7-.7-6.5-3.5-.9-2.8.7-5.7 3.5-6.5 16.3-4.9 43.1-3.7 63.8 8.6 2.5 1.4 3.3 4.6 1.8 7.2-1.4 2.4-4.5 3.3-7.1 1.8z" fill="#000" />
        </svg>
      );
    case "amazon":
    case "amazon_prime":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <path d="M80.2 69.8c-10.4 7.2-25.1 10.3-40.2 10.3C26.1 80.1 13 75.3 5 69c-1-.8-1-2.2 0-3 1.1-1 2.6-.9 3.6.1 7.3 5.8 19 10.2 31.4 10.2 13.9 0 27.2-3.2 36.6-9.6 1-.7 2.4-.4 3.1.6.7 1.1.4 2.5-.6 3.4z" fill="#FF9900" />
          <path d="M85 64c-.4-.4-.5-1-.1-1.3l4.6-2.5c.3-.2.8 0 1 .4 1 2.3 2.5 7.6 1 12.3-.2.5-.7.8-1.2.6L79.1 70c-.5-.2-.7-.7-.5-1.2l1.6-4c.2-.5.8-.7 1.3-.5l3.5 1.4z" fill="#FF9900" />
          <path d="M60 41.5c0-12-7-18-18.4-18-12 0-18 6.5-18 15.5 0 8 5.4 14.5 15.5 14.5 7 0 12-3.4 15.1-7.5l.3 6h7.3V34c0-8.5-5.3-13.5-14.5-13.5-8.5 0-13.8 4.2-15 10.3l7 1.5c1-3 3.4-5.2 8-5.2 4.4 0 7 2.2 7 6v2.2c-2.4-.6-5.4-.8-8.5-.8-9.4 0-16 4-16 11 0 6 4.3 10 11.5 10 5.4 0 9.8-3 11.8-7.5l.3.3zm-7.6 3c-2 2.8-5.3 4.2-9.4 4.2-4 0-6.4-2.2-6.4-5.4 0-4.3 4.3-6.5 10.8-6.5 2.5 0 5 .2 7 .5v2.8c0 2-.4 3.5-1.5 4.8l-.4-.4z" fill="#FFF" />
        </svg>
      );
    case "uber":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <text x="50" y="58" fontSize="48" fontWeight="500" fontFamily="-apple-system, sans-serif" fill="#FFF" textAnchor="middle">Uber</text>
        </svg>
      );
    case "ola":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <circle cx="50" cy="50" r="50" fill="#D6DF27" />
          <text x="50" y="62" fontSize="40" fontWeight="700" fontFamily="sans-serif" fill="#000" textAnchor="middle">Ola</text>
        </svg>
      );
    case "swiggy":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <path d="M50 0C22.4 0 0 22.4 0 50s22.4 50 50 50 50-22.4 50-50S77.6 0 50 0zm0 85c-19.3 0-35-15.7-35-35S30.7 15 50 15s35 15.7 35 35-15.7 35-35 35zM38 31c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm24 0c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7z" fill="#FC8019" />
          <path d="M68 62c-3.5 6-10.2 10-18 10S35.5 68 32 62h36z" fill="#FC8019" />
        </svg>
      );
    case "youtube_premium":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <rect x="10" y="25" width="80" height="50" rx="15" fill="#FF0000" />
          <path d="M42 38L64 50L42 62V38Z" fill="#FFF" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <text x="50" y="66" fontSize="50" fontWeight="600" fontFamily="sans-serif" fill="currentColor" textAnchor="middle">{letter}</text>
        </svg>
      );
  }
}
