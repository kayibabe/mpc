import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { encountersApi, type TriageCreate, type TriageCategory } from '../../api/encounters'

export default function TriagePage() {
  const { encounterId } = useParams<{ encounterId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<TriageCreate>({
    triage_category: 'non_urgent',
    bp_systolic: undefined,
    bp_diastolic: undefined,
    pulse: undefined,
    temperature: undefined,
    spo2: undefined,
    weight: undefined,
    height: undefined,
    respiratory_rate: undefined,
    pain_score: undefined,
    notes: '',
  })

  const mutation = useMutation({
    mutationFn: (data: TriageCreate) => encountersApi.upsertTriage(encounterId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['encounter', encounterId] })
      navigate(`/opd/${encounterId}`)
    },
  })

  const num = (key: keyof TriageCreate, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value === '' ? undefined : Number(e.target.value)
    setForm({ ...form, [key]: v })
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Record Triage</h1>
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }}
        className="space-y-4"
      >
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Triage Category *</label>
            <select
              required
              value={form.triage_category}
              onChange={(e) => setForm({ ...form, triage_category: e.target.value as TriageCategory })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="immediate">Immediate (Red)</option>
              <option value="urgent">Urgent (Yellow)</option>
              <option value="non_urgent">Non-Urgent (Green)</option>
            </select>
          </div>

          <h3 className="text-sm font-semibold text-gray-600 border-t pt-3">Vital Signs</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'BP Systolic (mmHg)', key: 'bp_systolic' as const },
              { label: 'BP Diastolic (mmHg)', key: 'bp_diastolic' as const },
              { label: 'Pulse (bpm)', key: 'pulse' as const },
              { label: 'SpO₂ (%)', key: 'spo2' as const },
              { label: 'Temperature (°C)', key: 'temperature' as const, step: '0.1' },
              { label: 'Resp. Rate (/min)', key: 'respiratory_rate' as const },
              { label: 'Weight (kg)', key: 'weight' as const, step: '0.1' },
              { label: 'Height (cm)', key: 'height' as const, step: '0.1' },
              { label: 'Pain Score (0–10)', key: 'pain_score' as const },
            ].map(({ label, key, step }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type="number"
                  step={step ?? '1'}
                  min={0}
                  value={form[key] ?? ''}
                  onChange={(e) => num(key, e)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="text-red-600 text-sm">Failed to save triage. Please try again.</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Save Triage'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/opd/${encounterId}`)}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
