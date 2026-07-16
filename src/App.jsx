import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CreatePoll from './components/CreatePoll/CreatePoll';
import PollView from './components/PollView/PollView';
import LanguageProvider from './i18n/LanguageProvider';
import { useTranslation } from './i18n/useTranslation';
import OfflineBanner from './components/shared/OfflineBanner';

function LanguageToggle() {
  const { lang, setLang } = useTranslation();

  const button = (value, label) => (
    <button
      onClick={() => setLang(value)}
      aria-pressed={lang === value}
      className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
        lang === value
          ? 'bg-blue-600 text-white'
          : 'bg-white text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
      {button('en', 'EN')}
      {button('pl', 'PL')}
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <OfflineBanner />
          <header className="bg-white shadow-sm">
            <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">
                Board Game Scheduler
              </h1>
              <LanguageToggle />
            </div>
          </header>

          <main className="max-w-4xl mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<CreatePoll />} />
              <Route path="/poll/:pollId" element={<PollView />} />
            </Routes>
          </main>
        </div>
      </Router>
    </LanguageProvider>
  );
}

export default App;
