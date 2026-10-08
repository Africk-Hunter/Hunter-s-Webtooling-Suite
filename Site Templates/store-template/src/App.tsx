import { useState } from 'react'

type Product = { id: number; name: string; category: string; price: number; tone: string }

const products: Product[] = [
  { id: 1, name: 'Ceramic pour-over set', category: 'Kitchen', price: 48, tone: 'clay' },
  { id: 2, name: 'Linen apron', category: 'Kitchen', price: 36, tone: 'sage' },
  { id: 3, name: 'Hand-poured candle', category: 'Home', price: 24, tone: 'sand' },
  { id: 4, name: 'Walnut serving board', category: 'Kitchen', price: 62, tone: 'walnut' },
  { id: 5, name: 'Wool throw blanket', category: 'Home', price: 98, tone: 'slate' },
  { id: 6, name: 'Stoneware mug pair', category: 'Kitchen', price: 40, tone: 'clay' },
]

export default function App() {
  const [cart, setCart] = useState<Record<number, number>>({})
  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0)
  const total = products.reduce((sum, product) => sum + product.price * (cart[product.id] ?? 0), 0)

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top">Fieldhouse</a>
        <nav className="site-nav" aria-label="Main">
          <a href="#shop">Shop</a>
          <a href="#story">Our story</a>
          <a className="cart-link" href="#cart">Cart ({count})</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <p className="eyebrow">New season</p>
          <h1>Everyday objects, made to last.</h1>
          <p className="lead">Small-batch goods for the kitchen and home, shipped free over $75.</p>
          <a className="button" href="#shop">Shop the collection</a>
        </section>

        <section id="shop" className="section-wrap">
          <h2>Shop</h2>
          <div className="product-grid">
            {products.map((product) => (
              <article className="product-card" key={product.id}>
                <div className={`product-image tone-${product.tone}`} role="img" aria-label={product.name} />
                <p className="product-category">{product.category}</p>
                <h3>{product.name}</h3>
                <div className="product-row">
                  <span className="product-price">${product.price}</span>
                  <button className="button small" type="button" onClick={() => setCart({ ...cart, [product.id]: (cart[product.id] ?? 0) + 1 })}>
                    Add to cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="story" className="section-wrap story">
          <h2>Our story</h2>
          <p>Fieldhouse began in a garage with a kiln and a few good friends. Today we work with a handful of makers who share our belief that useful things should also be beautiful.</p>
        </section>

        <section id="cart" className="section-wrap cart">
          <h2>Your cart</h2>
          {count === 0 ? (
            <p className="muted">Your cart is empty.</p>
          ) : (
            <>
              <ul className="cart-list">
                {products.filter((product) => cart[product.id]).map((product) => (
                  <li key={product.id}>
                    <span>{product.name} × {cart[product.id]}</span>
                    <span>${product.price * cart[product.id]}</span>
                  </li>
                ))}
              </ul>
              <p className="cart-total">Total: ${total}</p>
              <button className="button" type="button">Checkout</button>
            </>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <p>© 2026 Fieldhouse Goods</p>
      </footer>
    </>
  )
}
