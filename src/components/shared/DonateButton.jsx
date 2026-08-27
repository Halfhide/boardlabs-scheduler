import { useTranslation } from '../../i18n/useTranslation';
import bcLogo from '../../assets/buycoffee-logo.svg';
import bmcButton from '../../assets/bmc-button.png';

// Official platform branding for the donation link, self-hosted so it
// works offline and needs no third-party request. English UI: Buy Me
// a Coffee's official yellow button (their brand page's embed asset).
// Polish UI: buycoffee.to's official white wordmark (copy of their
// /img/brand/bc-logo.svg) on black, matching how the brand presents
// itself.
function DonateButton() {
  const { t, lang } = useTranslation();

  return (
    <a
      href={t('donateUrl')}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex rounded-full hover:opacity-85 transition-opacity"
    >
      {lang === 'pl' ? (
        <span className="inline-flex items-center bg-black rounded-full h-9 px-5">
          <img
            src={bcLogo}
            alt="Postaw mi kawę na buycoffee.to"
            className="h-[17px] w-auto"
          />
        </span>
      ) : (
        <img
          src={bmcButton}
          alt="Buy me a coffee"
          className="h-9 w-auto"
        />
      )}
    </a>
  );
}

export default DonateButton;
