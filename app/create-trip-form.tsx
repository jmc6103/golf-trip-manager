'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function CreateTripForm() {
  const router = useRouter()
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [tripName, setTripName] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const slug = slugify(tripName || `${ownerName} golf trip`) || 'new-golf-trip'
    const params = new URLSearchParams({
      ownerName,
      ownerEmail,
      tripName: tripName || 'New Golf Trip',
    })
    router.push(`/t/${slug}/admin?${params.toString()}`)
  }

  return (
    <form onSubmit={submit} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Start a Trip</h2>
      <div className="mt-3 space-y-3">
        <input
          value={ownerName}
          onChange={(event) => setOwnerName(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold"
          placeholder="Your name"
          required
        />
        <input
          value={ownerEmail}
          onChange={(event) => setOwnerEmail(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold"
          placeholder="Admin email for recovery"
          type="email"
          required
        />
        <input
          value={tripName}
          onChange={(event) => setTripName(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold"
          placeholder="Trip name"
          required
        />
        <button className="w-full rounded-2xl bg-slate-950 px-4 py-4 font-black text-white">
          Continue to Setup
        </button>
      </div>
    </form>
  )
}
