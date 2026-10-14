import { useEffect, useMemo, useRef, useState } from 'react'

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function todayLocal() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function parseDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
  return date.getFullYear() === Number(match[3]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[1])
    ? date
    : null
}

function formatDate(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isSameDay(first, second) {
  return dateKey(first) === dateKey(second)
}

function calendarDays(viewDate) {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const firstVisibleDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1 - firstOfMonth.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDate)
    date.setDate(firstVisibleDate.getDate() + index)
    return date
  })
}

function dateLabel(date) {
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

export default function SignupDatePicker({ value, onChange }) {
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const today = useMemo(() => todayLocal(), [])
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => todayLocal())
  const selectedDate = parseDate(value)
  const days = calendarDays(viewDate)

  useEffect(() => {
    if (!isOpen) return undefined
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false)
    }
    const closeEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [isOpen])

  function openCalendar() {
    const parsed = parseDate(value)
    setViewDate(parsed || todayLocal())
    setIsOpen(true)
  }

  function changeMonth(month) {
    setViewDate((current) => new Date(current.getFullYear(), Number(month), 1))
  }

  function changeYear(year) {
    setViewDate((current) => new Date(Number(year), current.getMonth(), 1))
  }

  function stepYear(amount) {
    setViewDate((current) => new Date(current.getFullYear() + amount, current.getMonth(), 1))
  }

  function chooseDate(date) {
    if (date > today) return
    onChange(formatDate(date))
    inputRef.current?.setCustomValidity('')
    setIsOpen(false)
  }

  function handleTextChange(event) {
    const nextValue = event.target.value
    onChange(nextValue)
    event.target.setCustomValidity('')
    const parsed = parseDate(nextValue)
    if (parsed) setViewDate(parsed)
  }

  return (
    <div className="signup-date-control" ref={rootRef}>
      <input autoComplete="bday" id="signup-dob" name="dob" onChange={handleTextChange} onFocus={openCalendar} placeholder="DD/MM/YYYY" ref={inputRef} required type="text" value={value} />
      <button aria-expanded={isOpen} aria-label="Open date of birth calendar" className="signup-calendar-button" onClick={() => isOpen ? setIsOpen(false) : openCalendar()} type="button">
        <svg aria-hidden="true" fill="none" height="16" stroke="#A69B91" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16"><rect height="18" rx="2" ry="2" width="18" x="3" y="4" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
      </button>
      {isOpen && (
        <dialog aria-label="Date of birth calendar" className="signup-calendar" open>
          <div className="signup-calendar-header">
            <button aria-label="Previous month" className="signup-calendar-prev" onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} type="button"><span /></button>
            <div className="signup-calendar-month-select">
              <select aria-label="Month" onChange={(event) => changeMonth(event.target.value)} value={viewDate.getMonth()}>
                {months.map((month, index) => <option key={month} value={index}>{month}</option>)}
              </select>
            </div>
            <div className="signup-calendar-year-control">
              <input aria-label="Year" className="signup-calendar-year" max={today.getFullYear()} min="1900" onChange={(event) => changeYear(event.target.value)} type="number" value={viewDate.getFullYear()} />
              <span className="signup-calendar-year-arrows">
                <button aria-label="Increase year" disabled={viewDate.getFullYear() >= today.getFullYear()} onClick={() => stepYear(1)} type="button" />
                <button aria-label="Decrease year" disabled={viewDate.getFullYear() <= 1900} onClick={() => stepYear(-1)} type="button" />
              </span>
            </div>
            <button aria-label="Next month" className="signup-calendar-next" disabled={viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() >= today.getMonth()} onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} type="button"><span /></button>
          </div>
          <div className="signup-calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="signup-calendar-days">
            {days.map((date) => {
              const isCurrentMonth = date.getMonth() === viewDate.getMonth()
              const isFuture = date > today
              const isSelected = selectedDate && isSameDay(date, selectedDate)
              const isToday = isSameDay(date, today)
              return (
                <button aria-label={dateLabel(date)} aria-pressed={Boolean(isSelected)} className={`signup-calendar-day${isCurrentMonth ? '' : ' outside-month'}${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`} disabled={isFuture} key={dateKey(date)} onClick={() => chooseDate(date)} type="button">{date.getDate()}</button>
              )
            })}
          </div>
        </dialog>
      )}
    </div>
  )
}
