import { useState } from 'react'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { IconButton } from './components/ui/IconButton'
import { InputField } from './components/ui/InputField'

type Screen = 'login' | 'venue' | 'menu' | 'closing' | 'confirmation'
type WasteAmount = 'None' | 'A few' | 'About half' | 'Most'
type SubmissionStatus = 'success' | 'error'
type ApiWasteEntry = {
  item_name: string
  waste_level: WasteAmount
  unit_cost: number
}

const prepItems = [
  { name: 'Croissants', detail: 'Fresh pastry' },
  { name: 'Sourdough loaves', detail: 'Bakery' },
  { name: 'Chicken sandwiches', detail: 'Cabinet food' },
  { name: 'Granola pots', detail: 'Breakfast' },
  { name: 'Caesar salads', detail: 'Cabinet food' },
  { name: 'Chocolate brownies', detail: 'Sweet treats' },
]

const wasteOptions: WasteAmount[] = ['None', 'A few', 'About half', 'Most']
const wasteValue: Record<WasteAmount, number> = {
  None: 0,
  'A few': 3.5,
  'About half': 8,
  Most: 14,
}

function App() {
  // UI state lives here; venue and completed closing logs are persisted through /api.
  const [screen, setScreen] = useState<Screen>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [venueName, setVenueName] = useState('')
  const [suburb, setSuburb] = useState('')
  const [seats, setSeats] = useState('')
  const [venueId, setVenueId] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<string[]>(['Croissants', 'Chicken sandwiches', 'Granola pots'])
  const [wasteLog, setWasteLog] = useState<Record<string, WasteAmount | undefined>>({})
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>('success')
  const [timeTaken, setTimeTaken] = useState('')
  const [estimatedValue, setEstimatedValue] = useState(0)
  const [closingStartedAt, setClosingStartedAt] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('No waste amounts were selected.')
  const [errorDetail, setErrorDetail] = useState('Choose an amount for at least one prep item, then submit your log again.')
  const [retryScreen, setRetryScreen] = useState<Screen>('closing')

  const selectedPrepItems = prepItems.filter((item) => selectedItems.includes(item.name))
  const stepNumber: Record<Exclude<Screen, 'login'>, number> = {
    venue: 1,
    menu: 2,
    closing: 3,
    confirmation: 4,
  }

  const toggleMenuItem = (itemName: string) => {
    setSelectedItems((current) =>
      current.includes(itemName) ? current.filter((item) => item !== itemName) : [...current, itemName],
    )
  }

  const recordWaste = (itemName: string, amount: WasteAmount) => {
    setWasteLog((current) => ({ ...current, [itemName]: amount }))
  }

  const showError = (message: string, detail: string, returnTo: Screen) => {
    setSubmissionStatus('error')
    setTimeTaken('0 sec')
    setEstimatedValue(0)
    setErrorMessage(message)
    setErrorDetail(detail)
    setRetryScreen(returnTo)
    setScreen('confirmation')
  }

  const saveVenue = async () => {
    const seatCount = Number(seats)

    if (!venueName.trim() || !suburb.trim() || !Number.isInteger(seatCount) || seatCount < 1) {
      showError('Your venue needs a little more', 'Enter your café name, suburb, and a whole number of seats before continuing.', 'venue')
      return
    }

    try {
      const response = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: venueName.trim(), suburb: suburb.trim(), seats: seatCount }),
      })
      const data = (await response.json()) as { id?: string; error?: string }

      if (!response.ok || !data.id) {
        throw new Error(data.error || 'Trim could not save your venue.')
      }

      setVenueId(data.id)
      setScreen('menu')
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Please check your connection and try again.'
      showError('Your venue could not be saved', detail, 'venue')
    }
  }

  const openClosingLog = () => {
    setClosingStartedAt(Date.now())
    setScreen('closing')
  }

  const submitClosingLog = async () => {
    const loggedAmounts = selectedPrepItems.map((item) => wasteLog[item.name]).filter(Boolean) as WasteAmount[]

    if (loggedAmounts.length === 0) {
      showError('Your log needs a little more', 'Choose an amount for at least one prep item, then submit your log again.', 'closing')
      return
    }

    if (!venueId) {
      showError('Your log could not be saved', 'Your venue is missing. Return to Venue Setup and save it before logging waste.', 'venue')
      return
    }

    const entries: ApiWasteEntry[] = selectedPrepItems.flatMap((item) => {
      const wasteLevel = wasteLog[item.name]
      return wasteLevel ? [{ item_name: item.name, waste_level: wasteLevel, unit_cost: wasteValue[wasteLevel] }] : []
    })
    const calculatedValue = entries.reduce((total, entry) => total + entry.unit_cost, 0)
    const durationSeconds = Math.max(1, Math.round((Date.now() - (closingStartedAt ?? Date.now())) / 1000))

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: venueId,
          duration_seconds: durationSeconds,
          estimated_value: calculatedValue,
          status: 'completed',
          entries,
        }),
      })
      const data = (await response.json()) as { id?: string; error?: string }

      if (!response.ok || !data.id) {
        throw new Error(data.error || 'Trim could not save your closing log.')
      }

      setSubmissionStatus('success')
      setTimeTaken(`${durationSeconds} sec`)
      setEstimatedValue(calculatedValue)
      setScreen('confirmation')
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Please check your connection and try again.'
      showError('Your log could not be saved', detail, 'closing')
    }
  }

  const tryAgain = () => {
    setScreen(retryScreen)
  }

  const startNewLog = () => {
    setWasteLog({})
    setClosingStartedAt(Date.now())
    setScreen('closing')
  }

  const renderStepIndicator = () => {
    if (screen === 'login') return null
    const currentStep = stepNumber[screen]

    return (
      <div className="mb-7 flex items-center justify-between" aria-label={`Step ${currentStep} of 4`}>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Step {currentStep} of 4</span>
        <div className="flex gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4].map((step) => (
            <span key={step} className={`h-1.5 w-7 rounded-full ${step <= currentStep ? 'bg-sage' : 'bg-line'}`} />
          ))}
        </div>
      </div>
    )
  }

  const renderScreen = () => {
    switch (screen) {
      case 'login':
        return (
          <Card title="Welcome back">
            <p className="-mt-3 mb-7 text-sm leading-6 text-muted">Sign in to make tomorrow’s prep a little smarter.</p>
            <div className="space-y-5">
              <InputField label="Email" placeholder="you@yourcafe.com.au" value={email} onChange={setEmail} type="email" />
              <InputField label="Password" placeholder="Your password" value={password} onChange={setPassword} type="password" />
              <Button label="Sign in" onClick={() => setScreen('venue')} variant="primary" />
            </div>
          </Card>
        )

      case 'venue':
        return (
          <Card title="Tell us about your café">
            <p className="-mt-3 mb-7 text-sm leading-6 text-muted">A few details help make your prep suggestions feel local.</p>
            <div className="space-y-5">
              <InputField label="Venue name" placeholder="e.g. Sunday Café" value={venueName} onChange={setVenueName} type="text" />
              <InputField label="Suburb" placeholder="e.g. Fitzroy" value={suburb} onChange={setSuburb} type="text" />
              <InputField label="Number of seats" placeholder="e.g. 42" value={seats} onChange={setSeats} type="number" />
              <IconButton label="Continue" onClick={() => void saveVenue()} />
            </div>
          </Card>
        )

      case 'menu':
        return (
          <Card title="What do you prep each day?">
            <p className="-mt-3 mb-6 text-sm leading-6 text-muted">Choose the items you want Trim to track at close.</p>
            <div className="space-y-2">
              {prepItems.map((item) => {
                const isSelected = selectedItems.includes(item.name)
                return (
                  <label
                    key={item.name}
                    className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${isSelected ? 'border-sage bg-sage/5' : 'border-line bg-surface hover:border-muted'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleMenuItem(item.name)}
                      className="h-5 w-5 accent-sage"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{item.name}</span>
                      <span className="block pt-0.5 text-xs text-muted">{item.detail}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="mt-6">
              <IconButton label="Save menu" onClick={openClosingLog} />
            </div>
          </Card>
        )

      case 'closing':
        return (
          <Card title="What was left today?">
            <p className="-mt-3 mb-6 text-sm leading-6 text-muted">Tap one answer per item. This should take less than 20 seconds.</p>
            {selectedPrepItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-cream px-5 py-6 text-center text-sm text-muted">
                No prep items selected. Go back to Menu Setup to add some.
              </div>
            ) : (
              <div className="space-y-5">
                {selectedPrepItems.map((item) => (
                  <div key={item.name} className="border-b border-line pb-5 last:border-0 last:pb-0">
                    <p className="mb-3 text-sm font-semibold text-ink">{item.name}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {wasteOptions.map((amount) => {
                        const isActive = wasteLog[item.name] === amount
                        return (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => recordWaste(item.name, amount)}
                            className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-sage/30 ${isActive ? 'border-sage bg-sage text-surface' : 'border-line bg-surface text-ink hover:border-muted'}`}
                          >
                            {amount}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-7">
              <Button label="Finish today’s log" onClick={() => void submitClosingLog()} variant="primary" />
            </div>
          </Card>
        )

      case 'confirmation': {
        const isSuccess = submissionStatus === 'success'
        return (
          <Card title={isSuccess ? 'Logged for tomorrow' : 'Your log needs a little more'}>
            <div className={`rounded-2xl border p-5 ${isSuccess ? 'border-sage/25 bg-sage/10' : 'border-clay/25 bg-clay/10'}`}>
              <p className={`text-sm font-bold ${isSuccess ? 'text-sage' : 'text-clay'}`}>{isSuccess ? 'Nice work — Trim has your update.' : errorMessage}</p>
              <p className="mt-2 text-sm leading-6 text-ink/75">
                {isSuccess
                  ? `You finished in ${timeTaken}. Tomorrow’s prep list will account for today’s leftovers.`
                  : errorDetail}
              </p>
            </div>

            {isSuccess ? (
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-cream p-4">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-muted">Time taken</span>
                  <span className="mt-1 block font-display text-2xl text-ink">{timeTaken}</span>
                </div>
                <div className="rounded-2xl bg-cream p-4">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-muted">Est. saved</span>
                  <span className="mt-1 block font-display text-2xl text-ink">${estimatedValue.toFixed(0)}</span>
                </div>
              </div>
            ) : null}

            <div className="mt-7 space-y-3">
              {isSuccess ? <Button label="Start another log" onClick={startNewLog} variant="primary" /> : null}
              <Button label={isSuccess ? 'Back to closing log' : 'Try again'} onClick={tryAgain} variant="secondary" />
            </div>
          </Card>
        )
      }
    }
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-10 flex items-center justify-between">
          <span className="font-display text-3xl font-bold tracking-tight text-ink">trim</span>
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted">Daily waste, made useful</span>
        </header>
        {renderStepIndicator()}
        {renderScreen()}
        <p className="mt-7 text-center text-xs text-muted">Built for independent Australian cafés.</p>
      </div>
    </main>
  )
}

export default App