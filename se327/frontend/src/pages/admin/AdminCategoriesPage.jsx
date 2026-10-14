import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '../../lib/apiClient.js'
import './admin-categories.css'

const categoryOrder = { men: 1, women: 2, kids: 3, baby: 4, unisex: 5 }

function unwrap(response) {
  return response?.data?.data || response?.data || {}
}

function visibleCategories(categories) {
  return (Array.isArray(categories) ? categories : [])
    .filter((category) => category.parentCategoryId === null)
    .filter((category) => !String(category.slug || '').startsWith('tag-'))
    .sort((left, right) => {
      const leftOrder = categoryOrder[String(left.slug || '').toLowerCase()] || 999
      const rightOrder = categoryOrder[String(right.slug || '').toLowerCase()] || 999
      return leftOrder === rightOrder
        ? String(left.categoryName || '').localeCompare(String(right.categoryName || ''))
        : leftOrder - rightOrder
    })
}

function errorMessage(error, fallback) {
  return error?.payload?.message || error?.message || fallback
}

function notify(title, message, type = 'success') {
  window.dispatchEvent(new CustomEvent('admin:toast', { detail: { title, message, type } }))
}

function CategoryVisibility({ category, onToggle, busy }) {
  const isVisible = !category.isHidden
  return (
    <div className="admin-category-visibility">
      <label className="admin-category-toggle">
        <input
          aria-label={`${isVisible ? 'Hide' : 'Show'} ${category.categoryName}`}
          checked={isVisible}
          disabled={busy}
          onChange={(event) => { void onToggle(category, event.target.checked).catch(() => {}) }}
          type="checkbox"
        />
        <span aria-hidden="true" className="admin-category-toggle-slider" />
      </label>
      <span className={`admin-category-visibility-label ${isVisible ? 'is-visible' : ''}`}>
        {isVisible ? 'VISIBLE' : 'HIDDEN'}
      </span>
    </div>
  )
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [emptyMessage, setEmptyMessage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalCategory, setModalCategory] = useState(null)
  const [categoryName, setCategoryName] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyIds, setBusyIds] = useState([])

  /** @param {() => boolean} [isActiveCheck] */
  const loadCategories = useCallback(async (isActiveCheck) => {
    const isActive = isActiveCheck || (() => true)
    if (!isActive()) return
    setLoading(true)
    setEmptyMessage('')
    try {
      const payload = unwrap(await apiClient.get('/admin/categories'))
      if (!isActive()) return
      if (!Array.isArray(payload.categories)) {
        notify('Error', 'Failed to retrieve categories', 'error')
        setCategories([])
        setEmptyMessage('Failed to load data')
        return
      }
      const result = visibleCategories(payload.categories)
      setCategories(result)
      if (!result.length) setEmptyMessage('No categories found.')
    } catch {
      if (!isActive()) return
      notify('System Error', 'Could not connect to the Backend API', 'error')
      setCategories([])
      setEmptyMessage('Backend Connection Error')
    } finally {
      if (isActive()) setLoading(false)
    }
  }, [])

  useEffect(() => {
    /** @type {boolean} */
    let active = true
    void Promise.resolve().then(() => loadCategories(() => active)).catch(() => {})
    return () => { active = false }
  }, [loadCategories])

  function openModal(category = null) {
    setModalCategory(category)
    setCategoryName(category?.categoryName || '')
    setModalOpen(true)
  }

  async function saveCategory(event) {
    event.preventDefault()
    if (saving) return
    const trimmedName = categoryName.trim()
    if (!trimmedName) {
      notify('Validation Error', 'Category name is required', 'error')
      document.getElementById('admin-category-name')?.focus()
      return
    }
    setSaving(true)
    const editing = Boolean(modalCategory)
    const path = editing ? `/admin/categories/${modalCategory.categoryId}` : '/admin/categories'
    try {
      if (editing) await apiClient.put(path, { categoryName: trimmedName })
      else await apiClient.post(path, { categoryName: trimmedName })
      notify('Success', editing ? 'Category updated successfully' : 'Category created successfully')
      setModalOpen(false)
      await loadCategories(() => true)
    } catch (error) {
      notify('Save Failed', errorMessage(error, 'Could not save category'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleVisibility(category, checked) {
    if (busyIds.includes(category.categoryId)) return
    const oldHidden = Boolean(category.isHidden)
    setBusyIds((current) => [...current, category.categoryId])
    setCategories((current) => current.map((item) => item.categoryId === category.categoryId
      ? { ...item, isHidden: !checked }
      : item))
    try {
      await apiClient.patch(`/admin/categories/${category.categoryId}/visibility`, { isHidden: !checked })
      notify('Success', `Category "${checked ? 'Visible' : 'Hidden'}" status updated`)
    } catch {
      setCategories((current) => current.map((item) => item.categoryId === category.categoryId
        ? { ...item, isHidden: oldHidden }
        : item))
      notify('Update Failed', 'Server rejected visibility change', 'error')
    } finally {
      setBusyIds((current) => current.filter((id) => id !== category.categoryId))
    }
  }

  async function deleteCategory(category) {
    if (!window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) return
    try {
      await apiClient.delete(`/admin/categories/${category.categoryId}`)
      notify('Success', 'Category deleted successfully')
      await loadCategories(() => true)
    } catch (error) {
      notify('Action Failed', errorMessage(error, 'Could not delete category'), 'error')
    }
  }

  return (
    <section className="admin-categories-page">
      <header className="admin-feature-header">
        <div>
          <h1>Category Management</h1>
          <p>Manage store categories and visibility</p>
        </div>
        <button className="admin-category-golden-button" onClick={() => openModal()} type="button">
          <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M8 2v12M2 8h12" /></svg>
          Add Category
        </button>
      </header>
      <div className="admin-category-table-card">
        <div className="admin-category-table-scroll">
          <table className="admin-category-table">
            <thead><tr><th>Name</th><th>Slug / Description</th><th>Visibility Status</th><th className="is-actions">Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td className="admin-category-state" colSpan={4}><span aria-hidden="true" className="admin-category-spinner" />Initializing Architect-Grade Data Pipeline...</td></tr>}
              {!loading && emptyMessage && <tr><td className="admin-category-state" colSpan={4}>{emptyMessage}</td></tr>}
              {!loading && !emptyMessage && categories.map((category) => (
                <tr key={category.categoryId}>
                  <td className="admin-category-name">{category.categoryName}</td>
                  <td><code>/{category.slug}</code></td>
                  <td><CategoryVisibility category={category} busy={busyIds.includes(category.categoryId)} onToggle={toggleVisibility} /></td>
                  <td><div className="admin-category-actions">
                    <button aria-label={`Edit ${category.categoryName}`} className="admin-category-icon-button" onClick={() => openModal(category)} type="button"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m11.5 2.5 2 2L6 12l-3 1 1-3 7.5-7.5ZM10 4l2 2" /></svg></button>
                    <button aria-label={`Delete ${category.categoryName}`} className="admin-category-icon-button is-danger" onClick={() => { void deleteCategory(category).catch(() => {}) }} type="button"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M5.5 1.5h5l.5 1.5h3v1h-12v-1h3l.5-1.5Zm-2 3.5h9l-.7 9H4.2l-.7-9Zm2 1 .4 6.5m4.2-6.5-.4 6.5" /></svg></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modalOpen && (
        <dialog aria-labelledby="admin-category-modal-title" aria-modal="true" className="admin-category-modal-backdrop" onKeyDown={(event) => { if (event.key === 'Escape' && !saving) setModalOpen(false) }} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false) }} open>
          <section className="admin-category-modal">
            <header><h2 id="admin-category-modal-title">{modalCategory ? 'Edit Category' : 'Add Category'}</h2><button aria-label="Close" disabled={saving} onClick={() => setModalOpen(false)} type="button">×</button></header>
            <form noValidate onSubmit={(event) => { void saveCategory(event).catch(() => {}) }}>
              <label htmlFor="admin-category-name">Category Name</label>
              <input id="admin-category-name" onChange={(event) => setCategoryName(event.target.value)} placeholder="e.g. Men, Accessories" required value={categoryName} />
              <footer><button className="admin-category-glass-button" disabled={saving} onClick={() => setModalOpen(false)} type="button">Cancel</button><button className="admin-category-golden-button" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save Category'}</button></footer>
            </form>
          </section>
        </dialog>
      )}
    </section>
  )
}
