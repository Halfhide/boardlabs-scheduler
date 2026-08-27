import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';

// Mirrors the default EXPIRY_MONTHS of api/expire-polls.js; keep the
// two in sync if the retention window ever changes.
const EXPIRY_MONTHS = 12;

const CONTACT_EMAIL = 'adam.jastrzebski@codelabs.pl';

function PrivacyPage() {
  const { t } = useTranslation();

  const heading = 'text-lg font-bold text-ink mt-6 mb-2';
  const body = 'text-neutral-800 leading-relaxed';
  const extLink = 'underline text-terra-700 hover:text-terra-800';

  return (
    <div className="bg-surface rounded-lg shadow-md p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-ink mb-4">{t('privacyTitle')}</h2>
      <p className={body}>{t('privacyIntro')}</p>

      <h3 className={heading}>{t('privacyWhatTitle')}</h3>
      <p className={body}>{t('privacyWhatIntro')}</p>
      <ul className={`${body} list-disc pl-6 mt-2 space-y-1`}>
        <li>{t('privacyWhatItem1')}</li>
        <li>{t('privacyWhatItem2')}</li>
        <li>{t('privacyWhatItem3')}</li>
        <li>{t('privacyWhatItem4')}</li>
      </ul>
      <p className={`${body} mt-2`}>{t('privacyWhatOutro')}</p>

      <h3 className={heading}>{t('privacyWhereTitle')}</h3>
      <p className={body}>{t('privacyWhereBody')}</p>
      <p className="text-sm text-neutral-600 mt-2">
        {t('privacyRecaptchaPrefix')}{' '}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className={extLink}
        >
          {t('privacyRecaptchaPrivacy')}
        </a>{' '}
        {t('privacyRecaptchaAnd')}{' '}
        <a
          href="https://policies.google.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          className={extLink}
        >
          {t('privacyRecaptchaTerms')}
        </a>{' '}
        {t('privacyRecaptchaSuffix')}
      </p>

      <h3 className={heading}>{t('privacyHowLongTitle')}</h3>
      <p className={body}>{t('privacyHowLongBody', { months: EXPIRY_MONTHS })}</p>

      <h3 className={heading}>{t('privacyRemovalTitle')}</h3>
      <p className={body}>{t('privacyRemovalOwner')}</p>
      <p className={`${body} mt-2`}>
        {t('privacyContactPrefix')}{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className={extLink}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <p className="mt-8">
        <Link to="/" className="text-terra-700 hover:text-terra-800 underline">
          {t('backToHome')}
        </Link>
      </p>
    </div>
  );
}

export default PrivacyPage;
