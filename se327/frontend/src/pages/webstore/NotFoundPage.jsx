import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-16 text-center sm:px-8 sm:py-24">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-accent">ERROR 404</p>
      <h1 className="mt-3 font-display text-4xl font-normal sm:text-5xl">Page not found</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">The page you are looking for does not exist or may have been moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm">
        <Link className="border-b border-ink pb-1" to="/">Back to home</Link>
        <Link className="border-b border-ink pb-1" to="/products">Browse all products</Link>
      </div>
    </main>
  )
}
