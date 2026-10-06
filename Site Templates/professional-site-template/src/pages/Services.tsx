import CallToAction from '../components/CallToAction'
import { services } from '../config/site'

export default function Services() {
  return (
    <>
      <section className="page-header">
        <div className="container">
          <h1>Services</h1>
          <p className="lead">What we offer and what it costs.</p>
        </div>
      </section>

      <section className="section">
        <div className="container grid grid-3">
          {services.map(s => (
            <article key={s.title} className="card service-card">
              <h2>{s.title}</h2>
              <p className="service-price">{s.price}</p>
              <p>{s.description}</p>
              <ul className="check-list">
                {s.features.map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <CallToAction />
    </>
  )
}
