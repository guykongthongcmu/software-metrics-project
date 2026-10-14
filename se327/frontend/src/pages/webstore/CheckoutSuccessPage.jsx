import { Link, useLocation } from 'react-router-dom'

export default function CheckoutSuccessPage() {
  const location = useLocation()
  const orderId = location.state?.orderId
  return (
    <main className="ck-success-page">
      <section aria-labelledby="checkout-success-title" className="ck-success-card">
        <div aria-hidden="true" className="ck-success-icon"><svg fill="none" height="26" stroke="currentColor" viewBox="0 0 24 24" width="26"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg></div>
        <p className="ck-success-label">Order Confirmed</p>
        <h1 className="ck-success-title" id="checkout-success-title">Thank you for<br />your purchase</h1>
        <p className="ck-success-desc">Your order has been placed successfully.<br />We'll send you a confirmation email shortly.</p>
        <p className="ck-success-order-num">Order number: <span>{orderId ? `#${orderId}` : '#—'}</span></p>
        <div aria-hidden="true" className="ck-success-divider" />
        <div className="ck-success-actions">
          <Link className="ck-success-btn-primary" to="/">Continue Shopping</Link>
          <Link className="ck-success-btn-secondary" to="/account/profile">View My Profile</Link>
        </div>
      </section>
    </main>
  )
}
