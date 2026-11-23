import React, { useState, useEffect } from 'react';
import {
  Home,
  Building,
  Layers,
  Bed,
  Users,
  Wrench,
  UserCheck,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  Trash2,
  DoorOpen,
  Snowflake,
  Bath,
  ChevronRight,
  Filter,
  Eye,
  Lock,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { HostelBunkBedCard } from '../components/HostelBunkBedCard';

interface HostelBed {
  id: string;
  room_id: string;
  bed_number: string;
  bed_label: string;
  tier?: 'UPPER' | 'LOWER' | 'SINGLE' | string;
  bunk_group?: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  occupant_name?: string | null;
  occupant_code?: string | null;
  allocation_id?: string | null;
  allocation_start_date?: string | null;
  allocation_end_date?: string | null;
  deposit_amount?: number | null;
  unit_price?: number | null;
  plan_name?: string | null;
  billing_frequency?: string | null;
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

interface HostelRoom {
  id: string;
  room_number: string;
  room_type: string;
  capacity: number;
  has_attached_bathroom: boolean;
  is_ac: boolean;
  beds: HostelBed[];
}

interface HostelFloor {
  id: string;
  floor_number: number;
  name: string;
  rooms: HostelRoom[];
}

interface HostelBuilding {
  id: string;
  name: string;
  code: string;
  floors: HostelFloor[];
}

interface HostelData {
  id: string;
  name: string;
  code: string;
  gender_type: string;
  address?: string | null;
  buildings: HostelBuilding[];
}

interface StudentOption {
  id: string;
  student_code?: string;
  prn?: string;
  first_name: string;
  last_name: string;
  gender: string;
}

export const HostelManagement: React.FC = () => {
  const { hasRole } = useAuth();
  const canCustomPrice = hasRole(['SUPER_ADMIN', 'ADMIN']);
  const isAdmin = hasRole(['SUPER_ADMIN', 'ADMIN']);

  const [hostels, setHostels] = useState<HostelData[]>([]);
  const [plans, setPlans] = useState<FacilityPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Hierarchical Navigation States
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Filters & Search
  const [roomFilterStatus, setRoomFilterStatus] = useState<'ALL' | 'AVAILABLE' | 'FULL' | 'AC'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedBed, setSelectedBed] = useState<HostelBed | null>(null);

  // Allocation Modals & States
  const [showAllocateModal, setShowAllocateModal] = useState<boolean>(false);
  const [showVisitorModal, setShowVisitorModal] = useState<boolean>(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState<boolean>(false);

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [isCustomPricing, setIsCustomPricing] = useState<boolean>(false);
  const [customRentAmount, setCustomRentAmount] = useState<number>(6500);
  const [depositAmount, setDepositAmount] = useState<number>(5000);
  const [allocEndDate, setAllocEndDate] = useState<string>('2027-04-30');
  const [collectPaymentNow, setCollectPaymentNow] = useState<boolean>(true);
  const [paymentMode, setPaymentMode] = useState<string>('CASH');

  // Renewal Modal State
  const [showRenewModal, setShowRenewModal] = useState<boolean>(false);
  const [renewingBed, setRenewingBed] = useState<HostelBed | null>(null);
  const [renewalExtensionDays, setRenewalExtensionDays] = useState<number>(30);
  const [renewalRentAmount, setRenewalRentAmount] = useState<number>(6500);
  const [renewCollectPayment, setRenewCollectPayment] = useState<boolean>(true);
  const [renewPaymentMode, setRenewPaymentMode] = useState<string>('CASH');

  // Check-Out Modal State
  const [showCheckOutModal, setShowCheckOutModal] = useState<boolean>(false);
  const [checkingOutBed, setCheckingOutBed] = useState<HostelBed | null>(null);
  const [damageDeduction, setDamageDeduction] = useState<number>(0);
  const [checkOutRemarks, setCheckOutRemarks] = useState<string>('');
  const [keyReturned, setKeyReturned] = useState<boolean>(true);
  const [furnitureInspected, setFurnitureInspected] = useState<boolean>(true);

  // Transfer Bed Modal State
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [transferBedSource, setTransferBedSource] = useState<HostelBed | null>(null);
  const [transferSourceRoom, setTransferSourceRoom] = useState<any>(null);
  const [transferTargetBedId, setTransferTargetBedId] = useState<string>('');
  const [transferRemarks, setTransferRemarks] = useState<string>('');
  const [transferScope, setTransferScope] = useState<'SAME_ROOM' | 'SAME_FLOOR' | 'ALL'>('SAME_ROOM');

  // Visitor form
  const [visitorForm, setVisitorForm] = useState({
    student_id: '',
    visitor_name: '',
    visitor_phone: '',
    relation: 'Parent / Guardian',
    purpose: 'Routine monthly family visit'
  });

  // Maintenance form
  const [maintenanceForm, setMaintenanceForm] = useState({
    hostel_room_id: '',
    issue_type: 'AC_COOLING',
    description: '',
    priority: 'MEDIUM'
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Dynamic Infrastructure Modals
  const [showAddFloorModal, setShowAddFloorModal] = useState<boolean>(false);
  const [floorBuildingId, setFloorBuildingId] = useState<string>('');
  const [floorNumber, setFloorNumber] = useState<number>(1);
  const [floorName, setFloorName] = useState<string>('');

  const [showAddRoomModal, setShowAddRoomModal] = useState<boolean>(false);
  const [roomFloorId, setRoomFloorId] = useState<string>('');
  const [roomNumber, setRoomNumber] = useState<string>('');
  const [beddingType, setBeddingType] = useState<'BUNK' | 'SINGLE'>('BUNK');
  const [bunkCount, setBunkCount] = useState<number>(1);
  const [singleCount, setSingleCount] = useState<number>(1);
  const [roomType, setRoomType] = useState<string>('DOUBLE');
  const [roomCapacity, setRoomCapacity] = useState<number>(2);
  const [hasAttachedBathroom, setHasAttachedBathroom] = useState<boolean>(true);
  const [isAc, setIsAc] = useState<boolean>(false);
  const [autoCreateBeds, setAutoCreateBeds] = useState<boolean>(true);

  // Fetch Hostels & Hierarchy
  const fetchHostels = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<HostelData[]>('/hostels');
      setHostels(res.data);
      if (res.data.length > 0) {
        const hId = selectedHostelId || res.data[0].id;
        setSelectedHostelId(hId);
        const hostObj = res.data.find((h) => h.id === hId) || res.data[0];
        if (hostObj.buildings.length > 0) {
          const bId =
            selectedBuildingId && hostObj.buildings.some((b) => b.id === selectedBuildingId)
              ? selectedBuildingId
              : hostObj.buildings[0].id;
          setSelectedBuildingId(bId);
          const bldObj = hostObj.buildings.find((b) => b.id === bId) || hostObj.buildings[0];
          if (bldObj.floors.length > 0) {
            const fId =
              selectedFloorId && bldObj.floors.some((f) => f.id === selectedFloorId)
                ? selectedFloorId
                : bldObj.floors[0].id;
            setSelectedFloorId(fId);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load hostel data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await apiClient.get<StudentOption[]>('/students');
      setStudents(res.data);
    } catch (err: any) {
      console.error('Failed to load students', err);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await apiClient.get<FacilityPlan[]>('/services/plans?service_type_code=HOSTEL');
      setPlans(res.data);
      if (res.data.length > 0 && !selectedPlanId) {
        setSelectedPlanId(res.data[0].id);
        setCustomRentAmount(res.data[0].base_amount);
        setDepositAmount(res.data[0].deposit_amount);
        updateEndDateForFrequency(res.data[0].billing_frequency);
      }
    } catch (err: any) {
      console.error('Failed to load hostel plans', err);
    }
  };

  const updateEndDateForFrequency = (freq: string) => {
    const today = new Date();
    let days = 30;
    if (freq === 'QUARTERLY') days = 90;
    else if (freq === 'HALF_YEARLY') days = 180;
    else if (freq === 'YEARLY') days = 365;
    today.setDate(today.getDate() + days);
    setAllocEndDate(today.toISOString().split('T')[0]);
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
        setCustomRentAmount(plan.base_amount);
        setDepositAmount(plan.deposit_amount);
        updateEndDateForFrequency(plan.billing_frequency);
      }
    }
  };

  useEffect(() => {
    fetchHostels();
    fetchStudents();
    fetchPlans();
  }, []);

  // Hierarchy Navigation Handlers
  const handleSelectHostel = (hostelId: string) => {
    setSelectedHostelId(hostelId);
    setSelectedRoomId(null);
    const host = hostels.find((h) => h.id === hostelId);
    if (host && host.buildings.length > 0) {
      const firstBld = host.buildings[0];
      setSelectedBuildingId(firstBld.id);
      if (firstBld.floors.length > 0) {
        setSelectedFloorId(firstBld.floors[0].id);
      } else {
        setSelectedFloorId('');
      }
    } else {
      setSelectedBuildingId('');
      setSelectedFloorId('');
    }
  };

  const handleSelectBuilding = (bldId: string) => {
    setSelectedBuildingId(bldId);
    setSelectedRoomId(null);
    const bld = currentHostel?.buildings.find((b) => b.id === bldId);
    if (bld && bld.floors.length > 0) {
      setSelectedFloorId(bld.floors[0].id);
    } else {
      setSelectedFloorId('');
    }
  };

  const handleSelectFloor = (floorId: string) => {
    setSelectedFloorId(floorId);
    setSelectedRoomId(null);
  };

  // Subscriptions Expiry Helper
  const getBedSubscriptionStatus = (bed: HostelBed) => {
    if (bed.status !== 'OCCUPIED' || !bed.allocation_end_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(bed.allocation_end_date);
    expDate.setHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Expired (${Math.abs(diffDays)}d ago)`,
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        type: 'EXPIRED' as const,
        daysRemaining: diffDays
      };
    }
    if (diffDays <= 7) {
      return {
        label: `Due Soon (${diffDays}d left)`,
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
        type: 'RENEWAL_DUE' as const,
        daysRemaining: diffDays
      };
    }
    return {
      label: `Active (${diffDays}d left)`,
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      type: 'HEALTHY' as const,
      daysRemaining: diffDays
    };
  };

  // Dynamic Infrastructure Operations
  const openAddFloorModal = (buildingId: string, nextNumber: number) => {
    setFloorBuildingId(buildingId);
    setFloorNumber(nextNumber);
    setFloorName(nextNumber === 1 ? 'First Floor' : nextNumber === 2 ? 'Second Floor' : nextNumber === 3 ? 'Third Floor' : `Floor ${nextNumber}`);
    setShowAddFloorModal(true);
  };

  const handleCreateFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!floorBuildingId) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      await apiClient.post(`/hostels/buildings/${floorBuildingId}/floors`, {
        floor_number: Number(floorNumber),
        name: floorName
      });
      setFeedback({ type: 'success', text: `Floor '${floorName}' created successfully` });
      setShowAddFloorModal(false);
      await fetchHostels();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to create floor' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteFloor = async (floorId: string, floorNameStr: string) => {
    if (!window.confirm(`Are you sure you want to delete floor '${floorNameStr}' and all its vacant rooms?`)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      await apiClient.delete(`/hostels/floors/${floorId}`);
      setFeedback({ type: 'success', text: `Floor '${floorNameStr}' deleted successfully` });
      if (selectedFloorId === floorId) {
        setSelectedFloorId('');
      }
      await fetchHostels();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to delete floor' });
    } finally {
      setActionLoading(false);
    }
  };

  const openAddRoomModal = (floorId: string, floorNum: number) => {
    setRoomFloorId(floorId);
    setRoomNumber(`${floorNum}01`);
    setBeddingType('BUNK');
    setBunkCount(1);
    setSingleCount(1);
    setRoomType('DOUBLE');
    setRoomCapacity(2);
    setHasAttachedBathroom(true);
    setIsAc(false);
    setAutoCreateBeds(true);
    setShowAddRoomModal(true);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomFloorId || !roomNumber.trim()) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const finalCapacity = beddingType === 'BUNK' ? bunkCount * 2 : singleCount;
      const finalRoomType =
        finalCapacity > 2
          ? 'DORMITORY'
          : finalCapacity === 2
          ? 'DOUBLE'
          : 'SINGLE';

      const res = await apiClient.post(`/hostels/floors/${roomFloorId}/rooms`, {
        room_number: roomNumber.trim(),
        room_type: finalRoomType,
        capacity: finalCapacity,
        has_attached_bathroom: hasAttachedBathroom,
        is_ac: isAc,
        auto_create_beds: autoCreateBeds
      });

      const summaryText =
        beddingType === 'BUNK'
          ? `${bunkCount} Bunk Beds (${finalCapacity} Berths: ${bunkCount} Lower + ${bunkCount} Upper)`
          : `${singleCount} Single Beds`;

      setFeedback({
        type: 'success',
        text: `Room ${roomNumber} created successfully with ${autoCreateBeds ? summaryText : 'no pre-generated berths'}`
      });
      setShowAddRoomModal(false);
      await fetchHostels();
      if (res.data?.id) {
        setSelectedRoomId(res.data.id);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to create room' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string, roomNum: string) => {
    if (!window.confirm(`Are you sure you want to delete Room ${roomNum} and all its vacant beds?`)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      await apiClient.delete(`/hostels/rooms/${roomId}`);
      setFeedback({ type: 'success', text: `Room ${roomNum} deleted successfully` });
      if (selectedRoomId === roomId) {
        setSelectedRoomId(null);
      }
      await fetchHostels();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to delete room' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddBunk = async (roomId: string, roomNum: string) => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await apiClient.post<HostelBed[]>(`/hostels/rooms/${roomId}/bunks`);
      const beds = res.data;
      const lower = beds[0]?.bed_number || 'Lower';
      const upper = beds[1]?.bed_number || 'Upper';
      setFeedback({
        type: 'success',
        text: `Added Bunk Bed (${lower} & ${upper}) to Room ${roomNum} (+2 positions)`
      });
      await fetchHostels();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to add bunk bed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBunk = async (roomId: string, bunkGroup: number, roomNum: string) => {
    if (!window.confirm(`Delete entire Bunk ${bunkGroup} (both Lower & Upper berths) from Room ${roomNum}?`)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      await apiClient.delete(`/hostels/rooms/${roomId}/bunks/${bunkGroup}`);
      setFeedback({ type: 'success', text: `Bunk ${bunkGroup} (2 berths) deleted successfully from Room ${roomNum}` });
      await fetchHostels();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to delete bunk' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddBed = handleAddBunk;

  const handleDeleteBed = async (bedId: string, bedLabelStr: string) => {
    if (!window.confirm(`Delete vacant ${bedLabelStr}?`)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      await apiClient.delete(`/hostels/beds/${bedId}`);
      setFeedback({ type: 'success', text: `${bedLabelStr} deleted successfully` });
      await fetchHostels();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to delete bed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Bed Allocation
  const handleAllocateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed || !selectedStudentId) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const payload: any = {
        hostel_bed_id: selectedBed.id,
        student_id: selectedStudentId,
        start_date: new Date().toISOString().split('T')[0],
        end_date: allocEndDate,
        service_plan_id: isCustomPricing ? null : selectedPlanId,
        deposit_amount: depositAmount,
        collect_payment: collectPaymentNow,
        payment_mode: paymentMode
      };

      if (isCustomPricing) {
        payload.custom_rent_amount = customRentAmount;
      }

      const res = await apiClient.post('/hostels/allocate', payload);
      setFeedback({
        type: 'success',
        text: `Bed ${selectedBed.bed_number} successfully allocated! Invoice #${res.data.invoice_number} generated (${res.data.status}).`
      });
      setShowAllocateModal(false);
      setSelectedBed(null);
      setSelectedStudentId('');
      await fetchHostels();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to allocate bed.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Bed Renewal
  const handleOpenRenewModal = (bed: HostelBed) => {
    setRenewingBed(bed);
    setRenewalExtensionDays(30);
    setRenewalRentAmount(bed.unit_price || 6500);
    setRenewCollectPayment(true);
    setRenewPaymentMode('CASH');
    setShowRenewModal(true);
  };

  const handleRenewBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingBed?.allocation_id) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await apiClient.post(`/hostels/renew/${renewingBed.allocation_id}`, {
        allocation_id: renewingBed.allocation_id,
        extension_days: Number(renewalExtensionDays),
        renewal_rent_amount: Number(renewalRentAmount),
        collect_payment: renewCollectPayment,
        payment_mode: renewPaymentMode
      });
      setFeedback({
        type: 'success',
        text: `Bed ${renewingBed.bed_number} renewed until ${res.data.new_end_date}! Invoice #${res.data.invoice_number} created (${res.data.status}).`
      });
      setShowRenewModal(false);
      setRenewingBed(null);
      await fetchHostels();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to renew bed.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Bed Check-out
  const handleOpenCheckOutModal = (bed: HostelBed) => {
    setCheckingOutBed(bed);
    setDamageDeduction(0);
    setCheckOutRemarks('Room checkout inspected and room key surrendered.');
    setKeyReturned(true);
    setFurnitureInspected(true);
    setShowCheckOutModal(true);
  };

  const handleConfirmCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkingOutBed?.allocation_id) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await apiClient.post(`/hostels/check-out/${checkingOutBed.allocation_id}`, {
        allocation_id: checkingOutBed.allocation_id,
        refund_deposit: true,
        damage_deduction: Number(damageDeduction),
        remarks: checkOutRemarks
      });
      setFeedback({
        type: 'success',
        text: `Bed ${checkingOutBed.bed_number} checked out successfully. Refund calculated: ₹${Number(res.data.refund_amount || 0).toLocaleString('en-IN')}.`
      });
      setShowCheckOutModal(false);
      setCheckingOutBed(null);
      await fetchHostels();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to check-out bed.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Transfer Bed Handlers
  const handleOpenTransferModal = (bed: HostelBed, room: any) => {
    setTransferBedSource(bed);
    setTransferSourceRoom(room);
    setTransferRemarks('');

    const sameRoomVacant = (room?.beds || []).filter((b: any) => b.id !== bed.id && b.status === 'AVAILABLE');
    if (sameRoomVacant.length > 0) {
      setTransferScope('SAME_ROOM');
      setTransferTargetBedId(sameRoomVacant[0].id);
    } else {
      setTransferScope('SAME_FLOOR');
      const floorVacant = (currentFloor?.rooms || []).flatMap((r: any) =>
        r.beds.filter((b: any) => b.id !== bed.id && b.status === 'AVAILABLE')
      );
      setTransferTargetBedId(floorVacant[0]?.id || '');
    }
    setShowTransferModal(true);
  };

  const handleTransferBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferBedSource?.allocation_id || !transferTargetBedId) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await apiClient.post('/hostels/transfer', {
        current_allocation_id: transferBedSource.allocation_id,
        new_hostel_bed_id: transferTargetBedId,
        remarks: transferRemarks.trim() || undefined
      });
      setFeedback({ type: 'success', text: res.data.message || 'Bed transferred successfully' });
      setShowTransferModal(false);
      await fetchHostels();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to transfer bed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Log Visitor
  const handleLogVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);
    try {
      await apiClient.post('/hostels/visitors', {
        ...visitorForm,
        in_time: new Date().toTimeString().split(' ')[0]
      });
      setFeedback({ type: 'success', text: 'Visitor logged in security registry!' });
      setShowVisitorModal(false);
      setVisitorForm({
        student_id: '',
        visitor_name: '',
        visitor_phone: '',
        relation: 'Parent / Guardian',
        purpose: 'Routine family visit'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to log visitor.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Report Maintenance
  const handleReportMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);
    try {
      await apiClient.post('/hostels/maintenance', maintenanceForm);
      setFeedback({ type: 'success', text: 'Maintenance work order ticket dispatched!' });
      setShowMaintenanceModal(false);
      setMaintenanceForm({
        hostel_room_id: '',
        issue_type: 'AC_COOLING',
        description: '',
        priority: 'MEDIUM'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to submit maintenance request.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Resolved Hierarchy Objects
  const currentHostel = hostels.find((h) => h.id === selectedHostelId) || hostels[0];
  const currentBuilding =
    currentHostel?.buildings.find((b) => b.id === selectedBuildingId) || currentHostel?.buildings[0];
  const currentFloor =
    currentBuilding?.floors.find((f) => f.id === selectedFloorId) || currentBuilding?.floors[0];

  const selectedRoom =
    currentFloor?.rooms.find((r) => r.id === selectedRoomId) ||
    currentBuilding?.floors.flatMap((f) => f.rooms).find((r) => r.id === selectedRoomId) ||
    null;

  // Filtered Rooms on current floor (naturally sorted: Room 1, Room 2, Room 3... Room 101, Room 102...)
  const filteredRooms = (currentFloor?.rooms || [])
    .filter((room) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRoom = room.room_number.toLowerCase().includes(q);
        const matchOccupant = room.beds.some(
          (b) =>
            (b.occupant_name && b.occupant_name.toLowerCase().includes(q)) ||
            (b.occupant_code && b.occupant_code.toLowerCase().includes(q)) ||
            (b.bed_label && b.bed_label.toLowerCase().includes(q))
        );
        if (!matchRoom && !matchOccupant) return false;
      }

      if (roomFilterStatus === 'AVAILABLE') {
        return room.beds.some((b) => b.status === 'AVAILABLE');
      }
      if (roomFilterStatus === 'FULL') {
        return room.beds.length > 0 && room.beds.every((b) => b.status === 'OCCUPIED');
      }
      if (roomFilterStatus === 'AC') {
        return room.is_ac;
      }
      return true;
    })
    .sort((a, b) =>
      a.room_number.localeCompare(b.room_number, undefined, { numeric: true, sensitivity: 'base' })
    );

  // Candidate available beds for student transfer
  const sameRoomVacantBeds = (transferSourceRoom?.beds || [])
    .filter((b: any) => b.id !== transferBedSource?.id && b.status === 'AVAILABLE')
    .map((b: any) => ({
      ...b,
      room_number: transferSourceRoom?.room_number,
      floor_name: currentFloor?.name || `Floor ${currentFloor?.floor_number}`,
      scope_type: 'SAME_ROOM'
    }));

  const sameFloorVacantBeds = (currentFloor?.rooms || []).flatMap((r: any) =>
    r.beds
      .filter((b: any) => b.id !== transferBedSource?.id && b.status === 'AVAILABLE')
      .map((b: any) => ({
        ...b,
        room_number: r.room_number,
        floor_name: currentFloor?.name || `Floor ${currentFloor?.floor_number}`,
        is_same_room: r.id === transferSourceRoom?.id,
        scope_type: r.id === transferSourceRoom?.id ? 'SAME_ROOM' : 'SAME_FLOOR'
      }))
  );

  const allHostelVacantBeds = hostels.flatMap((h) =>
    h.buildings.flatMap((bld) =>
      bld.floors.flatMap((flr) =>
        flr.rooms.flatMap((rm) =>
          rm.beds
            .filter((b: any) => b.id !== transferBedSource?.id && b.status === 'AVAILABLE')
            .map((b: any) => ({
              ...b,
              room_number: rm.room_number,
              floor_name: `${bld.name} • ${flr.name || `Floor ${flr.floor_number}`}`,
              is_same_room: rm.id === transferSourceRoom?.id,
              scope_type: rm.id === transferSourceRoom?.id ? 'SAME_ROOM' : 'OTHER'
            }))
        )
      )
    )
  );

  const displayTransferBeds =
    transferScope === 'SAME_ROOM'
      ? sameRoomVacantBeds
      : transferScope === 'SAME_FLOOR'
      ? sameFloorVacantBeds
      : allHostelVacantBeds;

  // Aggregated Stats
  let totalBedsCount = 0;
  let occupiedBedsCount = 0;
  if (currentHostel) {
    for (const bld of currentHostel.buildings) {
      for (const flr of bld.floors) {
        for (const rm of flr.rooms) {
          totalBedsCount += rm.beds.length;
          occupiedBedsCount += rm.beds.filter((b) => b.status === 'OCCUPIED').length;
        }
      }
    }
  }

  // Floor Stats
  const floorTotalBeds = (currentFloor?.rooms || []).reduce((acc, r) => acc + r.beds.length, 0);
  const floorOccupiedBeds = (currentFloor?.rooms || []).reduce(
    (acc, r) => acc + r.beds.filter((b) => b.status === 'OCCUPIED').length,
    0
  );

  const allRooms = currentHostel
    ? currentHostel.buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms))
    : [];

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Hostel & Residential Facilities</h1>
            <p className="text-sm text-slate-500">
              Interactive Architectural Floor Plan • Visual Room Blueprint • Subscription Lifecycle
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowVisitorModal(true)}
            className="flex items-center space-x-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
          >
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Log Visitor</span>
          </button>
          <button
            onClick={() => setShowMaintenanceModal(true)}
            className="flex items-center space-x-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
          >
            <Wrench className="w-4 h-4 text-amber-600" />
            <span>Report Issue</span>
          </button>
          <button
            onClick={fetchHostels}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200"
            title="Refresh Hostel Infrastructure"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2 text-sm font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Level 1: Hostel Selector & Quick Campus KPIs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0">
          {hostels.map((h) => (
            <button
              key={h.id}
              onClick={() => handleSelectHostel(h.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                selectedHostelId === h.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>{h.name}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  selectedHostelId === h.id ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {h.gender_type}
              </span>
            </button>
          ))}
        </div>

        {/* Campus Overview Counters */}
        <div className="flex items-center space-x-4 text-xs font-medium text-slate-600 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <div>
            Total Beds: <span className="font-bold text-slate-900">{totalBedsCount}</span>
          </div>
          <div className="w-px h-3 bg-slate-300" />
          <div>
            Occupied: <span className="font-bold text-rose-600">{occupiedBedsCount}</span>
          </div>
          <div className="w-px h-3 bg-slate-300" />
          <div>
            Available: <span className="font-bold text-emerald-600">{totalBedsCount - occupiedBedsCount}</span>
          </div>
        </div>
      </div>

      {currentHostel && (
        <div className="space-y-4">
          {/* Level 2 & 3: Architectural Block & Floor Navigation Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 p-3 sm:p-4 space-y-2.5 sm:space-y-3">
            {/* Row 1: Building / Block Selector */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2 overflow-x-auto min-w-0 flex-1 scrollbar-none py-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 shrink-0 flex items-center space-x-1">
                  <Building className="w-3.5 h-3.5" />
                  <span>Blocks:</span>
                </span>
                {currentHostel.buildings.map((bld) => {
                  const bldBeds = bld.floors.flatMap((f) => f.rooms).flatMap((r) => r.beds);
                  const bldOccupied = bldBeds.filter((b) => b.status === 'OCCUPIED').length;
                  const isSelected = selectedBuildingId === bld.id;

                  return (
                    <button
                      key={bld.id}
                      onClick={() => handleSelectBuilding(bld.id)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{bld.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 font-normal">({bld.code})</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          bldBeds.length > 0 && bldOccupied === bldBeds.length
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {bldOccupied}/{bldBeds.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {isAdmin && currentBuilding && (
                <button
                  type="button"
                  onClick={() => openAddFloorModal(currentBuilding.id, currentBuilding.floors.length + 1)}
                  className="px-2.5 sm:px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1 shrink-0 transition"
                  title={`Add Floor to ${currentBuilding.name}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Floor to {currentBuilding.name}</span>
                  <span className="sm:hidden">Add Floor</span>
                </button>
              )}
            </div>

            {/* Row 2: Floor Switcher Tabs */}
            {currentBuilding && (
              <div className="flex items-center justify-between gap-2.5 pt-2.5 sm:pt-3">
                <div className="flex items-center space-x-2 overflow-x-auto min-w-0 flex-1 scrollbar-none py-0.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 shrink-0 flex items-center space-x-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Floors:</span>
                  </span>
                  {currentBuilding.floors.map((flr) => {
                    const isSelected = selectedFloorId === flr.id;
                    const flrBeds = flr.rooms.flatMap((r) => r.beds);
                    const flrOccupied = flrBeds.filter((b) => b.status === 'OCCUPIED').length;

                    return (
                      <button
                        key={flr.id}
                        onClick={() => handleSelectFloor(flr.id)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                          isSelected
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span>
                          Floor {flr.floor_number} • {flr.name}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {flr.rooms.length} R • {flrOccupied}/{flrBeds.length} B
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Current Floor Action & Empty Floor Deletion */}
                {currentFloor && isAdmin && (
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openAddRoomModal(currentFloor.id, currentFloor.floor_number)}
                      className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1 transition"
                      title={`Add Room to Floor ${currentFloor.floor_number}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Add Room to Floor {currentFloor.floor_number}</span>
                      <span className="sm:hidden">Add Room</span>
                    </button>

                    {currentFloor.rooms.every((r) => r.beds.every((b) => b.status !== 'OCCUPIED')) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteFloor(currentFloor.id, currentFloor.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition border border-slate-200"
                        title="Delete Empty Floor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main Visual Layout: Left 2D Floor Plan Grid + Right Interactive Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Section: Floor Filter & 2D Room Grid (2 Cols on Desktop) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Floor Controls & Filters */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search room #, student, PRN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Status Pills */}
                <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto">
                  <button
                    onClick={() => setRoomFilterStatus('ALL')}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                      roomFilterStatus === 'ALL'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({currentFloor?.rooms.length || 0})
                  </button>
                  <button
                    onClick={() => setRoomFilterStatus('AVAILABLE')}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition flex items-center space-x-1 ${
                      roomFilterStatus === 'AVAILABLE'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Has Vacancy</span>
                  </button>
                  <button
                    onClick={() => setRoomFilterStatus('FULL')}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition flex items-center space-x-1 ${
                      roomFilterStatus === 'FULL'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    <span>Full</span>
                  </button>
                  <button
                    onClick={() => setRoomFilterStatus('AC')}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition flex items-center space-x-1 ${
                      roomFilterStatus === 'AC'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    <Snowflake className="w-3 h-3" />
                    <span>AC Only</span>
                  </button>
                </div>
              </div>

              {/* 2D Architectural Floor Plan Grid */}
              {filteredRooms.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <DoorOpen className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">No Rooms Match Filter</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {currentFloor?.rooms.length === 0
                      ? `There are no rooms on Floor ${currentFloor.floor_number} yet. Click 'Add Room to Floor' to create your first room.`
                      : 'Try adjusting your search query or status filter to see other rooms.'}
                  </p>
                  {currentFloor?.rooms.length === 0 && isAdmin && (
                    <button
                      type="button"
                      onClick={() => openAddRoomModal(currentFloor.id, currentFloor.floor_number)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add First Room</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRooms.map((room) => {
                    const isSelected = selectedRoomId === room.id;
                    const roomOccupied = room.beds.filter((b) => b.status === 'OCCUPIED').length;
                    const isFull = roomOccupied === room.capacity;
                    const isVacant = roomOccupied === 0;

                    return (
                      <div
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
                          isSelected
                            ? 'bg-indigo-50/40 border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                            : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                        }`}
                      >
                        {/* Room Card Header */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                          <div>
                            <div className="flex items-center space-x-2">
                              <DoorOpen className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-600'}`} />
                              <h3 className="font-bold text-slate-900 text-sm">Room {room.room_number}</h3>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold uppercase">
                                {room.room_type}
                              </span>
                            </div>

                            {/* Amenity Badges */}
                            <div className="flex items-center space-x-1.5 mt-1">
                              {room.is_ac && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-medium flex items-center space-x-0.5 border border-blue-100">
                                  <Snowflake className="w-2.5 h-2.5 text-blue-600" />
                                  <span>AC</span>
                                </span>
                              )}
                              {room.has_attached_bathroom && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-medium flex items-center space-x-0.5 border border-emerald-100">
                                  <Bath className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Bath</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Occupancy Badge */}
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1 ${
                              isFull
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : isVacant
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isFull ? 'bg-rose-500' : isVacant ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            />
                            <span>
                              {roomOccupied} / {room.capacity} Beds
                            </span>
                          </span>
                        </div>

                        {/* 2-Tier Bunk Bed Layout */}
                        <div className="space-y-2">
                          {room.capacity === 1 ? (
                            <HostelBunkBedCard
                              singleBed={room.beds[0]}
                              showSubscriptionDetails={true}
                              compact={true}
                            />
                          ) : (
                            (() => {
                              const bunksMap: Record<number, { upper?: any; lower?: any }> = {};
                              room.beds.forEach((bed, idx) => {
                                const grp = bed.bunk_group || Math.floor(idx / 2) + 1;
                                if (!bunksMap[grp]) bunksMap[grp] = {};
                                const isUpper = bed.tier === 'UPPER' || bed.bed_number.endsWith('-U') || bed.bed_number.endsWith('-B');
                                if (isUpper) {
                                  bunksMap[grp].upper = bed;
                                } else {
                                  bunksMap[grp].lower = bed;
                                }
                              });

                              const bunkKeys = Object.keys(bunksMap);
                              return (
                                <div className={`grid gap-2 ${bunkKeys.length > 2 ? 'grid-cols-1 sm:grid-cols-2 max-h-[460px] overflow-y-auto pr-1' : 'grid-cols-1'}`}>
                                  {bunkKeys.map((grpKey) => {
                                    const grpNum = Number(grpKey);
                                    const bunk = bunksMap[grpNum];
                                    return (
                                      <HostelBunkBedCard
                                        key={grpNum}
                                        bunkNumber={grpNum}
                                        upperBed={bunk.upper}
                                        lowerBed={bunk.lower}
                                        onDeleteBunk={(bNum) => handleDeleteBunk(room.id, bNum, room.room_number)}
                                        onSelectBed={(bed) => {
                                          setSelectedRoomId(room.id);
                                          if (bed.status === 'AVAILABLE') {
                                            setSelectedBed(bed as any);
                                            if (plans.length > 0 && !selectedPlanId) {
                                              setSelectedPlanId(plans[0].id);
                                              setCustomRentAmount(plans[0].base_amount);
                                              setDepositAmount(plans[0].deposit_amount);
                                              updateEndDateForFrequency(plans[0].billing_frequency);
                                            }
                                            setShowAllocateModal(true);
                                          }
                                        }}
                                        showSubscriptionDetails={true}
                                        compact={true}
                                      />
                                    );
                                  })}
                                </div>
                              );
                            })()
                          )}
                        </div>

                        {/* Room Card Footer & Quick Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <span className="text-[11px] font-semibold text-indigo-600 flex items-center space-x-1 group">
                            <span>Inspect & Manage</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>

                          <div className="flex items-center space-x-1.5">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddBunk(room.id, room.room_number);
                                }}
                                className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg text-[10px] font-bold transition flex items-center space-x-1"
                                title="Add Bunk Bed (2 Berths: Lower + Upper)"
                              >
                                <Plus className="w-3 h-3 text-indigo-600" />
                                <span>Bunk (2 Beds)</span>
                              </button>
                            )}

                            {isAdmin && isVacant && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRoom(room.id, room.room_number);
                                }}
                                className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                                title="Delete Vacant Room"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {isAdmin && !isVacant && (
                              <span
                                className="p-1 text-slate-300 cursor-not-allowed"
                                title="Cannot delete: active occupants present"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Section: Interactive Room & Bed Inspector (Sticky Sidebar) */}
            <div className="lg:col-span-1">
              {selectedRoom ? (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5 sticky top-6 animate-in fade-in zoom-in-95 duration-150">
                  {/* Inspector Header */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                        <DoorOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">Room {selectedRoom.room_number}</h3>
                        <p className="text-xs text-slate-500">
                          {currentBuilding?.name} • Floor {currentFloor?.floor_number}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedRoomId(null)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                      title="Close Inspector"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Room Overview & Amenities */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Capacity & Occupancy:</span>
                      <span className="font-bold text-slate-900">
                        {selectedRoom.beds.filter((b) => b.status === 'OCCUPIED').length} / {selectedRoom.capacity} Beds
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 pt-1 border-t border-slate-200">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                        {selectedRoom.room_type}
                      </span>
                      {selectedRoom.is_ac && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold flex items-center space-x-1">
                          <Snowflake className="w-3 h-3 text-blue-600" />
                          <span>Air Conditioned</span>
                        </span>
                      )}
                      {selectedRoom.has_attached_bathroom && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center space-x-1">
                          <Bath className="w-3 h-3 text-emerald-600" />
                          <span>Attached Bath</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Room Level Operations */}
                  {isAdmin && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleAddBunk(selectedRoom.id, selectedRoom.room_number)}
                        disabled={actionLoading}
                        className="flex-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Bunk (2 Berths)</span>
                      </button>

                      {selectedRoom.beds.every((b) => b.status !== 'OCCUPIED') ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteRoom(selectedRoom.id, selectedRoom.room_number)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Room</span>
                        </button>
                      ) : (
                        <span
                          className="px-2.5 py-1.5 bg-slate-100 text-slate-400 rounded-xl text-[11px] font-medium flex items-center space-x-1 cursor-not-allowed"
                          title="Cannot delete room: active occupants present"
                        >
                          <Lock className="w-3 h-3" />
                          <span>Room Occupied</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Detailed Bed Bays Grouped by Bunk */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <span>Room Beds ({selectedRoom.beds.length} Berths)</span>
                      <span className="text-[10px] text-slate-400 font-normal lowercase">Click bed to manage</span>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const bunksMap: Record<number, { upper?: any; lower?: any; single?: any }> = {};
                        selectedRoom.beds.forEach((bed, idx) => {
                          if (bed.tier === 'SINGLE') {
                            bunksMap[idx + 1000] = { single: bed };
                            return;
                          }
                          let grp = bed.bunk_group;
                          if (!grp) {
                            const match = bed.bed_number.match(/-B(\d+)-/);
                            grp = match ? parseInt(match[1]) : 1;
                          }
                          if (!bunksMap[grp]) bunksMap[grp] = {};
                          const isUpper = bed.tier === 'UPPER' || bed.bed_number.endsWith('-U') || bed.bed_number.endsWith('-B');
                          if (isUpper) {
                            bunksMap[grp].upper = bed;
                          } else {
                            bunksMap[grp].lower = bed;
                          }
                        });

                        const renderBedBay = (bed: any, tier: 'UPPER' | 'LOWER' | 'SINGLE') => {
                          const isOccupied = bed.status === 'OCCUPIED';
                          const subStatus = getBedSubscriptionStatus(bed);

                          return (
                            <div
                              key={bed.id}
                              className={`p-3.5 rounded-xl border text-xs space-y-2.5 transition-all ${
                                isOccupied ? 'bg-rose-50/50 border-rose-200' : 'bg-emerald-50/50 border-emerald-200'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-2">
                                  <div
                                    className={`p-1.5 rounded-lg ${
                                      isOccupied ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                                    }`}
                                  >
                                    <Bed className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-1.5">
                                      {tier === 'UPPER' ? (
                                        <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                                          <ArrowUp className="w-2.5 h-2.5 mr-0.5 text-blue-600 stroke-[3]" /> Upper Berth
                                        </span>
                                      ) : tier === 'LOWER' ? (
                                        <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                          <ArrowDown className="w-2.5 h-2.5 mr-0.5 text-amber-700 stroke-[3]" /> Lower Berth
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                          Single Bed
                                        </span>
                                      )}
                                      <span className="font-bold text-slate-900 text-sm">
                                        {bed.bed_label || bed.bed_number}
                                      </span>
                                      {tier === 'SINGLE' && isAdmin && !isOccupied && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteBed(bed.id, bed.bed_label || bed.bed_number)}
                                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition"
                                          title="Delete Vacant Single Bed"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono">ID: {bed.bed_number}</span>
                                  </div>
                                </div>

                                {isOccupied && subStatus ? (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${subStatus.badgeClass}`}>
                                    {subStatus.label}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                    Available
                                  </span>
                                )}
                              </div>

                              {isOccupied ? (
                                <>
                                  {/* Occupant Details Card */}
                                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1.5">
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-500">Student:</span>
                                      <span className="font-bold text-slate-900">{bed.occupant_name}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                      <span className="text-slate-500">Roll/Code:</span>
                                      <span className="font-mono font-bold text-emerald-700">{bed.occupant_code}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                                      <span className="text-slate-500">Plan:</span>
                                      <span className="font-semibold text-slate-800">
                                        {bed.plan_name || 'Hostel Boarding'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-500">Tariff:</span>
                                      <span className="font-bold text-slate-900">
                                        ₹{Number(bed.unit_price || 0).toLocaleString('en-IN')}/
                                        {bed.billing_frequency?.toLowerCase().replace('_', ' ') || 'mo'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-500">Caution Deposit:</span>
                                      <span className="font-bold text-blue-700">
                                        ₹{Number(bed.deposit_amount || 0).toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                    {bed.allocation_end_date && (
                                      <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-100">
                                        <span className="text-slate-500">Valid Through:</span>
                                        <span className="font-semibold text-slate-700">{bed.allocation_end_date}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center space-x-1.5 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenTransferModal(bed, selectedRoom)}
                                      className="flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition"
                                      title="Transfer student to a new berth in this room, on this floor, or across the hostel"
                                    >
                                      <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Transfer</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRenewModal(bed)}
                                      className="flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                                    >
                                      <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                                      <span>Renew</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCheckOutModal(bed)}
                                      className="flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                                    >
                                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                                      <span>Check-Out</span>
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-[11px] text-emerald-700 font-medium">
                                    Vacant berth ready for instant student registration and fee plan billing.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedBed(bed);
                                      if (plans.length > 0 && !selectedPlanId) {
                                        setSelectedPlanId(plans[0].id);
                                        setCustomRentAmount(plans[0].base_amount);
                                        setDepositAmount(plans[0].deposit_amount);
                                        updateEndDateForFrequency(plans[0].billing_frequency);
                                      }
                                      setShowAllocateModal(true);
                                    }}
                                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center justify-center space-x-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Allocate Bed</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        };

                        return Object.keys(bunksMap).map((grpKey) => {
                          const grpNum = Number(grpKey);
                          const bunk = bunksMap[grpNum];

                          if (bunk.single) {
                            return renderBedBay(bunk.single, 'SINGLE');
                          }

                          const isBunkDeletable =
                            isAdmin &&
                            (!bunk.upper || bunk.upper.status !== 'OCCUPIED') &&
                            (!bunk.lower || bunk.lower.status !== 'OCCUPIED');

                          return (
                            <div key={grpNum} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
                              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                                  <span className="font-bold text-xs text-slate-800">
                                    Bunk {grpNum} <span className="text-[11px] font-normal text-slate-500">(Double Berth • 2 Beds)</span>
                                  </span>
                                </div>
                                {isBunkDeletable && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBunk(selectedRoom.id, grpNum, selectedRoom.room_number)}
                                    disabled={actionLoading}
                                    className="text-[11px] text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-lg font-semibold transition flex items-center space-x-1 border border-rose-200/60"
                                    title={`Delete Bunk ${grpNum} (removes both Upper & Lower berths)`}
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-500" />
                                    <span>Delete Bunk</span>
                                  </button>
                                )}
                              </div>

                              {bunk.upper && renderBedBay(bunk.upper, 'UPPER')}
                              {bunk.lower && renderBedBay(bunk.lower, 'LOWER')}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty / Selection Guide Card */
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4 sticky top-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <DoorOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Select a Room</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Click any room on the floor map to inspect its beds, allocate students, or manage renewals and checkouts.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1.5 text-left border border-slate-100">
                    <div className="flex justify-between">
                      <span>Current Floor:</span>
                      <span className="font-bold text-slate-900">
                        Floor {currentFloor?.floor_number} ({currentFloor?.name})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Rooms:</span>
                      <span className="font-bold text-slate-900">{currentFloor?.rooms.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Floor Capacity:</span>
                      <span className="font-bold text-slate-900">
                        {floorOccupiedBeds} / {floorTotalBeds} Beds ({floorTotalBeds > 0 ? Math.round((floorOccupiedBeds / floorTotalBeds) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Allocate Bed Modal */}
      {showAllocateModal && selectedBed && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Allocate Bed {selectedBed.bed_number}</h3>
                <p className="text-xs text-slate-500">{currentHostel?.name}</p>
              </div>
              <button onClick={() => setShowAllocateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAllocateBed} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Registered Student *
                </label>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">-- Choose Student --</option>
                  {students
                    .filter((s) => {
                      if (currentHostel?.gender_type === 'BOYS') return s.gender === 'MALE';
                      if (currentHostel?.gender_type === 'GIRLS') return s.gender === 'FEMALE';
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
                  Hostel Boarding Plan *
                </label>
                <select
                  value={isCustomPricing ? 'CUSTOM' : selectedPlanId}
                  onChange={(e) => handlePlanSelectionChange(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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

              {/* Custom Pricing Inputs (if selected) */}
              {isCustomPricing ? (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-900">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Admin Custom Tariff Override</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Custom Rent Fee (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={customRentAmount}
                        onChange={(e) => setCustomRentAmount(Number(e.target.value))}
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Caution Deposit (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(Number(e.target.value))}
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg font-bold text-indigo-700"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                (() => {
                  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
                  if (!currentPlan) return null;
                  return (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Boarding Fee ({currentPlan.billing_frequency.replace('_', ' ')}):</span>
                        <span className="font-bold text-slate-900">₹{Number(currentPlan.base_amount).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span className="flex items-center space-x-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>Caution Deposit (Refundable):</span>
                        </span>
                        <span className="font-bold text-blue-700">₹{Number(currentPlan.deposit_amount).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-sm text-slate-900">
                        <span>Total Due Initial Invoice:</span>
                        <span className="text-indigo-700">
                          ₹{(Number(currentPlan.base_amount) + Number(currentPlan.deposit_amount)).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  );
                })()
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tenure End Date *
                </label>
                <input
                  type="date"
                  required
                  value={allocEndDate}
                  onChange={(e) => setAllocEndDate(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
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
                  <span>Collect Upfront Initial Payment (Invoice Marked Paid)</span>
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
                      <option value="UPI">UPI / QR Code</option>
                      <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
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
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Allocating...' : 'Allocate & Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Bed Modal */}
      {showRenewModal && renewingBed && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-indigo-700">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Renew Bed {renewingBed.bed_number}</h3>
              </div>
              <button onClick={() => setShowRenewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewBed} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-900">
                    {renewingBed.occupant_name} ({renewingBed.occupant_code})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Expiry:</span>
                  <span className="font-semibold text-slate-700">{renewingBed.allocation_end_date}</span>
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
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
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
                  Renewal Boarding Rent (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={renewalRentAmount}
                  onChange={(e) => setRenewalRentAmount(Number(e.target.value))}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Caution deposit on file notice */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Caution Deposit Preserved:</strong> Refundable deposit of ₹
                  {Number(renewingBed.deposit_amount || 0).toLocaleString('en-IN')} remains held on file and is{' '}
                  <strong>not recharged</strong> on renewal.
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
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm"
                >
                  {actionLoading ? 'Renewing...' : 'Extend & Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Check-Out Bed & Settle Deposit Modal */}
      {showCheckOutModal && checkingOutBed && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-rose-700">
                <LogOut className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900">Check-Out Bed {checkingOutBed.bed_number}</h3>
              </div>
              <button onClick={() => setShowCheckOutModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCheckOut} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-900">
                    {checkingOutBed.occupant_name} ({checkingOutBed.occupant_code})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Caution Deposit on File:</span>
                  <span className="font-bold text-blue-700">
                    ₹{Number(checkingOutBed.deposit_amount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Handover Checklist */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Handover Checklist</p>
                <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keyReturned}
                    onChange={(e) => setKeyReturned(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>Room & Wardrobe Key surrendered</span>
                </label>
                <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={furnitureInspected}
                    onChange={(e) => setFurnitureInspected(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>Bed, mattress & electrical fittings inspected intact</span>
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
                  <span>₹{Number(checkingOutBed.deposit_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-medium">
                  <span>Deductions:</span>
                  <span>-₹{Number(damageDeduction).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-emerald-200 font-bold text-sm text-emerald-950">
                  <span>Net Refund to Student:</span>
                  <span>
                    ₹{Math.max(0, Number(checkingOutBed.deposit_amount || 0) - damageDeduction).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Settlement Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Room check-out inspection cleared."
                  value={checkOutRemarks}
                  onChange={(e) => setCheckOutRemarks(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCheckOutModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !keyReturned || !furnitureInspected}
                  className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Checking Out...' : 'Confirm Check-Out & Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Bed Modal */}
      {showTransferModal && transferBedSource && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-indigo-700">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Transfer Bed Allocation</h3>
                  <p className="text-xs text-slate-500">Move resident to a different berth or room</p>
                </div>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferBed} className="space-y-4">
              {/* Current Resident & Bed Summary */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Student Resident:</span>
                  <span className="font-bold text-slate-900">
                    {transferBedSource.occupant_name} ({transferBedSource.occupant_code})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Current Allocation:</span>
                  <span className="font-mono font-semibold text-indigo-900">
                    Room {transferSourceRoom?.room_number} • Bed {transferBedSource.bed_number} (
                    {transferBedSource.tier === 'UPPER' ? 'Upper Berth' : transferBedSource.tier === 'SINGLE' ? 'Single' : 'Lower Berth'})
                  </span>
                </div>
                {transferBedSource.allocation_end_date && (
                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-indigo-200/50">
                    <span>Valid Through:</span>
                    <span className="font-semibold text-slate-700">{transferBedSource.allocation_end_date}</span>
                  </div>
                )}
              </div>

              {/* Transfer Destination Scope Tabs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Destination Scope:
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setTransferScope('SAME_ROOM');
                      if (sameRoomVacantBeds.length > 0) {
                        setTransferTargetBedId(sameRoomVacantBeds[0].id);
                      } else {
                        setTransferTargetBedId('');
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg transition text-center ${
                      transferScope === 'SAME_ROOM'
                        ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Within Room</span>
                    <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-normal">
                      {sameRoomVacantBeds.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTransferScope('SAME_FLOOR');
                      if (sameFloorVacantBeds.length > 0) {
                        setTransferTargetBedId(sameFloorVacantBeds[0].id);
                      } else {
                        setTransferTargetBedId('');
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg transition text-center ${
                      transferScope === 'SAME_FLOOR'
                        ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Same Floor</span>
                    <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-normal">
                      {sameFloorVacantBeds.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTransferScope('ALL');
                      if (allHostelVacantBeds.length > 0) {
                        setTransferTargetBedId(allHostelVacantBeds[0].id);
                      } else {
                        setTransferTargetBedId('');
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg transition text-center ${
                      transferScope === 'ALL'
                        ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>All Rooms</span>
                    <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-normal">
                      {allHostelVacantBeds.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Target Bed Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Choose Available Target Bed *
                </label>
                {displayTransferBeds.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 text-amber-900 text-xs text-center">
                    <p className="font-bold">No vacant beds available in this scope.</p>
                    <p className="text-[11px] mt-0.5 text-amber-700">
                      {transferScope === 'SAME_ROOM'
                        ? `Room ${transferSourceRoom?.room_number} is completely full. Switch to 'Same Floor' or 'All Rooms' above.`
                        : 'Try selecting another floor or building.'}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                    {displayTransferBeds.map((tBed: any) => {
                      const isChosen = transferTargetBedId === tBed.id;
                      const isUpper = tBed.tier === 'UPPER' || tBed.bed_number.endsWith('-U');
                      const isLower = tBed.tier === 'LOWER' || tBed.bed_number.endsWith('-L');

                      return (
                        <div
                          key={tBed.id}
                          onClick={() => setTransferTargetBedId(tBed.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                            isChosen
                              ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20 shadow-2xs'
                              : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div className={`p-1.5 rounded-lg ${isChosen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              <Bed className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-slate-900">Room {tBed.room_number}</span>
                                <span className="text-slate-400">•</span>
                                <span className="font-mono font-bold text-indigo-900">{tBed.bed_number}</span>
                                {isUpper ? (
                                  <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                                    <ArrowUp className="w-2.5 h-2.5 mr-0.5" /> Upper
                                  </span>
                                ) : isLower ? (
                                  <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900">
                                    <ArrowDown className="w-2.5 h-2.5 mr-0.5" /> Lower
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                                    Single
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">{tBed.floor_name}</p>
                            </div>
                          </div>

                          <div>
                            {isChosen ? (
                              <span className="inline-flex items-center text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 mr-0.5 text-indigo-600" /> Target
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-emerald-700">● Available</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Transfer Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transfer Reason / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Student requested lower berth, shifted to Room 101"
                  value={transferRemarks}
                  onChange={(e) => setTransferRemarks(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !transferTargetBedId}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {actionLoading ? (
                    <span>Transferring...</span>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Confirm Transfer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Visitor Modal */}
      {showVisitorModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Hostel Warden Visitor Log</h3>
                <p className="text-xs text-slate-500">Security Gate Entry Record</p>
              </div>
              <button onClick={() => setShowVisitorModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogVisitor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Student Visited *</label>
                <select
                  required
                  value={visitorForm.student_id}
                  onChange={(e) => setVisitorForm({ ...visitorForm, student_id: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">-- Select Resident Student --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} ({s.student_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Visitor Full Name *</label>
                <input
                  type="text"
                  required
                  value={visitorForm.visitor_name}
                  onChange={(e) => setVisitorForm({ ...visitorForm, visitor_name: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Visitor Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={visitorForm.visitor_phone}
                  onChange={(e) => setVisitorForm({ ...visitorForm, visitor_phone: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Relationship *</label>
                  <select
                    value={visitorForm.relation}
                    onChange={(e) => setVisitorForm({ ...visitorForm, relation: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Parent / Guardian">Parent / Guardian</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Relative">Relative</option>
                    <option value="Local Guardian">Local Guardian</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Purpose *</label>
                  <input
                    type="text"
                    required
                    value={visitorForm.purpose}
                    onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowVisitorModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                >
                  {actionLoading ? 'Logging...' : 'Log Security Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Maintenance Issue Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Log Facility Work Order</h3>
                <p className="text-xs text-slate-500">Hostel Maintenance Dispatch</p>
              </div>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReportMaintenance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hostel Room *</label>
                <select
                  required
                  value={maintenanceForm.hostel_room_id}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, hostel_room_id: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">-- Select Room --</option>
                  {allRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} ({r.room_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Issue Category *</label>
                  <select
                    value={maintenanceForm.issue_type}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, issue_type: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="AC_COOLING">AC / Cooling</option>
                    <option value="PLUMBING">Plumbing & Bathroom</option>
                    <option value="ELECTRICAL">Electrical & Lighting</option>
                    <option value="CARPENTRY">Furniture & Bedding</option>
                    <option value="CLEANING">Sanitation / Deep Cleaning</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Priority Level *</label>
                  <select
                    value={maintenanceForm.priority}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, priority: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="LOW">Low (Routine)</option>
                    <option value="MEDIUM">Medium (24h)</option>
                    <option value="HIGH">High (Urgent)</option>
                    <option value="CRITICAL">Critical (Immediate)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description & Observations *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail the issue reported by the warden or resident..."
                  value={maintenanceForm.description}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                >
                  {actionLoading ? 'Dispatching...' : 'Dispatch Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Floor Modal */}
      {showAddFloorModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Add Residential Floor</h3>
              </div>
              <button onClick={() => setShowAddFloorModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFloor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Floor Number *</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  required
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(parseInt(e.target.value) || 1)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Floor Name / Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Second Floor, Executive Wing"
                  value={floorName}
                  onChange={(e) => setFloorName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddFloorModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Floor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Room to Floor Modal */}
      {showAddRoomModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Room to Floor</h3>
                  <p className="text-xs text-slate-500">Configure bed structure and capacity</p>
                </div>
              </div>
              <button onClick={() => setShowAddRoomModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Room Number / Identifier *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 104, 201, 301-A"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800"
                />
              </div>

              {/* Bedding Structure Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bedding Structure</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBeddingType('BUNK')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition flex items-center space-x-2 ${
                      beddingType === 'BUNK'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Bed className={`w-4 h-4 ${beddingType === 'BUNK' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                      <p className="font-bold">Double Bunk Beds</p>
                      <p className="text-[10px] font-normal text-slate-500">2 Berths / Bed (Lower + Upper)</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBeddingType('SINGLE')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition flex items-center space-x-2 ${
                      beddingType === 'SINGLE'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Bed className={`w-4 h-4 ${beddingType === 'SINGLE' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                      <p className="font-bold">Single Beds</p>
                      <p className="text-[10px] font-normal text-slate-500">1 Berth per Bed</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Dynamic Count Input & Quick Preset Pills */}
              {beddingType === 'BUNK' ? (
                <div className="space-y-2.5 p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block">
                        Number of Bunk Beds
                      </label>
                      <span className="text-[10px] text-slate-500">Each bunk adds 2 berths (Lower + Upper)</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setBunkCount(Math.max(1, bunkCount - 1))}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold flex items-center justify-center text-sm shadow-2xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        required
                        value={bunkCount}
                        onChange={(e) => setBunkCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                        className="w-16 text-center text-sm font-bold p-1 border border-indigo-300 rounded-lg bg-white text-indigo-900 shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => setBunkCount(Math.min(50, bunkCount + 1))}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold flex items-center justify-center text-sm shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Quick Pick Pills for Bunk Counts */}
                  <div className="pt-1">
                    <span className="text-[10px] text-slate-500 font-medium block mb-1">Quick Select Bunk Count:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 2, 3, 4, 6, 8, 10, 11, 12, 16, 20].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setBunkCount(count)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition ${
                            bunkCount === count
                              ? 'bg-indigo-600 text-white shadow-2xs ring-1 ring-indigo-600'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300'
                          }`}
                        >
                          {count} {count === 1 ? 'Bunk' : 'Bunks'} ({count * 2}B)
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Real-time Calculation Summary Breakdown */}
                  <div className="p-2.5 bg-white rounded-lg border border-indigo-200/80 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Total Capacity:</span>
                      <span className="font-bold text-indigo-700 text-sm">{bunkCount * 2} Berths / Positions</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Berths Breakdown:</span>
                      <span className="font-mono font-semibold text-slate-700">
                        {bunkCount} Lower (↓) + {bunkCount} Upper (↑)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-500">
                      <span>Room Classification:</span>
                      <span className="font-semibold text-slate-800">
                        {bunkCount === 1 ? 'Double Sharing Room' : `Dormitory (${bunkCount * 2}-Bed Room)`}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">Number of Single Beds</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      required
                      value={singleCount}
                      onChange={(e) => setSingleCount(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                      className="w-16 text-center text-sm font-bold p-1 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex justify-between">
                    <span className="text-slate-600 font-medium">Total Capacity:</span>
                    <span className="font-bold text-slate-900">{singleCount} Single Bed(s)</span>
                  </div>
                </div>
              )}

              {/* Amenities & Auto-Provisioning */}
              <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Attached Bathroom</span>
                  <input
                    type="checkbox"
                    checked={hasAttachedBathroom}
                    onChange={(e) => setHasAttachedBathroom(e.target.checked)}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Air Conditioned (AC)</span>
                  <input
                    type="checkbox"
                    checked={isAc}
                    onChange={(e) => setIsAc(e.target.checked)}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                </div>
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
                  <div>
                    <span className="font-semibold text-indigo-900 block">
                      {beddingType === 'BUNK'
                        ? `Auto-Provision ${bunkCount * 2} Berths (${bunkCount} Bunk Beds)`
                        : `Auto-Provision ${singleCount} Single Bed(s)`}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {beddingType === 'BUNK'
                        ? 'Generates paired Lower (-L) and Upper (-U) berths ready for student registration'
                        : 'Generates single beds ready for student registration'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoCreateBeds}
                    onChange={(e) => setAutoCreateBeds(e.target.checked)}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !roomNumber.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {actionLoading ? (
                    <span>Creating Room & Berths...</span>
                  ) : (
                    <span>
                      Create Room ({beddingType === 'BUNK' ? `${bunkCount} Bunks • ${bunkCount * 2} Beds` : `${singleCount} Beds`})
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
