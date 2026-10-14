import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import './admin-products.css'

const subtypes = {
  Men: ['T-Shirts & Sweatshirts', 'Shirts & Polo Shirts', 'Knitwear & Sweaters', 'Outerwear', 'Pants', 'Innerwear & Socks', 'Loungewear', 'Linen', 'Sport Utility Wear', 'UV Protection Collection', 'AIRism', 'HEATTECH', 'Accessories', 'Special Collaborations', 'New Arrivals', 'Price Down'],
  Women: ['T-Shirts & Sweats & Bra Tops', 'Shirts & Polo Shirts', 'Knitwear & Cardigans', 'Outerwear', 'Bottoms', 'Dresses & Skirts', 'Innerwear & Socks', 'Loungewear', 'Linen', 'Accessories', 'Sport Utility Wear', 'UV Protection Collection', 'AIRism', 'HEATTECH', 'Maternity', 'New Arrivals'],
  Kids: ['T-Shirts & Sweatshirts', 'Shirts & Blouses', 'Outerwear', 'Bottoms', 'Dresses & Skirts', 'Activewear', 'Innerwear & Socks', 'Pajamas', 'Accessories', 'AIRism', 'HEATTECH', 'Special Collaborations'],
  Baby: ['Bodysuits & Rompers', 'Tops & T-Shirts', 'Bottoms & Leggings', 'Dresses & Skirts', 'Outerwear', 'Innerwear & Socks', 'Pajamas & Sleepwear', 'Accessories', 'Maternity & Newborn', 'AIRism', 'HEATTECH', 'Special Collaborations'],
  Unisex: ['T-Shirts', 'Sweatshirts & Hoodies', 'Outerwear', 'Bottoms', 'Activewear', 'Loungewear', 'Accessories', 'Bags', 'Shoes', 'Sunglasses', 'AIRism', 'Special Collaborations'],
}
function unwrap(response) { return response?.data?.data || response?.data || {} }
function announce(title, message, type = 'success') { window.dispatchEvent(new CustomEvent('admin:toast', { detail: { title, message, type } })) }
function initialVariant() { return { size: '', colour: '', stock: '' } }
function productErrorMessage(error) { return error?.payload?.message || error?.message || 'Unable to save product.' }
function statusForApi(status) { return status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE' }
function submitLabel(busy, editing) {
  if (busy) return 'Saving...'
  if (editing) return 'Update Product'
  return 'Create Product'
}

export default function AdminProductFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [fields, setFields] = useState({ name: '', description: '', categoryId: '', subtype: '', sku: '', price: '', discountPrice: '', stock: '', status: 'ACTIVE' })
  const [variants, setVariants] = useState([])
  const [loadedVariants, setLoadedVariants] = useState([])
  const [newVariant, setNewVariant] = useState(initialVariant)
  const [existingImages, setExistingImages] = useState([])
  const [hiddenExistingImages, setHiddenExistingImages] = useState([])
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const previewUrls = useRef(new Set())
  /** @type {[any, (value: any) => void]} */
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(editing)
  const [busy, setBusy] = useState(false)

  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])

  useEffect(() => {
    let active = true
    apiClient.get('/admin/categories')
      .then((response) => {
        const rows = unwrap(response).categories || []
        if (active) setCategories(rows.filter((category) => category.parentCategoryId == null && !String(category.slug || '').startsWith('tag-')))
      })
      .catch(() => { if (active) setCategories([]) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!editing) return undefined
    let active = true
    apiClient.get(`/admin/products/${id}?lang=EN`)
      .then((response) => {
        if (!active) return
        const product = unwrap(response)
        const primary = product.categories?.find((category) => category.isPrimary)
        const firstVariant = product.variants?.[0] || {}
        setFields({ name: product.name || '', description: product.description || '', categoryId: primary?.categoryId ? String(primary.categoryId) : '', subtype: primary?.name?.split(' ').slice(1).join(' ') || '', sku: firstVariant.sku || '', price: String(firstVariant.price || product.priceFrom || ''), discountPrice: String(firstVariant.compareAtPrice ?? ''), stock: String(product.variants?.reduce((sum, variant) => sum + (Number(variant.stockQty) || 0), 0) ?? ''), status: (product.status || 'ACTIVE').toUpperCase() })
        setVariants((product.variants || []).map((variant) => ({ sku: variant.sku, size: variant.size || '', colour: variant.colour || '', stock: String(variant.stockQty ?? 0) })))
        setLoadedVariants(product.variants || [])
        setExistingImages(product.media || [])
      })
      .catch((requestError) => {
        if (active) setError(productErrorMessage(requestError))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [editing, id])

  function updateField(event) {
    const { name, value } = event.target
    setFields((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
  }

  function selectFiles(fileList) {
    const incoming = Array.from(fileList || [])
    if (files.length + incoming.length > 4) {
      window.alert('Maximum 4 images allowed.')
      return
    }
    const urls = incoming.map((file) => URL.createObjectURL(file))
    urls.forEach((url) => previewUrls.current.add(url))
    setFiles((current) => [...current, ...incoming])
    setPreviews((current) => [...current, ...urls])
  }

  function addVariant() {
    if (!newVariant.size.trim() || !newVariant.colour.trim()) {
      window.alert('Please enter both size and color')
      return
    }
    setVariants((current) => [...current, newVariant])
    setNewVariant(initialVariant())
  }

  function updateVariant(index, field, value) {
    setVariants((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))
  }

  function removeVariant(index) { setVariants((current) => current.filter((_, rowIndex) => rowIndex !== index)) }

  async function saveProduct(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setFieldErrors({})
    setError('')
    try {
      if (editing) {
        const body = {
          name: fields.name,
          description: fields.description,
          status: statusForApi(fields.status),
          category_id: fields.categoryId ? Number(fields.categoryId) : undefined,
        }
        // the API changes one variant per request, picked by sku
        const variantChanges = {}
        const shownVariant = loadedVariants.find((variant) => variant.sku === fields.sku)
        if (shownVariant && Number(fields.price) !== Number(shownVariant.price)) variantChanges[shownVariant.sku] = { price: Number(fields.price) }
        variants.forEach((row) => {
          const loaded = loadedVariants.find((variant) => variant.sku === row.sku)
          const stock = Number.parseInt(row.stock, 10)
          if (loaded && stock !== (loaded.stockQty ?? 0)) variantChanges[row.sku] = { ...variantChanges[row.sku], stock }
        })
        const skus = Object.keys(variantChanges)
        const [firstSku] = skus
        await apiClient.put(`/admin/products/${id}`, firstSku ? { ...body, sku: firstSku, ...variantChanges[firstSku] } : body)
        for (const sku of skus.slice(1)) await apiClient.put(`/admin/products/${id}`, { sku, ...variantChanges[sku] })
        announce('Success', 'Product updated successfully.')
      } else {
        if (!fields.categoryId) {
          setFieldErrors({ categoryId: 'Please select a valid category' })
          return
        }
        const stickerPrice = Number(fields.price) || 0
        const sellingPrice = Number(fields.discountPrice) || stickerPrice
        const chosenVariants = variants.filter((row) => row.size.trim() && row.colour.trim()).map((row) => ({ sku: `${fields.name.slice(0, 3)}-${row.size}-${row.colour}`.toUpperCase(), colour: row.colour.trim().toUpperCase(), size: row.size.trim().toUpperCase(), price: sellingPrice, compareAtPrice: stickerPrice > sellingPrice ? stickerPrice : null, stockQty: Number.parseInt(row.stock, 10) || 0 }))
        if (!chosenVariants.length) chosenVariants.push({ sku: fields.sku || 'NEW-PROD-SKU', colour: 'DEFAULT', size: 'FREE', price: sellingPrice, compareAtPrice: stickerPrice > sellingPrice ? stickerPrice : null, stockQty: Number.parseInt(fields.stock, 10) || 0 })
        const payload = { productType: 'TOP', status: statusForApi(fields.status), translations: [{ languageCode: 'EN', name: fields.name, description: fields.description }, { languageCode: 'TH', name: fields.name, description: fields.description }], categories: [{ categoryId: Number(fields.categoryId), isPrimary: true }], variants: chosenVariants, media: files.map((_, index) => ({ sortOrder: index + 1, isThumbnail: index === 0, isHero: index === 0, altText: fields.name })) }
        const formData = new FormData()
        formData.append('payload', JSON.stringify(payload))
        files.forEach((file) => formData.append('mediaFiles', file))
        await apiClient.post('/admin/products', formData)
        announce('Success', 'Product Catalog Updated.')
      }
      await navigate('/admin/products')
    } catch (requestError) {
      const details = requestError?.payload?.details || requestError?.payload?.errors || {}
      setFieldErrors(details)
      setError(productErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  const selectedCategory = categories.find((category) => String(category.categoryId) === fields.categoryId)
  const availableSubtypes = subtypes[selectedCategory?.categoryName] || []
  const visibleExistingImages = existingImages.filter((image) => !hiddenExistingImages.includes(image.productMediaId || image.publicUrl))
  const showUploadInstructions = visibleExistingImages.length + previews.length === 0
  const openFilePicker = () => document.getElementById('admin-product-images')?.click()

  return (
    <section className="admin-product-form-page">
      <header className="admin-feature-header"><div><h2>{editing ? 'Edit Product' : 'Create Product'}</h2><p>{editing ? 'Update product information' : 'Add a new product to your catalog'}</p></div><Link className="admin-feature-button admin-product-back" to="/admin/products">← Back</Link></header>
      {loading && <output>Loading product...</output>}
      {error && <p className="admin-product-form-error" role="alert">{error}</p>}
      {!loading && <form className="admin-product-form" onSubmit={(event) => { void saveProduct(event).catch(() => {}) }}>
        <div className="admin-product-form-main">
          <article className="admin-feature-card"><h3>Basic Information</h3><div className="admin-product-form-grid id-name"><label>Product ID<input defaultValue={id || ''} readOnly={editing} placeholder="Auto" /></label><label>Product Name *<input name="name" onChange={updateField} placeholder="Enter product name" required value={fields.name} />{fieldErrors.name && <small role="alert">{fieldErrors.name}</small>}</label></div><label>Description<textarea name="description" onChange={updateField} value={fields.description} /></label><div className="admin-product-form-grid three"><label>Category<select name="categoryId" onChange={(event) => { updateField(event); setFields((current) => ({ ...current, subtype: '' })) }} value={fields.categoryId}><option value="">Select Category</option>{categories.slice().sort((left, right) => String(left.categoryName || '').localeCompare(String(right.categoryName || ''))).map((category) => <option key={category.categoryId} value={category.categoryId}>{category.categoryName}{category.isHidden ? ' (Hidden)' : ''}</option>)}</select>{fieldErrors.categoryId && <small role="alert">{fieldErrors.categoryId}</small>}</label><label>Sub Type (Optional)<select name="subtype" onChange={updateField} value={fields.subtype}><option value="">Select Sub Type</option>{availableSubtypes.map((item) => <option key={item}>{item}</option>)}</select></label><label>SKU<input name="sku" onChange={updateField} placeholder="SKU-XX-XXXX" value={fields.sku} />{fieldErrors.sku && <small role="alert">{fieldErrors.sku}</small>}</label></div></article>
          <article className="admin-feature-card"><h3>Pricing &amp; Stock</h3><div className="admin-product-form-grid three"><label>Price ($) *<input name="price" onChange={updateField} placeholder="0.00" required step="0.01" type="number" value={fields.price} />{fieldErrors.price && <small role="alert">{fieldErrors.price}</small>}</label><label>Discount Price ($)<input name="discountPrice" onChange={updateField} placeholder="0.00" step="0.01" type="number" value={fields.discountPrice} /></label><label>Stock *<input name="stock" onChange={updateField} placeholder="0" readOnly={editing} required type="number" value={editing ? variants.reduce((sum, row) => sum + (Number.parseInt(row.stock, 10) || 0), 0) : fields.stock} />{fieldErrors.stock && <small role="alert">{fieldErrors.stock}</small>}</label></div></article>
          <article className="admin-feature-card"><h3>Variants</h3><div className="admin-orders-table-scroll"><table className="admin-orders-table admin-variant-table"><thead><tr><th>Size</th><th>Color</th><th>Stock</th><th /></tr></thead><tbody>{variants.map((row, index) => <tr key={`${row.size}-${row.colour}-${index}`}><td><input aria-label={`Variant ${index + 1} size`} onChange={(event) => updateVariant(index, 'size', event.target.value)} value={row.size} /></td><td><input aria-label={`Variant ${index + 1} color`} onChange={(event) => updateVariant(index, 'colour', event.target.value)} value={row.colour} /></td><td><input aria-label={`Variant ${index + 1} stock`} min="0" onChange={(event) => updateVariant(index, 'stock', event.target.value)} type="number" value={row.stock} /></td><td><button aria-label={`Remove variant ${index + 1}`} onClick={() => removeVariant(index)} type="button">×</button></td></tr>)}<tr><td><input aria-label="New variant size" onChange={(event) => setNewVariant((current) => ({ ...current, size: event.target.value }))} placeholder="S" value={newVariant.size} /></td><td><input aria-label="New variant color" onChange={(event) => setNewVariant((current) => ({ ...current, colour: event.target.value }))} placeholder="White" value={newVariant.colour} /></td><td><input aria-label="New variant stock" min="0" onChange={(event) => setNewVariant((current) => ({ ...current, stock: event.target.value }))} placeholder="0" type="number" value={newVariant.stock} /></td><td><button aria-label="Add variant" onClick={addVariant} type="button">＋</button></td></tr></tbody></table></div></article>
        </div>
        <aside className="admin-product-form-aside"><article className="admin-feature-card"><h3>Status</h3><select aria-label="Status" name="status" onChange={updateField} value={fields.status}><option value="ACTIVE">Active</option><option value="INACTIVE">Draft</option><option value="ARCHIVED">Archived</option></select>{fieldErrors.status && <small role="alert">{fieldErrors.status}</small>}</article><article className="admin-feature-card"><h3>Media</h3><input accept="image/*" aria-label="Product images" className="admin-product-file-input" id="admin-product-images" multiple onChange={(event) => selectFiles(event.target.files)} type="file" />{fieldErrors.media && <small role="alert">{fieldErrors.media}</small>}<div className="admin-product-previews" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFiles(event.dataTransfer.files) }}>{showUploadInstructions && <button aria-label="Drag and drop or click to upload product images" className="admin-product-upload-trigger" onClick={openFilePicker} type="button"><svg aria-hidden="true" className="admin-upload-icon" viewBox="0 0 32 32"><path d="M8.5 24.5h15a6.5 6.5 0 0 0 .7-13A8.5 8.5 0 0 0 8 9.4a6.25 6.25 0 0 0 .5 15.1Z" /><path d="M16 22V14m0 0-3 3m3-3 3 3" /></svg><p>Drag &amp; dropdown or click to upload</p><p>Upload 1 or more images (JPG, PNG)</p></button>}{visibleExistingImages.map((image, index) => <div className="admin-product-preview" key={image.productMediaId || image.publicUrl}><img alt={image.altText || fields.name} src={image.publicUrl} /><button aria-label={`Remove existing image ${index + 1}`} onClick={() => setHiddenExistingImages((current) => [...current, image.productMediaId || image.publicUrl])} type="button">×</button></div>)}{previews.map((src, index) => <div className="admin-product-preview" key={src}><img alt={`${fields.name} preview ${index + 1}`} src={src} /><button aria-label={`Remove image ${index + 1}`} onClick={() => { URL.revokeObjectURL(src); previewUrls.current.delete(src); setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index)); setPreviews((current) => current.filter((_, previewIndex) => previewIndex !== index)) }} type="button">×</button></div>)}</div></article><button className="admin-feature-button admin-product-submit" disabled={busy} type="submit">{submitLabel(busy, editing)}</button></aside>
      </form>}
    </section>
  )
}
