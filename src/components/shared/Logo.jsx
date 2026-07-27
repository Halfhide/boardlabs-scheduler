// The MeppleTime brand mark and lockup, from Adam's design system
// (design-assets/MeppleTime Design System.html): a split calendar
// tile, sage left and terracotta right, with a cream meeple standing
// on the seam and two binder rings on top. Geometry is a faithful
// SVG port of the reference (84x84 box, tile from y=8, radius 20).
// Rules honored here: the seam stays centered, the meeple straddles
// it, rings drop below 32px, and the wordmark is always Caprasimo
// with Mepple in sage and Time in terracotta.

export function MeppleMark({ size = 36, className = '' }) {
  const rings = size >= 32;
  return (
    <svg
      viewBox="0 0 84 84"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {rings && (
        <>
          <rect x="18.5" y="0" width="9" height="13" rx="4.5" fill="#56633f" />
          <rect x="53.8" y="0" width="9" height="13" rx="4.5" fill="#8c491a" />
        </>
      )}
      <clipPath id="mepple-tile">
        <rect x="0" y="8" width="84" height="76" rx="20" />
      </clipPath>
      <g clipPath="url(#mepple-tile)">
        <rect x="0" y="8" width="42" height="76" fill="#7a8a5e" />
        <rect x="42" y="8" width="42" height="76" fill="#c67139" />
      </g>
      <g fill="#f5ead8">
        <circle cx="42" cy="35" r="10" />
        <rect x="18" y="47" width="48" height="10" rx="5" />
        <polygon points="30,51 54,51 67,75 17,75" />
      </g>
    </svg>
  );
}

function Logo({ markSize = 38, textClass = 'text-2xl' }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <MeppleMark size={markSize} />
      <span
        className={`${textClass} leading-none`}
        style={{ fontFamily: '"Caprasimo", system-ui, sans-serif' }}
      >
        <span className="text-sage-700">Mepple</span>
        <span className="text-terra-600">Time</span>
      </span>
    </span>
  );
}

export default Logo;
