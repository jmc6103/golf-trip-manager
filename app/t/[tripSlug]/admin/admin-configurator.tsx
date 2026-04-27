'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { saveTripSetup } from '@/app/actions'
import { createCoursesForSetup, createDefaultSetup, formatOptions, tripTemplates } from '@/lib/trip-data'
import type { CourseDraft, PairingMethod, RulesMode, ScoreMax, TeamMethod, TripSetupDraft, TripSummary, TripTemplateId } from '@/lib/types'

type StepId = 'basics' | 'template' | 'formats' | 'rules' | 'courses' | 'review' | 'complete'

const steps: Array<{ id: StepId; label: string }> = [
  { id: 'basics', label: 'Basics' },
  { id: 'template', label: 'Template' },
  { id: 'formats', label: 'Rounds' },
  { id: 'rules', label: 'Rules' },
  { id: 'courses', label: 'Courses' },
  { id: 'review', label: 'Review' },
  { id: 'complete', label: 'Done' },
]

const rulesOptions: Array<[RulesMode, string]> = [
  ['RELAXED', 'Relaxed trip rules'],
  ['USGA', 'Official USGA-style rules'],
]

const scoreMaxOptions: Array<[ScoreMax, string]> = [
  ['TRIPLE_BOGEY', 'Triple bogey max'],
  ['DOUBLE_BOGEY', 'Double bogey max'],
  ['NET_DOUBLE_BOGEY', 'Net double bogey max'],
  ['NONE', 'No max'],
]

const teamMethods: Array<[TeamMethod, string]> = [
  ['BALANCED_AUTO', 'Auto-balance teams'],
  ['CAPTAINS_PICK', 'Captains pick'],
  ['MANUAL', 'Manual teams'],
  ['RANDOM', 'Random teams'],
]

const pairingMethods: Array<[PairingMethod, string]> = [
  ['RULE_BASED', 'Rule-based pairings'],
  ['MANUAL', 'Manual pairings'],
  ['RANDOM', 'Random pairings'],
]

type SetupResult = { adminUrl: string; inviteUrl: string; adminToken: string }

