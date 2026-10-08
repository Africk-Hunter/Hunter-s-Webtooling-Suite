const features = [
  { title: 'Plan in minutes', text: 'Drop in your tasks and Orbit lays out a realistic week around your calendar.' },
  { title: 'Stay in sync', text: 'Everyone sees the same plan, with changes shared the moment they happen.' },
  { title: 'See what slips', text: 'Early warnings show which commitments are at risk before deadlines do.' },
]

const plans = [
  { name: 'Starter', price: '$0', note: 'For individuals', perks: ['Up to 3 projects', 'Basic reports', 'Community support'], featured: false },
  { name: 'Team', price: '$12', note: 'per person, per month', perks: ['Unlimited projects', 'Shared calendars', 'Priority support'], featured: true },
  { name: 'Company', price: 'Custom', note: 'For larger organizations', perks: ['Single sign-on', 'Audit log', 'Dedicated manager'], featured: false },
]

export default function App() {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top">Orbit</a>
        <nav className="site-nav" aria-label="Main">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a className="button small" href="#signup">Get started</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="section-wrap">
            <p className="eyebrow">Planning for busy teams</p>
            <h1>Plan the week once. Keep everyone on track.</h1>
            <p className="lead">Orbit turns scattered tasks into a shared plan that adapts as your week changes.</p>
            <div className="hero-actions">
              <a className="button" href="#signup">Start free</a>
              <a className="button ghost" href="#features">See how it works</a>
            </div>
          </div>
        </section>

        <section id="features" className="section-wrap">
          <h2>Everything you need to ship on time</h2>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="section-wrap">
          <h2>Simple pricing</h2>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={plan.featured ? 'plan-card featured' : 'plan-card'} key={plan.name}>
                <h3>{plan.name}</h3>
                <p className="price">{plan.price}</p>
                <p className="plan-note">{plan.note}</p>
                <ul>
                  {plan.perks.map((perk) => <li key={perk}>{perk}</li>)}
                </ul>
                <a className="button" href="#signup">Choose {plan.name}</a>
              </article>
            ))}
          </div>
        </section>

        <section id="signup" className="signup">
          <div className="section-wrap">
            <h2>Ready to try Orbit?</h2>
            <p>Join the waitlist and we will send your invite this week.</p>
            <form className="signup-form" onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="email">Work email</label>
              <input id="email" type="email" placeholder="you@company.com" required />
              <button className="button" type="submit">Join the waitlist</button>
            </form>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>© 2026 Orbit Labs</p>
      </footer>
    </>
  )
}
