import React, { useState, useEffect } from 'react';
import {
  Armchair,
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  Lock,
  ArrowRightLeft,
  LogOut,
  LogIn,
  UserCheck,
  RefreshCw,
  X,
  Sparkles,
  ShieldCheck,
  DollarSign,
  Calendar,
  Check,
  Mail,
  Bell
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StudyRoomPhysicalFloorMap } from '../components/StudyRoomPhysicalFloorMap';

interface StudySeat {
  id: string;
  study_room_id: string;
  seat_number: string;
  row_identifier: string;
  column_identifier: number;
  gender_allowed: string;
  has_power_outlet: boolean;
  has_locker: boolean;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
  occupant_name?: string | null;
  occupant_code?: string | null;
  allocation_id?: string | null;
  allocation_start_date?: string | null;
  allocation_end_date?: string | null;
  plan_name?: string | null;
  billing_frequency?: string | null;
  unit_price?: number | null;
  deposit_amount?: number | null;
}

interface FacilityPlan {
  id: string;
  service_type_id: string;
  name: string;
  code: string;
  billing_frequency: string;
  base_amount: number;
  deposit_amount: number;
  features?: Record<string, any>;
  is_active: boolean;
}

interface StudentOption {
  id: string;
  student_code?: string;
  prn?: string;
  first_name: string;
  last_name: string;
  gender: string;
}

