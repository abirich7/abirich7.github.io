import { useEffect, useRef, useState } from 'react';
import { useMouseScrub, useReducedMotion, useTypewriter } from './hooks';
import videoData from '../public/data/edited_videos.json';
import GrowthData from './GrowthData';

const EMAIL = 'abirichcrown@gmail.com';
const CV = '/cv/Abirich-Vaithiyalingam-Social-Media-Content-Lead-CV.pdf';
const ATS = '/cv/Abirich-Vaithiyalingam-Social-Media-Content-Lead-CV-ATS.pdf';
const INTRO = 'I turn good stories into growing audiences. From the first idea to the final frame. What are we building next?';
const VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_041744_63efcd78-bf7d-4039-99e2-2461e8a61903.mp4';
const links = [['Work', '#work'], ['About', '#about'], ['Process', '#process']] as const;
type Format = 'All work' | 'Shorts' | 'Long form' | 'AI visuals';
type Film = { id: string; title: string; views: number; seconds: number; credit: string; start?: number; format: Format };
const films: Film[] = [
  ...videoData.shortForm.map(video => ({ ...video, format: 'Shorts' as Format })),
  ...videoData.longForm.map(video => ({ ...video, format: 'Long form' as Format })),
  ...videoData.aiVisuals.map(video => ({ ...video, format: 'AI visuals' as Format })),
];
const featured = ['wSLWpX5PGvU', 'XVHnvPxSHa0', 'rPrJmcNbTEM'].map(id => films.find(film => film.id === id)!);
const formatViews = (number: number) => number >= 1000000 ? `${(number / 1000000).toFixed(2)}M` : `${Math.round(number / 1000)}K`;

function CopyIcon() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" /><path d="M10 3V2H2v8h1" stroke="currentColor" strokeLinecap="round" /></svg>;
}

function CopyEmail({ outline = false }: { outline?: boolean }) {
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setStatus('Email copied');
    } catch { setStatus('Copy unavailable. Use the email link below.'); }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(''), 4000);
  };
  return <div className="copy-wrap">
    <button className={`pill ${outline ? 'pill-outline' : 'pill-dark'}`} onClick={copy} aria-label="Copy email address">
      <span>{status === 'Email copied' ? 'Email copied' : <>Say hello: <span className="underline underline-offset-2">{EMAIL}</span></>}</span><CopyIcon />
    </button>
    <span className="sr-only" role="status">{status}</span>
    {status.startsWith('Copy unavailable') && <span className="copy-error">{status}</span>}
  </div>;
}

