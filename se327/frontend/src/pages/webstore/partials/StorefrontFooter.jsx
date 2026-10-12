import { Link } from 'react-router-dom'

export default function StorefrontFooter() {
  return (
    <footer className="bg-[#eae5d9] px-6 py-12 text-[#555] lg:px-16 lg:pt-16 lg:pb-8">
      <div className="mb-8 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12 lg:mb-16 lg:gap-12">
        <div>
          <h2 className="mb-6 text-[0.9rem] font-medium tracking-[1px] text-[#333]">PRODUCT</h2>
          <ul className="space-y-[0.8rem] text-[0.9rem]">
            <li><Link className="hover:text-accent" to="/men">Men</Link></li>
            <li><Link className="hover:text-accent" to="/women">Women</Link></li>
            <li><Link className="hover:text-accent" to="/kids">Kids</Link></li>
            <li><Link className="hover:text-accent" to="/baby">Baby</Link></li>
            <li><Link className="hover:text-accent" to="/unisex">Unisex</Link></li>
            <li><Link className="hover:text-accent" to="/">Home</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-6 text-[0.9rem] font-medium tracking-[1px] text-[#333]">INFO</h2>
          <ul className="space-y-[0.8rem] text-[0.9rem]">
            <li><Link className="hover:text-accent" to="/about">About</Link></li>
            <li><a className="hover:text-accent" href="#">Sustainability</a></li>
            <li><a className="hover:text-accent" href="#">Press</a></li>
            <li><Link className="hover:text-accent" to="/contact">Contact Us</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-6 text-[0.9rem] font-medium tracking-[1px] text-[#333]">MEMBERSHIP</h2>
          <p className="mb-6 text-[0.9rem]">Join now and get 15% off your first order.</p>
          <div className="flex flex-wrap gap-4">
            <Link className="rounded-full border border-accent bg-accent px-7.5 py-2 text-[0.8rem] font-medium text-white! transition-colors hover:border-[#97836d] hover:bg-[#97836d]" to="/auth/signup">SIGN UP</Link>
            <Link className="rounded-full border border-[#c4b9a9] px-7.5 py-2 text-[0.8rem] font-medium text-ink transition-colors hover:bg-black/5" to="/login">LOG IN</Link>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-between gap-4 border-t border-black/5 pt-8 text-[0.8rem] sm:flex-row">
        <p>© 2026 Core & Co. All rights reserved.</p>
        <div className="flex gap-8"><a className="hover:text-accent" href="#">Privacy Policy</a><a className="hover:text-accent" href="#">Terms of Service</a></div>
      </div>
    </footer>
  )
}