export const StudyRoomVisualizer: React.FC = () => {
  const { hasRole } = useAuth();
  const canCustomPrice = hasRole(['SUPER_ADMIN', 'ADMIN']);

  const [seats, setSeats] = useState<StudySeat[]>([]);
  const [plans, setPlans] = useState<FacilityPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSeat, setSelectedSeat] = useState<StudySeat | null>(null);
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'BOYS' | 'GIRLS'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Allocation Modal State
  const [showAllocateModal, setShowAllocateModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [isCustomPricing, setIsCustomPricing] = useState<boolean>(false);
  const [customRentAmount, setCustomRentAmount] = useState<number>(1600);
  const [customDepositAmount, setCustomDepositAmount] = useState<number>(1000);
  const [collectPaymentNow, setCollectPaymentNow] = useState<boolean>(true);
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [monthlyCharge, setMonthlyCharge] = useState<number>(1600);
  const [allocationStartDate, setAllocationStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [allocationEndDate, setAllocationEndDate] = useState<string>('2027-04-30');
  const [transferTargetSeatId, setTransferTargetSeatId] = useState<string>('');

  const computeEndDate = (startDateStr: string, months: number): string => {
    const d = new Date(startDateStr);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + months);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  // Renewal Modal State
  const [showRenewModal, setShowRenewModal] = useState<boolean>(false);
  const [renewalExtensionDays, setRenewalExtensionDays] = useState<number>(30);
  const [renewalRentAmount, setRenewalRentAmount] = useState<number>(1600);
  const [renewCollectPayment, setRenewCollectPayment] = useState<boolean>(true);
  const [renewPaymentMode, setRenewPaymentMode] = useState<string>('CASH');

  // Vacate Modal State
  const [showVacateModal, setShowVacateModal] = useState<boolean>(false);
  const [damageDeduction, setDamageDeduction] = useState<number>(0);
  const [vacateRemarks, setVacateRemarks] = useState<string>('');
  const [keyReturned, setKeyReturned] = useState<boolean>(true);
  const [lockerCleared, setLockerCleared] = useState<boolean>(true);

  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scanningExpiries, setScanningExpiries] = useState<boolean>(false);

  const triggerExpiryReminders = async () => {
    try {
      setScanningExpiries(true);
      const res = await apiClient.post('/notifications/reminders/process-facility-expiries', null, {
        params: { days_ahead: 3, include_expired: true }
      });
      const data = res.data;
      setFeedbackMessage({
        type: 'success',
        text: `Facility Reminder Scan Complete: Processed ${data.processed_count} tenancies (${data.dispatched_count} notifications dispatched, ${data.skipped_count} skipped/already reminded today).`
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to trigger facility expiry reminders.'
      });
    } finally {
      setScanningExpiries(false);
    }
  };

  const fetchSeats = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<StudySeat[]>('/study-rooms/seats');
      setSeats(res.data);
      if (selectedSeat) {
        const updated = res.data.find((s) => s.id === selectedSeat.id);
        if (updated) setSelectedSeat(updated);
      }
    } catch (err: any) {
      console.error('Failed to load study room seats', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await apiClient.get<StudentOption[]>('/students');
      setStudents(res.data);
    } catch (err: any) {
      console.error('Failed to load students for allocation', err);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await apiClient.get<FacilityPlan[]>('/services/plans?service_type_code=STUDY_ROOM');
      setPlans(res.data);
      if (res.data.length > 0 && !selectedPlanId) {
        setSelectedPlanId(res.data[0].id);
        const p = res.data[0];
        setCustomRentAmount(p.base_amount);
        setCustomDepositAmount(p.deposit_amount);
        updateEndDateForFrequency(p.billing_frequency);
      }
    } catch (err: any) {
      console.error('Failed to load study room plans', err);
    }
  };

  const updateEndDateForFrequency = (freq: string) => {
    const today = new Date();
    let days = 30;
    if (freq === 'QUARTERLY') days = 90;
    else if (freq === 'HALF_YEARLY') days = 180;
    else if (freq === 'YEARLY') days = 365;
    today.setDate(today.getDate() + days);
    setAllocationEndDate(today.toISOString().split('T')[0]);
  };

  const handlePlanSelectionChange = (planId: string) => {
    if (planId === 'CUSTOM') {
      setIsCustomPricing(true);
      setSelectedPlanId('');
    } else {
      setIsCustomPricing(false);
      setSelectedPlanId(planId);
      const plan = plans.find((p) => p.id === planId);
      if (plan) {
        let monthly = Number(plan.base_amount);
        let mCount = 1;
        if (plan.billing_frequency === 'QUARTERLY') {
          monthly = Math.round(Number(plan.base_amount) / 3);
          mCount = 3;
        } else if (plan.billing_frequency === 'HALF_YEARLY') {
          monthly = Math.round(Number(plan.base_amount) / 6);
          mCount = 6;
        } else if (plan.billing_frequency === 'YEARLY') {
          monthly = Math.round(Number(plan.base_amount) / 12);
          mCount = 12;
        }
        setMonthlyCharge(monthly);
        setDurationMonths(mCount);
        setCustomDepositAmount(Number(plan.deposit_amount));
        setAllocationEndDate(computeEndDate(allocationStartDate, mCount));
      }
    }
  };

  useEffect(() => {
    fetchSeats();
    fetchStudents();
    fetchPlans();
  }, []);

  const getSeatSubscriptionStatus = (seat: StudySeat) => {
    if (seat.status !== 'OCCUPIED' || !seat.allocation_end_date) {
      return null;
    }
    const today = new Date().toISOString().split('T')[0];
    const endDate = seat.allocation_end_date;
    if (today > endDate) {
      const daysAgo = Math.floor((new Date(today).getTime() - new Date(endDate).getTime()) / (1000 * 60 * 60 * 24));
      return {
        type: 'EXPIRED',
        label: `Expired ${daysAgo}d ago`,
        subText: `Expired (${endDate})`,
        badgeClass: 'bg-rose-900 text-rose-100 border border-rose-800',
        deskClass: 'bg-rose-100 text-rose-900 border-2 border-rose-600 font-bold'
      };
    }
    const daysLeft = Math.ceil((new Date(endDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7) {
      return {
        type: 'RENEWAL_DUE',
        label: `Renewal due (${daysLeft}d)`,
        subText: `Expires in ${daysLeft}d`,
        badgeClass: 'bg-amber-100 text-amber-800 border border-amber-300',
        deskClass: 'bg-amber-100 text-amber-900 border-2 border-amber-500 font-bold'
      };
    }
    return {
      type: 'ACTIVE',
      label: `Active (${daysLeft}d left)`,
      subText: `Valid until ${endDate}`,
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      deskClass: 'bg-rose-50 text-rose-800 border border-rose-200'
    };
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeat || !selectedStudentId) return;

    setActionLoading(true);
    setFeedbackMessage(null);
    try {
      const months = Math.max(1, Number(durationMonths) || 1);
      const computedEnd = allocationEndDate || computeEndDate(allocationStartDate, months);
      const payload: any = {
        student_id: selectedStudentId,
        study_seat_id: selectedSeat.id,
        start_date: allocationStartDate,
        end_date: computedEnd,
        duration_months: months,
        monthly_charge: Number(monthlyCharge),
        collect_payment: collectPaymentNow,
        payment_mode: paymentMode
      };

      if (isCustomPricing) {
        payload.service_plan_id = null;
        payload.custom_rent_amount = Number(monthlyCharge);
        payload.custom_deposit_amount = customDepositAmount;
      } else {
        payload.service_plan_id = selectedPlanId || (plans[0] ? plans[0].id : null);
        payload.custom_deposit_amount = customDepositAmount;
      }

      const res = await apiClient.post('/study-rooms/allocate', payload);
      setFeedbackMessage({
        type: 'success',
        text: `Seat ${selectedSeat.seat_number} allocated successfully! Invoice #${res.data.invoice_number} created (${res.data.status}). Total: ₹${res.data.total_amount}.`
      });
      setShowAllocateModal(false);
      setSelectedStudentId('');
      await fetchSeats();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to allocate seat. Check permissions or availability.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenRenewModal = () => {
    if (!selectedSeat?.allocation_id) return;
    setRenewalExtensionDays(30);
    setRenewalRentAmount(selectedSeat.unit_price || 1600);
    setRenewCollectPayment(true);
    setRenewPaymentMode('CASH');
    setShowRenewModal(true);
  };

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeat?.allocation_id) return;

    setActionLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await apiClient.post(`/study-rooms/renew/${selectedSeat.allocation_id}`, {
        allocation_id: selectedSeat.allocation_id,
        extension_days: Number(renewalExtensionDays),
        renewal_rent_amount: Number(renewalRentAmount),
        collect_payment: renewCollectPayment,
        payment_mode: renewPaymentMode
      });
      setFeedbackMessage({
        type: 'success',
        text: `Seat ${selectedSeat.seat_number} renewed until ${res.data.new_end_date}! Invoice #${res.data.invoice_number} generated (${res.data.status}).`
      });
      setShowRenewModal(false);
      await fetchSeats();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to renew seat subscription.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenVacateModal = () => {
    if (!selectedSeat?.allocation_id) return;
    setDamageDeduction(0);
    setVacateRemarks('Desk key returned and locker vacated in good condition.');
    setKeyReturned(true);
    setLockerCleared(true);
    setShowVacateModal(true);
  };

  const handleConfirmVacate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeat?.allocation_id) return;

    setActionLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await apiClient.post(`/study-rooms/vacate/${selectedSeat.allocation_id}`, {
        allocation_id: selectedSeat.allocation_id,
        refund_deposit: true,
        damage_deduction: Number(damageDeduction),
        remarks: vacateRemarks
      });
      setFeedbackMessage({
        type: 'success',
        text: `Seat ${selectedSeat.seat_number} vacated successfully. Security deposit refund calculated: ₹${Number(res.data.refund_amount || 0).toLocaleString('en-IN')}.`
      });
      setShowVacateModal(false);
      setSelectedSeat(null);
      await fetchSeats();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to vacate seat.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeat?.allocation_id || !transferTargetSeatId) return;

    setActionLoading(true);
    setFeedbackMessage(null);
    try {
      await apiClient.post('/study-rooms/transfer', {
        current_allocation_id: selectedSeat.allocation_id,
        new_study_seat_id: transferTargetSeatId
      });
      setFeedbackMessage({ type: 'success', text: 'Seat transferred successfully!' });
      setShowTransferModal(false);
      setTransferTargetSeatId('');
      await fetchSeats();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to transfer seat. Check compatibility.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckInOut = async (isCheckOut: boolean) => {
    if (!selectedSeat?.allocation_id) return;
    const student = students.find((s) => s.student_code === selectedSeat.occupant_code || s.prn === selectedSeat.occupant_code);
    if (!student) {
      alert('Could not match occupant record.');
      return;
    }

    try {
      await apiClient.post('/study-rooms/attendance', {
        study_seat_id: selectedSeat.id,
        student_id: student.id,
        is_check_out: isCheckOut
      });
      alert(isCheckOut ? 'Study room Check-Out recorded!' : 'Study room Check-In recorded!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Attendance action failed');
    }
  };

  // Metrics
  const totalSeats = seats.length;
  const occupiedSeats = seats.filter((s) => s.status === 'OCCUPIED').length;
  const availableSeats = seats.filter((s) => s.status === 'AVAILABLE').length;
  const boysSeats = seats.filter((s) => s.gender_allowed === 'BOYS');
  const girlsSeats = seats.filter((s) => s.gender_allowed === 'GIRLS');
  const boysOccupancy = boysSeats.length ? Math.round((boysSeats.filter((s) => s.status === 'OCCUPIED').length / boysSeats.length) * 100) : 0;
  const girlsOccupancy = girlsSeats.length ? Math.round((girlsSeats.filter((s) => s.status === 'OCCUPIED').length / girlsSeats.length) * 100) : 0;

  // Filtered Seats
  const filteredSeats = seats.filter((seat) => {
    if (genderFilter !== 'ALL' && seat.gender_allowed !== genderFilter) return false;
    if (statusFilter !== 'ALL' && seat.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchNum = seat.seat_number.toLowerCase().includes(q);
      const matchOcc = seat.occupant_name?.toLowerCase().includes(q);
      const matchCode = seat.occupant_code?.toLowerCase().includes(q);
      if (!matchNum && !matchOcc && !matchCode) return false;
    }
    return true;
  });

  const boysGrid = filteredSeats.filter((s) => s.gender_allowed === 'BOYS');
  const girlsGrid = filteredSeats.filter((s) => s.gender_allowed === 'GIRLS');

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Armchair className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Study Room Interactive Floor Map</h1>
              <p className="text-sm text-slate-500">
                150 Precision Dedicated Study Desks • 105 Boys Desks (B001–B105) • 45 Girls Desks (G001–G045)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={triggerExpiryReminders}
            disabled={scanningExpiries}
            className="flex items-center space-x-2 px-3.5 py-2 text-sm font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all shadow-sm disabled:opacity-60"
            title="Scan upcoming (3-day) and expired desk tenancies and dispatch WhatsApp/Email reminders"
          >
            <Bell className={`w-4 h-4 ${scanningExpiries ? 'animate-bounce text-amber-600' : 'text-amber-600'}`} />
            <span>{scanningExpiries ? 'Scanning Expiries...' : 'Send Expiry Reminders'}</span>
          </button>
          <button
            onClick={fetchSeats}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Map</span>
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2 text-sm font-medium">
            {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{feedbackMessage.text}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Analytics KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Capacity</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{totalSeats}</span>
            <span className="text-xs font-medium text-slate-500">150 Desks</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">105 Boys • 45 Girls</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Occupied Desks</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-600">{occupiedSeats}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
              {totalSeats ? Math.round((occupiedSeats / totalSeats) * 100) : 0}% Active
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Real-time registered subscribers</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Desks</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600">{availableSeats}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Ready</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Ready for instant allocation</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Wing Utilization</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-blue-600">Boys Wing: {boysOccupancy}%</span>
              <span className="text-purple-600">Girls Wing: {girlsOccupancy}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
              <div className="bg-blue-500 h-2" style={{ width: `${(boysSeats.filter(s => s.status === 'OCCUPIED').length / totalSeats) * 100}%` }} />
              <div className="bg-purple-500 h-2" style={{ width: `${(girlsSeats.filter(s => s.status === 'OCCUPIED').length / totalSeats) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Gender Tabs */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 text-xs font-semibold">
            <button
              onClick={() => setGenderFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                genderFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Desks (150)
            </button>
            <button
              onClick={() => setGenderFilter('BOYS')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                genderFilter === 'BOYS' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-blue-700'
              }`}
            >
              Boys Wing (105)
            </button>
            <button
              onClick={() => setGenderFilter('GIRLS')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                genderFilter === 'GIRLS' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-purple-700'
              }`}
            >
              Girls Wing (45)
            </button>
          </div>

          {/* Status Filter */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter('AVAILABLE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'AVAILABLE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              Available
            </button>
            <button
              onClick={() => setStatusFilter('OCCUPIED')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'OCCUPIED' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              Occupied
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search desk #, student name, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Main Floor Grid & Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Desks Grid Area (Cols 1-3) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="font-semibold text-slate-800">Legend:</span>
            <div className="flex items-center space-x-1.5">
              <div className="w-3.5 h-3.5 rounded bg-emerald-500" />
              <span>Available</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-3.5 h-3.5 rounded bg-rose-500" />
              <span>Occupied</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-3.5 h-3.5 rounded bg-amber-500" />
              <span>Reserved</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-3.5 h-3.5 rounded bg-slate-300" />
              <span>Maintenance</span>
            </div>
            <div className="flex items-center space-x-1.5 ml-auto text-slate-400">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Power Outlet</span>
              <Lock className="w-3.5 h-3.5 text-blue-500 ml-2" />
              <span>Personal Locker</span>
            </div>
          </div>

          {/* Physical Classroom Blueprint Floor Map */}
          <StudyRoomPhysicalFloorMap
            seats={filteredSeats as any}
            selectedSeatId={selectedSeat?.id}
            onSelectSeat={(seat) => setSelectedSeat(seat as any)}
            genderFilter={genderFilter}
            interactiveOnlyAvailable={false}
            showSubscriptionDetails={true}
          />
        </div>

        {/* Selected Desk Inspection Sidebar (Col 4) */}
        <div className="lg:col-span-1">
          {selectedSeat ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 sticky top-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      selectedSeat.status === 'AVAILABLE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {selectedSeat.seat_number}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Desk Details</h3>
                    <p className="text-xs text-slate-500">{selectedSeat.gender_allowed} Section</p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                    selectedSeat.status === 'AVAILABLE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {selectedSeat.status}
                </span>
              </div>

              {/* Desk Attributes */}
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">Row / Column</span>
                  <span className="font-semibold text-slate-800">
                    Row {selectedSeat.row_identifier} • Col {selectedSeat.column_identifier}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">Gender Restriction</span>
                  <span className="font-semibold text-slate-800">{selectedSeat.gender_allowed} ONLY</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">Power Outlet</span>
                  <span className="font-semibold text-slate-800">{selectedSeat.has_power_outlet ? 'Yes (230V)' : 'No'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">Personal Locker</span>
                  <span className="font-semibold text-slate-800">{selectedSeat.has_locker ? 'Included' : 'None'}</span>
                </div>
              </div>

              {/* Occupant Info if occupied */}
              {selectedSeat.status === 'OCCUPIED' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Occupant</p>
                    {(() => {
                      const st = getSeatSubscriptionStatus(selectedSeat);
                      return st ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.badgeClass}`}>
                          {st.label}
                        </span>
                      ) : null;
                    })()}
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedSeat.occupant_name}</p>
                    <p className="text-xs font-mono text-emerald-600 font-semibold">{selectedSeat.occupant_code}</p>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Plan:</span>
                      <span className="font-bold text-slate-800">{selectedSeat.plan_name || 'Standard Study Plan'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tariff:</span>
                      <span className="font-bold text-slate-800">
                        ₹{Number(selectedSeat.unit_price || 0).toLocaleString('en-IN')}
                        <span className="text-[10px] text-slate-400 font-normal"> / {selectedSeat.billing_frequency?.toLowerCase().replace('_', ' ') || 'mo'}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-blue-700">
                      <span className="text-slate-500 flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>Deposit Held:</span>
                      </span>
                      <span className="font-bold">
                        ₹{Number(selectedSeat.deposit_amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {selectedSeat.allocation_end_date && (
                    <div className="text-[11px] text-slate-500 flex justify-between items-center">
                      <span>Valid Through:</span>
                      <span className="font-bold text-slate-700">{selectedSeat.allocation_end_date}</span>
                    </div>
                  )}

                  {/* Attendance Check-in / Check-out quick actions */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => handleCheckInOut(false)}
                      className="flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Check-In</span>
                    </button>
                    <button
                      onClick={() => handleCheckInOut(true)}
                      className="flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Check-Out</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {selectedSeat.status === 'AVAILABLE' ? (
                  <button
                    onClick={() => {
                      if (plans.length > 0 && !selectedPlanId) {
                        setSelectedPlanId(plans[0].id);
                        setCustomRentAmount(plans[0].base_amount);
                        setCustomDepositAmount(plans[0].deposit_amount);
                        updateEndDateForFrequency(plans[0].billing_frequency);
                      }
                      setShowAllocateModal(true);
                    }}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Allocate Desk</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleOpenRenewModal}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      <span>Renew Subscription</span>
                    </button>
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Transfer Desk</span>
                    </button>
                    <button
                      onClick={handleOpenVacateModal}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-sm font-semibold transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Vacate Desk & Settle Deposit</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
              <Armchair className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">Select a Desk</h3>
              <p className="text-xs text-slate-400">
                Click any desk on the floor map to inspect live occupancy, allocate to a student, transfer seats, or record study attendance.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Allocate Desk Modal */}
      {showAllocateModal && selectedSeat && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Allocate Desk {selectedSeat.seat_number}</h3>
                <p className="text-xs text-slate-500">Gender restriction: {selectedSeat.gender_allowed} Section</p>
              </div>
              <button onClick={() => setShowAllocateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAllocate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Registered Student *
                </label>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">-- Choose Student --</option>
                  {students
                    .filter((s) => {
                      if (selectedSeat.gender_allowed === 'BOYS') return s.gender === 'MALE';
                      if (selectedSeat.gender_allowed === 'GIRLS') return s.gender === 'FEMALE';
                      return true;
                    })
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.prn || (s.student_code ? s.student_code.replace('STU-', 'PRN-') : '')} • {s.first_name} {s.last_name} ({s.gender})
                      </option>
                    ))}
                </select>
              </div>

              {/* Plan Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Subscription Fee Plan *
                </label>
                <select
                  value={isCustomPricing ? 'CUSTOM' : selectedPlanId}
                  onChange={(e) => handlePlanSelectionChange(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{Number(p.base_amount).toLocaleString('en-IN')}/{p.billing_frequency.toLowerCase().replace('_', ' ')} (₹{Number(p.deposit_amount).toLocaleString('en-IN')} dep)
                    </option>
                  ))}
                  <option value="CUSTOM" disabled={!canCustomPrice}>
                    {canCustomPrice ? '⚡ Custom Pricing & Agreement (Admin Override)' : '🔒 Custom Pricing (Admin only)'}
                  </option>
                </select>
              </div>

              {/* Duration in Months and Rate Calculator */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Single Month Charge (₹) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={monthlyCharge}
                        onChange={(e) => setMonthlyCharge(Number(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Monthly Rate"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Duration (in Months) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="36"
                      required
                      value={durationMonths}
                      onChange={(e) => {
                        const m = Math.max(1, Number(e.target.value) || 1);
                        setDurationMonths(m);
                        setAllocationEndDate(computeEndDate(allocationStartDate, m));
                      }}
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Quick Month Preset Pills */}
                <div>
                  <span className="block text-[11px] font-medium text-slate-500 mb-1.5">Quick Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '1 Mo', count: 1 },
                      { label: '3 Mo (Quarter)', count: 3 },
                      { label: '6 Mo (Half Year)', count: 6 },
                      { label: '10 Mo (Academic)', count: 10 },
                      { label: '12 Mo (Full Year)', count: 12 },
                    ].map((preset) => (
                      <button
                        key={preset.count}
                        type="button"
                        onClick={() => {
                          setDurationMonths(preset.count);
                          setAllocationEndDate(computeEndDate(allocationStartDate, preset.count));
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          durationMonths === preset.count
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dates Selection */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200/80">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={allocationStartDate}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setAllocationStartDate(newStart);
                        setAllocationEndDate(computeEndDate(newStart, durationMonths));
                      }}
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Date (Auto)</label>
                    <input
                      type="date"
                      required
                      value={allocationEndDate}
                      onChange={(e) => setAllocationEndDate(e.target.value)}
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {/* Live Dynamic Financial Summary Card */}
                {(() => {
                  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
                  const depositAmt = isCustomPricing ? customDepositAmount : (currentPlan ? Number(currentPlan.deposit_amount) : 0);
                  const totalRent = (Number(monthlyCharge) || 0) * (Number(durationMonths) || 1);
                  const totalInitialDue = totalRent + depositAmt;

                  return (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Facility Rent ({durationMonths} Month{durationMonths > 1 ? 's' : ''} @ ₹{Number(monthlyCharge).toLocaleString('en-IN')}/mo):</span>
                        <span className="font-bold text-slate-900">₹{totalRent.toLocaleString('en-IN')}</span>
                      </div>
                      {depositAmt > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center space-x-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span>Key &amp; Locker Deposit (Refundable):</span>
                          </span>
                          <span className="font-bold text-blue-700">₹{depositAmt.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-sm text-slate-900">
                        <span>Total Initial Invoice:</span>
                        <span className="text-emerald-700">₹{totalInitialDue.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center space-x-1.5 text-[11px] font-medium text-blue-700 bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span>Confirmation email with tenancy details, invoice reference &amp; rules will be automatically sent to student &amp; parent.</span>
                </div>
              </div>

              {/* Payment Collection Toggle */}
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-emerald-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={collectPaymentNow}
                    onChange={(e) => setCollectPaymentNow(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span>Collect Payment Immediately & Generate Receipt</span>
                </label>

                {collectPaymentNow && (
                  <div className="pt-2 flex items-center space-x-2">
                    <span className="text-xs font-medium text-slate-600">Payment Mode:</span>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="p-1.5 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI / QR</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedStudentId}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Allocating & Billing...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1-Click Renew Subscription Modal */}
      {showRenewModal && selectedSeat && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-emerald-700">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Renew Desk {selectedSeat.seat_number}</h3>
              </div>
              <button onClick={() => setShowRenewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenew} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-900">{selectedSeat.occupant_name} ({selectedSeat.occupant_code})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Expiry:</span>
                  <span className="font-semibold text-slate-700">{selectedSeat.allocation_end_date}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Extension Duration *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '30 Days', days: 30 },
                    { label: '60 Days', days: 60 },
                    { label: '90 Days', days: 90 },
                    { label: '365 Days', days: 365 }
                  ].map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setRenewalExtensionDays(opt.days)}
                      className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all ${
                        renewalExtensionDays === opt.days
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Renewal Rent Tariff (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={renewalRentAmount}
                  onChange={(e) => setRenewalRentAmount(Number(e.target.value))}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Deposit on file notice */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Security Deposit Preserved:</strong> Refundable deposit of ₹{Number(selectedSeat.deposit_amount || 0).toLocaleString('en-IN')} remains held on file and is <strong>not recharged</strong> on renewal.
                </span>
              </div>

              {/* Collect payment toggle */}
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-emerald-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={renewCollectPayment}
                    onChange={(e) => setRenewCollectPayment(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span>Collect Renewal Payment Now</span>
                </label>

                {renewCollectPayment && (
                  <div className="pt-2 flex items-center space-x-2">
                    <span className="text-xs font-medium text-slate-600">Mode:</span>
                    <select
                      value={renewPaymentMode}
                      onChange={(e) => setRenewPaymentMode(e.target.value)}
                      className="p-1.5 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI / QR</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm"
                >
                  {actionLoading ? 'Renewing...' : 'Extend & Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vacate Desk & Settle Deposit Modal */}
      {showVacateModal && selectedSeat && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-rose-700">
                <LogOut className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900">Vacate Desk {selectedSeat.seat_number}</h3>
              </div>
              <button onClick={() => setShowVacateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmVacate} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-900">{selectedSeat.occupant_name} ({selectedSeat.occupant_code})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Refundable Deposit on File:</span>
                  <span className="font-bold text-blue-700">₹{Number(selectedSeat.deposit_amount || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Clearance Checklist */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Handover Checklist</p>
                <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keyReturned}
                    onChange={(e) => setKeyReturned(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>Physical Desk Key returned to front office</span>
                </label>
                <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockerCleared}
                    onChange={(e) => setLockerCleared(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>Personal locker cleared and inspected damage-free</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Damage / Deduction Charges (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={damageDeduction}
                  onChange={(e) => setDamageDeduction(Number(e.target.value))}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Net Refund Calculation */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Deposit:</span>
                  <span>₹{Number(selectedSeat.deposit_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-medium">
                  <span>Deductions:</span>
                  <span>-₹{Number(damageDeduction).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-emerald-200 font-bold text-sm text-emerald-950">
                  <span>Net Refund to Student:</span>
                  <span>₹{Math.max(0, Number(selectedSeat.deposit_amount || 0) - damageDeduction).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Settlement Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Desk inspection completed, key handed over."
                  value={vacateRemarks}
                  onChange={(e) => setVacateRemarks(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowVacateModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !keyReturned || !lockerCleared}
                  className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Vacating...' : 'Confirm Vacate & Settle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Desk Modal */}
      {showTransferModal && selectedSeat && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Transfer from {selectedSeat.seat_number}</h3>
                <p className="text-xs text-slate-500">Occupant: {selectedSeat.occupant_name}</p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Target Desk (Available Only) *
                </label>
                <select
                  required
                  value={transferTargetSeatId}
                  onChange={(e) => setTransferTargetSeatId(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">-- Choose New Desk --</option>
                  {seats
                    .filter((s) => s.status === 'AVAILABLE' && s.gender_allowed === selectedSeat.gender_allowed)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        Desk {s.seat_number} (Row {s.row_identifier}, Col {s.column_identifier})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !transferTargetSeatId}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Transferring...' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
