import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  GraduationCap,
  Home,
  Armchair,
  DollarSign,
  AlertCircle,
  FileCheck,
  Calendar,
  Sliders,
  CalendarDays,
  User,
  Users,
  Phone,
  Mail,
  Sparkles,
  Lock,
  Zap,
  CreditCard,
  MapPin,
  School,
  Building2,
  ShieldCheck,
  Percent,
  HeartHandshake,
  Printer,
  Clock,
  Bed
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useInstitute } from '../context/InstituteContext';
import { useAcademicYear } from '../context/AcademicYearContext';
import { StudentAdmissionFormModal } from '../components/StudentAdmissionFormModal';
import { InvoiceDetailModal } from '../components/InvoiceDetailModal';
import { StudyRoomPhysicalFloorMap } from '../components/StudyRoomPhysicalFloorMap';
import { HostelPhysicalFloorMap } from '../components/HostelPhysicalFloorMap';

const initialFormData = {
  // Student & Demographics
  admission_date: new Date().toISOString().split('T')[0],
  admission_type: 'CONFIRMED' as 'CONFIRMED' | 'PROVISIONAL_TRIAL',
  form_fee_payment_mode: 'CASH',
  form_fee_transaction_ref: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  date_of_birth: '',
  gender: 'MALE',
  blood_group: '',
  aadhar_number: '',
  category: 'GENERAL',
  mobile: '',
  email: '',

  // Residential Address (Mandatory)
  village: '',
  taluka: '',
  district: 'Kolhapur',

  // Current Regular Education (School vs Junior College)
  institution_type: 'SCHOOL',
  school_college_name: '',
  education_board: 'STATE_BOARD',
  previous_percentage: '',

  // Parent / Guardian & Emergency Contact
  guardian_name: '',
  guardian_mobile: '',
  guardian_relation: 'FATHER',
  guardian_email: '',
  guardian_occupation: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relation: '',

  // Academic Selection
  is_academic_enrolled: true,
  enrollment_type: 'SINGLE_YEAR',
  academic_year_id: '',
  class_id: '',
  stream_id: '',
  course_id: '',
  course_version_id: '',
  subject_group_id: '',
  selected_subject_ids: [] as string[],
  batch_id: '',

  // Facility Subscriptions
  hostel_plan_id: '',
  hostel_bed_id: '',
  hostel_months: 1,
  hostel_monthly_charge: 0,
  study_room_plan_id: '',
  study_seat_id: '',
  study_room_months: 1,
  study_room_monthly_charge: 0,

  // Fee & Installments
  discount_amount: 0,
  number_of_installments: 1,
  custom_installments: [] as { installment_number: number; due_date: string; amount?: number }[]
};

