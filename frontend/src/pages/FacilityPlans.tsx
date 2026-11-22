import React, { useState, useEffect } from 'react';
import {
  Armchair,
  Home,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Tag
} from 'lucide-react';
import apiClient from '../api/client';

interface FacilityPlanItem {
  id: string;
  service_type_id: string;
  service_type_code?: string;
  name: string;
  code: string;
  billing_frequency: string;
  base_amount: number;
  deposit_amount: number;
  features?: Record<string, any>;
  is_active: boolean;
}

interface ServiceTypeItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export const FacilityPlans: React.FC = () => {
  const [facilityPlans, setFacilityPlans] = useState<FacilityPlanItem[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeItem[]>([]);
  const [facilityFilter, setFacilityFilter] = useState<'ALL' | 'STUDY_ROOM' | 'HOSTEL'>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [showAddPlan, setShowAddPlan] = useState<boolean>(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<FacilityPlanItem | null>(null);

  const initialPlanForm = {
    service_type_id: '',
    name: '',
    code: '',
    billing_frequency: 'MONTHLY',
    base_amount: 1600,
    deposit_amount: 1000,
    features_text: 'Dedicated Desk, 24/7 Power Backup, High-Speed WiFi, Personal Locker'
  };
  const [planForm, setPlanForm] = useState(initialPlanForm);

  const fetchFacilityPlans = async () => {
    try {
      setLoading(true);
      const [typesRes, plansRes] = await Promise.all([
        apiClient.get<ServiceTypeItem[]>('/services/types'),
        apiClient.get<FacilityPlanItem[]>('/services/plans')
      ]);
      setServiceTypes(typesRes.data);
      setFacilityPlans(plansRes.data);
    } catch (err: any) {
      console.error('Failed to load facility plans', err);
      setFeedback({ type: 'error', text: 'Failed to load facility plans & pricing.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacilityPlans();
  }, []);

  const handleOpenCreatePlan = () => {
    setEditingPlanId(null);
    const defaultType = serviceTypes.find((t) => t.code === 'STUDY_ROOM') || serviceTypes[0];
    setPlanForm({
      service_type_id: defaultType ? defaultType.id : '',
      name: '',
      code: '',
      billing_frequency: 'MONTHLY',
      base_amount: 1600,
      deposit_amount: 1000,
      features_text: 'Dedicated Desk, 24/7 Power Backup, High-Speed WiFi, Personal Locker'
    });
    setShowAddPlan(true);
  };

  const handleOpenEditPlan = (plan: FacilityPlanItem) => {
    setEditingPlanId(plan.id);
    let featsText = '';
    if (plan.features?.items && Array.isArray(plan.features.items)) {
      featsText = plan.features.items.join(', ');
    } else if (plan.features && typeof plan.features === 'object') {
      featsText = Object.keys(plan.features).join(', ');
    }
    setPlanForm({
      service_type_id: plan.service_type_id,
      name: plan.name,
      code: plan.code,
      billing_frequency: plan.billing_frequency,
      base_amount: plan.base_amount,
      deposit_amount: plan.deposit_amount,
      features_text: featsText
    });
    setShowAddPlan(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const featureItems = planForm.features_text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        service_type_id: planForm.service_type_id,
        name: planForm.name,
        code: planForm.code,
        billing_frequency: planForm.billing_frequency,
        base_amount: Number(planForm.base_amount),
        deposit_amount: Number(planForm.deposit_amount),
        features: { items: featureItems }
      };

      if (editingPlanId) {
        await apiClient.put(`/services/plans/${editingPlanId}`, payload);
        setFeedback({ type: 'success', text: `Facility plan '${planForm.name}' updated successfully.` });
      } else {
        await apiClient.post('/services/plans', payload);
        setFeedback({ type: 'success', text: `Facility plan '${planForm.name}' created successfully.` });
      }
      setShowAddPlan(false);
      setEditingPlanId(null);
      await fetchFacilityPlans();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to save facility plan' });
    }
  };

  const handleDeletePlan = async () => {
    if (!deletingPlan) return;
    try {
      await apiClient.delete(`/services/plans/${deletingPlan.id}`);
      setFeedback({ type: 'success', text: `Plan '${deletingPlan.name}' deactivated successfully.` });
      setDeletingPlan(null);
      await fetchFacilityPlans();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to deactivate plan' });
    }
  };

  const filteredPlans = facilityPlans.filter((plan) => {
    if (facilityFilter === 'ALL') return true;
    return plan.service_type_code === facilityFilter;
  });

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Facility Plans &amp; Subscription Pricing</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage recurring rental tariffs, refundable security deposits, and amenities for Study Room and Hostel occupancy.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:space-x-3">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setFacilityFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                facilityFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({facilityPlans.length})
            </button>
            <button
              onClick={() => setFacilityFilter('STUDY_ROOM')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                facilityFilter === 'STUDY_ROOM' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Study Room ({facilityPlans.filter((p) => p.service_type_code === 'STUDY_ROOM').length})
            </button>
            <button
              onClick={() => setFacilityFilter('HOSTEL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                facilityFilter === 'HOSTEL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-indigo-700'
              }`}
            >
              Hostel ({facilityPlans.filter((p) => p.service_type_code === 'HOSTEL').length})
            </button>
          </div>

          <button
            onClick={handleOpenCreatePlan}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all whitespace-nowrap cursor-pointer flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4" />
            <span>Create Facility Plan</span>
          </button>
        </div>
      </div>

      {/* Grid of Plans */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500">Loading facility plans...</p>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
          <Tag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">No facility plans found</h4>
          <p className="text-xs text-slate-500 mt-1">Click "Create Facility Plan" above to configure a rental package.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPlans.map((plan) => {
            const isStudy = plan.service_type_code === 'STUDY_ROOM';
            const featuresList: string[] = plan.features?.items && Array.isArray(plan.features.items)
              ? plan.features.items
              : plan.features && typeof plan.features === 'object'
              ? Object.keys(plan.features)
              : [];

            return (
              <div
                key={plan.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-blue-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        isStudy
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {isStudy ? <Armchair className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                      <span>{isStudy ? 'Study Room' : 'Hostel Facility'}</span>
                    </span>

                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
                      {plan.code}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{plan.name}</h4>
                    <span className="text-xs font-medium text-slate-500">
                      Billing Cycle: <strong className="text-slate-700">{plan.billing_frequency.replace('_', ' ')}</strong>
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500 font-medium">Subscription Rent</span>
                      <span className="text-lg font-black text-slate-900">
                        ₹{Number(plan.base_amount).toLocaleString('en-IN')}
                        <span className="text-xs font-normal text-slate-500"> / {plan.billing_frequency.toLowerCase().replace('_', ' ')}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60">
                      <span className="text-slate-500 flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>Security Deposit</span>
                      </span>
                      <span className="font-bold text-blue-700">
                        ₹{Number(plan.deposit_amount).toLocaleString('en-IN')}
                        <span className="font-normal text-slate-400 text-[10px] ml-1">(Refundable)</span>
                      </span>
                    </div>
                  </div>

                  {featuresList.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Included Amenities</p>
                      <div className="flex flex-wrap gap-1.5">
                        {featuresList.map((feat, i) => (
                          <span
                            key={i}
                            className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200"
                          >
                            {feat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenEditPlan(plan)}
                    className="flex items-center space-x-1 text-xs font-semibold px-3 py-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => setDeletingPlan(plan)}
                    className="flex items-center space-x-1 text-xs font-semibold px-3 py-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Deactivate</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Facility Plan Modal */}
      {showAddPlan && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingPlanId ? 'Edit Facility Plan' : 'Create Facility Plan'}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure subscription fee, refundable caution deposit, and billing cadence.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddPlan(false);
                  setEditingPlanId(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Facility Type *</label>
                <select
                  required
                  disabled={!!editingPlanId}
                  value={planForm.service_type_id}
                  onChange={(e) => setPlanForm({ ...planForm, service_type_id: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-75"
                >
                  <option value="">-- Choose Facility --</option>
                  {serviceTypes
                    .filter((t) => ['STUDY_ROOM', 'HOSTEL'].includes(t.code))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standard Study Desk (Monthly)"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PLN-SR-MONTHLY"
                    value={planForm.code}
                    onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Frequency *</label>
                  <select
                    value={planForm.billing_frequency}
                    onChange={(e) => setPlanForm({ ...planForm, billing_frequency: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="HALF_YEARLY">Half Yearly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="ONE_TIME">One Time</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rent / Base Fee (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={planForm.base_amount}
                    onChange={(e) => setPlanForm({ ...planForm, base_amount: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Refundable Deposit (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={planForm.deposit_amount}
                    onChange={(e) => setPlanForm({ ...planForm, deposit_amount: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-blue-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Features &amp; Inclusions (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 24/7 Power Backup, WiFi, Personal Locker, Reading Light"
                  value={planForm.features_text}
                  onChange={(e) => setPlanForm({ ...planForm, features_text: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPlan(false);
                    setEditingPlanId(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  {editingPlanId ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Plan Confirmation Modal */}
      {deletingPlan && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Deactivate Plan</h3>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to deactivate <strong className="text-slate-900">{deletingPlan.name}</strong>? Existing active subscriptions will remain unaffected, but no new seats/beds can be assigned to this plan.
            </p>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setDeletingPlan(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePlan}
                className="px-3.5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm cursor-pointer"
              >
                Deactivate Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default FacilityPlans;
