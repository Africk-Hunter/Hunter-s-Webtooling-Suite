import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { nav, navCta, site } from '../config/site'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])

  return (
    <header className="nav">
      <div className="nav-inner container">
        <Link to="/" className="nav-brand">
          <img src={site.logo} alt="" width={32} height={32} />
          <span>{site.name}</span>
        </Link>

        <button
          className="nav-toggle"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="nav-links"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          <span />
          <span />
          <span />
        </button>

        <nav id="nav-links" className={`nav-links ${open ? 'is-open' : ''}`}>
          {nav.map(({ label, path }) => (
            <NavLink key={path} to={path} end className="nav-link">
              {label}
            </NavLink>
          ))}
          <Link to={navCta.path} className="btn btn-primary nav-cta">
            {navCta.label}
          </Link>
        </nav>
      </div>
    </header>
  )
}
