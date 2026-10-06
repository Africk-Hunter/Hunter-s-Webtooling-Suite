import CallToAction from '../components/CallToAction'
import { about } from '../config/site'

export default function About() {
  return (
    <>
      <section className="page-header">
        <div className="container">
          <h1>{about.heading}</h1>
        </div>
      </section>

      <section className="section">
        <div className="container about-grid">
          {about.image ? (
            <img className="about-image" src={about.image} alt="" />
          ) : (
            <div className="about-image placeholder" aria-hidden="true" />
          )}
          <div className="prose">
            {about.paragraphs.map(p => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      <CallToAction />
    </>
  )
}
