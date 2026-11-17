// Content of the landing guide pages (feature 24), rendered by
// scripts/generate-guides.mjs. English and Polish are written for
// their own readers, not translated line by line. Inside a body,
// {{guide:<id>}} becomes the path of that guide in the same language.
// Competitor facts in the "doodle" guide were checked against each
// vendor's own pages on 17 Nov 2026 (sources listed on the page);
// re-check them whenever that guide is edited.

export const UI = {
  en: {
    guides: 'Guides',
    guide: 'Guide',
    inShort: 'In short',
    updated: 'Updated',
    minRead: 'min read',
    openApp: 'Open the app',
    bandTitle: 'Plan your next game night',
    bandBody: 'Create a poll, share one link and let your friends vote on the date and the game. Free, no accounts needed.',
    bandCta: 'Plan your game night',
    moreGuides: 'More guides',
    readGuide: 'Read the guide',
    footNote: 'Made for game nights.',
    privacy: 'Privacy',
    sourceCode: 'Source code',
    languageLabel: 'Language',
    breadcrumbLabel: 'Breadcrumb',
    onThisPage: 'On this page',
    ogLocale: 'en_US',
    notFoundTitle: 'This page is not on the board',
    notFoundBody: 'The link may be old or mistyped. The pages below will get you back to the game.',
    notFoundHome: 'MeppleTime home'
  },
  pl: {
    guides: 'Poradniki',
    guide: 'Poradnik',
    inShort: 'W skrócie',
    updated: 'Aktualizacja:',
    minRead: 'min czytania',
    openApp: 'Otwórz aplikację',
    bandTitle: 'Zaplanuj kolejny wieczór gier',
    bandBody: 'Utwórz ankietę, udostępnij jeden link i pozwól znajomym zagłosować na termin i grę. Za darmo, bez zakładania kont.',
    bandCta: 'Zaplanuj wieczór gier',
    moreGuides: 'Więcej poradników',
    readGuide: 'Przeczytaj poradnik',
    footNote: 'Stworzone dla wieczorów planszówek.',
    privacy: 'Prywatność',
    sourceCode: 'Kod źródłowy',
    languageLabel: 'Język',
    breadcrumbLabel: 'Ścieżka nawigacji',
    onThisPage: 'W tym poradniku',
    ogLocale: 'pl_PL',
    notFoundTitle: 'Tej strony nie ma na planszy',
    notFoundBody: 'Link może być nieaktualny albo zawierać literówkę. Strony poniżej pomogą wrócić do gry.',
    notFoundHome: 'Strona główna MeppleTime'
  }
};

export const HUB = {
  en: {
    slug: 'guides',
    title: 'Board Game Night Guides | MeppleTime',
    description: 'Practical guides for planning board game nights: scheduling with friends, choosing what to play, and how MeppleTime compares with Doodle and other polls.',
    h1: 'Game night guides',
    intro: 'Short, practical guides to the planning side of board game nights: finding a date that works, choosing what to play, and picking the right tool for the job.'
  },
  pl: {
    slug: 'poradniki',
    title: 'Poradniki o wieczorach planszówkowych | MeppleTime',
    description: 'Praktyczne poradniki o planowaniu planszówek: jak umówić się ze znajomymi, jak wybrać grę i jak MeppleTime wypada na tle Doodle i innych ankiet.',
    h1: 'Poradniki o wieczorach planszówkowych',
    intro: 'Krótkie, praktyczne poradniki o organizacyjnej stronie planszówek: jak znaleźć termin, który pasuje wszystkim, jak wybrać grę i jakiego narzędzia do tego użyć.'
  }
};

const SOURCES = [
  ['Doodle, plans and pricing', 'Doodle, plany i cennik', 'https://doodle.com/en/premium'],
  ['Doodle Help Center, account to take part in a group poll', 'Centrum pomocy Doodle, konto a udział w ankiecie grupowej', 'https://help.doodle.com/en/articles/9457227-do-i-need-a-doodle-account-to-participate-in-a-group-poll'],
  ['Doodle Help Center, the "if need be" answer', 'Centrum pomocy Doodle, odpowiedź „if need be”', 'https://help.doodle.com/en/articles/9457343-how-does-the-if-need-be-group-poll-response-work'],
  ['Doodle Help Center, deadlines and other special settings', 'Centrum pomocy Doodle, termin głosowania i inne ustawienia specjalne', 'https://help.doodle.com/en/articles/9457346-how-do-i-set-a-deadline-limit-participants-send-automatic-reminders-or-make-my-group-poll-hidden'],
  ['Doodle Help Center, how long group polls are kept', 'Centrum pomocy Doodle, jak długo przechowywane są ankiety', 'https://help.doodle.com/en/articles/9457337-how-long-does-doodle-keep-group-polls-until-when-will-my-group-poll-be-available'],
  ['Rallly, pricing and plan limits', 'Rallly, cennik i limity planów', 'https://rallly.co/pricing'],
  ['Rallly, creating a poll ("if need be")', 'Rallly, tworzenie ankiety („if need be”)', 'https://support.rallly.co/workflow/create.md'],
  ['Rallly, source code and license', 'Rallly, kod źródłowy i licencja', 'https://github.com/lukevella/rallly'],
  ['WhatsApp Help Center, polls', 'Centrum pomocy WhatsApp, ankiety', 'https://faq.whatsapp.com/796470361614974'],
  ['Messenger Help Center, polls', 'Centrum pomocy Messengera, ankiety', 'https://www.facebook.com/help/messenger-app/627307411210372']
];
const sourceList = (lang) => '<ol class="sources">\n' + SOURCES.map(([en, pl, url]) =>
  `<li>${lang === 'en' ? en : pl}: <a href="${url}">${url}</a></li>`).join('\n') + '\n</ol>';