export function AdminConfigurator({ trip, initialSetup, canAdmin }: { trip: TripSummary; initialSetup: TripSetupDraft; canAdmin: boolean }) {
  const storageKey = `trip-setup:${trip.slug}`
  const [setup, setSetup] = useState<TripSetupDraft>(() => normalizeSetup(initialSetup ?? createDefaultSetup(trip.slug, '', trip.name)))
  const [stepIndex, setStepIndex] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null)
  const currentStep = steps[stepIndex]

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const stored = window.localStorage.getItem(storageKey)
    if (stored) {
      setSetup(normalizeSetup(JSON.parse(stored) as TripSetupDraft))
      return
    }

    const next = initialSetup ?? createDefaultSetup(trip.slug, params.get('ownerName') ?? '', params.get('tripName') ?? trip.name)
    next.ownerEmail = params.get('ownerEmail') ?? ''
    setSetup(normalizeSetup(next))
  }, [initialSetup, storageKey, trip.name, trip.slug])

  const selectedFormatNames = useMemo(
    () => setup.formats.map((id) => formatOptions.find((format) => format.id === id)?.name ?? id),
    [setup.formats]
  )

  function update(partial: Partial<TripSetupDraft>) {
    setSetup((current) => normalizeSetup({ ...current, ...partial }))
  }

  function updateCourse(day: number, partial: Partial<CourseDraft>) {
    setSetup((current) => ({
      ...current,
      courses: current.courses.map((course) => (course.day === day ? { ...course, ...partial } : course)),
    }))
  }

  function toggleFormat(id: string) {
    const exists = setup.formats.includes(id)
    if (!exists && setup.formats.length >= setup.roundCount) return
    update({
      formats: exists ? setup.formats.filter((format) => format !== id) : [...setup.formats, id],
    })
  }

  function applyTemplate(id: TripTemplateId) {
    const template = tripTemplates.find((item) => item.id === id)
    if (!template) return
    update({
      templateId: id,
      ...template.setup,
      courses: createCoursesForSetup(template.setup.dayCount, template.setup.roundCount, setup.courses),
    })
  }

  function saveAndReview() {
    window.localStorage.setItem(storageKey, JSON.stringify(setup))
    setStepIndex(steps.findIndex((step) => step.id === 'review'))
  }

  function completeSetup() {
    setError('')
    startTransition(async () => {
      try {
        const result = await saveTripSetup(setup)
        window.localStorage.removeItem(storageKey)
        setSetupResult(result)
        setStepIndex(steps.findIndex((step) => step.id === 'complete'))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save trip setup.')
      }
    })
  }

  function goNext() {
    if (currentStep.id === 'courses') {
      saveAndReview()
      return
    }
    setStepIndex((current) => Math.min(current + 1, steps.length - 1))
  }

  function goBack() {
    setStepIndex((current) => Math.max(current - 1, 0))
  }

  return (
    <>
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Trip Setup</p>
        <h1 className="mt-2 text-3xl font-black">{setup.tripName}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-300">/t/{trip.slug} - owner {setup.ownerName || 'pending'}</p>
      </section>

      {!canAdmin ? (
        <section className="rounded-[24px] bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
          This trip already exists. Use the private admin link to save changes.
        </section>
      ) : null}

      {error ? (
        <section className="rounded-[24px] bg-rose-50 p-4 text-sm font-bold text-rose-800 ring-1 ring-rose-200">
          {error}
        </section>
      ) : null}

      <section className="rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2 overflow-x-auto">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setStepIndex(index)}
              className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-black ${
                index === stepIndex ? 'bg-slate-950 text-white' : index < stepIndex ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {index + 1}. {step.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        {currentStep.id === 'basics' ? <BasicsStep setup={setup} update={update} /> : null}
        {currentStep.id === 'template' ? <TemplateStep setup={setup} applyTemplate={applyTemplate} /> : null}
        {currentStep.id === 'formats' ? <FormatsStep setup={setup} update={update} toggleFormat={toggleFormat} /> : null}
        {currentStep.id === 'rules' ? <RulesStep setup={setup} update={update} /> : null}
        {currentStep.id === 'courses' ? <CoursesStep setup={setup} updateCourse={updateCourse} /> : null}
        {currentStep.id === 'review' ? <ReviewStep trip={trip} setup={setup} selectedFormatNames={selectedFormatNames} onComplete={completeSetup} /> : null}
        {currentStep.id === 'complete' ? <CompleteStep trip={trip} result={setupResult} /> : null}
      </section>

      {currentStep.id !== 'complete' ? (
        <section className="grid grid-cols-2 gap-3">
          <button onClick={goBack} disabled={stepIndex === 0} className="rounded-2xl bg-white px-4 py-4 font-black text-slate-700 ring-1 ring-slate-200 disabled:text-slate-300">
            Back
          </button>
          <button onClick={currentStep.id === 'review' ? completeSetup : goNext} className="rounded-2xl bg-slate-950 px-4 py-4 font-black text-white">
            {isPending ? 'Saving...' : currentStep.id === 'review' ? 'Complete Setup' : currentStep.id === 'courses' ? 'Review Setup' : 'Next'}
          </button>
        </section>
      ) : null}
    </>
  )
}

