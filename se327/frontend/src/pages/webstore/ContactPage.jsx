export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-8 sm:py-14">
      <header className="mb-9 text-center sm:mb-12"><p className="text-[11px] font-semibold tracking-[0.18em] text-accent">WE ARE HERE TO HELP</p><h1 className="mt-3 font-display text-4xl font-normal sm:text-5xl">Contact Us</h1></header>
      <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:gap-8">
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-panel)] sm:p-9">
          <h2 className="mb-7 font-display text-2xl">Store Information</h2>
          <div className="space-y-6">
            <div><h3 className="text-xs font-semibold tracking-[0.12em] text-accent">ADDRESS</h3><p className="mt-2 text-sm leading-6 text-muted">Core &amp; Co Flagship Store<br />123 Fashion Ave<br />Bangkok, Thailand 10110</p></div>
            <div><h3 className="text-xs font-semibold tracking-[0.12em] text-accent">EMAIL US</h3><a className="mt-2 inline-block border-b border-current pb-0.5 text-sm text-muted hover:text-ink" href="mailto:coreandco2026@gmail.com">coreandco2026@gmail.com</a></div>
            <div><h3 className="text-xs font-semibold tracking-[0.12em] text-accent">STORE HOURS</h3><p className="mt-2 text-sm leading-6 text-muted">Mon - Fri: 10:00 AM - 9:00 PM<br />Sat - Sun: 10:00 AM - 10:00 PM</p></div>
            <div><h3 className="text-xs font-semibold tracking-[0.12em] text-accent">FOLLOW US</h3><ul className="mt-3 space-y-2 text-sm"><li><a className="hover:text-accent" href="https://www.instagram.com/coreandco_official">Instagram: @coreandco_official</a></li><li><a className="hover:text-accent" href="https://www.facebook.com/">Facebook: Core &amp; Co</a></li><li><a className="hover:text-accent" href="https://twitter.com/">Twitter: @coreandco_th</a></li></ul></div>
          </div>
        </section>
        <div className="min-h-[360px] overflow-hidden rounded-[var(--radius-card)] border border-line bg-stone-200 shadow-[var(--shadow-panel)] sm:min-h-[480px]">
          <iframe title="Map to Core & Co in Bangkok" className="h-full min-h-[360px] w-full sm:min-h-[480px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d124021.08272583808!2d100.4147072554763!3d13.72460049445037!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30e29b30ec60613f%3A0xcb1bca728956ce24!2sBangkok!5e0!3m2!1sen!2sth!4v1714080131451!5m2!1sen!2sth" />
        </div>
      </div>
    </main>
  )
}