import { useEffect, useRef, useState } from 'react'
import 'flatpickr/dist/flatpickr.min.css'
import { apiClient } from '../../lib/apiClient.js'
import './admin-campaign-builder.css'

const offers = [
  { value: 'PERCENTAGE_DISCOUNT', label: 'Percentage Discount (%)' },
  { value: 'FIXED_AMOUNT_DISCOUNT', label: 'Fixed Amount Discount ($)' },
  { value: 'BEST_SELLER', label: 'Best Seller' },
]

const initialForm = {
  name: '',
  type: '',
  discountValue: '',
  startDate: '',
  endDate: '',
  web: true,
  email: false,
}

function offerText(type, value) {
  if (type === 'PERCENTAGE_DISCOUNT') return value ? `${value}% OFF` : 'Percentage Sale'
  if (type === 'FIXED_AMOUNT_DISCOUNT') return value ? `$${value} OFF` : 'Fixed Discount'
  if (type === 'BEST_SELLER') return 'Best Seller'
  return 'Discount Type'
}

function dateLabel(start, end) {
  if (!start || !end) return 'Dates will appear here'
  const format = (value) => {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return `${format(start)} — ${format(end)}`
}

function validateCampaign(form, file) {
  if (!form.name.trim()) return 'Enter a campaign name.'
  if (!form.type) return 'Select an offer type.'
  if (form.type === 'BEST_SELLER' && form.discountValue !== '') return 'Best Seller campaigns do not use a discount value.'
  if (form.type !== 'BEST_SELLER') {
    const discount = Number(form.discountValue)
    if (!form.discountValue || !Number.isFinite(discount) || discount <= 0) return 'Enter a discount value greater than zero.'
    if (form.type === 'PERCENTAGE_DISCOUNT' && discount > 100) return 'Percentage discount must be 100 or less.'
  }
  if (!form.startDate || !form.endDate) return 'Select the campaign start and end dates.'
  if (form.startDate > form.endDate) return 'The end date must be on or after the start date.'
  if (!file) return 'Upload a campaign banner image.'
  if (file.size > 5 * 1024 * 1024) return 'Banner image must be 5 MB or smaller.'
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Banner image must be a JPEG, PNG or WebP file.'
  return ''
}

function emailResultText(emailBlast) {
  if (!emailBlast?.enabled) return `Email blast not selected. Emails sent: ${emailBlast?.sentCount || 0} of ${emailBlast?.totalRecipients || 0}. Failed: ${emailBlast?.failedCount || 0}.`
  return `Emails sent: ${emailBlast.sentCount} of ${emailBlast.totalRecipients}. Failed: ${emailBlast.failedCount}.`
}

function CampaignPreview({ form, imageUrl }) {
  const currentOffer = offerText(form.type, form.discountValue)
  return (
    <section className="campaign-builder-preview-section" aria-labelledby="campaign-preview-heading">
      <h2 id="campaign-preview-heading">Campaign Preview</h2>
      <div className="campaign-builder-glass-card campaign-builder-preview-card">
        <div className="campaign-builder-preview" style={imageUrl ? { backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.48), transparent 70%), url("${imageUrl}")` } : undefined}>
          <div className="campaign-builder-preview-content">
            <h3>{form.name.trim() || 'Your Sale Name'}</h3>
            <div className="campaign-builder-preview-meta">
              <span>{currentOffer}</span>
              <span>{dateLabel(form.startDate, form.endDate)}</span>
            </div>
          </div>
        </div>
        <div className="campaign-builder-progress" aria-hidden="true"><span /></div>
      </div>
    </section>
  )
}

function LaunchDialog({ form, busy, error, onClose, onConfirm }) {
  const selectedChannels = [form.web && 'Web Banner', form.email && 'Email blast'].filter(Boolean).join(', ')
  return (
    <div className="campaign-builder-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <section aria-labelledby="campaign-confirm-heading" aria-modal="true" className="campaign-builder-modal" role="dialog">
        {busy ? (
          <div className="campaign-builder-modal-body" aria-live="polite">
            <span className="campaign-builder-spinner" aria-hidden="true" />
            <h2>Launching Campaign...</h2>
            <p>Contacting distribution servers...</p>
          </div>
        ) : (
          <div className="campaign-builder-modal-body">
            <span className="campaign-builder-question" aria-hidden="true">?</span>
            <h2 id="campaign-confirm-heading">Ready to launch?</h2>
            <p>The campaign <strong>{form.name.trim()}</strong> will go live immediately on the selected channels.</p>
            <dl className="campaign-builder-summary">
              <div><dt>Offer</dt><dd>{offerText(form.type, form.discountValue)}</dd></div>
              <div><dt>Dates</dt><dd>{dateLabel(form.startDate, form.endDate)}</dd></div>
              <div><dt>Channels</dt><dd>{selectedChannels}</dd></div>
            </dl>
            {error && <p className="campaign-builder-error" role="alert">{error}</p>}
            <div className="campaign-builder-modal-actions">
              <button className="campaign-builder-secondary" onClick={onClose} type="button">Go back</button>
              <button className="campaign-builder-primary" onClick={onConfirm} type="button">Confirm &amp; Launch</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default function AdminCampaignBuilderPage() {
  const [form, setForm] = useState(initialForm)
  const [file, setFile] = useState(null)
  const [imageUrl, setImageUrl] = useState('')
  const [formError, setFormError] = useState('')
  const [modalError, setModalError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const durationInput = useRef(null)
  const discountRequired = form.type !== '' && form.type !== 'BEST_SELLER'

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
  }, [imageUrl])

  useEffect(() => {
    if (!dialogOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !busy) setDialogOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [dialogOpen, busy])

  useEffect(() => {
    let disposed = false
    let picker
    import('flatpickr').then(({ default: flatpickr }) => {
      if (disposed || !durationInput.current) return
      picker = flatpickr(durationInput.current, {
        mode: 'range',
        dateFormat: 'Y-m-d',
        minDate: 'today',
        prevArrow: '‹',
        nextArrow: '›',
        onChange: (_dates, value) => {
          const [startDate = '', endDate = ''] = value.split(' to ')
          setForm((current) => ({ ...current, startDate, endDate }))
        },
      })
    }).catch(() => {
      if (!disposed) setFormError('The date picker could not be loaded. Please refresh and try again.')
    })
    return () => {
      disposed = true
      picker?.destroy()
    }
  }, [])

  function updateForm(event) {
    const { name, value, checked, type } = event.target
    setForm((current) => {
      const nextValue = type === 'checkbox' ? checked : value
      return { ...current, [name]: nextValue, ...(name === 'type' && nextValue === 'BEST_SELLER' ? { discountValue: '' } : {}) }
    })
    setFormError('')
  }

  function selectImage(nextFile) {
    if (!nextFile) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) {
      setFormError('Banner image must be a JPEG, PNG or WebP file.')
      return
    }
    if (nextFile.size > 5 * 1024 * 1024) {
      setFormError('Banner image must be 5 MB or smaller.')
      return
    }
    setFile(nextFile)
    setImageUrl(URL.createObjectURL(nextFile))
    setFormError('')
  }

  function clearImage() {
    setFile(null)
    setImageUrl('')
  }

  function openConfirmation(event) {
    event.preventDefault()
    const error = validateCampaign(form, file)
    setFormError(error)
    if (error) return
    setModalError('')
    setDialogOpen(true)
  }

  async function launchCampaign() {
    if (busy) return
    setBusy(true)
    setModalError('')
    const campaignData = {
      name: form.name.trim(),
      type: form.type,
      discountValue: form.type === 'BEST_SELLER' ? '' : Number(form.discountValue),
      startDate: form.startDate,
      endDate: form.endDate,
      channels: { web: form.web, email: form.email },
    }
    const body = new FormData()
    body.append('campaignData', JSON.stringify(campaignData))
    body.append('mediaFile', file)
    try {
      const response = await apiClient.post('/admin/launch-campaign', body)
      const result = response?.data || {}
      const message = `${response?.message || 'Campaign launched successfully.'} ${emailResultText(result.emailBlast)}`
      window.dispatchEvent(new CustomEvent('admin:toast', {
        detail: { title: 'Campaign Launched', message, type: result.emailBlast?.failedCount > 0 ? 'warning' : 'success' },
      }))
      setDialogOpen(false)
      setForm(initialForm)
      durationInput.current?._flatpickr?.clear()
      clearImage()
    } catch (error) {
      setModalError(error?.payload?.message || error?.message || 'Unable to launch campaign. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="campaign-builder-page">
      <header className="campaign-builder-header">
        <div><h1>Promotional Campaign Builder</h1><p>Design, schedule, and launch marketing campaigns across platforms</p></div>
      </header>
      <CampaignPreview form={form} imageUrl={imageUrl} />
      <section className="campaign-builder-glass-card campaign-builder-form-card" aria-label="Campaign form">
        <form onSubmit={openConfirmation} noValidate>
          <div className="campaign-builder-field campaign-builder-name-field">
            <label htmlFor="campaign-name">Campaign Name</label>
            <input id="campaign-name" maxLength={150} name="name" onChange={updateForm} placeholder="e.g., Summer Flash Sale" required value={form.name} />
          </div>
          <div className="campaign-builder-row">
            <div className="campaign-builder-field">
              <label htmlFor="campaign-offer">Offer Type</label>
              <select id="campaign-offer" name="type" onChange={updateForm} required value={form.type}>
                <option disabled value="">Select offer type</option>
                {offers.map((offer) => <option key={offer.value} value={offer.value}>{offer.label}</option>)}
              </select>
            </div>
            <div className="campaign-builder-field">
              <label htmlFor="campaign-discount">Discount Value</label>
              <input disabled={!discountRequired} id="campaign-discount" max={form.type === 'PERCENTAGE_DISCOUNT' ? 100 : undefined} min="0.01" name="discountValue" onChange={updateForm} placeholder={discountRequired ? 'e.g., 20' : 'Not needed for Best Seller'} required={discountRequired} step="any" type="number" value={form.discountValue} />
            </div>
          </div>
          <div className="campaign-builder-field campaign-builder-date-field">
            <label htmlFor="campaign-duration">Campaign Scheduled Duration</label>
            <div className="campaign-builder-date-range">
              <span aria-hidden="true">▦</span>
              <input aria-label="Campaign Scheduled Duration" id="campaign-duration" name="duration" placeholder="Select Start & End Dates" ref={durationInput} required type="text" />
            </div>
          </div>
          <div className="campaign-builder-field">
            <label htmlFor="campaign-image">Campaign Cover (Image)</label>
            <label className={`campaign-builder-drop-zone ${dragging ? 'is-dragging' : ''}`} htmlFor="campaign-image" onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={(event) => { event.preventDefault(); setDragging(false) }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setDragging(false); selectImage(event.dataTransfer.files?.[0]) }}>
              <input accept="image/jpeg,image/png,image/webp" className="campaign-builder-file-input" id="campaign-image" onChange={(event) => selectImage(event.target.files?.[0])} type="file" />
              <span className="campaign-builder-upload-icon" aria-hidden="true">⇧</span>
              <span className="campaign-builder-drop-title">Drag &amp; Drop or Click to Upload</span>
              <span className="campaign-builder-drop-help">Supports Image (JPG, PNG or WebP, up to 5 MB)</span>
            </label>
            {file && <div className="campaign-builder-upload-feedback"><img src={imageUrl} alt="Campaign banner preview" /><span title={file.name}>{file.name}</span><button aria-label="Remove banner image" onClick={clearImage} type="button">×</button></div>}
          </div>
          <fieldset className="campaign-builder-field campaign-builder-channels">
            <legend>Distribution Channels</legend>
            <div className="campaign-builder-channel-grid">
              <label className={form.web ? 'is-selected' : ''}><input checked={form.web} name="web" onChange={updateForm} type="checkbox" /><span aria-hidden="true">◉</span><span>Web Banner</span></label>
              <label className={form.email ? 'is-selected' : ''}><input checked={form.email} name="email" onChange={updateForm} type="checkbox" /><span aria-hidden="true">✉</span><span>Email blast</span></label>
            </div>
          </fieldset>
          {formError && <p className="campaign-builder-error" role="alert">{formError}</p>}
          <button className="campaign-builder-launch-button" type="submit"><span aria-hidden="true">↗</span> Launch Campaign</button>
        </form>
      </section>
      {dialogOpen && <LaunchDialog busy={busy} error={modalError} form={form} onClose={() => setDialogOpen(false)} onConfirm={() => { void launchCampaign() }} />}
    </main>
  )
}
