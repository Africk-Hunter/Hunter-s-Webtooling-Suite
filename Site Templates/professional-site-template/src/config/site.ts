// Single source of truth for everything that's specific to a client.
// Edit this file first when starting a new site.

export const site = {
  name: 'Your Business Name',
  tagline: 'A short line about what you do and who you help.',
  url: 'https://www.example.com',
  ogImage: '/og-image.png',
  logo: '/favicon.svg',
  contact: {
    email: 'hello@example.com',
    phone: '(555) 555-5555',
    address: '123 Main Street, City, ST 00000',
    hours: 'Mon-Fri, 9am-5pm',
  },
  social: [
    { label: 'Instagram', href: 'https://www.instagram.com/' },
    { label: 'Facebook', href: 'https://www.facebook.com/' },
  ],
  credit: { text: 'Designed & Developed by Your Name', href: 'https://example.com' },
}

export const nav = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Services', path: '/services' },
  { label: 'Gallery', path: '/gallery' },
  { label: 'FAQ', path: '/faq' },
]

export const navCta = { label: 'Contact', path: '/contact' }

export interface PageSeo {
  title: string
  description: string
  image?: string
}

// Keyed by pathname. Anything not listed falls back to the '/' entry.
export const pages: Record<string, PageSeo> = {
  '/': {
    title: `${site.name} | Professional Services`,
    description: site.tagline,
  },
  '/about': { title: `About | ${site.name}`, description: `Learn more about ${site.name}.` },
  '/services': { title: `Services | ${site.name}`, description: `Services and pricing from ${site.name}.` },
  '/gallery': { title: `Gallery | ${site.name}`, description: `Recent work from ${site.name}.` },
  '/faq': { title: `FAQ | ${site.name}`, description: `Answers to common questions about ${site.name}.` },
  '/contact': { title: `Contact | ${site.name}`, description: `Get in touch with ${site.name}.` },
}

export const hero = {
  eyebrow: 'Welcome',
  heading: 'A clear headline that says what you do',
  subheading: 'One or two sentences expanding on the value you offer and who it is for.',
  primaryCta: { label: 'Get in touch', path: '/contact' },
  secondaryCta: { label: 'View services', path: '/services' },
}

export const features = [
  { title: 'Feature one', body: 'Short description of a key benefit or differentiator.' },
  { title: 'Feature two', body: 'Short description of a key benefit or differentiator.' },
  { title: 'Feature three', body: 'Short description of a key benefit or differentiator.' },
]

export const services = [
  { title: 'Service one', description: 'What this service includes and who it is for.', price: '$000', features: ['Detail one', 'Detail two', 'Detail three'] },
  { title: 'Service two', description: 'What this service includes and who it is for.', price: '$000', features: ['Detail one', 'Detail two', 'Detail three'] },
  { title: 'Service three', description: 'What this service includes and who it is for.', price: '$000', features: ['Detail one', 'Detail two', 'Detail three'] },
]

export const about = {
  heading: 'About us',
  image: '', // e.g. '/about.jpg' placed in /public. Leave empty for a placeholder.
  paragraphs: [
    'Tell your story here: who you are, how you started, and what you care about.',
    'A second paragraph for credentials, approach, or what clients can expect.',
  ],
}

// Put images in /public/gallery and list them here. Empty src renders a placeholder tile.
export const gallery = Array.from({ length: 6 }, (_, i) => ({ src: '', alt: `Gallery image ${i + 1}` }))

export const faqs = [
  { q: 'Question one?', a: 'Answer to the first question.' },
  { q: 'Question two?', a: 'Answer to the second question.' },
  { q: 'Question three?', a: 'Answer to the third question.' },
]

export const cta = {
  heading: 'Ready to get started?',
  body: 'Tell us a bit about what you need and we will be in touch.',
  button: 'Contact us',
}
