import bcLogo from '../../assets/buycoffee-logo.svg';
import bmcButton from '../../assets/bmc-button.png';

// Both donation platforms are always offered, in every language:
// Buy Me a Coffee for international supporters (earth emoji) and
// buycoffee.to for Polish ones (flag emoji; supports BLIK). Official
// branding, self-hosted assets: Buy Me a Coffee's yellow embed
// button, and buycoffee.to's white wordmark on their signature
// green-to-magenta brand gradient.
function DonateButton() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
      <a
        href="https://buymeacoffee.com/halfhide"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 hover:opacity-85 transition-opacity"
      >
        <span aria-hidden="true" className="text-lg">🌍</span>
        <img src={bmcButton} alt="Buy me a coffee" className="h-9 w-auto rounded-xl" />
      </a>
      <a
        href="https://buycoffee.to/halfhide"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 hover:opacity-85 transition-opacity"
      >
        <span aria-hidden="true" className="text-lg">🇵🇱</span>
        <span className="inline-flex items-center h-9 px-5 rounded-full bg-[linear-gradient(90deg,#009052,#b43899)]">
          <img
            src={bcLogo}
            alt="Postaw mi kawę na buycoffee.to"
            className="h-[17px] w-auto"
          />
        </span>
      </a>
    </div>
  );
}

export default DonateButton;
