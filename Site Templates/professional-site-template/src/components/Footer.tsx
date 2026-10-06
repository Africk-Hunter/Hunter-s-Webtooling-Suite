import { Link } from 'react-router-dom'
import { nav, site } from '../config/site'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <p className="footer-brand">{site.name}</p>
          <p className="footer-muted">{site.tagline}</p>
        </div>

        <div>
          <p className="footer-heading">Explore</p>
          <ul className="footer-list">
            {nav.map(({ label, path }) => (
              <li key={path}>
                <Link to={path}>{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="footer-heading">Contact</p>
          <ul className="footer-list">
            <li><a href={`mailto:${site.contact.email}`}>{site.contact.email}</a></li>
            <li><a href={`tel:${site.contact.phone.replace(/\D/g, '')}`}>{site.contact.phone}</a></li>
            <li>{site.contact.address}</li>
            {site.social.map(({ label, href }) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>Copyright © {year} {site.name}. All rights reserved.</p>
        <p>
          <a href={site.credit.href} target="_blank" rel="noopener noreferrer">{site.credit.text}</a>
        </p>
      </div>
    </footer>
  )
}
