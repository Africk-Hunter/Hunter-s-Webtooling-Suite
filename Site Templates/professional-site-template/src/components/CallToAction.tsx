import { Link } from 'react-router-dom'
import { cta } from '../config/site'

export default function CallToAction() {
  return (
    <section className="cta">
      <div className="container cta-inner">
        <h2>{cta.heading}</h2>
        <p>{cta.body}</p>
        <Link to="/contact" className="btn btn-light">{cta.button}</Link>
      </div>
    </section>
  )
}
