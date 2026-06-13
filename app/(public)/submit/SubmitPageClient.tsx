'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { apiPost, apiGet, ApiError } from '@/lib/api'
import { CheckCircle, ChevronRight, ChevronLeft, Upload, X, Search, Loader2, AlertCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3

interface DishSuggestion {
  dishId: string
  canonicalName: string
  slug: string
  category: string
}

interface DishEntry {
  dishId: string
  canonicalName: string
  nameAsServed?: string
  price?: number
  availabilityStatus: 'ALWAYS_AVAILABLE' | 'SEASONAL' | 'WEEKEND_ONLY' | 'ON_ORDER' | 'UNKNOWN'
}

interface PhotoEntry {
  cloudinaryPublicId: string
  thumbnailUrl: string
  isPrimary: boolean
}

interface RestaurantInfo {
  name: string
  description: string
  address: string
  area: string
  phone: string
  email: string
  website: string
  priceRange: 'BUDGET' | 'MID' | 'UPSCALE' | ''
  cuisineTypes: string
}

// ─── Step progress indicator ──────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: 'Restaurant Info' },
  { n: 2, label: 'Dishes Served' },
  { n: 3, label: 'Photos & Submit' },
] as const

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="sticky top-0 lg:top-[60px] z-30 bg-neutral-0 border-b border-neutral-100">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-center gap-2 px-2">
          {STEPS.map(({ n, label }, i) => {
            const done    = step > n
            const active  = step === n
            const future  = step < n
            return (
              <div key={n} className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold transition-colors duration-fast',
                      done   && 'bg-amber-500 text-neutral-0',
                      active && 'bg-neutral-900 text-neutral-0',
                      future && 'bg-neutral-200 text-neutral-500',
                    )}
                  >
                    {done ? <CheckCircle size={14} aria-hidden="true" /> : n}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium truncate hidden sm:block',
                      done   && 'text-amber-600',
                      active && 'text-neutral-900',
                      future && 'text-neutral-400',
                    )}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'h-px mx-2 transition-colors duration-fast min-w-[1.5rem] flex-1',
                      step > n ? 'bg-amber-400' : 'bg-neutral-200',
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Field components ─────────────────────────────────────────────────────────

function Label({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-800 mb-1.5">
      {children}
      {optional && <span className="ml-1.5 text-neutral-400 font-normal text-xs">Optional</span>}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
      <AlertCircle size={11} aria-hidden="true" />
      {message}
    </p>
  )
}

function Input({
  id, value, onChange, placeholder, type = 'text', error, autoComplete,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  error?: string
  autoComplete?: string
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className={cn(
        'w-full h-11 px-3.5 rounded-xl border text-sm text-neutral-900 placeholder-neutral-400',
        'bg-neutral-0 transition-colors duration-fast',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500',
        error ? 'border-red-400' : 'border-neutral-200 hover:border-neutral-300',
      )}
    />
  )
}

function Textarea({
  id, value, onChange, placeholder, rows = 3, error,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  error?: string
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        'w-full px-3.5 py-3 rounded-xl border text-sm text-neutral-900 placeholder-neutral-400',
        'bg-neutral-0 resize-none transition-colors duration-fast',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500',
        error ? 'border-red-400' : 'border-neutral-200 hover:border-neutral-300',
      )}
    />
  )
}

function SelectField({
  id, value, onChange, children, error,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  error?: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full h-11 px-3.5 rounded-xl border text-sm text-neutral-900',
        'bg-neutral-0 transition-colors duration-fast appearance-none',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500',
        value === '' && 'text-neutral-400',
        error ? 'border-red-400' : 'border-neutral-200 hover:border-neutral-300',
      )}
    >
      {children}
    </select>
  )
}

// ─── Step 1: Restaurant Info ──────────────────────────────────────────────────

interface Step1Errors {
  name?: string
  address?: string
  phone?: string
  priceRange?: string
  cuisineTypes?: string
  email?: string
  website?: string
}

