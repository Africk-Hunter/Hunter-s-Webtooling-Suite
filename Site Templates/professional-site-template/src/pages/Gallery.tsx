import { gallery } from '../config/site'

export default function Gallery() {
  return (
    <>
      <section className="page-header">
        <div className="container">
          <h1>Gallery</h1>
          <p className="lead">A selection of recent work.</p>
        </div>
      </section>

      <section className="section">
        <div className="container gallery-grid">
          {gallery.map(({ src, alt }, i) =>
            src ? (
              <img key={src} src={src} alt={alt} loading="lazy" className="gallery-item" />
            ) : (
              <div key={i} className="gallery-item placeholder" role="img" aria-label={alt} />
            ),
          )}
        </div>
      </section>
    </>
  )
}