function App() {
  const reducedMotion = useReducedMotion();
  const [motionPaused, setMotionPaused] = useState(false);
  const reduced = reducedMotion || motionPaused;
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [actionsReady, setActionsReady] = useState(false);
  const [format, setFormat] = useState<Format>('All work');
  const [showAll, setShowAll] = useState(false);
  const [activeFilm, setActiveFilm] = useState<Film | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefCopied, setBriefCopied] = useState(false);
  const [briefCopyError, setBriefCopyError] = useState(false);
  const player = useRef<HTMLDialogElement>(null);
  const brief = useRef<HTMLDialogElement>(null);
  const navToggle = useRef<HTMLButtonElement>(null);
  const videoRef = useMouseScrub(reduced);
  const { displayed, done } = useTypewriter(INTRO, 38, 600, reduced);

  useEffect(() => {
    const delay = setTimeout(() => setActionsReady(true), 400);
    const scroll = () => setScrolled(window.scrollY > 48);
    scroll();
    window.addEventListener('scroll', scroll, { passive: true });
    return () => { clearTimeout(delay); window.removeEventListener('scroll', scroll); };
  }, []);

  useEffect(() => {
    const header = document.querySelector('.site-header');
    const main = document.querySelector('main');
    if (main instanceof HTMLElement) main.inert = menuOpen;
    document.body.style.overflow = menuOpen || activeFilm || briefOpen ? 'hidden' : '';
    const key = (event: KeyboardEvent) => {
      if (!menuOpen) return;
      if (event.key === 'Escape') { setMenuOpen(false); navToggle.current?.focus(); }
      if (event.key === 'Tab' && header) {
        const elements = Array.from(header.querySelectorAll<HTMLElement>('a, button')).filter(el => el.offsetParent !== null);
        const first = elements[0]; const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const resize = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener('keydown', key);
    window.addEventListener('resize', resize);
    return () => {
      document.body.style.overflow = '';
      if (main instanceof HTMLElement) main.inert = false;
      window.removeEventListener('keydown', key); window.removeEventListener('resize', resize);
    };
  }, [menuOpen, activeFilm, briefOpen]);

  useEffect(() => { if (activeFilm && !player.current?.open) player.current?.showModal(); }, [activeFilm]);
  useEffect(() => { if (briefOpen && !brief.current?.open) brief.current?.showModal(); }, [briefOpen]);
  const closePlayer = () => { player.current?.close(); setActiveFilm(null); };
  const closeBrief = () => { brief.current?.close(); setBriefOpen(false); setBriefCopied(false); setBriefCopyError(false); };
  const visibleFilms = format !== 'All work' ? films.filter(film => film.format === format) : showAll ? films : featured;

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className={`site-header fixed inset-x-0 top-0 z-50 px-5 sm:px-8 py-4 sm:py-5 ${scrolled ? 'header-scrolled' : ''} ${menuOpen ? 'menu-open' : ''}`}>
      <div className="nav-row flex justify-between items-center">
        <a href="#top" className="logo flex items-center gap-3" onClick={() => setMenuOpen(false)} aria-label="Abirich home">Abirich<sup>®</sup><span className="logo-asterisk select-none" aria-hidden="true">✳︎</span></a>
        <nav className="hidden md:flex desktop-nav" aria-label="Primary">{links.map(([label, href], i) => <span key={label}><a href={href} className="hover:opacity-60 transition-opacity">{label}</a>{i < links.length - 1 ? ', ' : ''}</span>)}</nav>
        <a className="nav-contact hidden md:block underline underline-offset-2 hover:opacity-60 transition-opacity" href="#contact">Get in touch</a>
        <button ref={navToggle} className="hamburger md:hidden" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}><span /><span /><span /></button>
      </div>
      <nav id="mobile-menu" className={`mobile-menu md:hidden ${menuOpen ? 'is-open' : ''}`} aria-label="Mobile" aria-hidden={!menuOpen} inert={!menuOpen}>
        {[...links, ['Get in touch', '#contact']].map(([label, href]) => <a key={label} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
        <a className="mobile-cv" href={CV} download>Download CV</a>
      </nav>
    </header>

    <main id="main">
      <section id="top" className="hero relative overflow-hidden">
        <div className="hero-color" />
        <video className={`hero-video ${reduced ? 'video-still' : ''}`} ref={videoRef} muted playsInline preload={reduced ? 'none' : 'auto'} aria-hidden="true" tabIndex={-1}>
          <source src={VIDEO} type="video/mp4" />
        </video>
        <div className="hero-word" aria-hidden="true">ABIRICH</div>
        <img className="hero-portrait" src="/assets/img/portrait-cutout.png" alt="Abirich Vaithiyalingam in a cream pinstripe suit" width="939" height="1675" fetchPriority="high" />
        <div className="hero-shade" />
        <div className="hero-content relative z-10">
          <p className="eyebrow hero-eyebrow">Abirich Vaithiyalingam <span>Content & Social Lead</span></p>
          <p className="intro-blur pointer-events-none select-none" aria-hidden="true">A little strategy.<br />A lot of creative instinct.</p>
          <h1>Good stories.<br /><span>Real growth.</span></h1>
          <p className="typewriter"><span className="sr-only">{INTRO}</span><span aria-hidden="true">{displayed}{!done && <span className="type-cursor" />}</span></p>
          <div className={`hero-actions flex flex-wrap gap-y-1 ${actionsReady ? 'actions-ready' : ''}`}>
            <a className="pill pill-white" href="#work">Explore my work</a>
            <button className="pill pill-white" onClick={() => setBriefOpen(true)}>The 30-second brief</button>
            <a className="pill pill-white" href={CV} download>Download my CV</a>
            <a className="pill pill-white" href="#process">How I work</a>
            <CopyEmail outline />
          </div>
        </div>
        <div className="hero-bottom"><span>Independent thinking. Measurable impact.</span><span>Bengaluru, India <span className="small-star" aria-hidden="true">✳︎</span></span></div>
      </section>

      <section className="proof-strip" aria-label="Career highlights">
        <div><strong>1.18M</strong><span>Followers on a page<br />I built from zero</span></div>
        <div><strong>87M+</strong><span>Lifetime views across<br />149 unique videos</span></div>
        <div><strong>2.96M</strong><span>Subscribers on a creator<br />brand I helped build</span></div>
        <div><strong>7+ years</strong><span>Turning ideas into<br />social-first content</span></div>
      </section>

      <section className="section section-light" id="work">
        <div className="section-head"><p className="eyebrow">01 / Selected work</p><div><h2>From an idea.<br /><span className="muted">To an audience.</span></h2><p>A few places where strategy, storytelling,<br className="hidden sm:block" /> and hands-on making came together.</p></div></div>
        <div className="case-grid">
          <article className="case-card case-yogic">
            <div className="case-visual red-visual"><span className="visual-label">Built from zero</span><strong>1.18<span>M</span></strong><p>people. one community.</p><span className="metric-foot">Facebook · 27 Sep 2026</span></div>
            <div className="case-meta"><span>Social strategy / Organic growth</span><span>01</span></div>
            <h3>Yogic Insights</h3><p>I built and ran an independent Facebook page, owning everything from clip selection and editing to publishing and audience insights.</p>
            <details className="case-details"><summary>The story & results <span>+</span></summary><div><p>179 posts. 149 unique videos. 21 videos with over one million lifetime views. A consistent format made spirituality and wellness stories accessible in the feed.</p><p>Active May 2019–December 2021. The page has 1,181,776 followers as of 27 September 2026. Independent and unofficial; not affiliated with Sadhguru or Isha Foundation.</p><a className="text-link" href="https://www.facebook.com/1686690976352496" target="_blank" rel="noreferrer">Visit the page</a> <a className="text-link" href="#growth-data">Explore the data</a></div></details>
          </article>
          <article className="case-card case-keerthi">
            <div className="case-visual film-visual"><img src="/assets/thumbs/wSLWpX5PGvU.jpg" alt="Keerthi's Took My Family to Mumbai video" loading="lazy" /><div className="film-gradient" /><span className="visual-label">A creator brand, built together</span><div className="film-visual-type"><span>Stories worth</span><strong>staying for.</strong></div><span className="visual-foot">YouTube + Instagram</span></div>
            <div className="case-meta"><span>Creative leadership / Creator growth</span><span>02</span></div>
            <h3>Keerthi</h3><p>Part of the core team behind a creator brand with 2.96M YouTube subscribers. I led post-production, trained editors, and looked after social publishing.</p>
            <details className="case-details"><summary>The story & results <span>+</span></summary><div><p>From 2023 to July 2026, my work covered Shorts, documentaries, titles, thumbnails, captions, and AI-assisted visuals. The 13 edits shown below have 11.7M combined views.</p><p>2.96M subscribers and 909K Instagram followers are whole-brand totals, not growth attributed to me alone. Public counts: 27 September 2026.</p><a className="text-link" href="https://www.youtube.com/@KeerthikaGovindhasamy" target="_blank" rel="noreferrer">Visit the channel</a></div></details>
          </article>
          <article className="case-card case-kharigai">
            <div className="case-visual brand-visual"><span className="visual-label">A brand with a point of view</span><div className="brand-word">Kharigai<span>Workwear. With character.</span></div><span className="visual-foot">Brand & social / 2020–2023</span></div>
            <div className="case-meta"><span>Brand direction / Social content</span><span>03</span></div>
            <h3>Kharigai</h3><p>A clear voice and a consistent visual identity for an Indian women's workwear brand, brought to life through Reels, shoots, carousels, and everyday content.</p>
            <details className="case-details"><summary>The story & results <span>+</span></summary><div><p>As Brand & Social Media Lead from 2020 to 2023, I planned content, wrote captions, and managed the account's daily presence.</p><p>The brand's Instagram has 40.1K followers as of 27 September 2026. This current brand total includes activity after my tenure.</p><a className="text-link" href="https://www.instagram.com/kharigaii/" target="_blank" rel="noreferrer">Visit Kharigai</a></div></details>
          </article>
        </div>
        <div id="growth-data" className="data-area"><p className="source-note">Portfolio figures are a snapshot from 27 September 2026. Source: supplied Meta export and public channel counts.</p><details className="data-disclosure"><summary>Behind the numbers <span>View growth data +</span></summary><GrowthData /></details></div>
      </section>

      <section className="section section-dark" id="films">
        <div className="section-head"><p className="eyebrow">02 / The films</p><div><h2>Made to<br /><span className="muted">hold attention.</span></h2><p>Short stories. Long stories. New possibilities with AI.<br />Selected edits for the Keerthi channel.</p></div></div>
        <div className="film-toolbar"><div className="film-filters" role="group" aria-label="Filter films">{(['All work', 'Shorts', 'Long form', 'AI visuals'] as Format[]).map(item => <button key={item} aria-pressed={format === item} onClick={() => { setFormat(item); setShowAll(false); }}>{item}<span>{item === 'All work' ? 13 : films.filter(f => f.format === item).length}</span></button>)}</div><span className="film-count" aria-live="polite">{visibleFilms.length} films shown / 11.7M views across all 13</span></div>
        <div className="film-grid">{visibleFilms.map(film => <article className="film-card" key={film.id}>
          <button className="film-thumb" onClick={() => setActiveFilm(film)} aria-label={`Watch ${film.title}`}><img src={`/assets/thumbs/${film.id}.jpg`} alt="" loading="lazy" /><span className="film-format">{film.format}</span><span className="play-icon" aria-hidden="true">▶</span><span className="film-duration">{Math.floor(film.seconds / 60)}:{String(film.seconds % 60).padStart(2, '0')}</span></button>
          <div className="film-card-top"><span>{formatViews(film.views)} views</span><span>Keerthi</span></div><h3><button onClick={() => setActiveFilm(film)}>{film.title}</button></h3><p className="film-credit">{film.credit}</p>
        </article>)}</div>
        {format === 'All work' && <div className="film-more"><button className="pill pill-outline" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show selected films' : 'Explore all 13 films'}</button></div>}
        <p className="source-note">Views are lifetime public counts as of 27 September 2026. Videos belong to their channel. Individual contributions and partial edits are credited above.</p>
      </section>

      <section className="section section-light about-section" id="about">
        <div className="about-portrait"><span className="eyebrow">The person behind the work</span><img src="/assets/img/portrait-cutout.png" alt="Abirich Vaithiyalingam" width="939" height="1675" loading="lazy" /><span className="portrait-caption">Abirich Vaithiyalingam</span></div>
        <div className="about-copy"><p className="eyebrow">03 / A little about me</p><h2>The big picture.<br /><span className="muted">And every frame.</span></h2><p className="about-lead">I'm Abirich. A content and social media lead who can shape the strategy, lead the creative, and make the work happen.</p><p>I started by building my own page from zero. That grew into brand building, creator partnerships, and leading post-production. I bring an understanding of audiences and the craft to turn ideas into something people want to watch.</p><div className="current-role"><span className="eyebrow">Currently / Sep 2026–present</span><h3>Senior Video Editor · Arkahub</h3><p>Creating explainers and customer stories for a rooftop solar brand in Bengaluru.</p></div><div className="about-actions"><a className="pill pill-dark" href={CV} download>Download CV</a><a className="text-link" href={ATS} download>Get the ATS version</a></div></div>
      </section>

      <section className="section process-section" id="process">
        <div className="section-head"><p className="eyebrow">04 / How I work</p><div><h2>Make it clear.<br /><span className="muted">Make it connect.</span></h2><p>A practical approach from the first conversation<br className="hidden sm:block" /> to the next round of content.</p></div></div>
        <div className="process-grid">{[
          ['01', 'Find the story.', 'Understand the audience, the brand, and what is worth saying. Build a content plan around that.'],
          ['02', 'Make it matter.', 'Shape the hook, format, title, and visual direction. Every choice gives someone a reason to watch.'],
          ['03', 'Bring it to life.', 'Lead the edit, build the visuals, and use AI where it helps. Keep the storytelling decisions human.'],
          ['04', 'Learn. Then refine.', 'Read the performance, look beyond the biggest hit, and use those insights to make the next piece better.'],
        ].map(([number, title, copy]) => <article key={number}><span className="process-number">{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
        <div className="tool-strip"><span className="eyebrow">Tools of the trade</span><p>Premiere Pro <span>·</span> After Effects <span>·</span> Photoshop <span>·</span> Runway <span>·</span> Kling AI <span>·</span> Google Flow <span>·</span> Meta Business Suite <span>·</span> YouTube Studio</p></div>
      </section>

      <footer className="contact-section" id="contact"><div className="contact-top"><p className="eyebrow">Good work starts with a conversation.</p><span className="contact-star" aria-hidden="true">✳︎</span></div><h2>Let's build<br />what's next.</h2><div className="contact-bottom"><div><p>Open to social media, content, and creative lead roles.</p><a className="contact-email" href={`mailto:${EMAIL}`}>{EMAIL}</a><div className="contact-buttons"><CopyEmail outline /><a className="pill pill-outline" href={CV} download>Download CV</a></div></div><div className="contact-location"><span>Bengaluru, India</span><a href="tel:+917904859661">+91 79048 59661</a><a href="tel:+919943764364">+91 99437 64364</a></div></div><div className="footer-line"><span>© {new Date().getFullYear()} Abirich Vaithiyalingam</span><button onClick={() => setMotionPaused(!motionPaused)} aria-pressed={reduced} disabled={reducedMotion}>{reduced ? 'Motion: reduced' : 'Motion: on'}</button><a href="#top">Back to top</a></div></footer>
    </main>

    <dialog ref={player} className="film-dialog" aria-label={activeFilm?.title || 'Video player'} onClose={() => setActiveFilm(null)} onClick={event => { if (event.target === event.currentTarget) closePlayer(); }}>
      {activeFilm && <div className="dialog-panel"><div className="dialog-head"><div><span className="eyebrow">{activeFilm.format}</span><h2>{activeFilm.title}</h2></div><button className="close-button" onClick={closePlayer} aria-label="Close video">×</button></div><iframe src={`https://www.youtube-nocookie.com/embed/${activeFilm.id}?start=${activeFilm.start || 0}&rel=0`} title={activeFilm.title} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /><div className="dialog-foot"><p>{activeFilm.credit}</p><a className="text-link" href={`https://www.youtube.com/watch?v=${activeFilm.id}&t=${activeFilm.start || 0}s`} target="_blank" rel="noreferrer">Watch on YouTube</a></div></div>}
    </dialog>
    <dialog ref={brief} className="brief-dialog" aria-label="The 30-second brief" onClose={() => setBriefOpen(false)} onClick={event => { if (event.target === event.currentTarget) closeBrief(); }}><div className="brief-panel"><button className="close-button" onClick={closeBrief} aria-label="Close brief">×</button><p className="eyebrow">The 30-second brief</p><h2>Strategy in mind.<br />Making at heart.</h2><p>Abirich Vaithiyalingam · Bengaluru<br />Social Media & Content Lead</p><ul><li><strong>1.18M followers</strong> on an independent page built from zero.</li><li><strong>87M+ lifetime views</strong> across 149 unique videos.</li><li><strong>Core-team experience</strong> with Keerthi, a creator brand with 2.96M subscribers.</li><li><strong>7+ years</strong> across content, social media, and video production.</li></ul><p>Looking for social media manager, content lead, creative lead, or YouTube channel management opportunities.</p><div className="brief-actions"><a className="pill pill-dark" href={CV} download>Download CV</a><button className="pill pill-light" onClick={async () => { try { await navigator.clipboard.writeText(`Abirich Vaithiyalingam — Social Media & Content Lead, Bengaluru. Built a page from zero to 1.18M followers, with 87M+ lifetime views across 149 videos. Core team at Keerthi (2.96M subscribers, brand total). 7+ years in content and video. Portfolio: https://abirich7.github.io/ Contact: ${EMAIL}`); setBriefCopied(true); setBriefCopyError(false); } catch { setBriefCopyError(true); } }}>{briefCopied ? 'Brief copied' : 'Copy brief'}</button><button className="text-link" onClick={() => window.print()}>Print brief</button></div><p role="status" className="source-note">{briefCopied ? 'Brief copied to clipboard.' : briefCopyError ? 'Copy unavailable. You can select the text above or download the CV.' : ''}</p><p className="source-note">Figures as of 27 September 2026. Channel totals reflect team work.</p></div></dialog>
  </>;
}

export default App;
