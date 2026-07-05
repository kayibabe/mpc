import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { encountersApi, type ClinicalNoteCreate } from '../../api/encounters'
import { useAuthStore } from '../../store/auth'
import { ArrowLeft, Stethoscope, ClipboardList } from 'lucide-react'

const TRIAGE_COLOR: Record<string, string> = {
  immediate: 'bg-red-100 text-red-700 border-red-200',
  urgent: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  non_urgent: 'bg-green-100 text-green-700 border-green-200',
}

export default function EncounterDetailPage() {
  const { encounterId } = useParams<{ encounterId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [noteForm, setNoteForm] = useState<ClinicalNoteCreate>({
    subjective: '', objective: '', assessment: '', plan: '',
  })
  const [showNoteForm, setShowNoteForm] = useState(false)

  const { data: encounter, isLoading } = useQuery({
    queryKey: ['encounter', encounterId],
    queryFn: () => encountersApi.get(encounterId!).then((r) => r.data),
    enabled: !!encounterId,
  })

  const closeMutation = useMutation({
    mutationFn: () => encountersApi.update(encounterId!, { status: 'closed' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['encounter', encounterId] }),
  })

  const noteMutation = useMutation({
    mutationFn: (data: ClinicalNoteCreate) => encountersApi.addNote(encounterId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['encounter', encounterId] })
      setNoteForm({ subjective: '', objective: '', assessment: '', plan: '' })
      setShowNoteForm(false)
    },
  })

  if (isLoading) return <div className="py-12 text-center text-gray-400 text-sm">Loading encounter…</div>
  if (!encounter) return <div className="py-12 text-center text-gray-500 text-sm">Encounter not found.</div>

  const isDoctor = user?.role === 'doctor' || user?.role === 'admin'
  const isNurse = user?.role === 'nurse' || user?.role === 'admin'

  return (
    <div>
      <Link to="/opd" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-6">
        <ArrowLeft size={14} /> Back to OPD Queue
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Encounter — {encounter.encounter_type.toUpperCase()}</h1>
          <p className="text-sm text-gray-500">{new Date(encounter.encounter_date).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          {isNurse && !encounter.triage && (
            <button
              onClick={() => navigate(`/opd/${encounterId}/triage`)}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
            >
              <Stethoscope size={14} /> Record Triage
            </button>
          )}
          {encounter.status === 'open' && isDoctor && (
            <button
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm disabled:opacity-50"
            >
              Close Encounter
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd className="font-medium capitalize">{encounter.status}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Complaint</dt><dd className="font-medium max-w-xs text-right">{encounter.chief_complaint ?? '—'}</dd></div>
          </dl>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Triage</h2>
          {encounter.triage ? (
            <div className={`rounded-lg border px-3 py-2 text-sm ${TRIAGE_COLOR[encounter.triage.triage_category] ?? ''}`}>
              <p className="font-semibold capitalize mb-2">{encounter.triage.triage_category.replace('_', ' ')}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {encounter.triage.bp_systolic && <span>BP: {encounter.triage.bp_systolic}/{encounter.triage.bp_diastolic} mmHg</span>}
                {encounter.triage.pulse && <span>Pulse: {encounter.triage.pulse} bpm</span>}
                {encounter.triage.temperature && <span>Temp: {encounter.triage.temperature}°C</span>}
                {encounter.triage.spo2 && <span>SpO₂: {encounter.triage.spo2}%</span>}
                {encounter.triage.weight && <span>Weight: {encounter.triage.weight} kg</span>}
                {encounter.triage.respiratory_rate && <span>RR: {encounter.triage.respiratory_rate}/min</span>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No triage recorded yet.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <ClipboardList size={16} /> Clinical Notes ({encounter.notes.length})
          </h2>
          {isDoctor && encounter.status === 'open' && (
            <button
              onClick={() => setShowNoteForm((v) => !v)}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm"
            >
              + Add Note
            </button>
          )}
        </div>

        {showNoteForm && (
          <div className="mb-4 p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
            {(['subjective', 'objective', 'assessment', 'plan'] as const).map((field) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{field}</label>
                <textarea
                  rows={2}
                  value={noteForm[field] ?? ''}
                  onChange={(e) => setNoteForm({ ...noteForm, [field]: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={() => noteMutation.mutate(noteForm)}
                disabled={noteMutation.isPending}
                className="px-4 py-1.5 bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {noteMutation.isPending ? 'Saving…' : 'Save Note'}
              </button>
              <button onClick={() => setShowNoteForm(false)} className="px-4 py-1.5 text-gray-600 border border-gray-300 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {encounter.notes.length === 0 && !showNoteForm && (
          <p className="text-sm text-gray-400 italic text-center py-6">No clinical notes yet.</p>
        )}

        <div className="space-y-3">
          {encounter.notes.map((note) => (
            <div key={note.id} className="border border-gray-100 rounded-lg p-4 text-sm">
              <p className="text-xs text-gray-400 mb-2">{new Date(note.created_at).toLocaleString()}</p>
              {note.subjective && <p><span className="font-medium text-gray-600">S:</span> {note.subjective}</p>}
              {note.objective && <p><span className="font-medium text-gray-600">O:</span> {note.objective}</p>}
              {note.assessment && <p><span className="font-medium text-gray-600">A:</span> {note.assessment}</p>}
              {note.plan && <p><span className="font-medium text-gray-600">P:</span> {note.plan}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
