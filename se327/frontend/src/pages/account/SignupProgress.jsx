const stepLabels = ['EMAIL', 'INFO', 'CONFIRM']

export default function SignupProgress({ activeStep, className = '' }) {
  return (
    <div aria-label="Sign up progress" className={`signup-progress ${className}`}>
      <div aria-hidden="true" className="signup-progress-track">
        {activeStep > 1 && <div className={`signup-progress-fill ${activeStep === 3 ? 'full' : ''}`} />}
      </div>
      {stepLabels.map((label, index) => {
        const step = index + 1
        const stateClass = step === activeStep ? 'active' : step < activeStep ? 'completed' : ''
        return (
          <div aria-current={step === activeStep ? 'step' : undefined} className={`signup-progress-step ${stateClass}`} key={label}>
            <div className="signup-step-circle">{step}</div>
            <div className="signup-step-label">{label}</div>
          </div>
        )
      })}
    </div>
  )
}
