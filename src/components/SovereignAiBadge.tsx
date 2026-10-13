import Link from "next/link";

/**
 * The Mistral AI "M" mark, taken unmodified from the official logo SVG in the
 * mistralai/mistral-common repository. Mistral AI's name and logo are their
 * trademarks, used here only to say which AI the site runs on.
 */
export function MistralMark({ height = 16 }: { height?: number }) {
  return (
    <svg
      role="img"
      aria-label="Mistral AI"
      viewBox="-76.61 -161.245 181.818 151.515"
      height={height}
      width={(height * 181.818) / 151.515}
      style={{ display: "block" }}
    >
      <path d="M-46.307-161.245h30.303v30.303h-30.303zm121.212 0h30.303v30.303H74.905z" fill="gold" />
      <path d="M-46.307-130.942h60.606v30.303h-60.606zm90.909 0h60.606v30.303H44.602z" fill="#ffaf00" />
      <path fill="#ff8205" d="M-46.307-100.639h151.515v30.303H-46.307z" />
      <path d="M-46.307-70.336h30.303v30.303h-30.303zm60.606 0h30.303v30.303H14.299zm60.606 0h30.303v30.303H74.905z" fill="#fa500f" />
      <path d="M-76.61-40.033h90.909V-9.73H-76.61zm121.212 0h90.909V-9.73H44.602z" fill="#e10500" />
    </svg>
  );
}

/** Elegant one-line credit for the footer. */
export default function SovereignAiBadge() {
  return (
    <div className="eu-ai">
      <span>Proudly running on EU sovereign AI by</span>
      <Link href="/privacy#ai" className="eu-ai-brand" aria-label="Mistral AI, see how we use AI">
        <MistralMark height={15} />
        <b>Mistral AI</b>
      </Link>
    </div>
  );
}
