const projects = [
  { title: 'Harbor Coffee', kind: 'Brand and website', year: '2025', blurb: 'A booking-first site for a neighborhood roaster, built in a weekend.' },
  { title: 'Northline Atlas', kind: 'Data visualization', year: '2025', blurb: 'An interactive map of regional trail conditions for hikers.' },
  { title: 'Paperweight', kind: 'Mobile app', year: '2024', blurb: 'A calm note-taking app with offline sync and a tiny footprint.' },
  { title: 'Field Notes Co.', kind: 'Online store', year: '2024', blurb: 'A small-batch stationery shop with subscription boxes.' },
]

const skills = ['Interface design', 'Front-end development', 'Design systems', 'Accessibility', 'Prototyping', 'Art direction']

export default function App() {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top">Alex Rivera</a>
        <nav className="site-nav" aria-label="Main">
          <a href="#work">Work</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <p className="eyebrow">Designer and developer</p>
          <h1>I design and build calm, fast websites for small teams.</h1>
          <p className="lead">Based in Portland. Currently booking projects for the autumn.</p>
          <a className="button" href="#contact">Start a project</a>
        </section>

        <section id="work" className="section-wrap">
          <h2>Selected work</h2>
          <div className="project-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.title}>
                <div className="project-thumb" role="img" aria-label={`${project.title} preview`} />
                <p className="project-meta">{project.kind} · {project.year}</p>
                <h3>{project.title}</h3>
                <p>{project.blurb}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="section-wrap about">
          <div>
            <h2>About</h2>
            <p>I have spent ten years helping founders and small studios turn rough ideas into clear, well-made websites. I care about type, spacing and the details that make a page feel considered.</p>
            <p>Away from the screen you will find me on a bike or in the kitchen testing a bread recipe.</p>
          </div>
          <ul className="skill-list">
            {skills.map((skill) => <li key={skill}>{skill}</li>)}
          </ul>
        </section>

        <section id="contact" className="section-wrap contact">
          <h2>Let's work together</h2>
          <p>Tell me about your project and I will reply within two working days.</p>
          <a className="button" href="mailto:hello@example.com">hello@example.com</a>
        </section>
      </main>

      <footer className="site-footer">
        <p>© 2026 Alex Rivera</p>
      </footer>
    </>
  )
}
