import { Link, useSearchParams } from 'react-router-dom'

export default function ForgotPasswordSuccessPage() {
  const [searchParams] = useSearchParams()
  const isDemo = searchParams.get('demo') === '1'
  const token = searchParams.get('token') || ''

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
      <section className="flex w-full max-w-[450px] flex-col items-center">
        <h1 className="mb-[35px] text-center font-inter text-[1.8rem] font-medium leading-[1.4] tracking-[-0.5px] text-[#8c7e73] max-sm:text-[1.4rem]">We already sent you<br />a link to reset your<br />password</h1>
        {isDemo && <p className="mb-6 text-center text-sm leading-relaxed text-[#8c7e73]" role="status">Demo mode: no email was sent. Use the link below to preview password reset.</p>}
        <div aria-hidden="true" className="mb-10 flex h-[60px] w-[60px] items-center justify-center rounded-full border border-[#dcd4cc]">
          <svg className="h-6 w-6" fill="none" stroke="#a3978f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
            <path d="m10 14-2 2m6-2 3 3" />
          </svg>
        </div>
        {isDemo && token && <Link className="mb-4 text-sm font-semibold text-[#8c7e73] underline underline-offset-4 hover:text-[#5b4636]" to={`/auth/reset-password?demo=1&token=${encodeURIComponent(token)}`}>Open demo reset link</Link>}
        <Link className="inline-block w-full rounded border border-[#c7bfb6] px-4 py-4 text-center font-inter text-[0.8rem] font-semibold tracking-[1.2px] text-[#a3978f] transition-all hover:border-[#8c7e73] hover:bg-black/[0.03] hover:text-[#8c7e73]" to="/login">GO BACK</Link>
      </section>
    </main>
  )
}
