// The MeppleTime brand mark and lockup. The mark is the illustrated
// split calendar (sage left, terracotta right, cream meeple on the
// seam) from Adam's logotype delivered 3 Aug 2026
// (design-assets/good-logotype.svg), extracted without the wordmark
// into src/assets/mepple-mark.svg by scripts/generate-icons.mjs.
// The wordmark stays live text: the logotype sets it in Bogart
// Extrabold, a commercial font we do not ship, so Caprasimo remains
// the in-app wordmark face, Mepple in sage and Time in terracotta.

import markUrl from '../../assets/mepple-mark.svg';

export function MeppleMark({ size = 36, className = '' }) {
  return (
    <img
      src={markUrl}
      alt=""
      aria-hidden="true"
      className={className}
      style={size ? { height: size, width: 'auto' } : undefined}
    />
  );
}

// Smaller on phones so the lockup fits beside the language toggle
// and the longer Polish sign-in button; below 375 px there is no room
// for the wordmark at all, so the header shows the mark alone (the
// home link keeps its aria-label)
function Logo({ markClass = 'h-8 sm:h-[38px] w-auto', textClass = 'hidden min-[375px]:inline text-lg sm:text-2xl' }) {
  return (
    <span className="inline-flex items-center gap-2 sm:gap-2.5">
      <MeppleMark size={null} className={markClass} />
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