export const GUIDES = [
  {
    id: 'schedule',
    published: '2026-11-17',
    updated: '2026-11-17',
    en: {
      slug: 'how-to-schedule-a-board-game-night',
      title: 'How to Schedule a Board Game Night with Friends | MeppleTime',
      description: 'Get game night on the calendar: propose a few dates, share one poll link, set a deadline and check the player count before you lock the night.',
      h1: 'How to schedule a board game night with friends',
      cardTitle: 'How to schedule a board game night',
      cardBody: 'Seven steps from "when are you free?" to a night everyone can make.',
      about: ['Board game night', 'Group scheduling'],
      lead: 'Offer three to five concrete dates, share one poll link and give people a deadline. Ask for yes, maybe or no, then pick the date that works for the game you want to play, not just the one with the most votes. Lock it, and tell everyone who is coming.',
      body: `
<p>Most game nights don't fail at the table. They fail in the group chat: someone asks "when is everyone free?", six people answer with six different kinds of maybe, and two weeks later nobody has played anything. What helps is a little structure, not more messages.</p>
<h2>1. Propose a few concrete dates</h2>
<p>Open questions produce vague answers. Pick three to five specific dates within the next two or three weeks and let people react to them. Add a weekend day or two if some of your group are busy on weekdays, and leave out any date you could not host.</p>
<h2>2. Share one link, with no sign-ups</h2>
<p>Every extra step loses someone. Put the dates in a poll that opens in any browser and does not ask voters to create an account or install an app, then post the link in the chat you already use. One link is also one source of truth, instead of answers scattered across a thread.</p>
<h2>3. Ask for yes, maybe or no</h2>
<p>A plain yes or no forces people to guess. "Maybe" covers the friend who can come if work allows, and it shows you which dates are fragile. When you compare dates, a simple rule works well: count each maybe as half a yes.</p>
<h2>4. Set a deadline</h2>
<p>Without a cutoff, a poll stays open until the last person remembers it. Give the group 48 to 72 hours and say so when you share the link. A poll that closes itself saves you from chasing people one by one.</p>
<h2>5. Check the player count, not just the votes</h2>
<p>The date with the most yes votes is not always the right one. If you want to play a game for three to five, a night with seven confirmed players needs a second table or a different game, and a night with two is hardly a game night. Decide how many players you can host and look for dates inside that range.</p>
<h2>6. Choose the game early</h2>
<p>Knowing what you will play helps people commit: a two-hour strategy game and a quick party game attract different crowds. Let everyone suggest a title or two, then vote. Our guide on <a href="{{guide:choose}}">choosing a game as a group</a> shows how to do that without a long debate.</p>
<h2>7. Lock the night and confirm</h2>
<p>Once the deadline passes, post the date, the game, the start time and the address in one message, and name who is coming. A clear "it's on" moment turns a likely date into a plan people put in their calendars.</p>
<h2>Make it a habit</h2>
<p>Regular groups can skip most of these steps. Two patterns work well:</p>
<ul>
<li><strong>A fixed slot</strong>, such as the first Friday of every month. People plan around it, and you only run a poll when the slot does not work.</li>
<li><strong>Book the next one at the table.</strong> Before everyone leaves, open a poll for the next game night while the group is still in the mood.</li>
</ul>
<h2>Doing it with MeppleTime</h2>
<p>MeppleTime was built for exactly this routine. Create a poll with your candidate dates, an optional voting deadline and the minimum and maximum player count, then share the link. Friends answer yes, maybe or no without an account, the group availability view shades each date by how many people can make it, and anyone can suggest games with BoardGameGeek search. When you lock the date, everyone sees the final night and who is coming. It is free and has no ads.</p>
`
    },
    pl: {
      slug: 'jak-umowic-sie-na-planszowki',
      title: 'Jak umówić się na planszówki ze znajomymi | MeppleTime',
      description: 'Jak ustalić termin planszówek: kilka konkretnych dat, jeden link do ankiety, termin głosowania i liczba graczy sprawdzona, zanim zaklepiesz wieczór.',
      h1: 'Jak umówić się na planszówki ze znajomymi',
      cardTitle: 'Jak umówić się na planszówki',
      cardBody: 'Siedem kroków od „kiedy wam pasuje?” do wieczoru, na który przyjdą wszyscy.',
      about: ['Wieczór planszówkowy', 'Ustalanie terminu spotkania'],
      lead: 'Zaproponuj od trzech do pięciu konkretnych dat, wyślij jeden link do ankiety i daj wszystkim czas na odpowiedź. Poproś o tak, może albo nie, a potem wybierz datę, która pasuje do gry, w którą chcecie zagrać, a nie tylko tę z największą liczbą głosów. Zaklep ją i napisz, kto przychodzi.',
      body: `
<p>Większość wieczorów planszówkowych przepada nie przy stole, tylko na grupowym czacie. Ktoś pyta „kiedy wam pasuje?”, sześć osób odpowiada sześcioma odcieniami „może”, a po dwóch tygodniach nikt w nic nie zagrał. Pomaga odrobina struktury, a nie kolejne wiadomości.</p>
<h2>1. Zaproponuj kilka konkretnych dat</h2>
<p>Otwarte pytanie daje mgliste odpowiedzi. Wybierz od trzech do pięciu konkretnych dat w ciągu najbliższych dwóch, trzech tygodni i pozwól znajomym się do nich odnieść. Jeśli część grupy jest zajęta w tygodniu, dorzuć dzień weekendowy, a pomiń terminy, w które nie możesz gościć.</p>
<h2>2. Wyślij jeden link, bez rejestracji</h2>
<p>Każdy dodatkowy krok kogoś po drodze gubi. Umieść daty w ankiecie, która otwiera się w każdej przeglądarce i nie wymaga od głosujących zakładania konta ani instalowania aplikacji, a link wrzuć na czat, z którego i tak korzystacie. Jeden link to też jedno źródło prawdy zamiast odpowiedzi rozsianych po wątku.</p>
<h2>3. Poproś o tak, może albo nie</h2>
<p>Samo tak lub nie zmusza ludzi do zgadywania. „Może” obejmuje znajomego, który dotrze, jeśli praca pozwoli, i pokazuje, które terminy są niepewne. Przy porównywaniu dat dobrze sprawdza się prosta zasada: każde „może” liczy się jako pół „tak”.</p>
<h2>4. Ustaw termin głosowania</h2>
<p>Ankieta bez terminu wisi otwarta, dopóki ostatnia osoba sobie o niej nie przypomni. Daj grupie od 48 do 72 godzin i napisz o tym od razu przy linku. Ankieta, która zamyka się sama, oszczędza ci przypominania każdemu z osobna.</p>
<h2>5. Sprawdź liczbę graczy, nie tylko głosy</h2>
<p>Data z największą liczbą głosów na tak nie zawsze jest właściwa. Jeśli chcecie zagrać w grę dla trzech do pięciu osób, wieczór z siedmioma chętnymi wymaga drugiego stołu albo innej gry, a wieczór we dwoje trudno nazwać planszówkowym spotkaniem. Ustal, ilu graczy możesz przyjąć, i szukaj dat w tym przedziale.</p>
<h2>6. Wybierzcie grę wcześniej</h2>
<p>Gdy wiadomo, w co gracie, łatwiej się zadeklarować: dwugodzinna strategia i szybka gra imprezowa przyciągają różne osoby. Niech każdy zaproponuje jeden lub dwa tytuły, a potem zagłosujcie. Jak zrobić to bez długiej dyskusji, opisujemy w poradniku o <a href="{{guide:choose}}">wyborze gry w grupie</a>.</p>
<h2>7. Zaklep wieczór i potwierdź</h2>
<p>Po upływie terminu głosowania podaj w jednej wiadomości datę, grę, godzinę i adres oraz wymień, kto przychodzi. Wyraźne „gramy” zamienia prawdopodobny termin w plan, który wszyscy wpisują do kalendarza.</p>
<h2>Niech to wejdzie w nawyk</h2>
<p>Stałe ekipy mogą pominąć większość tych kroków. Dobrze działają dwa sposoby:</p>
<ul>
<li><strong>Stały termin</strong>, na przykład pierwszy piątek miesiąca. Wszyscy planują pod niego, a ankietę robicie tylko wtedy, gdy termin akurat nie pasuje.</li>
<li><strong>Kolejne granie ustalane przy stole.</strong> Zanim wszyscy się rozejdą, otwórz ankietę na następny wieczór, póki grupa jest jeszcze w nastroju.</li>
</ul>
<h2>Jak zrobić to w MeppleTime</h2>
<p>MeppleTime powstał właśnie do tego. Utwórz ankietę z proponowanymi datami, opcjonalnym terminem głosowania oraz minimalną i maksymalną liczbą graczy, a potem udostępnij link. Znajomi odpowiadają tak, może albo nie bez zakładania konta, widok dostępności grupy cieniuje każdą datę według liczby osób, które mogą przyjść, a każdy może proponować gry z wyszukiwarką BoardGameGeek. Gdy zatwierdzisz termin, wszyscy zobaczą wybrany wieczór i listę osób, które przyjdą. Całość jest darmowa i bez reklam.</p>
`
    }
  },
  {
    id: 'doodle',
    published: '2026-11-17',
    updated: '2026-11-17',
    en: {
      slug: 'doodle-alternative-for-board-game-groups',
      title: 'A Doodle Alternative for Board Game Nights | MeppleTime',
      description: 'How MeppleTime compares with Doodle, Rallly and chat polls for planning board game nights: date voting, game voting, player counts and free-plan limits.',
      h1: 'A Doodle alternative built for board game nights',
      cardTitle: 'A Doodle alternative for game nights',
      cardBody: 'How MeppleTime compares with Doodle, Rallly and chat polls.',
      about: ['Doodle', 'Rallly', 'Scheduling poll', 'Board game night'],
      lead: 'Doodle, Rallly and chat polls are built to find a date. A game group also needs to agree on what to play and whether enough players can come. MeppleTime runs the date poll the same way (one link, no accounts for voters, yes, maybe or no on each date) and adds game voting with BoardGameGeek search and player counts. It is free, with no ads and no paid tier.',
      body: `
<p>If your group already uses Doodle or a poll in the group chat, you know the routine: someone lists dates, everyone ticks boxes, and the real questions start afterwards. What are we playing? Can six people play it? Who is actually coming? This page compares the common options for that job, based on each tool's own documentation.</p>
<h2>What a game night poll needs</h2>
<ul>
<li><strong>Date voting without sign-ups.</strong> Friends will not create an account to answer one question.</li>
<li><strong>A "maybe".</strong> Game nights often hinge on one or two people who are not sure yet.</li>
<li><strong>The game choice in the same place.</strong> The date and the game decide each other.</li>
<li><strong>Player counts.</strong> A great turnout is a problem for a four-player game.</li>
<li><strong>A clear final answer.</strong> One date, one game, and a list of who is coming.</li>
</ul>
<h2>Comparison at a glance</h2>
<p class="swipe-hint">Swipe the table sideways to see all four tools.</p>
<div class="table-scroll">
<table class="compare">
<caption class="sr-only">MeppleTime, Doodle, Rallly and chat polls compared for planning a board game night</caption>
<thead><tr><th scope="col"><span class="sr-only">Feature</span></th><th scope="col" class="us">MeppleTime</th><th scope="col">Doodle (free plan)</th><th scope="col">Rallly (free plan)</th><th scope="col">Chat poll (WhatsApp, Messenger)</th></tr></thead>
<tbody>
<tr><th scope="row">Price</th><td class="us">Free, no paid tier</td><td>Free plan, paid Pro</td><td>Free plan, paid Pro</td><td>Free in the app</td></tr>
<tr><th scope="row">Voters need an account</th><td class="us">No</td><td>No</td><td>No</td><td>Must be in the chat</td></tr>
<tr><th scope="row">Yes, maybe or no on each date</th><td class="us">Yes</td><td>Yes ("if need be")</td><td>Yes ("if need be")</td><td>No, a pick from a list</td></tr>
<tr><th scope="row">Polls on the free plan</th><td class="us">No limit</td><td>One group poll</td><td>3 collecting votes at once</td><td>No limit</td></tr>
<tr><th scope="row">Suggest and vote on games</th><td class="us">Yes, with BoardGameGeek search</td><td>Not built in</td><td>Not built in</td><td>A separate poll</td></tr>
<tr><th scope="row">Player count per date</th><td class="us">Yes</td><td>Not built in</td><td>Not built in</td><td>No</td></tr>
<tr><th scope="row">How long polls are kept</th><td class="us">About a year after the last date</td><td>May be deleted when inactive</td><td>Deleted 30 days after the dates pass, if inactive</td><td>As long as the chat</td></tr>
</tbody>
</table>
</div>
<p class="checked">Checked on 17 November 2026 against each vendor's own pages (sources below). Plans change, so check the current terms before you rely on a limit.</p>
<h2>Doodle</h2>
<p>Doodle is the name most people know, and its group poll handles the date part well: participants vote without an account and can answer "if need be". For a regular group the free plan is narrow, though. Doodle's plan page lists one group poll on the free plan, and its help center marks voting deadlines, participant limits and reminders as paid Professional features. An ad-free experience is also listed as a paid benefit. There is no built-in way to choose a game or check player counts.</p>
<p><strong>Choose Doodle if</strong> you already pay for it at work, or you need time slots within a day rather than whole days.</p>
<h2>Rallly</h2>
<p>Rallly is a clean, open-source scheduling tool (AGPL-3.0). Participants vote without an account and can answer "if need be", and the free plan does not limit the number of participants. Two limits matter for a game group: only three polls can collect votes at the same time, and free polls are deleted once their dates are more than 30 days past and there has been no activity for 30 days. Like Doodle, it schedules dates and times, not games.</p>
<p><strong>Choose Rallly if</strong> you need time slots, or you would like a tool you can host yourself.</p>
<h2>A poll in the group chat</h2>
<p>WhatsApp and Messenger polls are the quickest option when the group already lives in one chat. They are option polls, though: each person picks from a list, so there is no yes, maybe or no for each date, no overview of who can make which night, and choosing the game means a second poll. They work well for two or three people and an almost obvious date, and get messy beyond that.</p>
<p><strong>Choose a chat poll if</strong> the group is small and the date is nearly settled.</p>
<h2>MeppleTime</h2>
<p>MeppleTime takes the Doodle-style date poll and adds what game nights need. Anyone in the poll can suggest games with live BoardGameGeek search and vote for every game they would enjoy; the leading game appears next to the winning date. You can set a minimum and maximum player count, so each date shows whether enough people can play, and an optional voting deadline closes the poll on its own. A group availability view shades each date by how many people can come, and a table shows everyone's answers side by side.</p>
<p>It is free, with no ads and no paid tier, works in English and Polish, and its code is open source (GPL-3). Two honest limits: polls offer whole days rather than time slots, and there is no calendar export.</p>
<p><strong>Choose MeppleTime if</strong> you are planning a board game night and want the date, the game and the head count settled in one place.</p>
<h2>Sources</h2>
${sourceList('en')}
`
    },
    pl: {
      slug: 'alternatywa-dla-doodle-do-planszowek',
      title: 'Alternatywa dla Doodle do planowania planszówek | MeppleTime',
      description: 'Porównanie MeppleTime z Doodle, Rallly i ankietami na czacie przy planowaniu planszówek: głosowanie na terminy i gry, liczba graczy, limity darmowych planów.',
      h1: 'Alternatywa dla Doodle stworzona z myślą o planszówkach',
      cardTitle: 'Alternatywa dla Doodle do planszówek',
      cardBody: 'Jak MeppleTime wypada na tle Doodle, Rallly i ankiet na czacie.',
      about: ['Doodle', 'Rallly', 'Ankieta terminów', 'Wieczór planszówkowy'],
      lead: 'Doodle, Rallly i ankiety na czacie służą do znalezienia terminu. Grupa planszówkowa musi jeszcze ustalić, w co zagra i czy zbierze się wystarczająco dużo osób. MeppleTime prowadzi ankietę terminów tak samo (jeden link, głosujący bez kont, tak, może albo nie przy każdej dacie), a do tego ma głosowanie na gry z wyszukiwarką BoardGameGeek i liczbę graczy. Jest darmowy, bez reklam i bez płatnej wersji.',
      body: `
<p>Jeśli wasza ekipa korzysta już z Doodle albo z ankiety na grupowym czacie, zna ten schemat: ktoś wypisuje daty, wszyscy zaznaczają kratki, a prawdziwe pytania zaczynają się później. W co gramy? Czy da się w to zagrać w sześć osób? Kto naprawdę przyjdzie? Poniżej porównujemy popularne narzędzia do tego zadania na podstawie dokumentacji samych dostawców.</p>
<h2>Czego potrzebuje ankieta na planszówki</h2>
<ul>
<li><strong>Głosowania na daty bez rejestracji.</strong> Znajomi nie założą konta, żeby odpowiedzieć na jedno pytanie.</li>
<li><strong>Odpowiedzi „może”.</strong> Wieczór często zależy od jednej czy dwóch osób, które jeszcze nie wiedzą.</li>
<li><strong>Wyboru gry w tym samym miejscu.</strong> Termin i gra wzajemnie od siebie zależą.</li>
<li><strong>Liczby graczy.</strong> Świetna frekwencja to kłopot, gdy gra jest dla czterech osób.</li>
<li><strong>Jasnej odpowiedzi na koniec.</strong> Jedna data, jedna gra i lista osób, które przyjdą.</li>
</ul>
<h2>Porównanie w skrócie</h2>
<p class="swipe-hint">Przesuń tabelę w bok, aby zobaczyć wszystkie cztery narzędzia.</p>
<div class="table-scroll">
<table class="compare">
<caption class="sr-only">Porównanie MeppleTime, Doodle, Rallly i ankiet na czacie przy planowaniu wieczoru planszówkowego</caption>
<thead><tr><th scope="col"><span class="sr-only">Funkcja</span></th><th scope="col" class="us">MeppleTime</th><th scope="col">Doodle (plan darmowy)</th><th scope="col">Rallly (plan darmowy)</th><th scope="col">Ankieta na czacie (WhatsApp, Messenger)</th></tr></thead>
<tbody>
<tr><th scope="row">Cena</th><td class="us">Darmowy, bez płatnej wersji</td><td>Plan darmowy i płatny Pro</td><td>Plan darmowy i płatny Pro</td><td>Darmowa w aplikacji</td></tr>
<tr><th scope="row">Głosujący potrzebują konta</th><td class="us">Nie</td><td>Nie</td><td>Nie</td><td>Trzeba być na czacie</td></tr>
<tr><th scope="row">Tak, może albo nie przy każdej dacie</th><td class="us">Tak</td><td>Tak (opcja „if need be”)</td><td>Tak (opcja „if need be”)</td><td>Nie, wybór z listy</td></tr>
<tr><th scope="row">Ankiety w darmowym planie</th><td class="us">Bez limitu</td><td>Jedna ankieta grupowa</td><td>3 zbierające głosy naraz</td><td>Bez limitu</td></tr>
<tr><th scope="row">Propozycje gier i głosowanie na nie</th><td class="us">Tak, z wyszukiwarką BoardGameGeek</td><td>Brak</td><td>Brak</td><td>Osobna ankieta</td></tr>
<tr><th scope="row">Liczba graczy przy dacie</th><td class="us">Tak</td><td>Brak</td><td>Brak</td><td>Nie</td></tr>
<tr><th scope="row">Jak długo ankieta jest dostępna</th><td class="us">Około roku po ostatniej dacie</td><td>Może zostać usunięta, gdy jest nieaktywna</td><td>Usuwana 30 dni po minięciu dat, jeśli jest nieaktywna</td><td>Tak długo jak czat</td></tr>
</tbody>
</table>
</div>
<p class="checked">Stan na 17 listopada 2026 według stron samych dostawców (źródła poniżej). Plany się zmieniają, więc zanim oprzesz się na jakimś limicie, sprawdź aktualne warunki.</p>
<h2>Doodle</h2>
<p>Doodle to nazwa, którą zna większość osób, a jego ankieta grupowa dobrze radzi sobie z samym terminem: uczestnicy głosują bez konta i mogą odpowiedzieć „if need be”, czyli „w razie potrzeby”. Dla stałej ekipy darmowy plan jest jednak wąski. Strona z planami Doodle wymienia w darmowym planie jedną ankietę grupową, a centrum pomocy podaje, że termin głosowania, limit uczestników i przypomnienia to płatne funkcje planu Professional. Brak reklam również figuruje wśród płatnych korzyści. Nie ma wbudowanego sposobu na wybór gry ani sprawdzenie liczby graczy.</p>
<p><strong>Doodle sprawdzi się, jeśli</strong> płacisz za niego w pracy albo potrzebujesz konkretnych godzin w ciągu dnia, a nie całych dni.</p>
<h2>Rallly</h2>
<p>Rallly to przejrzyste narzędzie do ustalania terminów z otwartym kodem źródłowym (AGPL-3.0). Uczestnicy głosują bez konta i mogą odpowiedzieć „if need be”, a darmowy plan nie ogranicza liczby uczestników. Dla grupy planszówkowej ważne są dwa limity: głosy mogą zbierać naraz tylko trzy ankiety, a darmowe ankiety są usuwane, gdy od ich dat minie ponad 30 dni i przez 30 dni nie było w nich żadnej aktywności. Podobnie jak Doodle, Rallly ustala daty i godziny, a nie gry.</p>
<p><strong>Rallly sprawdzi się, jeśli</strong> potrzebujesz konkretnych godzin albo chcesz narzędzia, które możesz uruchomić na własnym serwerze.</p>
<h2>Ankieta na grupowym czacie</h2>
<p>Ankiety w WhatsAppie i Messengerze to najszybsze rozwiązanie, gdy cała grupa i tak siedzi na jednym czacie. To jednak ankiety z listą opcji: każdy wybiera z listy, więc nie ma odpowiedzi tak, może albo nie przy każdej dacie ani zestawienia, kto może którego wieczoru, a wybór gry wymaga drugiej ankiety. Sprawdzają się przy dwóch, trzech osobach i niemal oczywistym terminie, przy większej grupie robi się chaos.</p>
<p><strong>Ankieta na czacie sprawdzi się, jeśli</strong> grupa jest mała, a termin prawie ustalony.</p>
<h2>MeppleTime</h2>
<p>MeppleTime bierze ankietę terminów w stylu Doodle i dodaje to, czego potrzebuje wieczór gier. Każdy uczestnik ankiety może proponować gry z podpowiedziami z BoardGameGeek i głosować na wszystkie, w które chętnie zagra; prowadząca gra pojawia się obok zwycięskiego terminu. Możesz ustawić minimalną i maksymalną liczbę graczy, dzięki czemu przy każdej dacie widać, czy zbierze się komplet, a opcjonalny termin głosowania sam zamyka ankietę. Widok dostępności grupy cieniuje każdą datę według liczby osób, które mogą przyjść, a tabela pokazuje odpowiedzi wszystkich obok siebie.</p>
<p>Jest darmowy, bez reklam i bez płatnej wersji, działa po polsku i po angielsku, a jego kod jest otwarty (GPL-3). Dwa uczciwe ograniczenia: ankieta proponuje całe dni, a nie konkretne godziny, i nie ma eksportu do kalendarza.</p>
<p><strong>MeppleTime sprawdzi się, jeśli</strong> planujesz wieczór planszówkowy i chcesz ustalić termin, grę i skład w jednym miejscu.</p>
<h2>Źródła</h2>
${sourceList('pl')}
`
    }
  },
  {
    id: 'choose',
    published: '2026-11-17',
    updated: '2026-11-17',
    en: {
      slug: 'how-to-choose-a-board-game-as-a-group',
      title: 'How to Choose a Board Game to Play as a Group | MeppleTime',
      description: 'Pick the game for game night without a long debate: filter by player count and time, collect suggestions, then vote for everything you would enjoy.',
      h1: 'How to choose what to play at game night',
      cardTitle: 'How to choose what to play',
      cardBody: 'Filter by player count, let everyone suggest, then vote without hurt feelings.',
      about: ['Board games', 'Approval voting', 'Board game night'],
      lead: 'Filter first, then vote. Start from the games that fit the number of people coming and the time you have, ask each person for one or two suggestions, and let everyone vote for every game they would happily play instead of just one favorite. Settle a tie with the shorter game, or let whoever teaches it decide.',
      body: `
<p>Choosing the game can take longer than scheduling the night. The person with the biggest collection lists twenty titles, the newcomer has heard of none of them, and the loudest voice wins. A short, fair process saves the time and gives everyone a say.</p>
<h2>1. Start from the player count</h2>
<p>The number on the box is the range a game supports, not the range where it plays best. For a second opinion, look the game up on BoardGameGeek, where players vote on the best and recommended player counts. Keep only the games that work well for the number of people who are actually coming.</p>
<h2>2. Fit the time and the energy</h2>
<p>A weeknight after work suits something that plays in 60 to 90 minutes. A long weekend afternoon can take a heavy strategy game. Count the rules explanation too: a new, complex game can spend half an hour on the teach before anyone takes a turn.</p>
<h2>3. Think about the newest player</h2>
<p>If someone is new to modern board games, pick something with a short teach and simple turns, so they spend the evening playing instead of catching up. Cooperative games are another good option for mixed groups, because the whole table works through the rules together.</p>
<h2>4. Let everyone suggest, within limits</h2>
<p>Ask each person for one or two suggestions. That keeps the list short enough to vote on, gives quieter players a say, and stops one collection from taking over the evening. Whoever owns a game should confirm they can bring it and are happy to teach it.</p>
<h2>5. Vote for everything you would enjoy</h2>
<p>When each person can vote for only one game, the votes split between favorites and someone ends up playing a game they dislike. Let everyone vote for every suggestion they would be glad to play. This is called approval voting: the winner is the game the most people are happy with, which matters more on game night than the game one person loves most.</p>
<h2>6. Break ties fairly</h2>
<ul>
<li>Play the shorter game first, and the other one if there is time.</li>
<li>Let the person who will teach the game decide.</li>
<li>Give the pick to whoever chose least recently.</li>
</ul>
<h2>7. Take turns picking in a regular group</h2>
<p>Groups that meet often can skip the vote now and then and take turns choosing. It spreads the teaching load, brings new games to the table, and gives everyone a night that feels like theirs.</p>
<h2>Doing it with MeppleTime</h2>
<p>In a MeppleTime poll, anyone can suggest games with live BoardGameGeek search, so the right title and its link come up as you type. Everyone can vote for as many suggestions as they like, which is approval voting without having to explain it. The game with the most votes appears next to the winning date; if two games tie, the one suggested first leads. The minimum and maximum player count you set when creating the poll shows which dates have enough players. Planning the date as well? See <a href="{{guide:schedule}}">how to schedule a board game night</a>.</p>
`
    },
    pl: {
      slug: 'jak-wybrac-gre-na-wieczor-planszowkowy',
      title: 'Jak wybrać grę na wieczór planszówkowy | MeppleTime',
      description: 'Jak wybrać grę bez długiej dyskusji: odsiej tytuły po liczbie graczy i czasie, zbierz propozycje, a potem głosujcie na wszystko, w co chętnie zagracie.',
      h1: 'Jak wybrać grę na wieczór planszówkowy',
      cardTitle: 'Jak wybrać grę na wieczór',
      cardBody: 'Odsiej po liczbie graczy, zbierz propozycje i zagłosujcie tak, żeby nikt nie czuł się pominięty.',
      about: ['Gry planszowe', 'Głosowanie aprobujące', 'Wieczór planszówkowy'],
      lead: 'Najpierw odsiej, potem głosuj. Zacznij od gier, które pasują do liczby osób i czasu, jakim dysponujecie, poproś każdego o jedną lub dwie propozycje i niech wszyscy głosują na każdą grę, w którą chętnie zagrają, a nie tylko na ulubioną. Remis rozstrzygnij krótszą grą albo decyzją osoby, która będzie tłumaczyć zasady.',
      body: `
<p>Wybór gry potrafi trwać dłużej niż ustalenie terminu. Właściciel największej kolekcji wymienia dwadzieścia tytułów, nowa osoba nie zna żadnego, a wygrywa ten, kto mówi najgłośniej. Krótki, uczciwy sposób wyboru oszczędza czas i daje głos każdemu.</p>
<h2>1. Zacznij od liczby graczy</h2>
<p>Liczba na pudełku to zakres, który gra obsługuje, a nie ten, w którym działa najlepiej. Warto zajrzeć na stronę gry w serwisie BoardGameGeek, gdzie gracze głosują, przy ilu osobach gra jest najlepsza, a przy ilu polecana. Zostaw tylko gry, które dobrze działają przy liczbie osób, które naprawdę przyjdą.</p>
<h2>2. Dopasuj grę do czasu i energii</h2>
<p>Wieczór w tygodniu, po pracy, sprzyja grom na 60 do 90 minut. Długie weekendowe popołudnie zniesie ciężką strategię. Policz też tłumaczenie zasad: nowa, złożona gra potrafi zająć pół godziny, zanim ktokolwiek wykona pierwszy ruch.</p>
<h2>3. Pomyśl o najmniej doświadczonej osobie</h2>
<p>Jeśli ktoś dopiero poznaje nowoczesne planszówki, wybierz grę z krótkim wprowadzeniem i prostą turą, żeby ta osoba spędziła wieczór na graniu, a nie na nadrabianiu zasad. Dobrze sprawdzają się też gry kooperacyjne, bo cały stół poznaje reguły razem.</p>
<h2>4. Niech każdy coś zaproponuje, z umiarem</h2>
<p>Poproś każdego o jedną lub dwie propozycje. Lista pozostaje na tyle krótka, że da się nad nią głosować, cichsze osoby też mają głos, a jedna kolekcja nie przejmuje całego wieczoru. Osoba, która ma daną grę, powinna potwierdzić, że ją przyniesie i chętnie wytłumaczy zasady.</p>
<h2>5. Głosujcie na wszystko, w co chętnie zagracie</h2>
<p>Gdy każdy może zagłosować tylko na jedną grę, głosy rozpraszają się między ulubione tytuły i ktoś kończy wieczór przy grze, której nie lubi. Pozwólcie każdemu głosować na wszystkie propozycje, w które chętnie zagra. To tak zwane głosowanie aprobujące: wygrywa gra, która odpowiada największej liczbie osób, a na wieczorze planszówkowym to ważniejsze niż czyjś absolutny faworyt.</p>
<h2>6. Rozstrzygajcie remisy uczciwie</h2>
<ul>
<li>Zagrajcie najpierw w krótszą grę, a w drugą, jeśli starczy czasu.</li>
<li>Niech zdecyduje osoba, która będzie tłumaczyć zasady.</li>
<li>Oddajcie wybór temu, kto wybierał najdawniej.</li>
</ul>
<h2>7. W stałej ekipie wybierajcie po kolei</h2>
<p>Grupy, które spotykają się często, mogą czasem pominąć głosowanie i wybierać grę po kolei. Tłumaczenie zasad rozkłada się na więcej osób, na stół trafiają nowe tytuły, a każdy ma swój wieczór.</p>
<h2>Jak zrobić to w MeppleTime</h2>
<p>W ankiecie MeppleTime każdy może proponować gry z wyszukiwarką BoardGameGeek, więc właściwy tytuł i link do niego pojawiają się już podczas pisania. Każdy może zagłosować na dowolnie wiele propozycji, czyli głosowanie aprobujące działa samo, bez tłumaczenia. Gra z największą liczbą głosów pojawia się obok zwycięskiego terminu, a przy remisie prowadzi ta zaproponowana wcześniej. Minimalna i maksymalna liczba graczy, ustawiona przy tworzeniu ankiety, pokazuje, w które dni zbierze się komplet. Ustalasz też termin? Zobacz, <a href="{{guide:schedule}}">jak umówić się na planszówki</a>.</p>
`
    }
  }
];