function Step1({
  info, setInfo, onNext,
}: {
  info: RestaurantInfo
  setInfo: (i: RestaurantInfo) => void
  onNext: () => void
}) {
  const [errors, setErrors] = useState<Step1Errors>({})

  const set = (key: keyof RestaurantInfo) => (val: string) =>
    setInfo({ ...info, [key]: val })

  function validate(): boolean {
    const e: Step1Errors = {}
    if (!info.name.trim() || info.name.trim().length < 2)
      e.name = 'Restaurant name must be at least 2 characters'
    if (!info.address.trim() || info.address.trim().length < 5)
      e.address = 'Full street address is required (at least 5 characters)'
    if (!info.phone.trim())
      e.phone = 'Phone number is required'
    else if (!/^(\+?234|0)[789][01]\d{8}$/.test(info.phone.trim()))
      e.phone = 'Enter a valid Nigerian phone number (e.g. 08012345678)'
    if (!info.priceRange)
      e.priceRange = 'Please select a price range'
    if (!info.cuisineTypes.trim())
      e.cuisineTypes = 'Enter at least one cuisine type'
    if (info.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim()))
      e.email = 'Enter a valid email address'
    if (info.website && !/^https?:\/\/.+/.test(info.website.trim()))
      e.website = 'Enter a valid URL starting with http:// or https://'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (validate()) onNext()
  }

  return (
    <div className="space-y-5">
      {/* Name */}
      <div>
        <Label htmlFor="name">Restaurant name</Label>
        <Input
          id="name"
          value={info.name}
          onChange={set('name')}
          placeholder="e.g. Mama Cass Restaurant"
          autoComplete="organization"
          error={errors.name}
        />
        <FieldError message={errors.name} />
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description" optional>Short description</Label>
        <Textarea
          id="description"
          value={info.description}
          onChange={set('description')}
          placeholder="What makes this restaurant special?"
          rows={2}
        />
        <p className="mt-1 text-xs text-neutral-400">{500 - info.description.length} characters remaining</p>
      </div>

      {/* Address + Area */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="address">Street address</Label>
          <Input
            id="address"
            value={info.address}
            onChange={set('address')}
            placeholder="e.g. 5 Lobito Crescent, Wuse II"
            autoComplete="street-address"
            error={errors.address}
          />
          <FieldError message={errors.address} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="area" optional>Area / Neighbourhood</Label>
            <Input
              id="area"
              value={info.area}
              onChange={set('area')}
              placeholder="e.g. Wuse II"
            />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <div className="w-full h-11 px-3.5 rounded-xl border border-neutral-200 bg-neutral-100 text-sm text-neutral-500 flex items-center">
              Abuja
            </div>
          </div>
        </div>
      </div>

      {/* Phone */}
      <div>
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          type="tel"
          value={info.phone}
          onChange={set('phone')}
          placeholder="e.g. 08012345678"
          autoComplete="tel"
          error={errors.phone}
        />
        <FieldError message={errors.phone} />
      </div>

      {/* Email + Website */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email" optional>Email</Label>
          <Input
            id="email"
            type="email"
            value={info.email}
            onChange={set('email')}
            placeholder="restaurant@example.com"
            autoComplete="email"
            error={errors.email}
          />
          <FieldError message={errors.email} />
        </div>
        <div>
          <Label htmlFor="website" optional>Website</Label>
          <Input
            id="website"
            type="url"
            value={info.website}
            onChange={set('website')}
            placeholder="https://..."
            autoComplete="url"
            error={errors.website}
          />
          <FieldError message={errors.website} />
        </div>
      </div>

      {/* Price range */}
      <div>
        <Label htmlFor="priceRange">Price range</Label>
        <SelectField id="priceRange" value={info.priceRange} onChange={set('priceRange')} error={errors.priceRange}>
          <option value="" disabled>Select price range</option>
          <option value="BUDGET">Budget — affordable everyday eats</option>
          <option value="MID">Mid-range — comfortable sit-down dining</option>
          <option value="UPSCALE">Upscale — premium dining experience</option>
        </SelectField>
        <FieldError message={errors.priceRange} />
      </div>

      {/* Cuisine types */}
      <div>
        <Label htmlFor="cuisineTypes">Cuisine types</Label>
        <Input
          id="cuisineTypes"
          value={info.cuisineTypes}
          onChange={set('cuisineTypes')}
          placeholder="e.g. Nigerian, Yoruba, Continental"
          error={errors.cuisineTypes}
        />
        <p className="mt-1 text-xs text-neutral-400">Separate multiple cuisines with commas</p>
        <FieldError message={errors.cuisineTypes} />
      </div>

      <NavButtons onNext={handleNext} step={1} />
    </div>
  )
}

// ─── Step 2: Dishes ───────────────────────────────────────────────────────────

const AVAILABILITY_LABELS: Record<DishEntry['availabilityStatus'], string> = {
  ALWAYS_AVAILABLE: 'Always available',
  SEASONAL:         'Seasonal',
  WEEKEND_ONLY:     'Weekends only',
  ON_ORDER:         'On order',
  UNKNOWN:          'Not sure',
}

function Step2({
  dishes, setDishes, onNext, onBack,
}: {
  dishes: DishEntry[]
  setDishes: (d: DishEntry[]) => void
  onNext: () => void
  onBack: () => void
}) {
  const [query, setQuery]         = useState('')
  const [suggestions, setSugg]    = useState<DishSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShow]   = useState(false)
  const [error, setError]         = useState('')
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSugg([]); setShow(false); return }
    setSearching(true)
    try {
      const res = await apiGet<DishSuggestion[]>(`/api/v1/search/suggestions?q=${encodeURIComponent(q)}`)
      setSugg(res ?? [])
      setShow(true)
    } catch {
      setSugg([])
    } finally {
      setSearching(false)
    }
  }, [])

  function handleQueryChange(val: string) {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 280)
  }

  function addDish(s: DishSuggestion) {
    if (dishes.some((d) => d.dishId === s.dishId)) return
    setDishes([...dishes, {
      dishId:             s.dishId,
      canonicalName:      s.canonicalName,
      availabilityStatus: 'ALWAYS_AVAILABLE',
    }])
    setQuery('')
    setSugg([])
    setShow(false)
    setError('')
  }

  function removeDish(id: string) {
    setDishes(dishes.filter((d) => d.dishId !== id))
  }

  function updateDish(id: string, patch: Partial<DishEntry>) {
    setDishes(dishes.map((d) => d.dishId === id ? { ...d, ...patch } : d))
  }

  function handleNext() {
    if (dishes.length === 0) { setError('Add at least one dish this restaurant serves'); return }
    onNext()
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-neutral-600 mb-4">
          Search the dish catalogue and add every dish this restaurant serves. Our team will verify the list during review.
        </p>

        {/* Dish search */}
        <div className="relative">
          <Label htmlFor="dish-search">Search dishes</Label>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" aria-hidden="true" />
            <input
              id="dish-search"
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => query.length >= 2 && setShow(true)}
              placeholder="e.g. Jollof Rice, Egusi Soup..."
              className={cn(
                'w-full h-11 pl-9 pr-10 rounded-xl border border-neutral-200 text-sm text-neutral-900 placeholder-neutral-400',
                'bg-neutral-0 transition-colors duration-fast outline-none',
              )}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
            />
            {searching && (
              <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 animate-spin" aria-hidden="true" />
            )}
          </div>

          {/* Suggestions dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 w-full bg-neutral-0 border border-neutral-200 rounded-xl shadow-lg overflow-hidden"
            >
              {suggestions.slice(0, 8).map((s) => {
                const already = dishes.some((d) => d.dishId === s.dishId)
                return (
                  <li key={s.dishId} role="option" aria-selected={already}>
                    <button
                      type="button"
                      onClick={() => !already && addDish(s)}
                      disabled={already}
                      className={cn(
                        'w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2',
                        already
                          ? 'text-neutral-400 cursor-default bg-neutral-50'
                          : 'text-neutral-900 hover:bg-amber-50 hover:text-amber-700 transition-colors duration-fast',
                      )}
                    >
                      <span>{s.canonicalName}</span>
                      <span className="text-xs text-neutral-400 shrink-0">{s.category}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {showDropdown && !searching && query.length >= 2 && suggestions.length === 0 && (
            <div className="absolute z-20 mt-1 w-full bg-neutral-0 border border-neutral-200 rounded-xl shadow-lg px-4 py-3 text-sm text-neutral-500">
              No dishes found for &ldquo;{query}&rdquo;. Our team can add new dishes during review.
            </div>
          )}
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle size={11} aria-hidden="true" /> {error}
          </p>
        )}
      </div>

      {/* Dish list */}
      {dishes.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{dishes.length} dish{dishes.length !== 1 ? 'es' : ''} added</p>
          {dishes.map((d) => (
            <div key={d.dishId} className="border border-neutral-200 rounded-xl p-4 bg-neutral-0 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{d.canonicalName}</p>
                  {d.nameAsServed && d.nameAsServed !== d.canonicalName && (
                    <p className="text-xs text-neutral-500">Served as: {d.nameAsServed}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeDish(d.dishId)}
                  className="shrink-0 text-neutral-400 hover:text-red-500 transition-colors duration-fast p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                  aria-label={`Remove ${d.canonicalName}`}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Name as served */}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1" htmlFor={`name-${d.dishId}`}>
                    Name as served <span className="text-neutral-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id={`name-${d.dishId}`}
                    type="text"
                    value={d.nameAsServed ?? ''}
                    onChange={(e) => updateDish(d.dishId, { nameAsServed: e.target.value || undefined })}
                    placeholder={d.canonicalName}
                    className="w-full h-9 px-3 rounded-lg border border-neutral-200 text-xs text-neutral-900 placeholder-neutral-400 bg-neutral-0 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1" htmlFor={`price-${d.dishId}`}>
                    Price (₦) <span className="text-neutral-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id={`price-${d.dishId}`}
                    type="number"
                    min="0"
                    step="50"
                    value={d.price ?? ''}
                    onChange={(e) => updateDish(d.dishId, { price: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="e.g. 2500"
                    className="w-full h-9 px-3 rounded-lg border border-neutral-200 text-xs text-neutral-900 placeholder-neutral-400 bg-neutral-0 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Availability */}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Availability</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(AVAILABILITY_LABELS) as DishEntry['availabilityStatus'][]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateDish(d.dishId, { availabilityStatus: status })}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-fast',
                        d.availabilityStatus === status
                          ? 'bg-amber-500 border-amber-500 text-neutral-0'
                          : 'bg-neutral-0 border-neutral-200 text-neutral-600 hover:border-neutral-300',
                      )}
                    >
                      {AVAILABILITY_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NavButtons onNext={handleNext} onBack={onBack} step={2} />
    </div>
  )
}

// ─── Step 3: Photos + Submitter + Final submit ────────────────────────────────

function Step3({
  photos,
  setPhotos,
  submitterName,
  setSubmitterName,
  submitterEmail,
  setSubmitterEmail,
  submitterNote,
  setSubmitterNote,
  onBack,
  onSubmit,
  submitting,
  submitError,
}: {
  photos: PhotoEntry[]
  setPhotos: (p: PhotoEntry[]) => void
  submitterName: string
  setSubmitterName: (v: string) => void
  submitterEmail: string
  setSubmitterEmail: (v: string) => void
  submitterNote: string
  setSubmitterNote: (v: string) => void
  onBack: () => void
  onSubmit: () => void
  submitting: boolean
  submitError: string
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const remaining = 5 - photos.length
    if (remaining <= 0) { setUploadError('Maximum 5 photos allowed'); return }
    setUploadError('')
    setUploading(true)
    const toUpload = Array.from(files).slice(0, remaining)
    const results: PhotoEntry[] = []
    for (const file of toUpload) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        setUploadError('Only JPEG and PNG files are accepted')
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Each photo must be under 5MB')
        continue
      }
      try {
        const fd = new FormData()
        fd.append('file', file)
        // FormData upload — no Content-Type header so browser sets multipart boundary
        const raw = await fetch('/api/v1/intake/photos', { method: 'POST', body: fd })
        const envelope = await raw.json()
        if (!envelope.success) throw new ApiError(envelope.error.code, envelope.error.message, raw.status)
        const res = envelope.data as { publicId: string; thumbnailUrl: string; width: number; height: number }
        results.push({
          cloudinaryPublicId: res.publicId,
          thumbnailUrl:       res.thumbnailUrl,
          isPrimary:          photos.length + results.length === 0,
        })
      } catch (err: unknown) {
        setUploadError(err instanceof Error ? err.message : 'Photo upload failed')
      }
    }
    setPhotos([...photos, ...results])
    setUploading(false)
  }

  function removePhoto(id: string) {
    const next = photos.filter((p) => p.cloudinaryPublicId !== id)
    if (next.length > 0 && !next.some((p) => p.isPrimary)) next[0].isPrimary = true
    setPhotos(next)
  }

  function setPrimary(id: string) {
    setPhotos(photos.map((p) => ({ ...p, isPrimary: p.cloudinaryPublicId === id })))
  }

  return (
    <div className="space-y-6">
      {/* Photo upload */}
      <div>
        <Label htmlFor="photo-upload" optional>Restaurant photos</Label>
        <p className="text-xs text-neutral-500 mb-3">Add up to 5 photos — JPEG or PNG, max 5MB each. The first photo will be the primary listing image.</p>

        <input
          ref={fileRef}
          id="photo-upload"
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          aria-label="Upload photos"
        />

        {/* Drop zone */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || photos.length >= 5}
          className={cn(
            'w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
            photos.length >= 5
              ? 'border-neutral-200 bg-neutral-50 cursor-not-allowed opacity-50'
              : 'border-neutral-300 hover:border-amber-400 hover:bg-amber-50 cursor-pointer',
          )}
          aria-disabled={photos.length >= 5}
        >
          {uploading ? (
            <>
              <Loader2 size={24} className="text-amber-500 animate-spin" aria-hidden="true" />
              <span className="text-sm text-neutral-600">Uploading…</span>
            </>
          ) : (
            <>
              <Upload size={24} className="text-neutral-400" aria-hidden="true" />
              <span className="text-sm font-medium text-neutral-700">
                {photos.length >= 5 ? 'Maximum photos added' : 'Click to upload photos'}
              </span>
              <span className="text-xs text-neutral-400">{photos.length}/5 photos added</span>
            </>
          )}
        </button>

        {uploadError && (
          <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle size={11} aria-hidden="true" /> {uploadError}
          </p>
        )}

        {/* Thumbnails */}
        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
            {photos.map((p) => (
              <div key={p.cloudinaryPublicId} className="relative group aspect-square rounded-xl overflow-hidden bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumbnailUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-neutral-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-fast flex flex-col items-center justify-center gap-1 p-1">
                  {!p.isPrimary && (
                    <button
                      type="button"
                      onClick={() => setPrimary(p.cloudinaryPublicId)}
                      className="text-[10px] font-semibold text-neutral-0 bg-amber-500 rounded px-1.5 py-0.5 leading-tight"
                    >
                      Set primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(p.cloudinaryPublicId)}
                    className="text-neutral-0 hover:text-red-400 transition-colors duration-fast p-0.5 rounded"
                    aria-label="Remove photo"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
                {p.isPrimary && (
                  <div className="absolute top-1 left-1 text-[9px] font-bold text-neutral-0 bg-amber-500 rounded px-1.5 py-0.5 leading-tight">
                    Primary
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-neutral-100" />

      {/* Submitter info */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-neutral-800">About you <span className="text-neutral-400 font-normal text-xs">(optional)</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="submitter-name" optional>Your name</Label>
            <Input
              id="submitter-name"
              value={submitterName}
              onChange={setSubmitterName}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="submitter-email" optional>Your email</Label>
            <Input
              id="submitter-email"
              type="email"
              value={submitterEmail}
              onChange={setSubmitterEmail}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="submitter-note" optional>Anything else we should know?</Label>
          <Textarea
            id="submitter-note"
            value={submitterNote}
            onChange={setSubmitterNote}
            placeholder="e.g. Best Egusi in Abuja — trusted by the whole neighbourhood"
            rows={2}
          />
        </div>
      </div>

      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          {submitError}
        </div>
      )}

      <NavButtons onNext={onSubmit} onBack={onBack} step={3} submitting={submitting} />
    </div>
  )
}

// ─── Nav Buttons ─────────────────────────────────────────────────────────────

function NavButtons({
  onNext, onBack, step, submitting,
}: {
  onNext: () => void
  onBack?: () => void
  step: Step
  submitting?: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between pt-4 gap-3">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 h-11 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700',
            'hover:bg-neutral-100 transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
          )}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Back
        </button>
      ) : (
        <div />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={submitting}
        className={cn(
          'w-full sm:w-auto flex items-center justify-center gap-1.5 px-6 h-11 rounded-xl text-sm font-semibold sm:flex-1',
          'bg-amber-500 text-neutral-0 hover:bg-amber-600',
          'transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
          'disabled:opacity-60 disabled:cursor-not-allowed',
        )}
      >
        {submitting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
        {step === 3 ? (submitting ? 'Submitting…' : 'Submit restaurant') : 'Continue'}
        {step !== 3 && !submitting && <ChevronRight size={16} aria-hidden="true" />}
      </button>
    </div>
  )
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessState({ onSubmitAnother }: { onSubmitAnother: () => void }) {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center text-center py-12 px-4 gap-6">
      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
        <CheckCircle size={32} className="text-amber-500" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-bold text-neutral-900">Restaurant submitted!</h2>
        <p className="text-neutral-600 max-w-sm text-sm leading-relaxed">
          Thanks for helping grow Chow Here in Abuja. Our team will review and verify the listing — usually within 48 hours.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={() => router.push('/')}
          className={cn(
            'w-full sm:flex-1 h-11 rounded-xl bg-amber-500 text-neutral-0 text-sm font-semibold',
            'hover:bg-amber-600 transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
          )}
        >
          Explore Chow Here
        </button>
        <button
          type="button"
          onClick={onSubmitAnother}
          className={cn(
            'w-full sm:flex-1 h-11 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700',
            'hover:bg-neutral-100 transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
          )}
        >
          Submit another
        </button>
      </div>
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

const EMPTY_INFO: RestaurantInfo = {
  name:         '',
  description:  '',
  address:      '',
  area:         '',
  phone:        '',
  email:        '',
  website:      '',
  priceRange:   '',
  cuisineTypes: '',
}

export function SubmitPageClient() {
  const [step, setStep]               = useState<Step>(1)
  const [info, setInfo]               = useState<RestaurantInfo>(EMPTY_INFO)
  const [dishes, setDishes]           = useState<DishEntry[]>([])
  const [photos, setPhotos]           = useState<PhotoEntry[]>([])
  const [submitterName, setSubName]   = useState('')
  const [submitterEmail, setSubEmail] = useState('')
  const [submitterNote, setSubNote]   = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone]               = useState(false)

  function reset() {
    setStep(1); setInfo(EMPTY_INFO); setDishes([]); setPhotos([])
    setSubName(''); setSubEmail(''); setSubNote('')
    setSubmitError(''); setDone(false)
  }

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError('')
    try {
      const cuisineTypesArr = info.cuisineTypes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      await apiPost('/api/v1/intake/restaurants', {
        name:         info.name.trim(),
        description:  info.description.trim() || undefined,
        address:      info.address.trim(),
        city:         'Abuja',
        state:        'Federal Capital Territory',
        area:         info.area.trim() || undefined,
        phone:        info.phone.trim(),
        email:        info.email.trim() || undefined,
        website:      info.website.trim() || undefined,
        priceRange:   info.priceRange as 'BUDGET' | 'MID' | 'UPSCALE',
        cuisineTypes: cuisineTypesArr,
        dishes:       dishes.map(({ dishId, nameAsServed, price, availabilityStatus }) => ({
          dishId,
          nameAsServed:       nameAsServed?.trim() || undefined,
          price:              price ?? undefined,
          availabilityStatus,
        })),
        photos:        photos.map(({ cloudinaryPublicId, isPrimary }) => ({ cloudinaryPublicId, isPrimary })),
        submitterName: submitterName.trim() || undefined,
        submitterEmail: submitterEmail.trim() || undefined,
        submitterNote: submitterNote.trim() || undefined,
      })
      setDone(true)
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <SuccessState onSubmitAnother={reset} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <ProgressBar step={step} />

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-neutral-900 mb-1">
            {step === 1 && 'Restaurant information'}
            {step === 2 && 'Dishes served'}
            {step === 3 && 'Photos & submit'}
          </h1>
          <p className="text-sm text-neutral-500">
            {step === 1 && 'Tell us about the restaurant. All Chow Here listings are for Abuja.'}
            {step === 2 && 'Which dishes does this restaurant serve? Add as many as you know.'}
            {step === 3 && 'Add photos and a note, then submit for review.'}
          </p>
        </div>

        {/* Step panels */}
        <div className="bg-neutral-0 rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-sm">
          {step === 1 && (
            <Step1
              info={info}
              setInfo={setInfo}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step2
              dishes={dishes}
              setDishes={setDishes}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3
              photos={photos}
              setPhotos={setPhotos}
              submitterName={submitterName}
              setSubmitterName={setSubName}
              submitterEmail={submitterEmail}
              setSubmitterEmail={setSubEmail}
              submitterNote={submitterNote}
              setSubmitterNote={setSubNote}
              onBack={() => setStep(2)}
              onSubmit={handleSubmit}
              submitting={submitting}
              submitError={submitError}
            />
          )}
        </div>

        {/* Step counter */}
        <p className="text-center text-xs text-neutral-400 mt-4">
          Step {step} of 3
        </p>
      </div>
    </div>
  )
}
