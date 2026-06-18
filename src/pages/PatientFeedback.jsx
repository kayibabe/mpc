import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MessageSquare, Star, Send, Loader2, BarChart2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import PageHeader from "@/components/ui/PageHeader";

export default function PatientFeedback() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    visit_id: "",
    patient_id: "",
    satisfaction_rating: 5,
    cleanliness_rating: 5,
    staff_rating: 5,
    facilities_rating: 5,
    feedback_text: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Create feedback entity data if not exists
      const feedbackData = await base44.entities.list?.("Feedback") || [];
      const patientData = await base44.entities.Patient.list("-created_date", 200);
      const visitData = await base44.entities.Visit.list("-created_date", 200);
      
      setFeedbacks(feedbackData);
      setPatients(patientData);
      setVisits(visitData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (e) => {
    e.preventDefault();
    if (!form.visit_id || !form.patient_id) {
      alert("Please select visit and patient");
      return;
    }

    setSubmitting(true);
    try {
      // Store as Notification for now (no Feedback entity yet)
      await base44.entities.Notification.create({
        title: "Patient Feedback Received",
        message: form.feedback_text,
        target_role: "admin",
        is_read: false,
        metadata: JSON.stringify({
          visit_id: form.visit_id,
          patient_id: form.patient_id,
          satisfaction: form.satisfaction_rating,
          cleanliness: form.cleanliness_rating,
          staff: form.staff_rating,
          facilities: form.facilities_rating,
        }),
      });

      alert("Thank you for your feedback!");
      setShowForm(false);
      setForm({
        visit_id: "",
        patient_id: "",
        satisfaction_rating: 5,
        cleanliness_rating: 5,
        staff_rating: 5,
        facilities_rating: 5,
        feedback_text: "",
      });
      loadData();
    } catch (e) {
      alert("Submission failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getPatientName = (id) => {
    const p = patients.find(pt => pt.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const avgRating = feedbacks.length > 0
    ? (feedbacks.reduce((sum, f) => sum + (f.satisfaction_rating || 0), 0) / feedbacks.length).toFixed(1)
    : 0;

  const ratingDistribution = [
    { rating: "1 Star", count: feedbacks.filter(f => f.satisfaction_rating === 1).length },
    { rating: "2 Stars", count: feedbacks.filter(f => f.satisfaction_rating === 2).length },
    { rating: "3 Stars", count: feedbacks.filter(f => f.satisfaction_rating === 3).length },
    { rating: "4 Stars", count: feedbacks.filter(f => f.satisfaction_rating === 4).length },
    { rating: "5 Stars", count: feedbacks.filter(f => f.satisfaction_rating === 5).length },
  ];

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Patient Feedback" subtitle="Patient satisfaction surveys and feedback management" icon={MessageSquare} className="mb-6">
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Send className="w-4 h-4" /> Submit Feedback
        </button>
      </PageHeader>

      {/* Ratings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Avg Satisfaction", value: avgRating, icon: Star },
          { label: "Total Responses", value: feedbacks.length, icon: MessageSquare },
          { label: "This Month", value: feedbacks.filter(f => {
            const d = new Date(f.created_date);
            return d.getMonth() === new Date().getMonth();
          }).length, icon: BarChart2 },
          { label: "Response Rate", value: feedbacks.length > 0 ? "High" : "Low" },
        ].map((stat, i) => (
          <div key={i} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Rating Distribution */}
      {ratingDistribution.some(r => r.count > 0) && (
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm mb-6">
          <h4 className="font-heading font-semibold text-sm mb-4">Rating Distribution</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ratingDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Feedback List */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm">
        {feedbacks.length === 0 ? (
          <div className="py-12 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No feedback yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {feedbacks.map(f => (
              <div key={f.id} className="p-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{getPatientName(f.patient_id)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(f.created_date).toLocaleDateString("en-GB")}</p>
                  </div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < (f.satisfaction_rating || 0) ? "fill-chart-2 text-chart-2" : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 text-xs">
                  {[
                    { label: "Cleanliness", value: f.cleanliness_rating },
                    { label: "Staff", value: f.staff_rating },
                    { label: "Facilities", value: f.facilities_rating },
                  ].map(r => (
                    <div key={r.label} className="text-muted-foreground">
                      <p className="font-medium">{r.label}</p>
                      <p className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < (r.value || 0) ? "text-primary" : "text-muted-foreground/20"}>★</span>
                        ))}
                      </p>
                    </div>
                  ))}
                </div>

                {f.feedback_text && (
                  <p className="text-sm text-foreground italic bg-muted/20 p-2 rounded">{f.feedback_text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-xl border border-border shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-heading text-lg font-semibold mb-4">Submit Feedback</h3>

            <form onSubmit={submitFeedback} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Patient *</label>
                  <select
                    required
                    value={form.patient_id}
                    onChange={e => setForm({ ...form, patient_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Visit *</label>
                  <select
                    required
                    value={form.visit_id}
                    onChange={e => setForm({ ...form, visit_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select visit</option>
                    {visits.map(v => (
                      <option key={v.id} value={v.id}>{new Date(v.created_date).toLocaleDateString("en-GB")}</option>
                    ))}
                  </select>
                </div>
              </div>

              {[
                { key: "satisfaction_rating", label: "Overall Satisfaction" },
                { key: "cleanliness_rating", label: "Cleanliness" },
                { key: "staff_rating", label: "Staff Courtesy" },
                { key: "facilities_rating", label: "Facilities" },
              ].map(rating => (
                <div key={rating.key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    {rating.label} ({form[rating.key]}/5)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={form[rating.key]}
                    onChange={e => setForm({ ...form, [rating.key]: Number(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex gap-0.5 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 cursor-pointer ${
                          i < form[rating.key] ? "fill-chart-2 text-chart-2" : "text-muted-foreground/30"
                        }`}
                        onClick={() => setForm({ ...form, [rating.key]: i + 1 })}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Additional Comments</label>
                <textarea
                  value={form.feedback_text}
                  onChange={e => setForm({ ...form, feedback_text: e.target.value })}
                  placeholder="Share your feedback..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {submitting ? "Submitting..." : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}