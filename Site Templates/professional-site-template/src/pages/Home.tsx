import { Link } from 'react-router-dom'
import CallToAction from '../components/CallToAction'
import { features, hero, services } from '../config/site'

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1>{hero.heading}</h1>
          <p className="lead">{hero.subheading}</p>
          <div className="hero-actions">
            <Link to={hero.primaryCta.path} className="btn btn-primary">{hero.primaryCta.label}</Link>
            <Link to={hero.secondaryCta.path} className="btn btn-outline">{hero.secondaryCta.label}</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="grid grid-3">
            {features.map(f => (
              <div key={f.title} className="card">
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <h2 className="section-title">Services</h2>
          <div className="grid grid-3">
            {services.map(s => (
              <div key={s.title} className="card">
                <h3>{s.title}</h3>
                <p>{s.description}</p>
              </div>
            ))}
          </div>
          <p className="section-link"><Link to="/services">See all services →</Link></p>
        </div>
      </section>

      <CallToAction />
    </>
  )
}
