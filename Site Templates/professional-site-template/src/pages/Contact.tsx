import { useState } from 'react'
import emailjs from '@emailjs/browser'
import { site } from '../config/site'
import { formatPhoneNumber } from '../utils/phone'

const empty = { name: '', email: '', phone: '', message: '' }

export default function Contact() {
  const [form, setForm] = useState(empty)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: name === 'phone' ? formatPhoneNumber(value) : value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError(false)
    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        form,
        { publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY },
      )
      setSent(true)
      setForm(empty)
    } catch (err) {
      console.error('EmailJS send failed:', err)
      setError(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <section className="page-header">
        <div className="container">
          <h1>Contact</h1>
          <p className="lead">Send a message and we'll get back to you soon.</p>
        </div>
      </section>

      <section className="section">
        <div className="container contact-grid">
          <div className="contact-info">
            <h2>Get in touch</h2>
            <ul className="contact-list">
              <li><strong>Email</strong><a href={`mailto:${site.contact.email}`}>{site.contact.email}</a></li>
              <li><strong>Phone</strong><a href={`tel:${site.contact.phone.replace(/\D/g, '')}`}>{site.contact.phone}</a></li>
              <li><strong>Address</strong><span>{site.contact.address}</span></li>
              <li><strong>Hours</strong><span>{site.contact.hours}</span></li>
            </ul>
          </div>

          {sent ? (
            <div className="card contact-success" role="status">
              <h2>Message sent</h2>
              <p>Thanks for reaching out. We'll be in touch soon.</p>
            </div>
          ) : (
            <form className="form" onSubmit={handleSubmit}>
              <label>
                Name
                <input type="text" name="name" value={form.name} onChange={handleChange} required autoComplete="name" />
              </label>
              <label>
                Email
                <input type="email" name="email" value={form.email} onChange={handleChange} required autoComplete="email" />
              </label>
              <label>
                Phone (optional)
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} maxLength={14} autoComplete="tel" />
              </label>
              <label>
                Message
                <textarea name="message" rows={5} value={form.message} onChange={handleChange} required />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  Something went wrong sending your message. Please try again or email us directly.
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={sending}>
                {sending ? 'Sending...' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  )
}