export const Admissions: React.FC = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { institute } = useInstitute();
  const { selectedAcademicYear, setSelectedAcademicYearById } = useAcademicYear();
  const isAdmin = hasRole(['SUPER_ADMIN', 'ADMIN']);

  const [step, setStep] = useState(1);
  const [activeCard, setActiveCard] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customAmountsEnabled, setCustomAmountsEnabled] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Admission Success Screen State & Print Modals
  const [admissionSuccessData, setAdmissionSuccessData] = useState<any | null>(null);
  const [showAdmissionFormModal, setShowAdmissionFormModal] = useState<boolean>(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState(initialFormData);

  // Reference Master Options from Backend
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [universalCourses, setUniversalCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [studySeats, setStudySeats] = useState<any[]>([]);
  const [showStudyRoomPickerModal, setShowStudyRoomPickerModal] = useState<boolean>(false);
  const [hostelBeds, setHostelBeds] = useState<any[]>([]);
  const [showHostelPickerModal, setShowHostelPickerModal] = useState<boolean>(false);
  const [allHostelsData, setAllHostelsData] = useState<any[]>([]);
  const [hostelPlans, setHostelPlans] = useState<any[]>([]);
  const [studyRoomPlans, setStudyRoomPlans] = useState<any[]>([]);
  const [admissionTrack, setAdmissionTrack] = useState<'REGULAR' | 'SKILL_ONLY' | 'FACILITY_ONLY'>('REGULAR');
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);

  const isFacilityOnlyTrack = !formData.is_academic_enrolled || admissionTrack === 'FACILITY_ONLY';

  // Fee Preview Result
  const [feePreview, setFeePreview] = useState<any>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);

  useEffect(() => {
    loadInitialMasterData();
  }, []);

  const loadInitialMasterData = async () => {
    try {
      const [ayRes, clsRes, strmRes, subjRes, plansRes, univRes] = await Promise.all([
        api.get('/academics/years'),
        api.get('/academics/classes'),
        api.get('/academics/streams'),
        api.get('/academics/subjects'),
        api.get('/services/plans'),
        api.get('/academics/courses', { params: { is_universal: true } })
      ]);

      setAcademicYears(ayRes.data);
      const curYear = (selectedAcademicYear && ayRes.data.some((y: any) => y.id === selectedAcademicYear.id))
        ? selectedAcademicYear
        : (ayRes.data.find((y: any) => y.is_current) || ayRes.data[0]);
      if (curYear) setFormData((prev) => ({ ...prev, academic_year_id: curYear.id }));

      setClasses(clsRes.data);
      setStreams(strmRes.data);
      setSubjects(subjRes.data);
      setUniversalCourses(univRes.data || []);

      setHostelPlans(plansRes.data.filter((p: any) => p.code.includes('HOST')));
      setStudyRoomPlans(plansRes.data.filter((p: any) => p.code.includes('SR')));
    } catch (err) {
      console.error('Failed to load master metadata', err);
    }
  };

  // Reactively sync academic year when switched from Topbar
  useEffect(() => {
    if (selectedAcademicYear?.id) {
      setFormData((prev) => ({ ...prev, academic_year_id: selectedAcademicYear.id, batch_id: '' }));
    }
  }, [selectedAcademicYear?.id]);

  // Re-fetch courses when class or stream changes
  useEffect(() => {
    if (formData.class_id) {
      api.get('/academics/courses', {
        params: { class_id: formData.class_id, stream_id: formData.stream_id || undefined }
      }).then((res) => {
        setCourses(res.data);
        const selCls = classes.find((c) => c.id === formData.class_id);
        const isSenior = selCls && (['STD-11', 'STD-12'].includes(selCls.code) || selCls.name?.includes('11') || selCls.name?.includes('12'));
        if (!isSenior && res.data.length > 0) {
          // Automatically assign compulsory master course for 5th - 10th
          handleCourseSelect(res.data[0].id, res.data);
        }
      });
    }
  }, [formData.class_id, formData.stream_id, classes]);

  // Load available batches for selected course and academic year
  useEffect(() => {
    if (formData.course_id) {
      api.get('/academics/batches', {
        params: {
          course_id: formData.course_id,
          academic_year_id: formData.academic_year_id || undefined,
          is_active: true
        }
      }).then((res) => {
        setAvailableBatches(res.data || []);
        if (res.data && res.data.length > 0) {
          setFormData((prev) => ({
            ...prev,
            batch_id: prev.batch_id && res.data.some((b: any) => b.id === prev.batch_id) ? prev.batch_id : res.data[0].id
          }));
        } else {
          setFormData((prev) => ({ ...prev, batch_id: '' }));
        }
      }).catch(() => setAvailableBatches([]));
    } else {
      setAvailableBatches([]);
      setFormData((prev) => ({ ...prev, batch_id: '' }));
    }
  }, [formData.course_id, formData.academic_year_id]);

  // Load study seats for gender (all desks so floor map renders full room with occupancy)
  useEffect(() => {
    api.get('/study-rooms/seats', {
      params: { gender_filter: formData.gender === 'MALE' ? 'BOYS' : 'GIRLS' }
    }).then((res) => {
      setStudySeats(res.data);
    });

    api.get('/hostels').then((res) => {
      setAllHostelsData(res.data || []);
      const genderHostel = (res.data || []).find((h: any) => h.gender_type === (formData.gender === 'MALE' ? 'BOYS' : 'GIRLS'));
      const beds: any[] = [];
      if (genderHostel) {
        genderHostel.buildings.forEach((b: any) => {
          b.floors.forEach((f: any) => {
            f.rooms.forEach((r: any) => {
              r.beds.forEach((bed: any) => {
                if (bed.status === 'AVAILABLE') {
                  beds.push({ ...bed, room_number: r.room_number, tier: bed.tier, bunk_group: bed.bunk_group });
                }
              });
            });
          });
        });
      }
      setHostelBeds(beds);
    });
  }, [formData.gender]);

  const getDefaultInstallments = (count: number, anchorDateStr?: string) => {
    const anchor = anchorDateStr || formData.admission_date || new Date().toISOString().split('T')[0];
    const base = new Date(anchor + 'T00:00:00');
    const list = [];
    for (let i = 1; i <= count; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + (i - 1) * 30);
      list.push({
        installment_number: i,
        due_date: d.toISOString().split('T')[0],
        amount: undefined as number | undefined
      });
    }
    return list;
  };

  const handleAdmissionDateChange = (newDate: string) => {
    setFormData((prev) => {
      const updatedInst = getDefaultInstallments(prev.number_of_installments, newDate);
      return {
        ...prev,
        admission_date: newDate,
        custom_installments: updatedInst
      };
    });
  };

  const handleInstallmentCountChange = (count: number) => {
    const defaultList = getDefaultInstallments(count);
    setFormData((prev) => ({
      ...prev,
      number_of_installments: count,
      custom_installments: defaultList
    }));
  };

  const applyDatePreset = (preset: '30_DAYS' | '1ST_OF_MONTH' | '10TH_OF_MONTH') => {
    const count = formData.number_of_installments;
    const anchor = formData.admission_date || new Date().toISOString().split('T')[0];
    const base = new Date(anchor + 'T00:00:00');
    const updated = [];
    for (let i = 1; i <= count; i++) {
      let d = new Date(base);
      if (preset === '30_DAYS') {
        d.setDate(d.getDate() + (i - 1) * 30);
      } else if (preset === '1ST_OF_MONTH') {
        if (i > 1) {
          d.setMonth(d.getMonth() + (i - 1));
          d.setDate(1);
        }
      } else if (preset === '10TH_OF_MONTH') {
        if (i > 1) {
          d.setMonth(d.getMonth() + (i - 1));
          d.setDate(10);
        }
      }
      updated.push({
        installment_number: i,
        due_date: d.toISOString().split('T')[0],
        amount: formData.custom_installments[i - 1]?.amount
      });
    }
    setFormData((prev) => ({ ...prev, custom_installments: updated }));
  };

  const handleInstallmentDateChange = (idx: number, dateStr: string) => {
    const updated = [...formData.custom_installments];
    updated[idx] = { ...updated[idx], due_date: dateStr };
    setFormData((prev) => ({ ...prev, custom_installments: updated }));
  };

  const handleInstallmentAmountChange = (idx: number, amountVal: number | undefined) => {
    const updated = [...formData.custom_installments];
    updated[idx] = { ...updated[idx], amount: amountVal };
    setFormData((prev) => ({ ...prev, custom_installments: updated }));
  };

  // Trigger Live Fee Preview
  const fetchFeePreview = async () => {
    setCalculatingFee(true);
    try {
      const payloadInstallments = formData.number_of_installments > 1 && formData.custom_installments?.length === formData.number_of_installments
        ? formData.custom_installments.map((c) => ({
            installment_number: c.installment_number,
            due_date: c.due_date,
            amount: isAdmin && customAmountsEnabled && c.amount ? Number(c.amount) : undefined
          }))
        : undefined;

      const res = await api.post('/fees/preview', {
        course_version_id: formData.course_version_id || undefined,
        subject_group_id: formData.subject_group_id || undefined,
        selected_subject_ids: formData.selected_subject_ids,
        hostel_plan_id: formData.hostel_plan_id || undefined,
        hostel_months: formData.hostel_plan_id ? (Number(formData.hostel_months) || 1) : undefined,
        hostel_monthly_charge: formData.hostel_plan_id && formData.hostel_monthly_charge ? Number(formData.hostel_monthly_charge) : undefined,
        study_room_plan_id: formData.study_room_plan_id || undefined,
        study_room_months: formData.study_room_plan_id ? (Number(formData.study_room_months) || 1) : undefined,
        study_room_monthly_charge: formData.study_room_plan_id && formData.study_room_monthly_charge ? Number(formData.study_room_monthly_charge) : undefined,
        discount_amount: formData.discount_amount,
        number_of_installments: formData.number_of_installments,
        custom_installments: payloadInstallments,
        admission_date: formData.admission_date || undefined,
        include_admission_fee: formData.admission_type !== 'PROVISIONAL_TRIAL' && (institute?.enable_admission_form_fee ?? true)
      });
      setFeePreview(res.data);
    } catch (err: any) {
      console.error('Fee preview calculation failed', err);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Fee calculation failed');
    } finally {
      setCalculatingFee(false);
    }
  };

  const selectedClass = classes.find((c) => c.id === formData.class_id);
  const isSeniorSecondary = Boolean(selectedClass && (
    ['STD-11', 'STD-12'].includes(selectedClass.code) ||
    selectedClass.name?.includes('11') ||
    selectedClass.name?.includes('12')
  ));
  const isCompulsoryFullCourse = Boolean(selectedClass && !isSeniorSecondary);

  const selectedCourse = courses.find((c) => c.id === formData.course_id);
  const courseOneTimeFee = selectedCourse?.current_version?.one_time_fee != null ? Number(selectedCourse.current_version.one_time_fee) : null;
  const courseInstFee = selectedCourse?.current_version?.installment_fee != null ? Number(selectedCourse.current_version.installment_fee) : null;
  const courseBaseFee = selectedCourse?.current_version?.base_fee != null ? Number(selectedCourse.current_version.base_fee) : 0;
  const coreSubjectIds = new Set(
    (selectedCourse?.current_version?.subjects || []).map((s: any) => s.id)
  );

  useEffect(() => {
    if (step === 4) {
      fetchFeePreview();
    }
  }, [
    formData.number_of_installments,
    formData.discount_amount,
    formData.admission_type,
    formData.study_room_plan_id,
    formData.study_room_months,
    formData.study_room_monthly_charge,
    formData.hostel_plan_id,
    formData.hostel_months,
    formData.hostel_monthly_charge
  ]);

  const clearFieldError = (name: string) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setError(null);
  };

  const getInputClass = (fieldName: string, baseExtra = '') => {
    const hasErr = Boolean(fieldErrors[fieldName]);
    return `w-full text-xs p-3 rounded-xl border font-medium text-slate-800 placeholder:text-slate-400 transition-all shadow-2xs focus:outline-none ${
      hasErr
        ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-600 focus:ring-4 focus:ring-rose-500/15'
        : 'border-slate-300 bg-white hover:border-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15'
    } ${baseExtra}`;
  };

  const getSelectClass = (fieldName: string, baseExtra = '') => {
    const hasErr = Boolean(fieldErrors[fieldName]);
    return `w-full text-xs p-3 rounded-xl border font-medium text-slate-800 transition-all shadow-2xs focus:outline-none ${
      hasErr
        ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-600 focus:ring-4 focus:ring-rose-500/15'
        : 'border-slate-300 bg-white hover:border-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15'
    } ${baseExtra}`;
  };

  const validateStep = (stepNumber: number, showErrors = true): boolean => {
    const errors: Record<string, string> = {};

    if (stepNumber === 1) {
      if (!formData.first_name.trim()) {
        errors.first_name = 'First name is required.';
      }
      if (!formData.last_name.trim()) {
        errors.last_name = 'Last name is required.';
      }
      if (!formData.date_of_birth) {
        errors.date_of_birth = 'Date of birth is required.';
      } else {
        const dob = new Date(formData.date_of_birth);
        const today = new Date();
        if (isNaN(dob.getTime())) {
          errors.date_of_birth = 'Please enter a valid date of birth.';
        } else if (dob > today) {
          errors.date_of_birth = 'Date of birth cannot be in the future.';
        }
      }
      if (!formData.gender) {
        errors.gender = 'Gender is required.';
      }
      if (!formData.aadhar_number?.trim()) {
        errors.aadhar_number = 'Aadhar / National ID (12 digits) is mandatory.';
      } else if (formData.aadhar_number.replace(/\D/g, '').length !== 12) {
        errors.aadhar_number = 'Aadhar number must be exactly 12 digits.';
      }
      if (!formData.mobile?.trim()) {
        errors.mobile = 'Student mobile phone is mandatory.';
      } else if (formData.mobile.replace(/\D/g, '').length < 10) {
        errors.mobile = 'Mobile number must be at least 10 digits.';
      }
      if (!isFacilityOnlyTrack) {
        if (!formData.guardian_name?.trim()) {
          errors.guardian_name = 'Guardian full name is mandatory.';
        }
        if (!formData.guardian_relation?.trim()) {
          errors.guardian_relation = 'Relationship to student is mandatory.';
        }
        if (!formData.guardian_mobile?.trim()) {
          errors.guardian_mobile = 'Guardian mobile phone is mandatory.';
        } else if (formData.guardian_mobile.replace(/\D/g, '').length < 10) {
          errors.guardian_mobile = 'Guardian mobile must be at least 10 digits.';
        }
        if (!formData.guardian_occupation?.trim()) {
          errors.guardian_occupation = 'Guardian occupation / profession is mandatory.';
        }
      } else {
        // Optional for facility-only track: if entered, ensure valid format and reciprocal presence
        if (formData.guardian_name?.trim() && !formData.guardian_mobile?.trim()) {
          errors.guardian_mobile = 'Guardian mobile phone is required when guardian name is provided.';
        } else if (formData.guardian_mobile?.trim()) {
          if (formData.guardian_mobile.replace(/\D/g, '').length < 10) {
            errors.guardian_mobile = 'Guardian mobile must be at least 10 digits.';
          }
          if (!formData.guardian_name?.trim()) {
            errors.guardian_name = 'Guardian full name is required when guardian mobile is provided.';
          }
        }
      }
      if (!formData.village?.trim()) {
        errors.village = 'Village / Town (गाव) is mandatory.';
      }
      if (!formData.taluka?.trim()) {
        errors.taluka = 'Taluka (तालुका) is mandatory.';
      }
      if (!formData.district?.trim()) {
        errors.district = 'District (जिल्हा) is mandatory.';
      }
      if (!formData.school_college_name?.trim()) {
        errors.school_college_name = formData.institution_type === 'COLLEGE'
          ? 'Junior College name is mandatory.'
          : 'School name is mandatory.';
      }
      if (!formData.education_board?.trim()) {
        errors.education_board = 'Education board / affiliation is mandatory.';
      }
      if (formData.previous_percentage === '' || formData.previous_percentage === undefined || formData.previous_percentage === null) {
        errors.previous_percentage = formData.institution_type === 'COLLEGE'
          ? 'Previous College / 10th percentage is mandatory.'
          : 'Previous school percentage is mandatory.';
      } else {
        const pct = parseFloat(String(formData.previous_percentage));
        if (isNaN(pct) || pct < 0 || pct > 100) {
          errors.previous_percentage = 'Please enter a valid percentage between 0 and 100.';
        }
      }
    }

    if (stepNumber === 2) {
      if (formData.is_academic_enrolled) {
        if (admissionTrack === 'SKILL_ONLY') {
          if (!formData.course_id) {
            errors.curriculum = 'Please select a Universal / Skill Course program to proceed.';
          }
        } else {
          if (!formData.class_id) {
            errors.class_id = 'Please select a target class/grade.';
          }
          if (isSeniorSecondary && !formData.stream_id) {
            errors.stream_id = 'Please select an academic stream for Senior Secondary.';
          }
          const hasCourse = Boolean(formData.course_id);
          const hasSubject = formData.selected_subject_ids.length > 0;
          if (!hasCourse && !hasSubject) {
            errors.curriculum = 'Please select a curriculum course offering or at least one subject.';
          }
        }
      }
    }

    if (stepNumber === 3) {
      if (!formData.is_academic_enrolled && !formData.study_room_plan_id && !formData.hostel_plan_id) {
        errors.service_selection = 'Please select at least one service (Academic Tuition, Study Room, or Hostel).';
      }
      if (formData.study_room_plan_id && !formData.study_seat_id) {
        errors.study_seat_id = 'Please assign an available study desk for the selected plan.';
      }
      if (formData.hostel_plan_id && !formData.hostel_bed_id) {
        errors.hostel_bed_id = 'Please assign an available hostel bed for the selected plan.';
      }
      if (formData.number_of_installments > 1) {
        if (!formData.custom_installments || formData.custom_installments.length !== formData.number_of_installments) {
          errors.installments = 'Please configure installment due dates.';
        } else {
          for (let i = 0; i < formData.custom_installments.length; i++) {
            if (!formData.custom_installments[i].due_date) {
              errors[`installment_date_${i}`] = `Installment #${i + 1} due date is required.`;
              if (!errors.installments) {
                errors.installments = `Please set a valid due date for Installment #${i + 1}.`;
              }
            }
            if (i > 0 && formData.custom_installments[i].due_date && formData.custom_installments[i - 1].due_date) {
              if (formData.custom_installments[i].due_date < formData.custom_installments[i - 1].due_date) {
                errors[`installment_date_${i}`] = `Installment #${i + 1} cannot be earlier than #${i}.`;
                if (!errors.installments) {
                  errors.installments = `Installment #${i + 1} due date cannot be earlier than Installment #${i}.`;
                }
              }
            }
          }
        }
      }
    }

    const isValid = Object.keys(errors).length === 0;

    if (showErrors) {
      setFieldErrors(errors);
      if (!isValid) {
        const firstError = Object.values(errors)[0];
        setError(firstError);
        if (stepNumber === 1) {
          if (errors.first_name || errors.last_name || errors.date_of_birth || errors.gender || errors.mobile || errors.aadhar_number) {
            setActiveCard(1);
          } else if (errors.village || errors.taluka || errors.district) {
            setActiveCard(2);
          } else if (errors.school_college_name || errors.education_board || errors.previous_percentage) {
            setActiveCard(3);
          } else if (errors.guardian_name || errors.guardian_relation || errors.guardian_mobile || errors.guardian_occupation) {
            setActiveCard(4);
          }
        }
      } else {
        setError(null);
      }
    }

    return isValid;
  };

  const canNavigateTo = (targetStep: number): boolean => {
    for (let s = 1; s < targetStep; s++) {
      if (!validateStep(s, false)) return false;
    }
    return true;
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep === step) return;
    if (targetStep < step) {
      setStep(targetStep);
      setError(null);
      return;
    }
    for (let s = 1; s < targetStep; s++) {
      if (!validateStep(s, true)) {
        setStep(s);
        return;
      }
    }
    if (targetStep === 4) {
      fetchFeePreview();
    }
    setStep(targetStep);
  };

  const handleNextStep = () => {
    if (!validateStep(step, true)) {
      return;
    }
    // If facility-only admission, jump straight from Demographics (Step 1) to Facilities (Step 3)
    if (step === 1 && !formData.is_academic_enrolled) {
      setStep(3);
      return;
    }
    if (step === 3) {
      fetchFeePreview();
    }
    setStep((prev) => Math.min(4, prev + 1));
  };

  const handlePrevStep = () => {
    // If facility-only admission, jump straight back from Facilities (Step 3) to Demographics (Step 1)
    if (step === 3 && !formData.is_academic_enrolled) {
      setStep(1);
      return;
    }
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubjectToggle = (subjId: string) => {
    // Core curriculum subjects in the selected course are already included in tuition
    if (coreSubjectIds.has(subjId)) return;
    clearFieldError('curriculum');
    clearFieldError('service_selection');
    setFormData((prev) => {
      const exists = prev.selected_subject_ids.includes(subjId);
      return {
        ...prev,
        selected_subject_ids: exists
          ? prev.selected_subject_ids.filter((id) => id !== subjId)
          : [...prev.selected_subject_ids, subjId]
      };
    });
  };

  const handleCourseSelect = (courseId: string, courseList: any[] = courses) => {
    clearFieldError('curriculum');
    clearFieldError('service_selection');
    const crs = courseList.find((c) => c.id === courseId);
    const crsSubjectIds = new Set((crs?.current_version?.subjects || []).map((s: any) => s.id));
    setFormData((prev) => ({
      ...prev,
      course_id: courseId,
      course_version_id: crs?.current_version?.id || '',
      // Automatically remove any newly-covered core subjects from individual elective selections
      selected_subject_ids: prev.selected_subject_ids.filter((id) => !crsSubjectIds.has(id))
    }));
  };

  const submitAdmission = async () => {
    for (let s = 1; s <= 3; s++) {
      if (!validateStep(s, true)) {
        setStep(s);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        admission_date: formData.admission_date || new Date().toISOString().split('T')[0],
        admission_type: formData.admission_type || 'CONFIRMED',
        form_fee_payment_mode: formData.form_fee_payment_mode || 'CASH',
        form_fee_transaction_ref: formData.form_fee_transaction_ref?.trim() || undefined,
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name?.trim() || undefined,
        last_name: formData.last_name.trim(),
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        mobile: formData.mobile?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        blood_group: formData.blood_group?.trim() || undefined,
        aadhar_number: formData.aadhar_number?.trim() || undefined,
        category: formData.category || undefined,
        village: formData.village?.trim() || undefined,
        taluka: formData.taluka?.trim() || undefined,
        district: formData.district?.trim() || undefined,
        address_line1: formData.village?.trim() ? `${formData.village.trim()}, Tal. ${formData.taluka?.trim() || ''}` : undefined,
        city: formData.district?.trim() || undefined,
        state: 'Maharashtra',
        institution_type: formData.institution_type || 'SCHOOL',
        school_college_name: formData.school_college_name?.trim() || undefined,
        education_board: formData.education_board?.trim() || undefined,
        previous_percentage: formData.previous_percentage !== '' && formData.previous_percentage != null
          ? parseFloat(String(formData.previous_percentage))
          : undefined,
        emergency_contact_name: formData.emergency_contact_name?.trim() || undefined,
        emergency_contact_phone: formData.emergency_contact_phone?.trim() || undefined,
        emergency_contact_relation: formData.emergency_contact_relation?.trim() || undefined,
        guardians: (formData.guardian_name?.trim() && formData.guardian_mobile?.trim()) ? [
          {
            first_name: formData.guardian_name.trim().split(/\s+/)[0],
            last_name: formData.guardian_name.trim().split(/\s+/).slice(1).join(' ') || formData.last_name.trim(),
            relation: formData.guardian_relation || 'FATHER',
            mobile: formData.guardian_mobile.trim(),
            email: formData.guardian_email?.trim() || undefined,
            occupation: formData.guardian_occupation?.trim() || undefined,
            is_primary: true
          }
        ] : [],
        is_academic_enrolled: formData.is_academic_enrolled,
        enrollment_type: formData.enrollment_type,
        academic_year_id: formData.academic_year_id || undefined,
        class_id: formData.class_id || undefined,
        stream_id: formData.stream_id || undefined,
        course_id: formData.course_id || undefined,
        course_version_id: formData.course_version_id || undefined,
        subject_group_id: formData.subject_group_id || undefined,
        selected_subject_ids: formData.selected_subject_ids || [],
        batch_id: formData.batch_id || undefined,
        hostel_plan_id: formData.hostel_plan_id || undefined,
        hostel_bed_id: formData.hostel_bed_id || undefined,
        hostel_months: formData.hostel_plan_id ? (Number(formData.hostel_months) || 1) : undefined,
        hostel_monthly_charge: formData.hostel_plan_id && formData.hostel_monthly_charge ? Number(formData.hostel_monthly_charge) : undefined,
        study_room_plan_id: formData.study_room_plan_id || undefined,
        study_seat_id: formData.study_seat_id || undefined,
        study_room_months: formData.study_room_plan_id ? (Number(formData.study_room_months) || 1) : undefined,
        study_room_monthly_charge: formData.study_room_plan_id && formData.study_room_monthly_charge ? Number(formData.study_room_monthly_charge) : undefined,
        discount_amount: formData.discount_amount || 0,
        number_of_installments: formData.number_of_installments || 1,
        custom_installments: formData.number_of_installments > 1 && formData.custom_installments?.length === formData.number_of_installments
          ? formData.custom_installments.map((c) => ({
              installment_number: c.installment_number,
              due_date: c.due_date,
              amount: isAdmin && customAmountsEnabled && c.amount ? Number(c.amount) : undefined
            }))
          : undefined
      };

      const res = await api.post('/enrollments/admit', payload);
      setAdmissionSuccessData({
        ...res.data,
        student_name: `${formData.first_name} ${formData.last_name}`,
        course_name: selectedCourse?.name || 'Academic Program',
        is_trial: res.data.is_trial,
        trial_end_date: res.data.trial_end_date,
        trial_receipt_number: res.data.trial_receipt_number
      });
    } catch (err: any) {
      const rawDetail = err.response?.data?.detail;
      let errorMsg = 'Admission processing failed';
      if (typeof rawDetail === 'string') {
        errorMsg = rawDetail;
      } else if (Array.isArray(rawDetail)) {
        errorMsg = rawDetail.map((d: any) => `${d.loc ? d.loc.slice(1).join('.') + ': ' : ''}${d.msg}`).join('; ');
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (admissionSuccessData) {
    return (
      <div className="space-y-6 w-full max-w-3xl mx-auto py-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10 text-center relative overflow-hidden">
          {/* Top celebratory radial gradient */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold mx-auto mb-4 shadow-xl shadow-emerald-500/25">
            <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11" />
          </div>

          {admissionSuccessData.is_trial ? (
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 uppercase tracking-wider mb-2">
              ⏳ Provisional Trial Enrollment
            </span>
          ) : (
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider mb-2">
              Enrollment Confirmed
            </span>
          )}

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {admissionSuccessData.is_trial ? 'Provisional Trial Admitted Successfully!' : 'Student Admitted Successfully!'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-lg mx-auto">
            {admissionSuccessData.is_trial
              ? `Student is provisionally enrolled for a ${institute?.trial_period_days || 14}-day trial period. Form fee receipt has been issued and student is rostered for lectures.`
              : 'All curriculum bundles, residential accommodations, and fee installment schedules have been provisioned in real time.'}
          </p>

          {/* Key Particulars Summary Card */}
          <div className="my-6 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-left grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Student Name</span>
              <strong className="text-slate-900 text-sm font-bold block">{admissionSuccessData.student_name}</strong>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Permanent Reg. (PRN)</span>
              <strong className="text-purple-700 font-mono text-xs font-extrabold block">
                {admissionSuccessData.prn || 'Assigned'}
              </strong>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Student Code</span>
              <strong className="text-slate-900 font-mono text-xs font-bold block">{admissionSuccessData.student_code}</strong>
            </div>

            {admissionSuccessData.is_trial ? (
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Form Fee Receipt</span>
                <strong className="text-emerald-700 font-mono text-xs font-bold block">
                  {admissionSuccessData.trial_receipt_number || 'REC-FORM-PAID'}
                </strong>
              </div>
            ) : (
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Initial Tax Invoice</span>
                <strong className="text-slate-900 font-mono text-xs font-bold block">
                  {admissionSuccessData.invoice_number || 'Generated'}
                </strong>
              </div>
            )}

            {admissionSuccessData.is_trial && (
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Trial Valid Until</span>
                <strong className="text-amber-700 font-bold block">
                  {admissionSuccessData.trial_end_date || 'In 14 Days'}
                </strong>
              </div>
            )}

            {admissionSuccessData.bed_allocated && (
              <div className="col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Hostel Bed</span>
                <strong className="text-emerald-700 font-bold block">Bed #{admissionSuccessData.bed_allocated}</strong>
              </div>
            )}

            {admissionSuccessData.seat_allocated && (
              <div className="col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Study Room Desk</span>
                <strong className="text-blue-700 font-bold block">Desk #{admissionSuccessData.seat_allocated}</strong>
              </div>
            )}
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
              <button
                type="button"
                onClick={() => setShowAdmissionFormModal(true)}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/25 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Detailed Admission Form</span>
              </button>

              {admissionSuccessData.invoice_id ? (
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(true)}
                  className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/25 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Print Tax Invoice</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(`/students/${admissionSuccessData.student_id}`)}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span>View Student Profile</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate(`/students/${admissionSuccessData.student_id}`)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Go to Student Profile</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setAdmissionSuccessData(null);
                  setStep(1);
                  setFormData(initialFormData);
                }}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Enroll Another Student</span>
              </button>
            </div>
          </div>
        </div>

        {/* Admission Form Modal */}
        {admissionSuccessData.student_id && (
          <StudentAdmissionFormModal
            isOpen={showAdmissionFormModal}
            studentId={admissionSuccessData.student_id}
            onClose={() => setShowAdmissionFormModal(false)}
          />
        )}

        {/* Invoice Modal */}
        {admissionSuccessData.invoice_id && (
          <InvoiceDetailModal
            isOpen={showInvoiceModal}
            invoiceId={admissionSuccessData.invoice_id}
            onClose={() => setShowInvoiceModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Wizard Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20 shrink-0">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Student Admission Wizard</h2>
              <p className="text-xs text-slate-500 mt-0.5">Automated multi-service enrollment, curriculum bundle mapping &amp; real-time fee schedules.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              Academic Year 2026–2027
            </span>
          </div>
        </div>

        {/* Interactive Step Stepper Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mt-4 sm:mt-6 pt-4 sm:pt-5 border-t border-slate-100">
          {[
            { num: 1, label: 'Student & Guardian', desc: 'Demographics & parent info', icon: User },
            {
              num: 2,
              label: admissionTrack === 'SKILL_ONLY' ? 'Skill Program' : 'Academic Program',
              desc: !formData.is_academic_enrolled
                ? 'Skipped (Facility Only)'
                : admissionTrack === 'SKILL_ONLY'
                ? 'Universal skill course selection'
                : 'Target grade, stream & subjects',
              icon: admissionTrack === 'SKILL_ONLY' ? Sparkles : GraduationCap,
              isSkipped: !formData.is_academic_enrolled
            },
            { num: 3, label: 'Facilities & Services', desc: 'Hostel bed, study desk & plan', icon: Armchair },
            { num: 4, label: 'Fee Preview & Confirm', desc: 'Invoice audit & generation', icon: DollarSign }
          ].map((s) => {
            const Icon = s.icon;
            const isCurrent = step === s.num;
            const isCompleted = step > s.num && validateStep(s.num, false);
            const isAccessible = s.num <= step || canNavigateTo(s.num);

            return (
              <div
                key={s.num}
                onClick={() => handleStepClick(s.num)}
                className={`p-2.5 sm:p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border-emerald-300 shadow-xs ring-1 ring-emerald-400/20'
                    : isCompleted
                    ? 'bg-slate-50/70 border-slate-200 cursor-pointer hover:bg-slate-100/70'
                    : s.isSkipped
                    ? 'bg-purple-50/30 border-purple-200/60 cursor-pointer hover:bg-purple-50/50'
                    : isAccessible
                    ? 'bg-white border-slate-200 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/20'
                    : 'bg-slate-50/40 border-slate-200/60 opacity-60 cursor-pointer hover:opacity-80'
                }`}
                title={!isAccessible ? `Complete Step ${s.num - 1} required fields first` : undefined}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition ${
                      isCurrent
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : s.isSkipped
                        ? 'bg-purple-100 text-purple-700'
                        : isAccessible
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    ) : s.isSkipped ? (
                      <Armchair className="w-4 h-4 text-purple-700" />
                    ) : isAccessible ? (
                      <Icon className="w-4 h-4" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <p className={`text-xs font-bold truncate ${isCurrent ? 'text-emerald-950' : isCompleted ? 'text-slate-800' : isAccessible ? 'text-slate-700' : 'text-slate-400'}`}>
                        {s.num}. {s.label}
                      </p>
                      {s.isSkipped ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold border border-purple-200">Bypassed</span>
                      ) : !isAccessible ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-normal">Locked</span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate hidden sm:block mt-0.5">
                      {s.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Wizard Step 1: Personal, Address, Education & Guardian Details */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Admission Mode / Enrollment Track */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-extrabold text-slate-900 flex items-center space-x-2 tracking-wide uppercase">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Admission Mode / Enrollment Track</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Select whether the student is joining for classroom academic courses, skill masterclasses, or strictly campus facilities.
                </p>
              </div>
              <span className={`text-[10px] font-bold px-3 py-1 rounded-full self-start sm:self-auto uppercase tracking-wider ${
                admissionTrack === 'REGULAR'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : admissionTrack === 'SKILL_ONLY'
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : 'bg-purple-100 text-purple-800 border border-purple-200'
              }`}>
                {admissionTrack === 'REGULAR' ? '🎓 Full Coaching Track' : admissionTrack === 'SKILL_ONLY' ? '🌟 Skill Program Track' : '🏛️ Facility-Only Track'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              {/* Option A: Full Academic Admission */}
              <button
                type="button"
                onClick={() => {
                  setAdmissionTrack('REGULAR');
                  setFormData({ ...formData, is_academic_enrolled: true });
                  clearFieldError('class_id');
                  clearFieldError('stream_id');
                  clearFieldError('curriculum');
                  clearFieldError('service_selection');
                }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  admissionTrack === 'REGULAR'
                    ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-300 bg-white hover:border-slate-400 text-slate-600 hover:shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      admissionTrack === 'REGULAR' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Full Coaching Admission</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Grade-specific batches (5th to 12th), tests &amp; attendance + optional Hostel / Study Room.
                      </p>
                      <span className="inline-block mt-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Class Curriculum + Facilities
                      </span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="admission_track"
                    checked={admissionTrack === 'REGULAR'}
                    onChange={() => {}}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </button>

              {/* Option B: Skill / Universal Program (Open to All Grades) */}
              <button
                type="button"
                onClick={() => {
                  setAdmissionTrack('SKILL_ONLY');
                  setFormData({
                    ...formData,
                    is_academic_enrolled: true,
                    class_id: '',
                    stream_id: '',
                    course_id: '',
                    course_version_id: '',
                    subject_group_id: '',
                    selected_subject_ids: []
                  });
                  clearFieldError('class_id');
                  clearFieldError('stream_id');
                  clearFieldError('curriculum');
                  clearFieldError('service_selection');
                }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  admissionTrack === 'SKILL_ONLY'
                    ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-300 bg-white hover:border-slate-400 text-slate-600 hover:shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      admissionTrack === 'SKILL_ONLY' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Skill / Universal Program</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Spoken English, Vedic Maths, Coding. Open to all students with no grade restrictions.
                      </p>
                      <span className="inline-block mt-2 text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        Grade Independent • Skill Only
                      </span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="admission_track"
                    checked={admissionTrack === 'SKILL_ONLY'}
                    onChange={() => {}}
                    className="mt-1 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </button>

              {/* Option C: Facility Only (Hostel & Study Hall) */}
              <button
                type="button"
                onClick={() => {
                  setAdmissionTrack('FACILITY_ONLY');
                  setFormData({
                    ...formData,
                    is_academic_enrolled: false,
                    class_id: '',
                    stream_id: '',
                    course_id: '',
                    course_version_id: '',
                    subject_group_id: '',
                    selected_subject_ids: []
                  });
                  clearFieldError('class_id');
                  clearFieldError('stream_id');
                  clearFieldError('curriculum');
                  clearFieldError('service_selection');
                }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  admissionTrack === 'FACILITY_ONLY'
                    ? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-500/20 shadow-xs'
                    : 'border-slate-300 bg-white hover:border-slate-400 text-slate-600 hover:shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      admissionTrack === 'FACILITY_ONLY' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Armchair className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Facility-Only Admission</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Study Room Desk and/or Hostel Bed strictly. No coaching classes, batches, or tuition fees billed.
                      </p>
                      <span className="inline-block mt-2 text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        ₹0 Tuition • Only Facilities Billed
                      </span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="admission_track"
                    checked={admissionTrack === 'FACILITY_ONLY'}
                    onChange={() => {}}
                    className="mt-1 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </div>
              </button>
            </div>

            {/* Admission Confirmation Track: Provisional Trial vs Confirmed Admission */}
            {formData.is_academic_enrolled && (institute?.enable_trial_admission ?? true) && (
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Admission Confirmation Stage (Learning Courses)</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Institute Trial Setting: <strong className="text-slate-800 font-semibold">{institute?.trial_period_days || 14} Days</strong> • One-Time Form Fee: <strong className="text-emerald-700 font-semibold">₹{institute?.admission_form_fee || 200}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Option 1: Confirmed Full Admission */}
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, admission_type: 'CONFIRMED' }))}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      formData.admission_type === 'CONFIRMED'
                        ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-300 bg-white hover:border-slate-400 text-slate-600 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          formData.admission_type === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Direct Confirmed Admission</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Full enrollment with complete curriculum tuition billing, itemized registration form fee (₹{institute?.admission_form_fee || 200}), and EMI installment schedule.
                          </p>
                          <span className="inline-block mt-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Tuition Invoiced • Permanent Roster
                          </span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="admission_type"
                        checked={formData.admission_type === 'CONFIRMED'}
                        onChange={() => {}}
                        className="mt-1 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                  </button>

                  {/* Option 2: Provisional Trial Admission */}
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, admission_type: 'PROVISIONAL_TRIAL' }))}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      formData.admission_type === 'PROVISIONAL_TRIAL'
                        ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20 shadow-xs'
                        : 'border-slate-300 bg-white hover:border-slate-400 text-slate-600 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          formData.admission_type === 'PROVISIONAL_TRIAL' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-900">Provisional Trial Admission</p>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded">
                              {institute?.trial_period_days || 14} Days Trial
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Collects ONLY the non-refundable Form Fee (₹{institute?.admission_form_fee || 200}) today. Zero tuition debt. Student attends classes for 1–2 weeks before paying course fees.
                          </p>
                          <span className="inline-block mt-2 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            ₹0 Tuition Debt • Receipt Issued Immediately
                          </span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="admission_type"
                        checked={formData.admission_type === 'PROVISIONAL_TRIAL'}
                        onChange={() => {}}
                        className="mt-1 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 1: Student Demographics & Identification */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-sm transition-all overflow-hidden">
            {/* Header Banner */}
            <div
              onClick={() => setActiveCard((prev) => (prev === 1 ? 0 : 1))}
              className="px-6 py-4 bg-gradient-to-r from-slate-50 via-white to-indigo-50/40 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2 cursor-pointer select-none hover:bg-slate-50/90 transition"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shadow-2xs border border-indigo-200 shrink-0">
                  01
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>Student Demographics &amp; Identification</span>
                  </h3>
                  {activeCard === 1 ? (
                    <p className="text-[11px] text-slate-500">Official student name, birth date, gender, and contact identification</p>
                  ) : (
                    <p className="text-[11px] font-semibold text-slate-700 truncate max-w-md sm:max-w-xl">
                      {formData.first_name && formData.last_name && formData.date_of_birth && formData.gender && formData.aadhar_number && formData.mobile ? (
                        <span>
                          {formData.first_name} {formData.middle_name ? formData.middle_name + ' ' : ''}{formData.last_name} • {formData.gender === 'FEMALE' ? 'Female (Girls)' : formData.gender === 'MALE' ? 'Male (Boys)' : 'Other'} • DOB: {formData.date_of_birth} • {formData.mobile}
                        </span>
                      ) : (
                        <span className="text-rose-500 font-semibold italic">
                          Mandatory: Name, DOB, Gender, Aadhar &amp; Mobile required
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {formData.first_name?.trim() && formData.last_name?.trim() && formData.date_of_birth && formData.gender && formData.aadhar_number?.trim() && formData.mobile?.trim() ? (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Recorded</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                    Required
                  </span>
                )}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600 transition-transform duration-200 ${activeCard === 1 ? 'rotate-180 bg-indigo-100 text-indigo-700' : ''}`}>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {activeCard === 1 && (
              <div className="p-6 sm:p-7 space-y-6">
                {/* Row 1: Full Name */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                    1.1 Legal Full Name (As Per Aadhar / School Leaving Certificate)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        First Name <span className="text-rose-500 font-extrabold">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={formData.first_name}
                          onChange={(e) => {
                            setFormData({ ...formData, first_name: e.target.value });
                            clearFieldError('first_name');
                          }}
                          placeholder="e.g. Harshvardhan"
                          className={getInputClass('first_name', 'pl-9')}
                        />
                      </div>
                      {fieldErrors.first_name && (
                        <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.first_name}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Middle Name</label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={formData.middle_name}
                          onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                          placeholder="e.g. Vijay"
                          className={getInputClass('middle_name', 'pl-9')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Last Name <span className="text-rose-500 font-extrabold">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={formData.last_name}
                          onChange={(e) => {
                            setFormData({ ...formData, last_name: e.target.value });
                            clearFieldError('last_name');
                          }}
                          placeholder="e.g. Patil"
                          className={getInputClass('last_name', 'pl-9')}
                        />
                      </div>
                      {fieldErrors.last_name && (
                        <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.last_name}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Personal Attributes */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                    1.2 Personal Attributes &amp; Background
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Gender <span className="text-rose-500 font-extrabold">*</span>
                      </label>
                      <select
                        value={formData.gender}
                        onChange={(e) => {
                          setFormData({ ...formData, gender: e.target.value, study_seat_id: '', hostel_bed_id: '' });
                          clearFieldError('gender');
                          clearFieldError('study_seat_id');
                          clearFieldError('hostel_bed_id');
                        }}
                        className={getSelectClass('gender')}
                      >
                        <option value="MALE">Male (Boys)</option>
                        <option value="FEMALE">Female (Girls)</option>
                        <option value="OTHER">Other</option>
                      </select>
                      {fieldErrors.gender && (
                        <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.gender}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Date of Birth <span className="text-rose-500 font-extrabold">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.date_of_birth}
                        onChange={(e) => {
                          setFormData({ ...formData, date_of_birth: e.target.value });
                          clearFieldError('date_of_birth');
                        }}
                        className={getInputClass('date_of_birth')}
                      />
                      {fieldErrors.date_of_birth && (
                        <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.date_of_birth}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Admission Date <span className="text-rose-500 font-extrabold">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.admission_date}
                        onChange={(e) => {
                          handleAdmissionDateChange(e.target.value);
                          clearFieldError('admission_date');
                        }}
                        className={getInputClass('admission_date')}
                      />
                      <p className="text-[10px] text-slate-400 mt-1">EMIs &amp; trial anchor here</p>
                      {fieldErrors.admission_date && (
                        <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.admission_date}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Blood Group</label>
                      <select
                        value={formData.blood_group}
                        onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                        className={getSelectClass('blood_group')}
                      >
                        <option value="">Not Specified</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Social Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className={getSelectClass('category')}
                      >
                        <option value="GENERAL">General</option>
                        <option value="OBC">OBC</option>
                        <option value="SC">SC</option>
                        <option value="ST">ST</option>
                        <option value="EWS">EWS</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 3: Direct Identification & Contact */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                    1.3 Identification &amp; Direct Student Contact
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <span>Aadhar / National ID (12 Digits)</span>
                        <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <ShieldCheck className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          maxLength={14}
                          value={formData.aadhar_number}
                          onChange={(e) => {
                            setFormData({ ...formData, aadhar_number: e.target.value });
                            clearFieldError('aadhar_number');
                          }}
                          placeholder="5432-8765-1098"
                          className={getInputClass('aadhar_number', 'pl-9 font-mono')}
                        />
                      </div>
                      {fieldErrors.aadhar_number && (
                        <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.aadhar_number}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <span>Student Mobile Phone</span>
                        <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="tel"
                          value={formData.mobile}
                          onChange={(e) => {
                            setFormData({ ...formData, mobile: e.target.value });
                            clearFieldError('mobile');
                          }}
                          placeholder="+91 98765 43210"
                          className={getInputClass('mobile', 'pl-9 font-mono')}
                        />
                      </div>
                      {fieldErrors.mobile && (
                        <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.mobile}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Student Email Address</label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="student@example.com"
                          className={getInputClass('email', 'pl-9')}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-slate-400 font-medium italic">Demographics completed • Proceed to address location</span>
                  <button
                    type="button"
                    onClick={() => {
                      const c1Err: Record<string, string> = {};
                      if (!formData.first_name.trim()) c1Err.first_name = 'First name is required.';
                      if (!formData.last_name.trim()) c1Err.last_name = 'Last name is required.';
                      if (!formData.date_of_birth) c1Err.date_of_birth = 'Date of birth is required.';
                      if (!formData.gender) c1Err.gender = 'Gender is required.';
                      if (!formData.aadhar_number?.trim()) {
                        c1Err.aadhar_number = 'Aadhar / National ID (12 digits) is mandatory.';
                      } else if (formData.aadhar_number.replace(/\D/g, '').length !== 12) {
                        c1Err.aadhar_number = 'Aadhar number must be exactly 12 digits.';
                      }
                      if (!formData.mobile?.trim()) {
                        c1Err.mobile = 'Student mobile phone is mandatory.';
                      } else if (formData.mobile.replace(/\D/g, '').length < 10) {
                        c1Err.mobile = 'Mobile number must be at least 10 digits.';
                      }
                      if (Object.keys(c1Err).length > 0) {
                        setFieldErrors((prev) => ({ ...prev, ...c1Err }));
                        setError(Object.values(c1Err)[0]);
                        return;
                      }
                      setActiveCard(2);
                    }}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <span>Next: Residential Address (Card 2)</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Residential Address */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-sm transition-all overflow-hidden">
            {/* Header Banner */}
            <div
              onClick={() => setActiveCard((prev) => (prev === 2 ? 0 : 2))}
              className="px-6 py-4 bg-gradient-to-r from-slate-50 via-white to-teal-50/40 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2 cursor-pointer select-none hover:bg-slate-50/90 transition"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 font-extrabold text-xs flex items-center justify-center shadow-2xs border border-teal-200 shrink-0">
                  02
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    <span>Residential Address &amp; Location</span>
                  </h3>
                  {activeCard === 2 ? (
                    <p className="text-[11px] text-slate-500">Permanent communication address for correspondence and campus records</p>
                  ) : (
                    <p className="text-[11px] font-semibold text-slate-700 truncate max-w-md sm:max-w-xl">
                      {formData.village && formData.taluka && formData.district ? (
                        <span>
                          {formData.village}, Tal. {formData.taluka}, Dist. {formData.district}
                        </span>
                      ) : (
                        <span className="text-rose-500 font-semibold italic flex items-center gap-1">
                          <span>Mandatory: Village, Taluka &amp; District required</span>
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {formData.village?.trim() && formData.taluka?.trim() && formData.district?.trim() ? (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Recorded</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                    Required
                  </span>
                )}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600 transition-transform duration-200 ${activeCard === 2 ? 'rotate-180 bg-teal-100 text-teal-700' : ''}`}>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {activeCard === 2 && (
              <div className="p-6 sm:p-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <Home className="w-3.5 h-3.5 text-teal-600" />
                      <span>Village / Town (गाव)</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.village}
                      onChange={(e) => {
                        setFormData({ ...formData, village: e.target.value });
                        if (fieldErrors.village) setFieldErrors((prev) => ({ ...prev, village: '' }));
                      }}
                      placeholder="e.g. Kuditre"
                      className={getInputClass('village')}
                    />
                    {fieldErrors.village && (
                      <p className="mt-1 text-[11px] text-rose-600 font-semibold">{fieldErrors.village}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-teal-600" />
                      <span>Taluka (तालुका)</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.taluka}
                      onChange={(e) => {
                        setFormData({ ...formData, taluka: e.target.value });
                        if (fieldErrors.taluka) setFieldErrors((prev) => ({ ...prev, taluka: '' }));
                      }}
                      placeholder="e.g. Karveer"
                      className={getInputClass('taluka')}
                    />
                    {fieldErrors.taluka && (
                      <p className="mt-1 text-[11px] text-rose-600 font-semibold">{fieldErrors.taluka}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-teal-600" />
                      <span>District (जिल्हा)</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.district}
                      onChange={(e) => {
                        setFormData({ ...formData, district: e.target.value });
                        if (fieldErrors.district) setFieldErrors((prev) => ({ ...prev, district: '' }));
                      }}
                      placeholder="e.g. Kolhapur / Sangli"
                      className={getInputClass('district')}
                    />
                    {fieldErrors.district && (
                      <p className="mt-1 text-[11px] text-rose-600 font-semibold">{fieldErrors.district}</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCard(1)}
                    className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back to Demographics (Card 1)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const vErr: Record<string, string> = {};
                      if (!formData.village?.trim()) vErr.village = 'Village / Town (गाव) is mandatory.';
                      if (!formData.taluka?.trim()) vErr.taluka = 'Taluka (तालुका) is mandatory.';
                      if (!formData.district?.trim()) vErr.district = 'District (जिल्हा) is mandatory.';
                      if (Object.keys(vErr).length > 0) {
                        setFieldErrors((prev) => ({ ...prev, ...vErr }));
                        setError(Object.values(vErr)[0]);
                        return;
                      }
                      setActiveCard(3);
                    }}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <span>Next: School / College (Card 3)</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Current Regular Education (School vs. Junior College) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-sm transition-all overflow-hidden">
            {/* Header Banner */}
            <div
              onClick={() => setActiveCard((prev) => (prev === 3 ? 0 : 3))}
              className="px-6 py-4 bg-gradient-to-r from-slate-50 via-white to-purple-50/40 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-3 cursor-pointer select-none hover:bg-slate-50/90 transition"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-extrabold text-xs flex items-center justify-center shadow-2xs border border-purple-200 shrink-0">
                  03
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <School className="w-4 h-4 text-purple-600" />
                    <span>Current Regular Education ({formData.institution_type === 'COLLEGE' ? 'Junior College' : 'School'})</span>
                  </h3>
                  {activeCard === 3 ? (
                    <p className="text-[11px] text-slate-500">Helps allocate morning vs evening coaching batches around regular school shifts</p>
                  ) : (
                    <p className="text-[11px] font-semibold text-slate-700 truncate max-w-md sm:max-w-xl">
                      {formData.school_college_name && formData.previous_percentage ? (
                        <span>{formData.school_college_name} • {formData.education_board} • {formData.previous_percentage}%</span>
                      ) : (
                        <span className="text-rose-500 font-semibold italic">
                          Mandatory: {formData.institution_type === 'COLLEGE' ? 'Junior College' : 'School'}, Board &amp; Percentage required
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {formData.school_college_name?.trim() && formData.education_board && formData.previous_percentage !== '' ? (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Recorded</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                    Required
                  </span>
                )}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600 transition-transform duration-200 ${activeCard === 3 ? 'rotate-180 bg-purple-100 text-purple-700' : ''}`}>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {activeCard === 3 && (
              <div className="p-6 sm:p-7 space-y-4">
                {/* Education Level Switcher */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-700">Education Standard Track:</span>
                  <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs border border-slate-200/80 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, institution_type: 'SCHOOL' })}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                        formData.institution_type === 'SCHOOL'
                          ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      School (5th – 10th)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, institution_type: 'COLLEGE' })}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                        formData.institution_type === 'COLLEGE'
                          ? 'bg-white text-purple-700 shadow-xs border border-purple-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Junior College (11th – 12th)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <span>{formData.institution_type === 'COLLEGE' ? 'Current Junior College Name' : 'Current School Name'}</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <School className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={formData.school_college_name}
                        onChange={(e) => {
                          setFormData({ ...formData, school_college_name: e.target.value });
                          clearFieldError('school_college_name');
                        }}
                        placeholder={
                          formData.institution_type === 'COLLEGE'
                            ? 'e.g. Fergusson College / Modern College, Pune'
                            : 'e.g. St. Vincent High School, Pune'
                        }
                        className={getInputClass('school_college_name', 'pl-9')}
                      />
                    </div>
                    {fieldErrors.school_college_name && (
                      <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{fieldErrors.school_college_name}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <span>Education Board / Affiliation</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <select
                      value={formData.education_board}
                      onChange={(e) => {
                        setFormData({ ...formData, education_board: e.target.value });
                        clearFieldError('education_board');
                      }}
                      className={getSelectClass('education_board')}
                    >
                      <option value="STATE_BOARD">Maharashtra State Board (SSC/HSC)</option>
                      <option value="CBSE">CBSE (Central Board)</option>
                      <option value="ICSE">ICSE / ISC</option>
                      <option value="IB_IGCSE">IB / Cambridge IGCSE</option>
                      <option value="OTHER">Other Board</option>
                    </select>
                    {fieldErrors.education_board && (
                      <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{fieldErrors.education_board}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <span>
                        {formData.institution_type === 'COLLEGE'
                          ? 'Previous College / 10th Percentage (%)'
                          : 'Previous School Percentage (%)'}
                      </span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <Percent className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.previous_percentage}
                        onChange={(e) => {
                          setFormData({ ...formData, previous_percentage: e.target.value });
                          clearFieldError('previous_percentage');
                        }}
                        placeholder="e.g. 85.50"
                        className={getInputClass('previous_percentage', 'pl-9 font-mono')}
                      />
                    </div>
                    {fieldErrors.previous_percentage && (
                      <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{fieldErrors.previous_percentage}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center space-x-2 text-[11px] text-purple-800">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>Captured to verify previous academic record and synchronize coaching batch shifts with regular school/college hours.</span>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCard(2)}
                    className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back to Address (Card 2)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const c3Err: Record<string, string> = {};
                      if (!formData.school_college_name?.trim()) {
                        c3Err.school_college_name = formData.institution_type === 'COLLEGE'
                          ? 'Junior College name is mandatory.'
                          : 'School name is mandatory.';
                      }
                      if (!formData.education_board?.trim()) {
                        c3Err.education_board = 'Education board / affiliation is mandatory.';
                      }
                      if (formData.previous_percentage === '' || formData.previous_percentage === undefined || formData.previous_percentage === null) {
                        c3Err.previous_percentage = formData.institution_type === 'COLLEGE'
                          ? 'Previous College / 10th percentage is mandatory.'
                          : 'Previous school percentage is mandatory.';
                      } else {
                        const pct = parseFloat(String(formData.previous_percentage));
                        if (isNaN(pct) || pct < 0 || pct > 100) {
                          c3Err.previous_percentage = 'Please enter a valid percentage between 0 and 100.';
                        }
                      }
                      if (Object.keys(c3Err).length > 0) {
                        setFieldErrors((prev) => ({ ...prev, ...c3Err }));
                        setError(Object.values(c3Err)[0]);
                        return;
                      }
                      setActiveCard(4);
                    }}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <span>Next: Parent &amp; Guardian (Card 4)</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 4: Parent / Guardian & Emergency Contact */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-sm transition-all overflow-hidden">
            {/* Header Banner */}
            <div
              onClick={() => setActiveCard((prev) => (prev === 4 ? 0 : 4))}
              className="px-6 py-4 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2 cursor-pointer select-none hover:bg-slate-50/90 transition"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-extrabold text-xs flex items-center justify-center shadow-2xs border border-blue-200 shrink-0">
                  04
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Parent / Guardian &amp; Emergency Contact</span>
                  </h3>
                  {activeCard === 4 ? (
                    <p className="text-[11px] text-slate-500">
                      {isFacilityOnlyTrack
                        ? 'Optional for Facility-Only admission • Primary fee billing sponsor and emergency contact'
                        : 'Primary fee billing sponsor and emergency contact for attendance & medical alerts'}
                    </p>
                  ) : (
                    <p className="text-[11px] font-semibold text-slate-700 truncate max-w-md sm:max-w-xl">
                      {formData.guardian_name && formData.guardian_mobile ? (
                        <span>
                          {formData.guardian_name} ({formData.guardian_relation || 'Guardian'}) • {formData.guardian_mobile}
                          {formData.guardian_occupation ? ` • ${formData.guardian_occupation}` : ''}
                        </span>
                      ) : isFacilityOnlyTrack ? (
                        <span className="text-slate-500 font-medium italic">
                          Optional (Guardian details can be provided or left blank)
                        </span>
                      ) : (
                        <span className="text-rose-500 font-semibold italic">
                          Mandatory: Guardian Name, Relationship, Mobile &amp; Occupation required
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {formData.guardian_name?.trim() && formData.guardian_mobile?.trim() ? (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Recorded</span>
                  </span>
                ) : isFacilityOnlyTrack ? (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
                    Optional
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                    Required
                  </span>
                )}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600 transition-transform duration-200 ${activeCard === 4 ? 'rotate-180 bg-blue-100 text-blue-700' : ''}`}>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {activeCard === 4 && (
              <div className="p-6 sm:p-7 space-y-6">
                {/* Subsection A: Primary Parent/Guardian */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                    {isFacilityOnlyTrack
                      ? '4.1 Parent / Guardian Details (Optional for Facility-Only Admission)'
                      : '4.1 Primary Parent / Guardian Details (Fee & Academic Updates)'}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <span>Guardian Full Name</span>
                        {isFacilityOnlyTrack ? (
                          <span className="text-slate-400 font-normal">(Optional)</span>
                        ) : (
                          <span className="text-rose-500 font-bold">*</span>
                        )}
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={formData.guardian_name}
                          onChange={(e) => {
                            setFormData({ ...formData, guardian_name: e.target.value });
                            clearFieldError('guardian_name');
                          }}
                          placeholder="e.g. Vikram Sharma"
                          className={getInputClass('guardian_name', 'pl-9')}
                        />
                      </div>
                      {fieldErrors.guardian_name && (
                        <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.guardian_name}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <span>Relationship to Student</span>
                        {isFacilityOnlyTrack ? (
                          <span className="text-slate-400 font-normal">(Optional)</span>
                        ) : (
                          <span className="text-rose-500 font-bold">*</span>
                        )}
                      </label>
                      <select
                        value={formData.guardian_relation}
                        onChange={(e) => {
                          setFormData({ ...formData, guardian_relation: e.target.value });
                          clearFieldError('guardian_relation');
                        }}
                        className={getSelectClass('guardian_relation')}
                      >
                        <option value="FATHER">Father</option>
                        <option value="MOTHER">Mother</option>
                        <option value="LEGAL_GUARDIAN">Legal Guardian</option>
                        <option value="OTHER">Other</option>
                      </select>
                      {fieldErrors.guardian_relation && (
                        <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.guardian_relation}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <span>Guardian Mobile Phone</span>
                        {isFacilityOnlyTrack ? (
                          <span className="text-slate-400 font-normal">(Optional)</span>
                        ) : (
                          <span className="text-rose-500 font-bold">*</span>
                        )}
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="tel"
                          value={formData.guardian_mobile}
                          onChange={(e) => {
                            setFormData({ ...formData, guardian_mobile: e.target.value });
                            clearFieldError('guardian_mobile');
                          }}
                          placeholder="+91 99887 76655"
                          className={getInputClass('guardian_mobile', 'pl-9 font-mono')}
                        />
                      </div>
                      {fieldErrors.guardian_mobile && (
                        <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.guardian_mobile}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <span>Guardian Email Address</span>
                        <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="email"
                          value={formData.guardian_email}
                          onChange={(e) => setFormData({ ...formData, guardian_email: e.target.value })}
                          placeholder="guardian@example.com"
                          className={getInputClass('guardian_email', 'pl-9')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <span>Guardian Occupation / Profession</span>
                        {isFacilityOnlyTrack ? (
                          <span className="text-slate-400 font-normal">(Optional)</span>
                        ) : (
                          <span className="text-rose-500 font-bold">*</span>
                        )}
                      </label>
                      <div className="relative">
                        <Building2 className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={formData.guardian_occupation}
                          onChange={(e) => {
                            setFormData({ ...formData, guardian_occupation: e.target.value });
                            clearFieldError('guardian_occupation');
                          }}
                          placeholder="e.g. Business / Civil Engineer / Teacher"
                          className={getInputClass('guardian_occupation', 'pl-9')}
                        />
                      </div>
                      {fieldErrors.guardian_occupation && (
                        <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.guardian_occupation}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subsection B: Emergency SOS Contact */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/70 via-amber-50/40 to-orange-50/30 border border-amber-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                    <span className="text-xs font-bold text-amber-950 flex items-center space-x-2">
                      <HeartHandshake className="w-4 h-4 text-amber-600" />
                      <span>4.2 Secondary Emergency SOS Contact</span>
                    </span>
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                      Medical &amp; Urgent Alerts • Optional
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <span>Emergency Contact Person</span>
                        <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={formData.emergency_contact_name}
                          onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                          placeholder="Emergency contact person"
                          className={getInputClass('emergency_contact_name', 'pl-9 bg-white')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <span>Emergency Phone</span>
                        <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="tel"
                          value={formData.emergency_contact_phone}
                          onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                          placeholder="+91 ..."
                          className={getInputClass('emergency_contact_phone', 'pl-9 bg-white font-mono')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <span>Emergency Relationship</span>
                        <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.emergency_contact_relation}
                        onChange={(e) => setFormData({ ...formData, emergency_contact_relation: e.target.value })}
                        placeholder="e.g. Uncle / Aunt / Neighbor"
                        className={getInputClass('emergency_contact_relation', 'bg-white')}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCard(3)}
                    className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back to School / College (Card 3)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <span>Proceed to Academic Selection (Step 2)</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wizard Step 2: Academic Program & Course Bundles */}
      {step === 2 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Step 2: Academic Program Selection</h3>
            <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_academic_enrolled}
                onChange={(e) => {
                  setFormData({ ...formData, is_academic_enrolled: e.target.checked });
                  clearFieldError('class_id');
                  clearFieldError('stream_id');
                  clearFieldError('curriculum');
                  clearFieldError('service_selection');
                }}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-semibold">Enroll in Academic Tuition</span>
            </label>
          </div>

          {!formData.is_academic_enrolled ? (
            <div className="p-8 text-center bg-purple-50/40 rounded-2xl border border-purple-200/80 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto shadow-xs">
                <Armchair className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-bold text-slate-900">Facility-Only Admission Track Active</h4>
                <p className="text-xs text-slate-500">
                  This student is enrolling solely for Study Room Desks and/or Hostel Accommodation. Classroom academic programs, streams, subjects, and teaching batches are bypassed.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, is_academic_enrolled: true }))}
                  className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition"
                >
                  Switch to Full Academic Admission
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition inline-flex items-center space-x-1.5"
                >
                  <span>Proceed to Facility Selection (Step 3)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : admissionTrack === 'SKILL_ONLY' ? (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Universal Skill &amp; Certificate Programs
                  </h4>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    Open to all candidates across all standards with no prerequisite class restrictions.
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg border border-indigo-200">
                  Grade Independent
                </span>
              </div>

              {fieldErrors.curriculum && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="font-semibold">{fieldErrors.curriculum}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {universalCourses.length === 0 ? (
                  <div className="col-span-2 p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs space-y-1">
                    <p className="font-bold text-slate-700">No universal skill courses available yet.</p>
                    <p>Go to Academic Config → Courses &amp; Fees to create a course with the "Universal" toggle enabled.</p>
                  </div>
                ) : (
                  universalCourses.map((crs: any) => {
                    const isSelected = formData.course_id === crs.id;
                    return (
                      <div
                        key={crs.id}
                        onClick={() => handleCourseSelect(crs.id, universalCourses)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 pr-3">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                              {crs.code}
                            </span>
                            <h5 className="font-bold text-slate-900 text-sm">{crs.name}</h5>
                            {crs.description && (
                              <p className="text-xs text-slate-500 line-clamp-2">{crs.description}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-base font-extrabold text-slate-900">
                              ₹{Number(crs.current_version?.base_fee || 0).toLocaleString('en-IN')}
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {crs.duration_months} Mos Duration
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-indigo-700 font-medium text-[11px]">
                            🌐 Institute-Wide Program
                          </span>
                          <span className={`text-[11px] font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-400'}`}>
                            {isSelected ? '● Selected for Admission' : '○ Click to select'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <>
              {fieldErrors.curriculum && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="font-semibold">{fieldErrors.curriculum}</span>
                </div>
              )}

              {/* Admission Model (Single Year vs Combined Multi-Year) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-xs font-semibold text-slate-900">Enrollment Duration Model</span>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, enrollment_type: 'SINGLE_YEAR' })}
                    className={`p-3 rounded-lg text-left border text-xs transition ${
                      formData.enrollment_type === 'SINGLE_YEAR'
                        ? 'border-emerald-500 bg-emerald-50/50 text-slate-900 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <p className="font-semibold text-slate-900">Single Year Admission</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Enrolls student for one current academic year.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const isCol = formData.institution_type === 'COLLEGE';
                      const targetClass = isCol
                        ? classes.find((c) => c.code === 'STD-11' || c.name?.includes('11'))
                        : classes.find((c) => c.code === 'STD-09' || c.name?.includes('9'));
                      setFormData((prev) => ({
                        ...prev,
                        enrollment_type: 'COMBINED_MULTI_YEAR',
                        ...(targetClass ? { class_id: targetClass.id } : {})
                      }));
                      clearFieldError('class_id');
                    }}
                    className={`p-3 rounded-lg text-left border text-xs transition ${
                      formData.enrollment_type === 'COMBINED_MULTI_YEAR'
                        ? 'border-emerald-500 bg-emerald-50/50 text-slate-900 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <p className="font-semibold text-emerald-800">
                      {formData.institution_type === 'COLLEGE' ? 'Combined 11th + 12th Program' : 'Combined 9th + 10th Program'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formData.institution_type === 'COLLEGE'
                        ? '2-Year linked program with automated Year 2 promotion.'
                        : '2-Year Secondary School Program with discounted fee & division continuity.'}
                    </p>
                  </button>
                </div>
              </div>

              {/* Academic Session / Year Selection */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                    AY
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      Academic Session / Year <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Admission, fee schedules, and division batches will be bound to this academic session.
                    </p>
                  </div>
                </div>
                <div className="sm:w-64">
                  <select
                    value={formData.academic_year_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({ ...prev, academic_year_id: val, batch_id: '' }));
                      if (val) {
                        setSelectedAcademicYearById(val);
                      }
                    }}
                    className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {academicYears.map((ay: any) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name} {ay.is_current ? '(Current Session)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Class & Stream Select */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Class <span className="text-rose-500">*</span>
                    {formData.enrollment_type === 'COMBINED_MULTI_YEAR' && (
                      <span className="ml-1 text-[11px] font-normal text-emerald-600">
                        (Year 1 Entry: {formData.institution_type === 'COLLEGE' ? '11th Standard' : '9th Standard'})
                      </span>
                    )}
                  </label>
                  <select
                    value={formData.class_id}
                    onChange={(e) => {
                      setFormData({ ...formData, class_id: e.target.value });
                      clearFieldError('class_id');
                      clearFieldError('curriculum');
                    }}
                    className={getSelectClass('class_id')}
                  >
                    <option value="">-- Choose Class --</option>
                    {(formData.enrollment_type === 'COMBINED_MULTI_YEAR'
                      ? (formData.institution_type === 'COLLEGE'
                          ? classes.filter((c) => c.code === 'STD-11' || c.name?.includes('11'))
                          : classes.filter((c) => c.code === 'STD-09' || c.name?.includes('9'))
                        )
                      : (formData.institution_type === 'COLLEGE'
                          ? classes.filter((c) => ['STD-11', 'STD-12'].includes(c.code) || c.name?.includes('11') || c.name?.includes('12'))
                          : classes.filter((c) => !(['STD-11', 'STD-12'].includes(c.code) || c.name?.includes('11') || c.name?.includes('12')))
                        )
                    ).map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                  {fieldErrors.class_id && (
                    <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.class_id}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isSeniorSecondary ? (
                      <>
                        Academic Stream <span className="text-rose-500">*</span>
                      </>
                    ) : (
                      'Academic Curriculum Track'
                    )}
                  </label>
                  {isSeniorSecondary ? (
                    <>
                      <select
                        value={formData.stream_id}
                        onChange={(e) => {
                          setFormData({ ...formData, stream_id: e.target.value });
                          clearFieldError('stream_id');
                          clearFieldError('curriculum');
                        }}
                        className={getSelectClass('stream_id')}
                      >
                        <option value="">-- Select Stream (Science / Commerce) --</option>
                        {streams.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      {fieldErrors.stream_id && (
                        <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.stream_id}</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-xs p-2.5 bg-slate-100/80 border border-slate-200 rounded-lg text-slate-700 font-semibold flex items-center justify-between">
                      <span>General Foundation / Board Curriculum</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Compulsory</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Course Selection */}
              {courses.length > 0 ? (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Curriculum Course Offering</label>
                  <select
                    value={formData.course_id}
                    onChange={(e) => handleCourseSelect(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  >
                    <option value="">-- No Master Course (Individual Subject Only) --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.duration_months} Months) - Base: ₹{Number(c.current_version?.base_fee || 0).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>

                  {/* Core Subjects Included in Selected Course */}
                  {selectedCourse?.current_version?.subjects && selectedCourse.current_version.subjects.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-950 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          Included Core Curriculum Subjects ({selectedCourse.current_version.subjects.length}):
                        </span>
                        <span className="text-[10px] font-medium text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                          Covered by Course Base Tuition
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {selectedCourse.current_version.subjects.map((s: any) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-lg bg-white text-blue-900 border border-blue-200 shadow-xs"
                          >
                            ✓ {s.name} <span className="text-[10px] text-blue-500 ml-1">({s.code})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : formData.class_id ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
                  <span>No master courses found for this Class & Stream yet.</span>
                  <button
                    type="button"
                    onClick={() => navigate('/academics')}
                    className="font-semibold underline hover:text-amber-900 ml-2"
                  >
                    Configure Course in Academics →
                  </button>
                </div>
              ) : null}

              {/* Teaching Batch & Division Selector */}
              {availableBatches.length > 0 && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-800">
                      Assigned Teaching Batch &amp; Division <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  {formData.enrollment_type === 'COMBINED_MULTI_YEAR' && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">📍</span>
                        <span className="font-medium text-[11px] leading-tight">
                          <strong>Classroom Placement:</strong> Students in this combined multi-year program attend physical lectures in the <strong>{selectedClass?.name || 'Entry Standard'} Regular Batch</strong> division (Year 1).
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300 shrink-0 self-start sm:self-auto">
                        Division auto-preserves in Year 2
                      </span>
                    </div>
                  )}
                  <select
                    value={formData.batch_id}
                    onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {availableBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (Division {b.division || 'A'}) - Max {b.max_capacity} Seats
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject Selection (Compulsory Summary for 5th-10th vs Elective Add-ons for 11th-12th) */}
              {isCompulsoryFullCourse ? (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-emerald-950">
                      Standardized Full Curriculum (Compulsory Enrollment)
                    </h4>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    For {selectedClass?.name || 'this grade'}, all students enroll in the standardized curriculum. All core subjects are included in the course tuition with uniform scheduling, period attendance, and examination grading. Single-subject add-ons are not applicable for junior and secondary classes.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedCourse?.current_version?.subjects?.map((s: any) => (
                      <span key={s.id} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 shadow-xs">
                        ✓ {s.name} ({s.code})
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-700">
                      {formData.course_id ? 'Elective / Additional Subject Add-ons' : 'Individual Subject Enrollment'}
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {formData.course_id
                        ? 'Core course subjects are pre-included. Add optional extra electives below.'
                        : 'Choose individual subjects for standalone subject tuition.'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
                    {subjects.map((subj) => {
                      const isCore = coreSubjectIds.has(subj.id);
                      const isChecked = isCore || formData.selected_subject_ids.includes(subj.id);

                      return (
                        <label
                          key={subj.id}
                          className={`flex items-start space-x-2.5 text-xs p-2.5 rounded-lg border transition-all ${
                            isCore
                              ? 'bg-blue-50/70 border-blue-200 text-blue-950 cursor-default'
                              : isChecked
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs cursor-pointer'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isCore}
                            onChange={() => handleSubjectToggle(subj.id)}
                            className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-75"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{subj.name}</div>
                            <div className="text-[10px] mt-0.5">
                              {isCore ? (
                                <span className="text-blue-700 font-semibold">Included in Course</span>
                              ) : (
                                <span className="text-slate-500">+₹{subj.default_individual_fee.toLocaleString('en-IN')}</span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Wizard Step 3: Optional Facilities (Hostel & Study Room) */}
      {step === 3 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Step 3: Facility Subscriptions (Hostel &amp; Study Room Desks)
              </h3>
              {!formData.is_academic_enrolled && (
                <p className="text-xs text-purple-700 font-medium mt-0.5">
                  ★ Facility-Only Track: Please allocate a Study Room Desk and/or Hostel Bed below to complete enrollment.
                </p>
              )}
            </div>
            {!formData.is_academic_enrolled && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200 self-start sm:self-auto uppercase tracking-wider">
                Facility-Only Mode
              </span>
            )}
          </div>

          {fieldErrors.service_selection && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-semibold">{fieldErrors.service_selection}</span>
            </div>
          )}

          {/* Facility Selection 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Study Room 150-Seat Selection */}
            <div className="p-5 bg-purple-50/40 border border-purple-200/80 rounded-2xl space-y-4">
              <div className="flex items-center space-x-2 border-b border-purple-100 pb-2.5">
                <Armchair className="w-4 h-4 text-purple-600" />
                <h4 className="font-bold text-xs text-slate-900">Study Room Facility (150 Dedicated Desks)</h4>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Study Room Plan</label>
                  <select
                    value={formData.study_room_plan_id}
                    onChange={(e) => {
                      const pid = e.target.value;
                      const plan = studyRoomPlans.find((p) => p.id === pid);
                      setFormData({
                        ...formData,
                        study_room_plan_id: pid,
                        study_seat_id: '',
                        study_room_months: formData.study_room_months || 1,
                        study_room_monthly_charge: plan ? Number(plan.base_amount) : 0
                      });
                      clearFieldError('study_seat_id');
                      clearFieldError('service_selection');
                    }}
                    className={getSelectClass('study_room_plan_id')}
                  >
                    <option value="">-- No Study Room Subscription --</option>
                    {studyRoomPlans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (₹{p.base_amount} / {p.billing_frequency})</option>
                    ))}
                  </select>
                </div>

                {formData.study_room_plan_id && (() => {
                  const currentPlan = studyRoomPlans.find((p) => p.id === formData.study_room_plan_id);
                  const months = Math.max(1, Number(formData.study_room_months) || 1);
                  const rate = formData.study_room_monthly_charge !== undefined && formData.study_room_monthly_charge !== null
                    ? Number(formData.study_room_monthly_charge)
                    : Number(currentPlan?.base_amount || 0);
                  const deposit = Number(currentPlan?.deposit_amount || 0);
                  const totalTariff = rate * months;
                  const totalPayable = totalTariff + deposit;

                  return (
                    <div className="p-3 bg-white/90 border border-purple-200 rounded-xl space-y-2.5 text-xs">
                      <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                        <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-purple-600" />
                          <span>Tenure Duration (Months)</span>
                        </span>
                        <div className="flex items-center space-x-1">
                          {[1, 3, 6, 10, 12].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setFormData({ ...formData, study_room_months: m })}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                                months === m
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {m}M
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Duration (Months)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="36"
                            value={formData.study_room_months || 1}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                study_room_months: Math.max(1, parseInt(e.target.value) || 1),
                              })
                            }
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Monthly Tariff Rate (₹/mo)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.study_room_monthly_charge ?? (currentPlan ? Number(currentPlan.base_amount) : 0)}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                study_room_monthly_charge: Math.max(0, parseFloat(e.target.value) || 0),
                              })
                            }
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                      </div>

                      <div className="p-2.5 bg-purple-50/70 rounded-lg border border-purple-100 space-y-1 text-[11px]">
                        <div className="flex justify-between text-slate-600">
                          <span>Tenure Tariff: ₹{rate.toLocaleString('en-IN')} × {months} {months === 1 ? 'month' : 'months'}</span>
                          <span className="font-bold text-slate-900">₹{totalTariff.toLocaleString('en-IN')}</span>
                        </div>
                        {deposit > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Refundable Locker Deposit:</span>
                            <span className="font-bold text-blue-700">₹{deposit.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-purple-200 font-bold text-slate-900">
                          <span>Study Room Total Fee:</span>
                          <span className="text-purple-700">₹{totalPayable.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {formData.study_room_plan_id && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      Assign Available Desk <span className="text-rose-500">*</span> ({formData.gender === 'MALE' ? 'Boys Hall: B001–B105' : 'Girls Hall: G001–G045'})
                    </label>

                    {/* Interactive Visual Floor Map Selection Trigger */}
                    {formData.study_seat_id ? (
                      (() => {
                        const chosenSeat = studySeats.find((s) => s.id === formData.study_seat_id);
                        return (
                          <div className="p-3.5 bg-emerald-50/80 border-2 border-emerald-300 rounded-xl flex items-center justify-between shadow-xs">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex flex-col items-center justify-center font-black text-xs shadow-sm">
                                <Armchair className="w-4 h-4 mb-0.5" />
                                <span>{chosenSeat?.seat_number || 'Desk'}</span>
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-bold text-emerald-950">
                                    Desk {chosenSeat?.seat_number} Assigned
                                  </span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-800">
                                    {chosenSeat?.row_identifier ? `Row ${chosenSeat.row_identifier} • Col ${chosenSeat.column_identifier}` : 'Floor Map Selection'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-emerald-700 font-medium">
                                  {chosenSeat?.gender_allowed === 'BOYS' ? 'Boys Study Hall' : 'Girls Study Hall'} • ⚡ Power Outlet • 🔒 Locker Included
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowStudyRoomPickerModal(true)}
                              className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition shadow-xs flex items-center space-x-1 cursor-pointer"
                            >
                              <span>Change on Map</span>
                            </button>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-2 border-dashed border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-indigo-950 flex items-center space-x-1.5">
                            <span>🗺️</span>
                            <span>Classroom Blueprint Desk Selection</span>
                          </p>
                          <p className="text-[11px] text-indigo-700 mt-0.5">
                            Select directly from the physical layout ({formData.gender === 'MALE' ? 'Boys Hall: B001–B105' : 'Girls Hall: G001–G045'}).
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowStudyRoomPickerModal(true)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center justify-center space-x-1.5 shrink-0"
                        >
                          <Armchair className="w-3.5 h-3.5" />
                          <span>Open Floor Map Picker</span>
                        </button>
                      </div>
                    )}

                    {/* Quick Dropdown Fallback */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span>Or choose from vacant desk dropdown:</span>
                        <span className="font-semibold text-emerald-600">
                          {studySeats.filter((s) => s.status === 'AVAILABLE').length} Available
                        </span>
                      </div>
                      <select
                        value={formData.study_seat_id}
                        onChange={(e) => {
                          setFormData({ ...formData, study_seat_id: e.target.value });
                          clearFieldError('study_seat_id');
                          clearFieldError('service_selection');
                        }}
                        className={getSelectClass('study_seat_id')}
                      >
                        <option value="">-- Select Vacant Seat --</option>
                        {studySeats
                          .filter((s) => s.status === 'AVAILABLE')
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              Desk {s.seat_number} ({s.row_identifier ? `${s.row_identifier}-Col ${s.column_identifier}` : s.gender_allowed})
                            </option>
                          ))}
                      </select>
                    </div>

                    {fieldErrors.study_seat_id && (
                      <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{fieldErrors.study_seat_id}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Hostel Facility Selection */}
            <div className="p-5 bg-blue-50/40 border border-blue-200/80 rounded-2xl space-y-4">
              <div className="flex items-center space-x-2 border-b border-blue-100 pb-2.5">
                <Home className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-xs text-slate-900">Residential Hostel Boarding</h4>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hostel Plan</label>
                  <select
                    value={formData.hostel_plan_id}
                    onChange={(e) => {
                      const pid = e.target.value;
                      const plan = hostelPlans.find((p) => p.id === pid);
                      setFormData({
                        ...formData,
                        hostel_plan_id: pid,
                        hostel_bed_id: '',
                        hostel_months: formData.hostel_months || 1,
                        hostel_monthly_charge: plan ? Number(plan.base_amount) : 0
                      });
                      clearFieldError('hostel_bed_id');
                      clearFieldError('service_selection');
                    }}
                    className={getSelectClass('hostel_plan_id')}
                  >
                    <option value="">-- No Hostel Subscription --</option>
                    {hostelPlans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (₹{p.base_amount})</option>
                    ))}
                  </select>
                </div>

                {formData.hostel_plan_id && (() => {
                  const currentPlan = hostelPlans.find((p) => p.id === formData.hostel_plan_id);
                  const months = Math.max(1, Number(formData.hostel_months) || 1);
                  const rate = formData.hostel_monthly_charge !== undefined && formData.hostel_monthly_charge !== null
                    ? Number(formData.hostel_monthly_charge)
                    : Number(currentPlan?.base_amount || 0);
                  const deposit = Number(currentPlan?.deposit_amount || 0);
                  const totalTariff = rate * months;
                  const totalPayable = totalTariff + deposit;

                  return (
                    <div className="p-3 bg-white/90 border border-blue-200 rounded-xl space-y-2.5 text-xs">
                      <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                        <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span>Tenure Duration (Months)</span>
                        </span>
                        <div className="flex items-center space-x-1">
                          {[1, 3, 6, 10, 12].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setFormData({ ...formData, hostel_months: m })}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                                months === m
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {m}M
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Duration (Months)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="36"
                            value={formData.hostel_months || 1}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                hostel_months: Math.max(1, parseInt(e.target.value) || 1),
                              })
                            }
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Monthly Boarding Rate (₹/mo)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.hostel_monthly_charge ?? (currentPlan ? Number(currentPlan.base_amount) : 0)}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                hostel_monthly_charge: Math.max(0, parseFloat(e.target.value) || 0),
                              })
                            }
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-100 space-y-1 text-[11px]">
                        <div className="flex justify-between text-slate-600">
                          <span>Boarding Tariff: ₹{rate.toLocaleString('en-IN')} × {months} {months === 1 ? 'month' : 'months'}</span>
                          <span className="font-bold text-slate-900">₹{totalTariff.toLocaleString('en-IN')}</span>
                        </div>
                        {deposit > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Refundable Security Deposit:</span>
                            <span className="font-bold text-blue-700">₹{deposit.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-blue-200 font-bold text-slate-900">
                          <span>Hostel Total Fee:</span>
                          <span className="text-blue-700">₹{totalPayable.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {formData.hostel_plan_id && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      Assign Room &amp; Bed <span className="text-rose-500">*</span>
                    </label>

                    {/* Visual Floor Map Trigger & Selected Bed Status Card */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        {formData.hostel_bed_id ? (
                          <div className="flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-bold text-slate-900">
                              {(() => {
                                const b = hostelBeds.find((x) => x.id === formData.hostel_bed_id);
                                if (!b) return `Bed ${formData.hostel_bed_id}`;
                                const tierText = b.tier === 'UPPER' ? 'Upper Berth' : 'Lower Berth';
                                return `Room ${b.room_number} • Bed ${b.bed_number} (${tierText})`;
                              })()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No bed selected yet</span>
                        )}
                        {formData.hostel_bed_id && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, hostel_bed_id: '' });
                              clearFieldError('hostel_bed_id');
                            }}
                            className="text-[11px] text-rose-500 hover:text-rose-700 font-medium ml-2 cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowHostelPickerModal(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer flex items-center justify-center space-x-1.5 shrink-0"
                      >
                        <Bed className="w-3.5 h-3.5" />
                        <span>Open Bunk Bed Floor Map</span>
                      </button>
                    </div>

                    {/* Quick Dropdown Fallback */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span>Or choose from vacant bed dropdown:</span>
                        <span className="font-semibold text-emerald-600">
                          {hostelBeds.length} Available
                        </span>
                      </div>
                      <select
                        value={formData.hostel_bed_id}
                        onChange={(e) => {
                          setFormData({ ...formData, hostel_bed_id: e.target.value });
                          clearFieldError('hostel_bed_id');
                          clearFieldError('service_selection');
                        }}
                        className={getSelectClass('hostel_bed_id')}
                      >
                        <option value="">-- Select Vacant Bed --</option>
                        {hostelBeds.map((b) => (
                          <option key={b.id} value={b.id}>
                            Room {b.room_number} - Bed {b.bed_number} ({b.tier === 'UPPER' ? 'Upper Berth' : 'Lower Berth'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {fieldErrors.hostel_bed_id && (
                      <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{fieldErrors.hostel_bed_id}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payment Plan Mode Selector (One-Time vs Installments) */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <span>Payment Plan Mode</span>
              </label>
              {courseOneTimeFee != null && courseInstFee != null && courseInstFee > courseOneTimeFee && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-600" />
                  <span>Save ₹{(courseInstFee - courseOneTimeFee).toLocaleString('en-IN')} with One-Time payment</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: One-Time Full Payment */}
              <button
                type="button"
                onClick={() => handleInstallmentCountChange(1)}
                className={`text-left p-3.5 rounded-xl border-2 transition relative flex flex-col justify-between ${
                  formData.number_of_installments === 1
                    ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-lg ${formData.number_of_installments === 1 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">One-Time Lumpsum</div>
                      <div className="text-[11px] text-slate-500">100% Upfront full clearance</div>
                    </div>
                  </div>
                  {formData.number_of_installments === 1 && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-baseline justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">Tuition Rate:</span>
                  <span className="font-extrabold text-emerald-700 text-sm">
                    ₹{(courseOneTimeFee != null ? courseOneTimeFee : courseBaseFee).toLocaleString('en-IN')}
                  </span>
                </div>
              </button>

              {/* Option 2: Installment Plan (EMI) */}
              <button
                type="button"
                onClick={() => {
                  if (formData.number_of_installments === 1) {
                    handleInstallmentCountChange(2);
                  }
                }}
                className={`text-left p-3.5 rounded-xl border-2 transition relative flex flex-col justify-between ${
                  formData.number_of_installments > 1
                    ? 'border-blue-500 bg-blue-50/60 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-lg ${formData.number_of_installments > 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Installment Plan (EMI)</div>
                      <div className="text-[11px] text-slate-500">Spread fees across 2 to 4 EMIs</div>
                    </div>
                  </div>
                  {formData.number_of_installments > 1 && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  )}
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-baseline justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">Tuition Rate:</span>
                  <span className="font-extrabold text-blue-700 text-sm">
                    ₹{(courseInstFee != null ? courseInstFee : courseBaseFee).toLocaleString('en-IN')}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Discounts & Installments */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Approved Scholarship / Discount (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.discount_amount}
                onChange={(e) => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Installment Split Count</label>
              <select
                value={formData.number_of_installments}
                onChange={(e) => handleInstallmentCountChange(parseInt(e.target.value) || 1)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg font-medium"
              >
                <option value={1}>1 Installment (Full Upfront Payment)</option>
                <option value={2}>2 Installments (Term-wise)</option>
                <option value={3}>3 Installments</option>
                <option value={4}>4 Quarterly Installments</option>
              </select>
            </div>
          </div>

          {/* Interactive Installment Due Dates & Schedule Configuration */}
          {formData.number_of_installments > 1 && (
            <div className="p-4 bg-emerald-50/40 border border-emerald-200/80 rounded-xl space-y-3 mt-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-2.5">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Custom Installment Due Dates</h4>
                    <p className="text-[11px] text-slate-500">Pick agreed calendar dates for each upcoming installment.</p>
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">Presets:</span>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('30_DAYS')}
                    className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md shadow-xs transition"
                  >
                    +30 Days Spacing
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('1ST_OF_MONTH')}
                    className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md shadow-xs transition"
                  >
                    1st of Month
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('10TH_OF_MONTH')}
                    className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md shadow-xs transition"
                  >
                    10th (Salary Day)
                  </button>
                </div>
              </div>

              {fieldErrors.installments && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  <span className="font-semibold">{fieldErrors.installments}</span>
                </div>
              )}

              {/* Admin Custom Amounts Toggle */}
              {isAdmin && (
                <div className="flex items-center justify-between py-1.5 px-3 bg-white/80 border border-emerald-200 rounded-lg text-xs">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-3.5 h-3.5 text-purple-600" />
                    <span className="font-semibold text-slate-800 text-[11px]">Admin Custom Split Amounts Override</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold">Admin Only</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customAmountsEnabled}
                      onChange={(e) => setCustomAmountsEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              )}

              {/* Installment Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                {formData.custom_installments.map((inst, idx) => (
                  <div key={inst.installment_number} className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">Inst #{inst.installment_number}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${idx === 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {idx === 0 ? 'Upfront' : `Cycle ${idx + 1}`}
                      </span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Due Date *</label>
                      <input
                        type="date"
                        min={idx > 0 && formData.custom_installments[idx - 1]?.due_date ? formData.custom_installments[idx - 1].due_date : new Date().toISOString().split('T')[0]}
                        value={inst.due_date}
                        onChange={(e) => {
                          handleInstallmentDateChange(idx, e.target.value);
                          clearFieldError(`installment_date_${idx}`);
                          clearFieldError('installments');
                        }}
                        className={`w-full text-xs p-1.5 rounded-lg border transition ${
                          fieldErrors[`installment_date_${idx}`]
                            ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-2 focus:ring-rose-500/20'
                            : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500'
                        }`}
                        required
                      />
                      {fieldErrors[`installment_date_${idx}`] && (
                        <p className="text-[9px] text-rose-600 font-medium mt-0.5">{fieldErrors[`installment_date_${idx}`]}</p>
                      )}
                    </div>

                    {isAdmin && customAmountsEnabled ? (
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Custom Amount (₹) *</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Amount"
                          value={inst.amount || ''}
                          onChange={(e) => handleInstallmentAmountChange(idx, parseFloat(e.target.value) || undefined)}
                          className="w-full text-xs p-1.5 border border-purple-200 rounded-lg bg-purple-50/30 focus:bg-white focus:border-purple-500 font-semibold"
                        />
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">
                        Amount: Auto equal split
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wizard Step 4: Real-Time Dynamic Fee Preview & Final Confirmation */}
      {step === 4 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {formData.admission_type === 'PROVISIONAL_TRIAL'
                  ? 'Step 4: Provisional Trial & Form Fee Receipt Summary'
                  : 'Step 4: Fee Calculation & Obligation Summary'}
              </h3>
              <p className="text-xs text-slate-500">
                {formData.admission_type === 'PROVISIONAL_TRIAL'
                  ? `Trial onboarding: Collecting upfront one-time form fee with ₹0 tuition liability. Valid for ${institute?.trial_period_days || 14} days.`
                  : formData.is_academic_enrolled
                  ? 'Itemized audit before creating permanent enrollment and issuing legal invoice.'
                  : 'Facility-Only Billing: No academic tuition charged. Billed strictly for selected Study Desk and/or Hostel Bed.'}
              </p>
            </div>
          </div>

          {formData.admission_type === 'PROVISIONAL_TRIAL' ? (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl space-y-3">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-950">
                        Provisional Trial Admission ({institute?.trial_period_days || 14} Days)
                      </h4>
                      <p className="text-[11px] text-amber-800">
                        Student is admitted for a {institute?.trial_period_days || 14}-day trial. <strong>Zero tuition fee debt is created today.</strong>
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-amber-200 text-amber-900 rounded-full border border-amber-300">
                    Provisional Mode Active
                  </span>
                </div>

                <div className="border border-amber-200 bg-white rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-amber-50/70 border-b border-amber-100 text-amber-900 font-semibold">
                      <tr>
                        <th className="p-3">Charge Description</th>
                        <th className="p-3">Terms</th>
                        <th className="p-3 text-right">Payable Today (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      <tr>
                        <td className="p-3 font-medium text-slate-900">One-Time Admission Form Fee</td>
                        <td className="p-3 text-slate-500">Non-refundable Registration Charge</td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          ₹{(institute?.admission_form_fee || 200).toLocaleString('en-IN')}
                        </td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-700">Classroom Lecture &amp; Attendance Access</td>
                        <td className="p-3 text-slate-500">Valid for {institute?.trial_period_days || 14} Days</td>
                        <td className="p-3 text-right font-semibold text-emerald-600">₹0.00 (Trial Privilege)</td>
                      </tr>
                    </tbody>
                    <tfoot className="bg-amber-100/60 font-bold text-amber-950 border-t border-amber-200">
                      <tr>
                        <td colSpan={2} className="p-3">Total Upfront Amount to Collect Today</td>
                        <td className="p-3 text-right text-base text-amber-900 font-black">
                          ₹{(institute?.admission_form_fee || 200).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Upfront Form Fee Payment Mode Selector */}
                <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-800">
                    Select Form Fee Payment Mode *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, form_fee_payment_mode: mode }))}
                        className={`p-2.5 rounded-xl border text-center text-xs font-bold transition ${
                          formData.form_fee_payment_mode === mode
                            ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {mode === 'CASH' ? '💵 Cash' : mode === 'UPI' ? '📱 UPI / QR' : mode === 'CHEQUE' ? '🏦 Cheque' : '🏛️ Bank Transfer'}
                      </button>
                    ))}
                  </div>

                  {formData.form_fee_payment_mode !== 'CASH' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {formData.form_fee_payment_mode === 'UPI' ? 'UPI UTR / Reference No.' : formData.form_fee_payment_mode === 'CHEQUE' ? 'Cheque Number & Bank' : 'Transfer Ref Number'}
                      </label>
                      <input
                        type="text"
                        value={formData.form_fee_transaction_ref}
                        onChange={(e) => setFormData((prev) => ({ ...prev, form_fee_transaction_ref: e.target.value }))}
                        placeholder="e.g. UPI-9876543210"
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:border-amber-500"
                      />
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-amber-800/90 space-y-1">
                  <p>• <strong>Instant Receipt:</strong> An official Form Fee Receipt (<code>REC-FORM-2026-XXXXX</code>) will be recorded immediately.</p>
                  <p>• <strong>Attendance Roll:</strong> The student is assigned to the selected course batch and appears in daily lecture attendance.</p>
                  <p>• <strong>Zero Financial Liability:</strong> If the student drops out after the trial, the trial is closed with ₹0 invoices touched. If they continue, admin converts them to full admission in one click with the form fee credited.</p>
                </div>
              </div>
            </div>
          ) : calculatingFee ? (
            <div className="p-8 text-center text-xs text-slate-500">Calculating fee schedule with double-charge verification...</div>
          ) : feePreview ? (
            <div className="space-y-4">
              {!formData.is_academic_enrolled && (
                <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Armchair className="w-4 h-4 text-purple-700 shrink-0" />
                    <span className="font-semibold text-purple-950">
                      Admission Track: <strong>Facility-Only (Hostel &amp; Study Hall)</strong>
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200 uppercase tracking-wider">
                    Tuition Bypassed
                  </span>
                </div>
              )}

              {/* Itemized Line Items */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="p-3">Fee Item Description</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {feePreview.items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-900">{item.description}</td>
                        <td className="p-3 text-slate-500">{item.service_type}</td>
                        <td className="p-3 text-right font-semibold text-slate-900">₹{parseFloat(item.total_amount).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold text-slate-900 border-t border-slate-200">
                    <tr>
                      <td colSpan={2} className="p-3">Subtotal</td>
                      <td className="p-3 text-right">₹{parseFloat(feePreview.subtotal).toLocaleString('en-IN')}</td>
                    </tr>
                    {feePreview.total_discount > 0 && (
                      <tr className="text-emerald-700">
                        <td colSpan={2} className="p-3">Applied Discount</td>
                        <td className="p-3 text-right">-₹{parseFloat(feePreview.total_discount).toLocaleString('en-IN')}</td>
                      </tr>
                    )}
                    <tr className="text-base text-emerald-800 bg-emerald-50/50">
                      <td colSpan={2} className="p-3">Total Payable Obligation</td>
                      <td className="p-3 text-right font-bold">₹{parseFloat(feePreview.total_amount).toLocaleString('en-IN')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Installment Breakdown Schedule */}
              {feePreview.installments?.length > 1 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-900">Confirmed Installment Schedule</h4>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Custom Due Dates Active
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {feePreview.installments.map((inst: any) => (
                      <div key={inst.installment_number} className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                        <p className="text-[11px] font-bold text-slate-600">Inst #{inst.installment_number}</p>
                        <p className="text-xs font-bold text-slate-900 mt-1">₹{parseFloat(inst.amount).toLocaleString('en-IN')}</p>
                        <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">Due: {inst.due_date}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Click Calculate Fee to generate preview.</p>
          )}
        </div>
      )}

      {/* Wizard Footer Controls */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={handlePrevStep}
          disabled={step === 1}
          className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer w-full sm:w-auto"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Step</span>
        </button>

        {step < 4 ? (
          <button
            type="button"
            onClick={handleNextStep}
            className="inline-flex items-center justify-center space-x-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-600/10 transition cursor-pointer w-full sm:w-auto"
          >
            <span>
              {step === 1 && !formData.is_academic_enrolled
                ? 'Continue to Facilities (Step 3)'
                : `Continue to Step ${step + 1}`}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={submitAdmission}
            className={`inline-flex items-center justify-center space-x-2 px-6 py-2.5 text-white rounded-lg text-xs font-bold shadow-lg disabled:opacity-50 transition cursor-pointer w-full sm:w-auto ${
              formData.admission_type === 'PROVISIONAL_TRIAL'
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>
              {loading
                ? 'Processing...'
                : formData.admission_type === 'PROVISIONAL_TRIAL'
                ? 'Confirm Provisional Trial & Issue Form Fee Receipt'
                : 'Confirm Admission & Issue Legal Invoice'}
            </span>
          </button>
        )}
      </div>

      {/* Interactive Study Room Floor Map Modal Picker */}
      {showStudyRoomPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Armchair className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Select Study Desk • {formData.gender === 'MALE' ? 'Boys Study Hall (B001–B105)' : 'Girls Study Hall (G001–G045)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Classroom physical layout. Click any available green desk to assign.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStudyRoomPickerModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Legend Ribbon */}
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 shrink-0">
              <span className="font-semibold text-slate-800">Legend:</span>
              <div className="flex items-center space-x-1.5">
                <div className="w-3.5 h-3.5 rounded bg-emerald-500" />
                <span className="text-emerald-900 font-semibold">Available (Click to Select)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3.5 h-3.5 rounded bg-rose-500" />
                <span className="text-rose-900">Occupied (Disabled)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3.5 h-3.5 rounded bg-indigo-600" />
                <span className="text-indigo-900 font-bold">Currently Selected</span>
              </div>
              <div className="flex items-center space-x-2 ml-auto text-slate-400">
                <span className="flex items-center"><Zap className="w-3 h-3 text-amber-500 mr-0.5" /> Power Outlet</span>
                <span className="flex items-center"><Lock className="w-3 h-3 text-blue-500 mr-0.5" /> Personal Locker</span>
              </div>
            </div>

            {/* Interactive Blueprint Canvas */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
              <StudyRoomPhysicalFloorMap
                seats={studySeats}
                selectedSeatId={formData.study_seat_id}
                onSelectSeat={(seat) => {
                  setFormData({ ...formData, study_seat_id: seat.id });
                  clearFieldError('study_seat_id');
                  clearFieldError('service_selection');
                  setShowStudyRoomPickerModal(false);
                }}
                genderFilter={formData.gender === 'MALE' ? 'BOYS' : 'GIRLS'}
                interactiveOnlyAvailable={true}
                compact={true}
              />
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="text-xs">
                {formData.study_seat_id ? (
                  <span className="text-emerald-700 font-bold flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Selected Desk:{' '}
                      {studySeats.find((s) => s.id === formData.study_seat_id)?.seat_number || formData.study_seat_id}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400">Click on any emerald green desk to lock in allocation.</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowStudyRoomPickerModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hostel Visual Bunk Bed Picker Modal */}
      {showHostelPickerModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Select Hostel Bed • {formData.gender === 'MALE' ? 'Boys Residential Hostel' : 'Girls Residential Hostel'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Interactive 2-tier bunk bed floor plan. Click on any green Upper or Lower berth to assign.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHostelPickerModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Interactive Floor Map Canvas */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
              <HostelPhysicalFloorMap
                hostels={allHostelsData}
                selectedBedId={formData.hostel_bed_id}
                onSelectBed={(bed) => {
                  setFormData({ ...formData, hostel_bed_id: bed.id });
                  clearFieldError('hostel_bed_id');
                  clearFieldError('service_selection');
                  setShowHostelPickerModal(false);
                }}
                genderFilter={formData.gender === 'MALE' ? 'BOYS' : 'GIRLS'}
                interactiveOnlyAvailable={true}
                compact={true}
              />
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="text-xs">
                {formData.hostel_bed_id ? (
                  <span className="text-emerald-700 font-bold flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Selected Bed:{' '}
                      {(() => {
                        const b = hostelBeds.find((x) => x.id === formData.hostel_bed_id);
                        if (!b) return formData.hostel_bed_id;
                        const tierText = b.tier === 'UPPER' ? 'Upper Berth' : 'Lower Berth';
                        return `Room ${b.room_number} • Bed ${b.bed_number} (${tierText})`;
                      })()}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400">Click on any emerald green Upper or Lower berth to lock in allocation.</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowHostelPickerModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