function BasicsStep({ setup, update }: { setup: TripSetupDraft; update: (partial: Partial<TripSetupDraft>) => void }) {
  return (
    <div>
      <SectionTitle title="Trip Basics" />
      <div className="mt-3 space-y-3">
        <input value={setup.ownerName} onChange={(event) => update({ ownerName: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold" placeholder="Admin name" />
        <input value={setup.ownerEmail} onChange={(event) => update({ ownerEmail: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold" placeholder="Admin email for magic-link recovery" type="email" />
        <input value={setup.tripName} onChange={(event) => update({ tripName: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold" placeholder="Trip name" />
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Players" value={setup.playerCount} onChange={(playerCount) => update({ playerCount })} />
          <NumberField label="Days" value={setup.dayCount} onChange={(dayCount) => update({ dayCount })} />
          <NumberField label="Rounds" value={setup.roundCount} onChange={(roundCount) => update({ roundCount, formats: setup.formats.slice(0, roundCount) })} />
        </div>
      </div>
    </div>
  )
}

function normalizeSetup(next: TripSetupDraft, existingCourses = next.courses): TripSetupDraft {
  return {
    ...next,
    formats: next.formats.slice(0, next.roundCount),
    courses: createCoursesForSetup(next.dayCount, next.roundCount, existingCourses),
  }
}

function TemplateStep({ setup, applyTemplate }: { setup: TripSetupDraft; applyTemplate: (id: TripTemplateId) => void }) {
  return (
    <div>
      <SectionTitle title="Template" />
      <div className="mt-3 space-y-2">
        {tripTemplates.map((template) => (
          <button key={template.id} onClick={() => applyTemplate(template.id)} className={`w-full rounded-2xl p-3 text-left ring-1 ${setup.templateId === template.id ? 'bg-emerald-700 text-white ring-emerald-700' : 'bg-slate-50 text-slate-950 ring-slate-200'}`}>
            <p className="font-black">{template.name}</p>
            <p className={`mt-1 text-sm font-semibold ${setup.templateId === template.id ? 'text-emerald-50' : 'text-slate-500'}`}>{template.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function FormatsStep({ setup, update, toggleFormat }: { setup: TripSetupDraft; update: (partial: Partial<TripSetupDraft>) => void; toggleFormat: (id: string) => void }) {
  return (
    <div>
      <SectionTitle title="Rounds and Formats" />
      <div className="mt-3 max-w-40">
        <NumberField label="Rounds" value={setup.roundCount} onChange={(roundCount) => update({ roundCount, formats: setup.formats.slice(0, roundCount) })} />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">
        Pick up to {setup.roundCount} format{setup.roundCount === 1 ? '' : 's'}. Pick fewer if rounds will repeat a format.
      </p>
      <div className="mt-3 space-y-2">
        {formatOptions.map((format) => {
          const selected = setup.formats.includes(format.id)
          const disabled = !selected && setup.formats.length >= setup.roundCount
          return (
            <button key={format.id} onClick={() => toggleFormat(format.id)} disabled={disabled} className={`w-full rounded-2xl p-3 text-left ring-1 disabled:opacity-40 ${selected ? 'bg-slate-950 text-white ring-slate-950' : 'bg-slate-50 text-slate-950 ring-slate-200'}`}>
              <p className="font-black">{format.name}</p>
              <p className={`mt-1 text-sm font-semibold ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{format.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RulesStep({ setup, update }: { setup: TripSetupDraft; update: (partial: Partial<TripSetupDraft>) => void }) {
  return (
    <div>
      <SectionTitle title="Rules and Scoring" />
      <div className="mt-3 grid grid-cols-1 gap-2">
        <Select value={setup.rulesMode} onChange={(value) => update({ rulesMode: value as RulesMode })} options={rulesOptions} />
        <Select value={setup.scoreMax} onChange={(value) => update({ scoreMax: value as ScoreMax })} options={scoreMaxOptions} />
        <Select value={setup.teamMethod} onChange={(value) => update({ teamMethod: value as TeamMethod })} options={teamMethods} />
        <Select value={setup.pairingMethod} onChange={(value) => update({ pairingMethod: value as PairingMethod })} options={pairingMethods} />
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
        Admin recovery stays lightweight: players need no account, owner gets email magic-link recovery and a private admin link.
      </div>
    </div>
  )
}

function CoursesStep({ setup, updateCourse }: { setup: TripSetupDraft; updateCourse: (day: number, partial: Partial<CourseDraft>) => void }) {
  return (
    <div>
      <SectionTitle title="Courses" />
      <p className="mt-2 text-sm font-semibold text-slate-500">Add courses manually, search GolfCourseAPI, or import tee and scorecard details from BlueGolf.</p>
      <div className="mt-3 space-y-3">
        {setup.courses.map((course) => (
          <div key={course.day} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Day {course.day}</p>
            <div className="mt-2 space-y-2">
              <input value={course.name} onChange={(event) => updateCourse(course.day, { name: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold" placeholder="Course name" />
              <div className="grid grid-cols-3 gap-2">
                <input value={course.teeName} onChange={(event) => updateCourse(course.day, { teeName: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 font-bold" placeholder="Tee" />
                <input value={course.rating} onChange={(event) => updateCourse(course.day, { rating: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 font-bold" placeholder="Rating" />
                <input value={course.slope} onChange={(event) => updateCourse(course.day, { slope: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 font-bold" placeholder="Slope" />
              </div>
              {course.holes?.length === 18 ? (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 ring-1 ring-emerald-100">
                  18-hole scorecard imported - par {course.holes.reduce((sum, hole) => sum + hole.par, 0)}
                  {course.holes.some((hole) => hole.yardage) ? ` - ${course.holes.reduce((sum, hole) => sum + (hole.yardage ?? 0), 0)} yards` : ''}
                </p>
              ) : null}
              <CourseTools course={course} onImport={(partial) => updateCourse(course.day, partial)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReviewStep({ trip, setup, selectedFormatNames, onComplete }: { trip: TripSummary; setup: TripSetupDraft; selectedFormatNames: string[]; onComplete: () => void }) {
  const checks = getSetupChecks(setup)
  const blockers = checks.filter((check) => check.level === 'blocker')
  const warnings = checks.filter((check) => check.level === 'warning')

  return (
    <div>
      <SectionTitle title="Review Setup" />
      <div className="mt-3 space-y-2">
        {blockers.length || warnings.length ? checks.map((check) => (
          <div key={check.message} className={`rounded-2xl p-3 text-sm font-bold ring-1 ${
            check.level === 'blocker'
              ? 'bg-rose-50 text-rose-800 ring-rose-100'
              : 'bg-amber-50 text-amber-800 ring-amber-100'
          }`}>
            {check.message}
          </div>
        )) : (
          <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
            Setup is ready for player invites.
          </div>
        )}
      </div>
      <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
        <ReviewRow label="Trip" value={setup.tripName} />
        <ReviewRow label="Admin" value={`${setup.ownerName || 'Owner pending'} / ${setup.ownerEmail || 'Email pending'}`} />
        <ReviewRow label="Players" value={String(setup.playerCount)} />
        <ReviewRow label="Days / Rounds" value={`${setup.dayCount} days / ${setup.roundCount} rounds`} />
        <ReviewRow label="Formats" value={selectedFormatNames.join(' / ') || 'No formats selected'} />
        <ReviewRow label="Rules" value={`${setup.rulesMode} / ${setup.scoreMax}`} />
        <ReviewRow label="Teams" value={`${setup.teamMethod} / ${setup.pairingMethod}`} />
        <ReviewRow label="Invite Link" value="Generated on completion" />
        <ReviewRow label="Admin Link" value={`/t/${trip.slug}/admin`} />
      </div>
      <button
        onClick={onComplete}
        disabled={Boolean(blockers.length)}
        className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-4 font-black text-white disabled:bg-slate-200 disabled:text-slate-500"
      >
        {blockers.length ? 'Fix Setup First' : 'Looks Good'}
      </button>
    </div>
  )
}

function getSetupChecks(setup: TripSetupDraft) {
  const checks: Array<{ level: 'blocker' | 'warning'; message: string }> = []
  const namedCourses = setup.courses.filter((course) => course.name.trim())

  if (!setup.tripName.trim()) checks.push({ level: 'blocker', message: 'Add a trip name.' })
  if (!setup.ownerName.trim()) checks.push({ level: 'warning', message: 'Add an admin name so players know who is running the trip.' })
  if (setup.playerCount < 2) checks.push({ level: 'blocker', message: 'Set at least 2 players.' })
  if (setup.roundCount < 1) checks.push({ level: 'blocker', message: 'Set at least 1 round.' })
  if (!setup.formats.length) checks.push({ level: 'blocker', message: 'Pick at least one round format.' })
  if (setup.formats.length > setup.roundCount) checks.push({ level: 'blocker', message: 'Format selections cannot exceed the number of rounds.' })
  if (!namedCourses.length) checks.push({ level: 'blocker', message: 'Add at least one course.' })
  if (namedCourses.length < Math.min(setup.dayCount, setup.roundCount)) checks.push({ level: 'warning', message: 'Some rounds will use placeholder course names until you fill them in.' })
  if (setup.playerCount % 2 !== 0 && setup.formats.some((format) => ['FOUR_BALL', 'SINGLES', 'ALT_SHOT'].includes(format))) {
    checks.push({ level: 'warning', message: 'Match play works best with an even player count.' })
  }

  return checks
}

function CompleteStep({ trip, result }: { trip: TripSummary; result: SetupResult | null }) {
  return (
    <div>
      <SectionTitle title="Setup Complete" />
      <div className="mt-3 space-y-3">
        <p className="rounded-2xl bg-emerald-50 p-3 font-black text-emerald-800">Your trip is live. You&apos;re logged in as admin.</p>
        {result ? (
          <>
            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Player Invite Link</p>
              <p className="mt-1 break-all text-sm font-bold text-slate-950">{result.inviteUrl}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">Admin Recovery Link — Save This Now</p>
              <p className="mt-1 break-all text-xs font-mono font-bold text-amber-900">/t/{trip.slug}/admin?adminToken={result.adminToken}</p>
              <p className="mt-2 text-xs font-semibold text-amber-700">If you lose your admin session, use this link to recover access. It will not be shown again.</p>
            </div>
          </>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href={result?.adminUrl ?? `/t/${trip.slug}/admin`} className="rounded-2xl bg-slate-950 px-4 py-4 text-center font-black text-white">Open Admin</Link>
        <Link href={`/t/${trip.slug}/team`} className="rounded-2xl bg-white px-4 py-4 text-center font-black text-slate-950 ring-1 ring-slate-200">Team Board</Link>
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words font-black text-slate-950">{value}</p>
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="px-1 text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        min={1}
        max={72}
        inputMode="numeric"
        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold"
      />
    </label>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold">
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  )
}

function CourseTools({ course, onImport }: { course: CourseDraft; onImport: (partial: Partial<CourseDraft>) => void }) {
  const [query, setQuery] = useState(course.name)
  const [blueGolfUrl, setBlueGolfUrl] = useState(course.blueGolfUrl ?? '')
  const [results, setResults] = useState<Array<{ id: string; name: string; city?: string; state?: string; country?: string }>>([])
  const [teeOptions, setTeeOptions] = useState<Array<{ id: string; name: string; gender: string; rating: string; slope: string; yardage: number; holes: CourseDraft['holes']; course: Partial<CourseDraft> }>>([])
  const [message, setMessage] = useState('')

  async function search() {
    setMessage('Searching...')
    const res = await fetch(`/api/courses/search?q=${encodeURIComponent(query)}`)
    const json = await res.json()
    setResults(json.courses ?? [])
    setMessage(json.error ?? (json.fallback ? 'Showing a manual course entry result.' : ''))
  }

  async function importBlueGolf() {
    setMessage('Importing BlueGolf page...')
    const res = await fetch('/api/courses/bluegolf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: blueGolfUrl }),
    })
    const json = await res.json()
    if (!res.ok) {
      setMessage(json.error ?? 'BlueGolf import failed.')
      return
    }

    setTeeOptions(json.teeOptions ?? [])
    onImport(json.course)
    setMessage([json.note, ...(json.warnings ?? [])].filter(Boolean).join(' '))
  }

  return (
    <div className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Find a Course</p>
      <div className="flex gap-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Search courses" />
        <button onClick={search} className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-black text-white">Search</button>
      </div>
      {results.length ? (
        <div className="space-y-2">
          {results.map((result) => (
            <button key={result.id} onClick={() => onImport({ name: result.name, holes: undefined, source: 'golfcourseapi', sourceId: result.id })} className="w-full rounded-xl bg-slate-50 p-2 text-left text-sm ring-1 ring-slate-200">
              <p className="font-black">{result.name}</p>
              <p className="font-semibold text-slate-500">{[result.city, result.state, result.country].filter(Boolean).join(', ') || 'Location unavailable'}</p>
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <input value={blueGolfUrl} onChange={(event) => setBlueGolfUrl(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="BlueGolf course URL" />
        <button onClick={importBlueGolf} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-black text-white">Import</button>
      </div>
      {teeOptions.length ? (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Imported Tees</p>
          <div className="grid grid-cols-1 gap-2">
            {teeOptions.map((tee) => (
              <button key={tee.id} onClick={() => onImport(tee.course)} className="rounded-xl bg-slate-50 p-2 text-left text-xs font-bold ring-1 ring-slate-200">
                <span className="font-black">{tee.name}{tee.gender ? ` (${tee.gender})` : ''}</span>
                <span className="text-slate-500"> - {tee.rating || 'NR'}/{tee.slope || 'NS'} - {tee.yardage} yards</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {message ? <p className="text-xs font-bold text-slate-500">{message}</p> : null}
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h2>
}
