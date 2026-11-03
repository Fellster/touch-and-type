import type { SVGProps } from "react";

export function NotedLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 838 838" aria-hidden="true" focusable="false" {...props}>
      <rect width="838" height="838" rx="196" fill="hsl(var(--primary))" />
      <path
        d="M230 112H476V223C476 265 509 298 551 298H676V640C676 680 645 712 606 712H232C193 712 162 681 162 642V182C162 143 192 112 230 112ZM514 112L676 264H557C533 264 514 245 514 221Z"
        fill="hsl(var(--primary-foreground))"
      />
      <path
        d="M325 376C291 435 254 517 256 561C330 460 426 365 466 387C511 412 437 503 472 531C497 550 532 525 565 494"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="48"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="614" cy="539" r="24" fill="hsl(var(--primary))" />
    </svg>
  );
}
