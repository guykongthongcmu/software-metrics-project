import { Link } from 'react-router-dom'

/** @param {{image: string, title: string, subtitle: string, ctaLabel: string, ctaTo: string}} props */
export default function HeroBanner({ image, title, subtitle, ctaLabel, ctaTo }) {
  return (
    <section aria-label={title} className="relative flex h-[90vh] items-center justify-center overflow-hidden text-center">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${image}')` }} />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 mt-16 max-w-[600px] px-5 text-white lg:mt-16">
        <h1 className="mb-4 font-display text-[5rem] font-bold leading-[1.6] tracking-[-2px]">{title}</h1>
        <p className="mb-10 text-[1.2rem] uppercase leading-[1.6] tracking-[4px] opacity-90">{subtitle}</p>
        <Link to={ctaTo} className="inline-flex rounded-full border border-white bg-transparent px-[30px] py-3 text-[0.9rem] font-normal tracking-[0.5px] transition-colors hover:bg-white hover:text-[#333]">{ctaLabel}</Link>
      </div>
    </section>
  )
}
