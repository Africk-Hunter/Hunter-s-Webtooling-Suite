import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="page-header">
      <div className="container">
        <h1>Page not found</h1>
        <p className="lead">The page you're looking for doesn't exist.</p>
        <Link to="/" className="btn btn-primary">Back to home</Link>
      </div>
    </section>
  )
}
