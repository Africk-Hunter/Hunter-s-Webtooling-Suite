import { useState } from 'react'

const cards = [
  { icon: '✳', title: 'Build with intention', text: 'Small, thoughtful details make the everyday feel a little more considered.' },
  { icon: '↗', title: 'Make room to grow', text: 'Flexible systems adapt as your ideas get bigger and your needs change.' },
  { icon: '◒', title: 'Keep it human', text: 'Good work starts with listening, clear communication, and real care.' },
]

const plans = [
  { name: 'Starter', price: '$24', detail: 'For the first steps', action: 'Choose Starter', featured: false },
  { name: 'Studio', price: '$48', detail: 'For growing ideas', action: 'Choose Studio', featured: true },
  { name: 'Collective', price: '$96', detail: 'For the whole team', action: 'Choose Collective', featured: false },
]

const swatches = [
  ['--color-primary', 'Evergreen'],
  ['--color-accent', 'Apricot'],
  ['--color-highlight', 'Butter'],
  ['--color-danger', 'Coral'],
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [sent, setSent] = useState(false)

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top"><span className="brand-mark">p.</span> playground<span className="brand-dot">/</span></a>
        <button className="menu-toggle" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        <nav className={menuOpen ? 'site-nav open' : 'site-nav'}>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#colors" onClick={() => setMenuOpen(false)}>Color tokens</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
          <a className="button button-small" href="#contact" onClick={() => setMenuOpen(false)}>Say hello <span>↗</span></a>
        </nav>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow"><span className="status-dot" /> A little room to experiment</div>
            <h1>Make something<br /><span>feel just right.</span></h1>
            <p className="hero-intro">A friendly sandbox full of real-world layouts, repeatable components, and tiny details to tune. Pick an element and see what you can make.</p>
            <div className="hero-actions">
              <a className="button" href="#features">Explore the playground <span>↓</span></a>
              <a className="text-link" href="#contact">See what’s inside <span>↗</span></a>
            </div>
            <div className="hero-meta"><span>✳ &nbsp;Made for tinkering</span><span>⌘ &nbsp;Nothing is precious</span></div>
          </div>
          <div className="hero-art" aria-label="Abstract colorful geometric artwork">
            <div className="art-grid"><span /><span /><span /><span /></div>
            <div className="art-note note-top">A good place to start <span>✳</span></div>
            <div className="art-note note-bottom">Try a new color <span>↗</span></div>
            <div className="art-orbit"><div className="orbit-core">p.</div></div>
          </div>
        </section>

        <section id="features" className="section-wrap features-section">
          <div className="section-heading">
            <div><div className="eyebrow">The building blocks</div><h2>Lots of little things<br />to play with.</h2></div>
            <p>Repeated cards, mixed layouts, different type sizes, and enough color to make experimenting fun.</p>
          </div>
          <div className="feature-grid">
            {cards.map((card) => (
              <article className="card feature-card" key={card.title}>
                <div className="feature-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <a className="card-link" href="#contact">Take a closer look <span>↗</span></a>
              </article>
            ))}
          </div>
          <div className="quote-card">
            <div className="quote-mark">“</div>
            <blockquote>Play is not a break from the work. It’s where the good stuff begins.</blockquote>
            <div className="quote-byline"><span className="avatar">JM</span><span><strong>Jamie Morgan</strong><br />Professional experimenter</span></div>
            <div className="quote-spark">✳</div>
          </div>
        </section>

        <section id="colors" className="color-section">
          <div className="section-wrap color-layout">
            <div>
              <div className="eyebrow">A tiny theme system</div>
              <h2>Color has<br />a point of view.</h2>
              <p>These swatches are connected to CSS custom properties. Change a token and watch it travel through the page.</p>
              <div className="swatch-list">
                {swatches.map(([token, name]) => (
                  <div className="swatch-row" key={token}>
                    <span className="swatch" style={{ background: `var(${token})` }} />
                    <span><strong>{name}</strong><small>{token}</small></span>
                    <span className="swatch-arrow">↗</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="color-poster">
              <div className="poster-top"><span>COLOR STUDY 01</span><span>2025 — 26</span></div>
              <div className="poster-shape shape-one" />
              <div className="poster-shape shape-two" />
              <div className="poster-shape shape-three" />
              <div className="poster-type">GOOD<br /><i>things</i><br />TAKE<br />SHAPE.</div>
              <div className="poster-bottom"><span>KEEP MOVING THINGS AROUND</span><span>✳</span></div>
            </div>
          </div>
        </section>

        <section id="pricing" className="section-wrap pricing-section">
          <div className="section-heading">
            <div><div className="eyebrow">Pick your pace</div><h2>Room for every<br />kind of idea.</h2></div>
            <p>A little pricing grid for spacing, alignment, and button experiments.</p>
          </div>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={plan.featured ? 'card price-card featured' : 'card price-card'} key={plan.name}>
                {plan.featured && <div className="popular">A GOOD FIT <span>✳</span></div>}
                <div className="plan-name">{plan.name}</div>
                <p>{plan.detail}</p>
                <div className="price">{plan.price}<small> / month</small></div>
                <ul><li>Thoughtful essentials</li><li>Room to make it yours</li><li>Friendly support</li></ul>
                <button className={plan.featured ? 'button' : 'button button-outline'}>{plan.action} <span>↗</span></button>
              </article>
            ))}
          </div>
        </section>

        <section className="banner-wrap section-wrap">
          <div className="banner-card">
            <div><div className="eyebrow">You’re doing great</div><h2>One more little<br />thing to try?</h2></div>
            <a className="button button-light" href="#contact">Let’s make a thing <span>↗</span></a>
            <div className="banner-flower">✳</div>
          </div>
        </section>

        <section id="contact" className="section-wrap contact-section">
          <div className="contact-copy">
            <div className="eyebrow">Open invitation</div>
            <h2>Got a good<br />question?</h2>
            <p>Try the fields, buttons, and labels. This form is just for show, so send it as many times as you like.</p>
            <div className="contact-stamp">LET’S<br />TALK<span>↗</span></div>
          </div>
          <form className="contact-form card" onSubmit={(event) => { event.preventDefault(); setSent(true) }}>
            <label>Your name<input name="name" placeholder="Avery Example" /></label>
            <label>Email address<input name="email" type="email" placeholder="avery@example.com" /></label>
            <label>What’s on your mind?<textarea name="message" rows="4" placeholder="A little note goes here..." /></label>
            <div className="form-footer"><span>{sent ? 'Thanks for playing — your note is ready!' : 'No pressure. Just practice.'}</span><button className="button" type="submit">{sent ? 'Sent!' : 'Send a note'} <span>↗</span></button></div>
          </form>
        </section>
      </main>

      <footer className="site-footer section-wrap">
        <a className="brand" href="#top"><span className="brand-mark">p.</span> playground<span className="brand-dot">/</span></a>
        <span>A tiny sandbox for big ideas.</span>
        <a href="#top">Back to top ↑</a>
      </footer>
    </>
  )
}

export default App
