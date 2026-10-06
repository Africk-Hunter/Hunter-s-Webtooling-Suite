import Accordion from '../components/Accordion'
import CallToAction from '../components/CallToAction'
import { faqs } from '../config/site'

export default function FAQ() {
  return (
    <>
      <section className="page-header">
        <div className="container">
          <h1>Frequently asked questions</h1>
        </div>
      </section>

      <section className="section">
        <div className="container container-narrow">
          <Accordion items={faqs} />
        </div>
      </section>

      <CallToAction />
    </>
  )
}
