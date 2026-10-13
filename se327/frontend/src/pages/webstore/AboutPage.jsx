import { Link } from 'react-router-dom'

const values = [
  { title: 'Timeless Design', text: 'Silhouettes designed beyond seasonal trends, ensuring enduring relevance.' },
  { title: 'Premium Craft', text: 'Exceptional materials sourced responsibly and crafted with precise attention to detail.' },
  { title: 'Conscious Ethos', text: 'A commitment to sustainable practices and transparency at every step.' },
]

export default function AboutPage() {
  return (
    <main>
      <section className="relative grid min-h-[62svh] place-items-center overflow-hidden bg-stone-700 sm:min-h-[70svh]">
        <img alt="Core & Co editorial campaign" className="absolute inset-0 h-full w-full object-cover object-center" src="/images/about_us_banner.png" />
        <div className="absolute inset-0 bg-stone-950/25" />
        <div className="relative px-5 text-center text-white"><h1 className="font-display text-5xl sm:text-7xl">CORE &amp; CO</h1><p className="mt-4 text-xs font-light tracking-[0.35em] sm:text-sm">REDEFINING MODERN ELEGANCE</p></div>
      </section>
      <div className="mx-auto max-w-[1000px] px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
        <section className="mx-auto mb-16 max-w-3xl text-center sm:mb-24"><p className="text-[11px] font-semibold tracking-[0.18em] text-accent">THE BRAND</p><h2 className="mt-4 font-display text-3xl sm:text-4xl">Our Story</h2><p className="mt-6 text-base leading-8 text-muted sm:text-lg">Born from a desire to create a wardrobe that transcends time, Core &amp; Co was founded on the principles of minimalism, quality, and effortless sophistication. We believe in fashion that speaks quietly but resonates deeply: pieces designed to be lived in, loved, and passed down.</p></section>
        <section className="mb-16 grid items-center gap-8 sm:mb-24 sm:grid-cols-2 sm:gap-14">
          <div className="aspect-[3/4] overflow-hidden bg-accent-soft"><img alt="Core & Co fashion editorial" className="h-full w-full object-cover grayscale-[15%] transition-transform duration-700 hover:scale-[1.03]" src="/images/aboutus.jpeg" /></div>
          <div className="py-3 sm:py-8"><p className="text-[11px] font-semibold tracking-[0.18em] text-accent">LESS, CONSIDERED</p><h2 className="mt-4 font-display text-3xl sm:text-4xl">The Philosophy</h2><p className="mt-5 text-sm leading-7 text-muted sm:text-base">Our approach is simple: curate the essential. By focusing on refined silhouettes, premium fabrics, and neutral palettes, we offer collections that are inherently versatile. Every garment is a canvas, empowering you to express your individual style with quiet confidence.</p><Link className="mt-7 inline-flex border border-ink px-7 py-3 text-[11px] font-semibold tracking-[0.15em] transition hover:bg-ink hover:text-white" to="/products">EXPLORE COLLECTION</Link></div>
        </section>
        <section className="grid gap-9 border-t border-stone-300 pt-12 text-center sm:grid-cols-3 sm:gap-7 sm:pt-14">{values.map((value) => <article key={value.title}><h3 className="font-display text-xl">{value.title}</h3><p className="mt-3 text-sm leading-6 text-muted">{value.text}</p></article>)}</section>
      </div>
    </main>
  )
}