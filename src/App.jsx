import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CreatePoll from './components/CreatePoll/CreatePoll';
import PollView from './components/PollView/PollView';
import LanguageProvider from './i18n/LanguageProvider';
import AuthProvider from './auth/AuthProvider';
import { useTranslation } from './i18n/useTranslation';
import OfflineBanner from './components/shared/OfflineBanner';
import AccountMenu from './components/shared/AccountMenu';
import Logo from './components/shared/Logo';
import PrivacyPage from './components/shared/PrivacyPage';
import DonateButton from './components/shared/DonateButton';

function LanguageToggle() {
  const { lang, setLang } = useTranslation();

  const button = (value, label) => (
    <button
      onClick={() => setLang(value)}
      aria-pressed={lang === value}
      className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
        lang === value
          ? 'bg-terra text-ground'
          : 'bg-surface text-neutral-700 hover:bg-ink/5'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex rounded-full border border-neutral-400 overflow-hidden">
      {button('en', 'EN')}
      {button('pl', 'PL')}
    </div>
  );
}

function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center gap-4">
      <DonateButton />
      <p className="text-sm text-neutral-600 flex items-center gap-2">
        <span>MeppleTime</span>
        <span aria-hidden="true">&middot;</span>
        <Link to="/privacy" className="underline hover:text-ink">
          {t('footerPrivacy')}
        </Link>
      </p>
    </footer>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
      <Router>
        <div className="min-h-screen bg-ground">
          <OfflineBanner />
          <header className="bg-surface shadow-sm">
            <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
              <h1 className="leading-none">
                <Link to="/" aria-label="MeppleTime home" className="inline-flex rounded-full">
                  <Logo />
                </Link>
              </h1>
              <div className="flex items-center gap-3 shrink-0">
                <LanguageToggle />
                <AccountMenu />
              </div>
            </div>
          </header>

          <main className="max-w-4xl mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<CreatePoll />} />
              <Route path="/poll/:pollId" element={<PollView />} />
              <Route path="/privacy" element={<PrivacyPage />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
