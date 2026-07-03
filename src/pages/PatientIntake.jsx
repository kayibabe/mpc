import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Save, Loader2, X, Plus, AlertCircle } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const INTAKE_SECTIONS = ["demographics", "medical_history", "allergies", "medications", "review"];

export default function PatientIntake() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "male",
    contact_number: "",
    email: "",
    address: "",
    marital_status: "single",
    occupation: "",
    emergency_contact_name: "",
    emergency_contact_number: "",
    blood_group: "",
    height: "",
    weight: "",
    chronic_conditions: "",
    past_surgeries: "",
    family_history: "",
    allergies_list: "",
    allergy_severity: "moderate",
    current_medications: "",
    medication_compliance: "good",
    insurance_scheme: "",
    insurance_number: "",
  });

  const [allergies, setAllergies] = useState([]);
  const [medications, setMedications] = useState([]);
  const [newAllergy, setNewAllergy] = useState({ drug: "", reaction: "", severity: "moderate" });
  const [newMed, setNewMed] = useState({ name: "", dose: "", frequency: "" });

  const handleAddAllergy = () => {
    if (newAllergy.drug && newAllergy.reaction) {
      setAllergies([...allergies, newAllergy]);
      setNewAllergy({ drug: "", reaction: "", severity: "moderate" });
    }
  };

  const handleAddMedication = () => {
    if (newMed.name && newMed.dose) {
      setMedications([...medications, newMed]);
      setNewMed({ name: "", dose: "", frequency: "" });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.date_of_birth) {
      alert("Fill required fields");
      return;
    }

    setLoading(true);
    try {
      // Create patient
      const patientData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        contact_number: formData.contact_number,
        email: formData.email,
        address: formData.address,
        blood_group: formData.blood_group,
        height: Number(formData.height) || null,
        weight: Number(formData.weight) || null,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_number: formData.emergency_contact_number,
        status: "active",
      };

      const patient = await base44.entities.Patient.create(patientData);

      // Create allergies
      for (const allergy of allergies) {
        await base44.entities.PatientAllergy.create({
          patient_id: patient.id,
          drug_name: allergy.drug,
          reaction_type: allergy.reaction,
          severity: allergy.severity,
          is_active: true,
        });
      }

      // Create initial appointment/visit record
      await base44.entities.Visit.create({
        patient_id: patient.id,
        visit_type: "initial_intake",
        priority: "routine",
        queue_status: "waiting",
        payment_type: formData.insurance_scheme || "self_pay",
        notes: `Intake: ${formData.chronic_conditions ? "Chronic conditions: " + formData.chronic_conditions : ""} ${formData.past_surgeries ? "Past surgeries: " + formData.past_surgeries : ""}`,
      });

      alert(`Patient ${formData.first_name} ${formData.last_name} registered successfully`);
      resetForm();
      setStep(0);
    } catch (e) {
      alert("Registration failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: "male",
      contact_number: "",
      email: "",
      address: "",
      marital_status: "single",
      occupation: "",
      emergency_contact_name: "",
      emergency_contact_number: "",
      blood_group: "",
      height: "",
      weight: "",
      chronic_conditions: "",
      past_surgeries: "",
      family_history: "",
      allergies_list: "",
      allergy_severity: "moderate",
      current_medications: "",
      medication_compliance: "good",
      insurance_scheme: "",
      insurance_number: "",
    });
    setAllergies([]);
    setMedications([]);
  };

  return (
    <div className="page-container">
      <PageHeader title="Patient Intake Form" subtitle="Complete registration and health history" icon={Users} className="mb-6" />

      {/* Progress Bar */}
      <div className="mb-6 flex gap-2">
        {INTAKE_SECTIONS.map((section, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`flex-1 h-2 rounded-full transition-colors ${
              i <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Form */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Demographics */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="font-heading font-semibold text-lg mb-4">Demographics</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">First Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Last Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Date of Birth *</label>
                  <input
                    required
                    type="date"
                    value={formData.date_of_birth}
                    onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Contact Number</label>
                  <input
                    type="tel"
                    value={formData.contact_number}
                    onChange={e => setFormData({ ...formData, contact_number: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Emergency Contact</label>
                  <input
                    type="text"
                    value={formData.emergency_contact_name}
                    onChange={e => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Emergency Number</label>
                  <input
                    type="tel"
                    value={formData.emergency_contact_number}
                    onChange={e => setFormData({ ...formData, emergency_contact_number: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Medical History */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-heading font-semibold text-lg mb-4">Medical History</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Blood Group</label>
                  <select
                    value={formData.blood_group}
                    onChange={e => setFormData({ ...formData, blood_group: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
                <div></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={e => setFormData({ ...formData, height: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={e => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Chronic Conditions</label>
                <textarea
                  value={formData.chronic_conditions}
                  onChange={e => setFormData({ ...formData, chronic_conditions: e.target.value })}
                  placeholder="e.g. Hypertension, Diabetes, Asthma"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Past Surgeries</label>
                <textarea
                  value={formData.past_surgeries}
                  onChange={e => setFormData({ ...formData, past_surgeries: e.target.value })}
                  placeholder="List previous surgical procedures"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Family History</label>
                <textarea
                  value={formData.family_history}
                  onChange={e => setFormData({ ...formData, family_history: e.target.value })}
                  placeholder="Relevant family medical history"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {/* Allergies */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-heading font-semibold text-lg mb-4">Allergies</h3>

              <div className="space-y-2">
                {allergies.map((allergy, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-border/40 bg-muted/20">
                    <div className="text-sm">
                      <p className="font-medium">{allergy.drug}</p>
                      <p className="text-xs text-muted-foreground">{allergy.reaction}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAllergies(allergies.filter((_, idx) => idx !== i))}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Drug/Substance</label>
                    <input
                      type="text"
                      value={newAllergy.drug}
                      onChange={e => setNewAllergy({ ...newAllergy, drug: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Reaction Type</label>
                    <input
                      type="text"
                      value={newAllergy.reaction}
                      onChange={e => setNewAllergy({ ...newAllergy, reaction: e.target.value })}
                      placeholder="e.g. Rash, Anaphylaxis"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="mt-2 flex gap-2">
                  <select
                    value={newAllergy.severity}
                    onChange={e => setNewAllergy({ ...newAllergy, severity: e.target.value })}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleAddAllergy}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Medications */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-heading font-semibold text-lg mb-4">Current Medications</h3>

              <div className="space-y-2">
                {medications.map((med, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-border/40 bg-muted/20">
                    <div className="text-sm">
                      <p className="font-medium">{med.name}</p>
                      <p className="text-xs text-muted-foreground">{med.dose} {med.frequency && `• ${med.frequency}`}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMedications(medications.filter((_, idx) => idx !== i))}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Medication name"
                    value={newMed.name}
                    onChange={e => setNewMed({ ...newMed, name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="text"
                    placeholder="Dose (e.g. 500mg)"
                    value={newMed.dose}
                    onChange={e => setNewMed({ ...newMed, dose: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Frequency (e.g. Twice daily)"
                      value={newMed.frequency}
                      onChange={e => setNewMed({ ...newMed, frequency: e.target.value })}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={handleAddMedication}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Medication Compliance</label>
                <select
                  value={formData.medication_compliance}
                  onChange={e => setFormData({ ...formData, medication_compliance: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
            </div>
          )}

          {/* Review */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-heading font-semibold text-lg mb-4">Review & Confirm</h3>

              <div className="bg-muted/30 rounded-lg p-4 space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{formData.first_name} {formData.last_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">{formData.date_of_birth}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Allergies</p>
                  <p className="font-medium">{allergies.length > 0 ? allergies.map(a => a.drug).join(", ") : "None"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Medications</p>
                  <p className="font-medium">{medications.length > 0 ? medications.map(m => m.name).join(", ") : "None"}</p>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-primary">Review all information before submitting. You can edit sections using the progress bar.</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-4 border-t border-border">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Back
              </button>
            )}
            {step < INTAKE_SECTIONS.length - 1 && (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="ml-auto px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                Next
              </button>
            )}
            {step === INTAKE_SECTIONS.length - 1 && (
              <button
                type="submit"
                disabled={loading}
                className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {loading ? "Registering..." : "Complete Registration"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}