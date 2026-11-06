import { Mail, MapPin, MessageCircle } from "lucide-react";

const programs = [
  {
    number: "01",
    program: "run-club",
    category: "RUN CLUB",
    title: "Find your pace.",
    description: "Good miles, better company. Every pace belongs here.",
    className: "program-card program-card-run",
  },
  {
    number: "02",
    program: "strength",
    category: "STRENGTH",
    title: "Stronger, together.",
    description: "Small-group sessions built around showing up for each other.",
    className: "program-card program-card-strength",
  },
  {
    number: "03",
    program: "recovery",
    category: "RECOVERY",
    title: "Make room to reset.",
    description: "Mobility and recovery for everything you do next.",
    className: "program-card program-card-recovery",
  },
];

export default function Home() {
  return (
    <div className="site-shell">
      <header className="site-header" id="top">
        <a className="brand" href="#top" aria-label="Mesh Sports home">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span className="brand-name">
            MESH<span>SPORTS</span>
          </span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#training">Training</a>-
          <a href="#story">Our story</a>
          <a href="#community">Community</a>
          <a href="#contact">Contact</a>
        </nav>

        <a className="header-link" href="/join">
          Member login <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-mark" aria-hidden="true" />
              A DIFFERENT KIND OF SPORTS CLUB
            </p>
            <h1 id="hero-title">
              MOVE
              <br />
              AS <span>ONE.</span>
            </h1>
            <p className="hero-description">
              More than a workout. A little more courage, a lot more connection,
              and a reason to keep showing up.
            </p>
            <div className="hero-actions">
              <a className="button button-dark" href="#training">
                Explore the movement <span aria-hidden="true">↗</span>
              </a>
              <a className="text-link" href="#story">
                Get to know us <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div className="hero-note">
              <span className="hero-note-line" aria-hidden="true" />
              <span>FOR EVERY BODY. EVERY BEGINNING.</span>
            </div>
          </div>

          <div className="hero-visual" role="img" aria-label="Runners moving together on an outdoor trail">
            <div className="hero-visual-top">
              <span>PEOPLE FIRST. ALWAYS.</span>
              <span>EST. MMXXIV</span>
            </div>
            <div className="hero-stamp" aria-hidden="true">
              <span>SHOW UP</span>
              <span className="stamp-star">✳</span>
              <span>MOVE TOGETHER</span>
            </div>
            <div className="hero-caption">
              <span>THE BEST PART IS WHO YOU&apos;RE WITH.</span>
              <span>01 — 03</span>
            </div>
          </div>

          <span className="hero-index" aria-hidden="true">
            01 / MESH MOVEMENT
          </span>
        </section>

        <div className="ticker" aria-label="Our philosophy">
          <div className="ticker-track">
            <span>MOVE YOUR WAY</span>
            <span className="ticker-star" aria-hidden="true">✳</span>
            <span>FIND YOUR PEOPLE</span>
            <span className="ticker-star" aria-hidden="true">✳</span>
            <span>FEEL THE DIFFERENCE</span>
            <span className="ticker-star" aria-hidden="true">✳</span>
            <span>MOVE YOUR WAY</span>
            <span className="ticker-star" aria-hidden="true">✳</span>
            <span>FIND YOUR PEOPLE</span>
            <span className="ticker-star" aria-hidden="true">✳</span>
            <span>FEEL THE DIFFERENCE</span>
            <span className="ticker-star" aria-hidden="true">✳</span>
          </div>
        </div>

        <section className="training-section section-pad" id="training" aria-labelledby="training-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">01 / FIND YOUR THING</p>
              <h2 id="training-title">
                Good things happen
                <br />
                <span>in the work.</span>
              </h2>
            </div>
            <p className="section-intro">
              Come for the movement. Stay for the feeling that you belong right
              where you are.
            </p>
          </div>

          <div className="program-grid">
            {programs.map((program) => (
              <a className={program.className} href={`/join?program=${program.program}`} key={program.number}>
                <span className="program-number">{program.number} / MESH</span>
                <span className="program-content">
                  <span className="program-category">{program.category}</span>
                  <span className="program-title">{program.title}</span>
                  <span className="program-description">{program.description}</span>
                </span>
                <span className="program-arrow" aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </section>

        <section className="story-section" id="story" aria-labelledby="story-title">
          <div className="story-image" role="img" aria-label="Athlete training with a teammate">
            <span className="story-image-label">BETTER, NOT ALONE.</span>
          </div>
          <div className="story-copy">
            <p className="eyebrow">02 / WHY WE&apos;RE HERE</p>
            <h2 id="story-title">
              Sport feels
              <br />
              different <span>together.</span>
            </h2>
            <p>
              We built Mesh for the early risers, the starting-over-againers,
              the “I&apos;ll just watch” friends who end up joining in. No
              tryouts. No perfect pace. Just good people, moving forward.
            </p>
            <a className="text-link text-link-dark" href="#community">
              A little more about Mesh <span aria-hidden="true">↗</span>
            </a>
            <div className="story-signoff">
              <span>EVERY LEVEL. EVERY STORY.</span>
              <span>THAT&apos;S THE POINT.</span>
            </div>
          </div>
        </section>

        <section className="community-section" id="community" aria-labelledby="community-title">
          <p className="eyebrow">03 / YOUR NEXT CHAPTER</p>
          <h2 id="community-title">
            There&apos;s room
            <br />
            <span>for you here.</span>
          </h2>
          <p>Start where you are. We&apos;ll meet you there.</p>
          <a className="button button-light" href="/join">
            Find your first session <span aria-hidden="true">↗</span>
          </a>
          <span className="community-orbit community-orbit-one" aria-hidden="true" />
          <span className="community-orbit community-orbit-two" aria-hidden="true" />
        </section>

        <section className="contact-section" id="contact" aria-labelledby="contact-title">
          <div className="contact-copy">
            <p className="eyebrow">04 / DIRECT SUPPORT</p>
            <h2 id="contact-title">Need a hand? Talk to us.</h2>
            <p>Reach the Mesh Sports team directly for help, questions, or service.</p>
          </div>
          <div className="contact-links">
            <a className="contact-link" href="mailto:meshacmugisha8@gmail.com">
              <span className="contact-icon" aria-hidden="true"><Mail size={21} strokeWidth={1.8} /></span>
              <span className="contact-link-label">EMAIL</span>
              <strong>meshacmugisha8@gmail.com</strong>
              <span className="contact-link-action">Send an email <span aria-hidden="true">↗</span></span>
            </a>
            <a
              className="contact-link"
              href="https://wa.me/256705530398?text=Hello%20Mesh%20Sports%2C%20I%20need%20some%20help."
              rel="noreferrer"
              target="_blank"
            >
              <span className="contact-icon" aria-hidden="true"><MessageCircle size={21} strokeWidth={1.8} /></span>
              <span className="contact-link-label">WHATSAPP</span>
              <strong>0705530398</strong>
              <span className="contact-link-action">Chat with us <span aria-hidden="true">↗</span></span>
            </a>
          </div>
          <div className="branch-section" aria-labelledby="branch-title">
            <div className="branch-heading">
              <p className="eyebrow">VISIT A MESH SPORTS BRANCH</p>
              <h3 id="branch-title">Find us near you.</h3>
            </div>
            <ul className="branch-list">
              {[
                "Naalya",
                "Lugogo",
                "Entebbe",
                "Seeta",
              ].map((branch) => (
                <li key={branch}>
                  <MapPin aria-hidden="true" size={17} strokeWidth={1.8} />
                  <span>{branch}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top" aria-label="Mesh Sports, back to top">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand-name">
            MESH<span>SPORTS</span>
          </span>
        </a>
        <span className="footer-note">BUILT FOR THE JOY OF MOVING.</span>
        <a className="back-to-top" href="#top">
          BACK TO TOP <span aria-hidden="true">↑</span>
        </a>
        <span className="copyright">© MESH SPORTS 2026</span>
      </footer>
    </div>
  );
}
