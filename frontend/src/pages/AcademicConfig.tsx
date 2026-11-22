import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Layers,
  BookOpen,
  FolderPlus,
  Clock,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Tag,
  DollarSign,
  Calendar,
  X,
  Pencil,
  Trash2,
  Users,
  Sparkles,
  Building,
  Home,
  Armchair,
  ShieldCheck,
  Save,
  Loader2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Receipt,
  Landmark,
  ArrowRightLeft,
  UserMinus,
  ShieldAlert,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  LayoutGrid,
  ListFilter
} from 'lucide-react';
import apiClient from '../api/client';
import { CohortPromotionWizard } from '../components/CohortPromotionWizard';

interface ClassItem {
  id: string;
  name: string;
  code: string;
  order_index: number;
}

interface CourseTypeItem {
  id: string;
  name: string;
  code: string;
}

interface StreamItem {
  id: string;
  name: string;
  code: string;
  description?: string;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  default_theory_marks: number;
  default_practical_marks: number;
  default_individual_fee: number;
}

interface SubjectGroupItem {
  id: string;
  class_id?: string;
  stream_id?: string;
  name: string;
  code: string;
  package_fee: number;
  subject_ids: string[];
  subjects?: SubjectItem[];
}

interface CourseItem {
  id: string;
  name: string;
  code: string;
  course_type_id?: string;
  class_id?: string;
  stream_id?: string;
  is_universal?: boolean;
  description?: string;
  duration_months: number;
  current_version?: {
    version_number: number;
    base_fee: number;
    one_time_fee?: number | null;
    installment_fee?: number | null;
    subjects: SubjectItem[];
  };
}

interface BatchSubjectSummary {
  id: string;
  subject_id: string;
  subject_name?: string;
  subject_code?: string;
  teacher_name?: string;
  classroom_name?: string;
}

interface BatchStudentRosterItem {
  student_id: string;
  student_code: string;
  prn?: string;
  first_name: string;
  last_name: string;
  gender: string;
  roll_number?: number | null;
  status: string;
  enrolled_at: string;
}

interface BatchSyncPreviewItem {
  student_id: string;
  student_code: string;
  prn?: string;
  first_name: string;
  last_name: string;
  gender: string;
  enrolled_batch_id?: string;
  enrolled_batch_name?: string;
  enrolled_division?: string;
  current_batch_id?: string;
  current_batch_name?: string;
  current_division?: string;
  current_roll_number?: number;
  is_assigned_to_this_batch: boolean;
  is_assigned_to_other_batch: boolean;
  is_matched_for_this_batch: boolean;
}

interface BatchSyncPreviewResponse {
  batch_id: string;
  batch_name: string;
  division: string;
  course_id: string;
  course_name: string;
  total_course_enrollments: number;
  matched_count: number;
  unassigned_count: number;
  other_division_count: number;
  already_in_this_batch_count: number;
  students: BatchSyncPreviewItem[];
}

interface BatchItem {
  id: string;
  course_id: string;
  course_name?: string;
  course_code?: string;
  name: string;
  code: string;
  division?: string;
  max_capacity: number;
  enrolled_count?: number;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  batch_subjects?: BatchSubjectSummary[];
}

export const AcademicConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'COURSES' | 'BATCHES' | 'SUBJECTS' | 'CLASSES' | 'STREAMS' | 'ROLLOVER'>('COURSES');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [courseTypes, setCourseTypes] = useState<CourseTypeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [showAddSubject, setShowAddSubject] = useState<boolean>(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<SubjectItem | null>(null);
  const [showAddCourse, setShowAddCourse] = useState<boolean>(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<CourseItem | null>(null);
  const [showAddBatch, setShowAddBatch] = useState<boolean>(false);
  const [showEditBatch, setShowEditBatch] = useState<boolean>(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<BatchItem | null>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [editBatchForm, setEditBatchForm] = useState({
    name: '',
    code: '',
    division: 'A',
    max_capacity: 60,
    start_date: '2026-06-01',
    end_date: '2027-04-30',
    is_active: true
  });
  const [selectedBatchForRoster, setSelectedBatchForRoster] = useState<BatchItem | null>(null);
  const [batchRoster, setBatchRoster] = useState<BatchStudentRosterItem[]>([]);
  const [loadingRoster, setLoadingRoster] = useState<boolean>(false);
  const [generatingRoll, setGeneratingRoll] = useState<boolean>(false);
  const [syncingStudents, setSyncingStudents] = useState<boolean>(false);
  const [editingRollStudentId, setEditingRollStudentId] = useState<string | null>(null);
  const [customRollInput, setCustomRollInput] = useState<number | string>('');

  // Division-Aware Sync & Preview State
  const [syncPreviewModalOpen, setSyncPreviewModalOpen] = useState<boolean>(false);
  const [syncPreviewData, setSyncPreviewData] = useState<BatchSyncPreviewResponse | null>(null);
  const [selectedSyncStudentIds, setSelectedSyncStudentIds] = useState<string[]>([]);
  const [loadingSyncPreview, setLoadingSyncPreview] = useState<boolean>(false);

  // Transfer Student Division State
  const [transferModalStudent, setTransferModalStudent] = useState<BatchStudentRosterItem | null>(null);
  const [targetTransferBatchId, setTargetTransferBatchId] = useState<string>('');
  const [transferringStudent, setTransferringStudent] = useState<boolean>(false);

  // Remove Student State
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);

  // Batch Grouping, Filtering & Search State
  const [batchViewMode, setBatchViewMode] = useState<'by_course' | 'flat'>('by_course');
  const [batchSearchTerm, setBatchSearchTerm] = useState<string>('');
  const [batchClassFilter, setBatchClassFilter] = useState<string>('ALL');
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});

  const toggleCourseExpand = (courseId: string) => {
    setExpandedCourses((prev) => ({
      ...prev,
      [courseId]: !prev[courseId]
    }));
  };

  const expandAllCourses = (courseIds: string[]) => {
    const next: Record<string, boolean> = {};
    courseIds.forEach((id) => {
      next[id] = true;
    });
    setExpandedCourses(next);
  };

  const collapseAllCourses = () => {
    setExpandedCourses({});
  };

  const handleSyncCourseStudents = async (forceOpenModal: boolean = false) => {
    if (!selectedBatchForRoster) return;
    setLoadingSyncPreview(true);
    setSyncingStudents(true);
    try {
      // 1. Fetch division-aware preview
      const previewRes = await apiClient.get<BatchSyncPreviewResponse>(
        `/academics/batches/${selectedBatchForRoster.id}/sync-preview`
      );
      const preview = previewRes.data;
      setSyncPreviewData(preview);

      // Pre-select students that match this batch or are unassigned
      const initialSelected = preview.students
        .filter((s) => s.is_matched_for_this_batch && !s.is_assigned_to_this_batch)
        .map((s) => s.student_id);
      setSelectedSyncStudentIds(initialSelected);

      // If user forced modal, or there are unassigned/ambiguous students across multiple batches:
      const courseBatchesCount = batches.filter(
        (b) => b.course_id === selectedBatchForRoster.course_id && b.is_active
      ).length;

      if (forceOpenModal || (courseBatchesCount > 1 && preview.unassigned_count > 0)) {
        setSyncPreviewModalOpen(true);
        setSyncingStudents(false);
        setLoadingSyncPreview(false);
        return;
      }

      // Option A: Smart Auto-Sync
      if (preview.matched_count === 0 && preview.unassigned_count === 0) {
        if (preview.already_in_this_batch_count > 0) {
          setFeedback({
            type: 'info',
            text: `All ${preview.already_in_this_batch_count} student(s) for Division ${selectedBatchForRoster.division || 'A'} are already in this roster.`
          });
        } else {
          setFeedback({
            type: 'info',
            text: `No students enrolled for Division ${selectedBatchForRoster.division || 'A'} found in this course.`
          });
        }
        setSyncingStudents(false);
        setLoadingSyncPreview(false);
        return;
      }

      // Execute auto-sync
      const res = await apiClient.post<BatchStudentRosterItem[]>(
        `/academics/batches/${selectedBatchForRoster.id}/sync-enrolled-students`,
        { mode: 'AUTO' }
      );
      setBatchRoster(res.data);
      setFeedback({
        type: 'success',
        text: `Successfully synced ${preview.matched_count} enrolled student(s) into Division ${selectedBatchForRoster.division || 'A'}.`
      });
      fetchAllAcademics();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to sync course students'
      });
    } finally {
      setSyncingStudents(false);
      setLoadingSyncPreview(false);
    }
  };

  const handleConfirmManualSync = async () => {
    if (!selectedBatchForRoster || selectedSyncStudentIds.length === 0) return;
    setSyncingStudents(true);
    try {
      const res = await apiClient.post<BatchStudentRosterItem[]>(
        `/academics/batches/${selectedBatchForRoster.id}/sync-enrolled-students`,
        {
          mode: 'MANUAL',
          selected_student_ids: selectedSyncStudentIds
        }
      );
      setBatchRoster(res.data);
      setFeedback({
        type: 'success',
        text: `Successfully imported ${selectedSyncStudentIds.length} student(s) into Division ${selectedBatchForRoster.division || 'A'}.`
      });
      setSyncPreviewModalOpen(false);
      fetchAllAcademics();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to import students'
      });
    } finally {
      setSyncingStudents(false);
    }
  };

  const handleTransferStudent = async () => {
    if (!selectedBatchForRoster || !transferModalStudent || !targetTransferBatchId) return;
    setTransferringStudent(true);
    try {
      const res = await apiClient.post(
        `/academics/batches/${selectedBatchForRoster.id}/students/${transferModalStudent.student_id}/transfer`,
        { target_batch_id: targetTransferBatchId }
      );
      setBatchRoster((prev) => prev.filter((s) => s.student_id !== transferModalStudent.student_id));
      setFeedback({
        type: 'success',
        text: res.data.message || `Transferred to Division ${res.data.target_division} with Roll #${res.data.new_roll_number}!`
      });
      setTransferModalStudent(null);
      setTargetTransferBatchId('');
      fetchAllAcademics();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to transfer student'
      });
    } finally {
      setTransferringStudent(false);
    }
  };

  const handleRemoveStudentFromBatch = async (studentId: string) => {
    if (!selectedBatchForRoster) return;
    if (!window.confirm('Are you sure you want to remove this student from this division roster?')) return;
    setRemovingStudentId(studentId);
    try {
      await apiClient.delete(`/academics/batches/${selectedBatchForRoster.id}/students/${studentId}`);
      setBatchRoster((prev) => prev.filter((s) => s.student_id !== studentId));
      setFeedback({ type: 'success', text: 'Student removed from this division roster.' });
      fetchAllAcademics();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to remove student' });
    } finally {
      setRemovingStudentId(null);
    }
  };

  // Form states
  const initialSubjectForm = {
    name: '',
    code: '',
    default_theory_marks: 80,
    default_practical_marks: 20,
    default_individual_fee: 5000
  };

  const [subjectForm, setSubjectForm] = useState(initialSubjectForm);

  const initialCourseForm = {
    name: '',
    code: '',
    course_type_id: '',
    class_id: '',
    stream_id: '',
    is_universal: false,
    duration_months: 12,
    initial_base_fee: 45000,
    one_time_fee: '' as string | number,
    installment_fee: '' as string | number,
    description: '',
    subject_ids: [] as string[]
  };

  const [courseForm, setCourseForm] = useState(initialCourseForm);

  const [batchForm, setBatchForm] = useState({
    course_id: '',
    academic_year_id: '',
    name: '',
    code: '',
    division: 'A',
    max_capacity: 45,
    start_date: '2026-06-01',
    end_date: '2027-04-30'
  });

  const getBatchExpiryStatus = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) {
      return {
        label: 'Undated',
        color: 'bg-slate-50 text-slate-600 border-slate-200',
        subText: 'Ready for Attendance',
        statusTextClass: 'text-slate-600',
        isExpired: false
      };
    }
    const today = new Date().toISOString().split('T')[0];
    if (today > endDate) {
      const expiredDays = Math.floor((new Date(today).getTime() - new Date(endDate).getTime()) / (1000 * 60 * 60 * 24));
      return {
        label: 'Course Expired',
        color: 'bg-rose-50 text-rose-700 border-rose-200',
        subText: `Expired ${expiredDays}d ago (${endDate})`,
        statusTextClass: 'text-rose-600 font-semibold',
        isExpired: true
      };
    }
    if (today < startDate) {
      const startInDays = Math.ceil((new Date(startDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
      return {
        label: 'Upcoming',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        subText: `Starts in ${startInDays}d (${startDate})`,
        statusTextClass: 'text-amber-600 font-semibold',
        isExpired: false
      };
    }
    const daysLeft = Math.ceil((new Date(endDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    return {
      label: `Active (${daysLeft}d left)`,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      subText: 'Ready for Attendance',
      statusTextClass: 'text-emerald-600 font-semibold',
      isExpired: false
    };
  };

  const openCreateBatch = (preselectedCourseId?: string) => {
    const curAy = academicYears.find((y: any) => y.is_current) || academicYears[0];
    const targetCourse = typeof preselectedCourseId === 'string' && preselectedCourseId
      ? courses.find((c) => c.id === preselectedCourseId)
      : null;

    let nextDiv = 'A';
    let suggestedName = '';
    let suggestedCode = '';

    if (targetCourse) {
      const existingDivs = batches
        .filter((b) => b.course_id === targetCourse.id)
        .map((b) => (b.division || 'A').toUpperCase());
      const charCodes = existingDivs.map((d) => d.charCodeAt(0)).filter((c) => c >= 65 && c <= 90);
      const maxChar = charCodes.length > 0 ? Math.max(...charCodes) : 64;
      nextDiv = String.fromCharCode(maxChar + 1);
      suggestedName = `${targetCourse.name} - Division ${nextDiv}`;
      const cleanCode = (targetCourse.code || 'DIV').replace(/^CRS-/, '');
      suggestedCode = `BAT-${cleanCode}-${nextDiv}`;
    }

    setBatchForm({
      course_id: targetCourse ? targetCourse.id : '',
      academic_year_id: curAy?.id || '',
      name: suggestedName,
      code: suggestedCode,
      division: nextDiv,
      max_capacity: 50,
      start_date: curAy?.start_date || '2026-06-01',
      end_date: curAy?.end_date || '2027-04-30'
    });
    setShowAddBatch(true);
  };

  const openEditBatch = (b: BatchItem) => {
    setEditingBatchId(b.id);
    setEditBatchForm({
      name: b.name,
      code: b.code,
      division: b.division || 'A',
      max_capacity: b.max_capacity,
      start_date: b.start_date,
      end_date: b.end_date,
      is_active: (b as any).is_active ?? true
    });
    setShowEditBatch(true);
  };

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fetchAllAcademics = async () => {
    try {
      setLoading(true);
      const [clsRes, strRes, subRes, crsRes, bthRes, ctRes, ayRes] = await Promise.all([
        apiClient.get<ClassItem[]>('/academics/classes'),
        apiClient.get<StreamItem[]>('/academics/streams'),
        apiClient.get<SubjectItem[]>('/academics/subjects'),
        apiClient.get<CourseItem[]>('/academics/courses'),
        apiClient.get<BatchItem[]>('/academics/batches'),
        apiClient.get<CourseTypeItem[]>('/academics/course-types').catch(() => ({ data: [] })),
        apiClient.get<any[]>('/academics/years').catch(() => ({ data: [] }))
      ]);

      setClasses(clsRes.data);
      setStreams(strRes.data);
      setSubjects(subRes.data);
      setCourses(crsRes.data);
      setBatches(bthRes.data);
      setCourseTypes(ctRes.data || []);
      setAcademicYears(ayRes.data || []);
    } catch (err: any) {
      console.error('Failed to load academic inventory', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAcademics();
  }, []);

  const openCreateSubject = () => {
    setSubjectForm(initialSubjectForm);
    setEditingSubjectId(null);
    setShowAddSubject(true);
  };

  const openEditSubject = (s: SubjectItem) => {
    setSubjectForm({
      name: s.name,
      code: s.code,
      default_theory_marks: s.default_theory_marks,
      default_practical_marks: s.default_practical_marks,
      default_individual_fee: Number(s.default_individual_fee)
    });
    setEditingSubjectId(s.id);
    setShowAddSubject(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSubjectId) {
        await apiClient.put(`/academics/subjects/${editingSubjectId}`, subjectForm);
        setFeedback({ type: 'success', text: `Subject "${subjectForm.name}" updated successfully!` });
      } else {
        await apiClient.post('/academics/subjects', subjectForm);
        setFeedback({ type: 'success', text: `Subject "${subjectForm.name}" added to curriculum!` });
      }
      setShowAddSubject(false);
      setEditingSubjectId(null);
      setSubjectForm(initialSubjectForm);
      fetchAllAcademics();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to save subject' });
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    try {
      const res = await apiClient.delete<{ message: string; subject_id: string; status: string }>(`/academics/subjects/${subjectId}`);
      setFeedback({ type: 'success', text: res.data.message });
      setDeletingSubject(null);
      fetchAllAcademics();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to delete subject' });
    }
  };

  const toggleCourseSubject = (subId: string) => {
    setCourseForm((prev) => ({
      ...prev,
      subject_ids: prev.subject_ids.includes(subId)
        ? prev.subject_ids.filter((id) => id !== subId)
        : [...prev.subject_ids, subId]
    }));
  };

  const openCreateCourse = () => {
    setEditingCourseId(null);
    setCourseForm(initialCourseForm);
    setShowAddCourse(true);
  };

  const openEditCourse = (crs: CourseItem) => {
    setEditingCourseId(crs.id);
    setCourseForm({
      name: crs.name,
      code: crs.code,
      course_type_id: crs.course_type_id || '',
      class_id: crs.class_id || '',
      stream_id: crs.stream_id || '',
      is_universal: !!crs.is_universal,
      duration_months: crs.duration_months || 12,
      initial_base_fee: crs.current_version ? Number(crs.current_version.base_fee) : 45000,
      one_time_fee: crs.current_version?.one_time_fee ? Number(crs.current_version.one_time_fee) : '',
      installment_fee: crs.current_version?.installment_fee ? Number(crs.current_version.installment_fee) : '',
      description: crs.description || '',
      subject_ids: crs.current_version?.subjects ? crs.current_version.subjects.map((s) => s.id) : []
    });
    setShowAddCourse(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCourseId) {
        const payload = {
          name: courseForm.name,
          code: courseForm.code,
          course_type_id: courseForm.course_type_id || undefined,
          class_id: courseForm.is_universal ? null : (courseForm.class_id || undefined),
          stream_id: courseForm.is_universal ? null : (courseForm.stream_id || undefined),
          is_universal: courseForm.is_universal,
          duration_months: courseForm.duration_months,
          base_fee: Number(courseForm.initial_base_fee),
          one_time_fee: courseForm.one_time_fee !== '' ? Number(courseForm.one_time_fee) : null,
          installment_fee: courseForm.installment_fee !== '' ? Number(courseForm.installment_fee) : null,
          description: courseForm.description || undefined,
          subject_ids: courseForm.subject_ids
        };
        await apiClient.put(`/academics/courses/${editingCourseId}`, payload);
        setFeedback({ type: 'success', text: `Master Course "${courseForm.name}" updated successfully!` });
      } else {
        const payload = {
          ...courseForm,
          initial_base_fee: Number(courseForm.initial_base_fee),
          one_time_fee: courseForm.one_time_fee !== '' ? Number(courseForm.one_time_fee) : undefined,
          installment_fee: courseForm.installment_fee !== '' ? Number(courseForm.installment_fee) : undefined,
          class_id: courseForm.is_universal ? undefined : (courseForm.class_id || undefined),
          stream_id: courseForm.is_universal ? undefined : (courseForm.stream_id || undefined),
          course_type_id: courseForm.course_type_id || undefined,
          description: courseForm.description || undefined
        };
        await apiClient.post('/academics/courses', payload);
        setFeedback({ type: 'success', text: `Master Course "${courseForm.name}" created successfully!` });
      }
      setShowAddCourse(false);
      setEditingCourseId(null);
      setCourseForm(initialCourseForm);
      fetchAllAcademics();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to save course' });
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      const res = await apiClient.delete<{ message: string; course_id: string; status: string }>(`/academics/courses/${courseId}`);
      setFeedback({ type: 'success', text: res.data.message });
      setDeletingCourse(null);
      fetchAllAcademics();
    } catch (err: any) {
      if (err.response?.status === 404) {
        setFeedback({ type: 'success', text: 'Course has been removed from the registry.' });
        setDeletingCourse(null);
        fetchAllAcademics();
      } else {
        setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to delete course' });
      }
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    try {
      const res = await apiClient.delete<{ message: string; batch_id: string; status: string }>(`/academics/batches/${batchId}`);
      setFeedback({ type: 'success', text: res.data.message });
      setDeletingBatch(null);
      if (showEditBatch) setShowEditBatch(false);
      fetchAllAcademics();
    } catch (err: any) {
      if (err.response?.status === 404) {
        setFeedback({ type: 'success', text: 'Batch has been removed from the registry.' });
        setDeletingBatch(null);
        if (showEditBatch) setShowEditBatch(false);
        fetchAllAcademics();
      } else {
        setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to delete batch' });
      }
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchForm.end_date < batchForm.start_date) {
      setFeedback({ type: 'error', text: 'Batch End Date cannot be earlier than Start Date' });
      return;
    }
    try {
      const curAy = academicYears.find((y: any) => y.id === batchForm.academic_year_id) ||
                    academicYears.find((y: any) => y.is_current) ||
                    academicYears[0];

      await apiClient.post('/academics/batches', {
        ...batchForm,
        academic_year_id: curAy?.id
      });
      setFeedback({ type: 'success', text: `Batch ${batchForm.name} established!` });
      setShowAddBatch(false);
      fetchAllAcademics();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to create batch' });
    }
  };

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatchId) return;
    if (editBatchForm.end_date < editBatchForm.start_date) {
      setFeedback({ type: 'error', text: 'Batch End Date cannot be earlier than Start Date' });
      return;
    }
    try {
      await apiClient.put(`/academics/batches/${editingBatchId}`, editBatchForm);
      setFeedback({ type: 'success', text: `Batch ${editBatchForm.name} updated successfully!` });
      setShowEditBatch(false);
      setEditingBatchId(null);
      fetchAllAcademics();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to update batch' });
    }
  };

  const openRosterModal = async (batch: BatchItem) => {
    setSelectedBatchForRoster(batch);
    setLoadingRoster(true);
    setEditingRollStudentId(null);
    try {
      const res = await apiClient.get<BatchStudentRosterItem[]>(`/academics/batches/${batch.id}/roster`);
      setBatchRoster(res.data);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to load batch roster' });
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleGenerateRollNumbers = async () => {
    if (!selectedBatchForRoster) return;
    setGeneratingRoll(true);
    try {
      const res = await apiClient.post<any>(`/academics/batches/${selectedBatchForRoster.id}/generate-roll-numbers`);
      setBatchRoster(res.data.roster);
      setFeedback({ type: 'success', text: res.data.message });
      fetchAllAcademics();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to generate roll numbers' });
    } finally {
      setGeneratingRoll(false);
    }
  };

  const handleSaveCustomRoll = async (studentId: string) => {
    if (!selectedBatchForRoster) return;
    const rollNum = Number(customRollInput);
    if (!rollNum || rollNum <= 0) {
      setFeedback({ type: 'error', text: 'Roll number must be a positive integer.' });
      return;
    }
    try {
      const res = await apiClient.put<BatchStudentRosterItem>(
        `/academics/batches/${selectedBatchForRoster.id}/students/${studentId}/roll-number`,
        { roll_number: rollNum }
      );
      setBatchRoster((prev) =>
        prev.map((s) => (s.student_id === studentId ? { ...s, roll_number: res.data.roll_number } : s))
      );
      setEditingRollStudentId(null);
      setCustomRollInput('');
      setFeedback({ type: 'success', text: `Roll number updated to #${res.data.roll_number} successfully.` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to update roll number' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Academic Inventory & Curriculum</h1>
            <p className="text-sm text-slate-500">
              Zero-Hardcoding Configuration • Master Courses • Classroom Batches & Divisions • Subjects • Classes 5th-12th • Streams
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAllAcademics}
            className="flex items-center space-x-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : feedback.type === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2 text-sm font-medium">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        {[
          { key: 'COURSES', label: 'Master Courses', count: courses.length },
          { key: 'BATCHES', label: 'Teaching Batches', count: batches.length },
          { key: 'ROLLOVER', label: 'Cohort Promotion & Rollover', count: 'New', isNew: true },
          { key: 'SUBJECTS', label: 'Subjects Catalog', count: subjects.length },
          { key: 'CLASSES', label: 'Classes (5th - 12th)', count: classes.length },
          { key: 'STREAMS', label: 'Academic Streams', count: streams.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center space-x-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab 1: COURSES */}
      {activeTab === 'COURSES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">Available Master Courses</h3>
            <button
              onClick={openCreateCourse}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Course</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((crs) => (
              <div key={crs.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 relative group hover:border-blue-300 transition-all">
                <div className="flex items-start justify-between">
                  <div className="pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {crs.code}
                      </span>
                      {crs.is_universal && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                          🌐 Universal / All Grades
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm mt-1">{crs.name}</h4>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {crs.duration_months} Mos
                    </span>
                    <button
                      onClick={() => openEditCourse(crs)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Edit Course"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingCourse(crs)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Delete Course"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {crs.current_version && (
                  <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Base Tuition Fee:</span>
                      <span className="font-bold text-slate-900">
                        ₹{Number(crs.current_version.base_fee).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {(crs.current_version.one_time_fee || crs.current_version.installment_fee) && (
                      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-200/60 text-[10px]">
                        <div>
                          <span className="text-emerald-700 font-medium">One-Time: </span>
                          <span className="font-bold text-emerald-900">
                            {crs.current_version.one_time_fee ? `₹${Number(crs.current_version.one_time_fee).toLocaleString('en-IN')}` : 'Same as Base'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-blue-700 font-medium">EMI: </span>
                          <span className="font-bold text-blue-900">
                            {crs.current_version.installment_fee ? `₹${Number(crs.current_version.installment_fee).toLocaleString('en-IN')}` : 'Same as Base'}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500 pt-0.5">
                      Version {crs.current_version.version_number} • {crs.current_version.subjects?.length || 0} Core Subjects
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: BATCHES */}
      {activeTab === 'BATCHES' && (() => {
        // 1. Group batches by course
        const courseBatchesGrouped = courses.map((c) => {
          const cBatches = batches.filter((b) => b.course_id === c.id);
          cBatches.sort((a, b) => (a.division || 'A').localeCompare(b.division || 'A'));
          const totalEnrolled = cBatches.reduce((sum, b) => sum + (b.enrolled_count || 0), 0);
          const totalCapacity = cBatches.reduce((sum, b) => sum + (b.max_capacity || 0), 0);
          const cls = classes.find((cl) => cl.id === c.class_id);
          const st = streams.find((s) => s.id === c.stream_id);
          return {
            course: c,
            divisions: cBatches,
            totalEnrolled,
            totalCapacity,
            className: cls?.name,
            streamName: st?.name
          };
        });

        // Orphan batches (if course_id not in courses)
        const orphanBatches = batches.filter((b) => !courses.some((c) => c.id === b.course_id));

        // 2. Filter course groups
        const filteredCourseGroups = courseBatchesGrouped.filter((grp) => {
          // Class / Skill filter
          if (batchClassFilter !== 'ALL') {
            if (batchClassFilter === 'UNIVERSAL') {
              if (!grp.course.is_universal) return false;
            } else {
              if (grp.course.class_id !== batchClassFilter) return false;
            }
          }
          // Search term filter
          if (batchSearchTerm.trim()) {
            const q = batchSearchTerm.toLowerCase();
            const matchCourse = grp.course.name.toLowerCase().includes(q) ||
                                grp.course.code.toLowerCase().includes(q);
            const matchDivision = grp.divisions.some((d) =>
              d.name.toLowerCase().includes(q) ||
              d.code.toLowerCase().includes(q) ||
              `division ${d.division}`.toLowerCase().includes(q) ||
              `div ${d.division}`.toLowerCase().includes(q)
            );
            if (!matchCourse && !matchDivision) return false;
          }
          return true;
        });

        // 3. Filter flat batches
        const filteredFlatBatches = batches.filter((b) => {
          const parentCourse = courses.find((c) => c.id === b.course_id);
          if (batchClassFilter !== 'ALL') {
            if (batchClassFilter === 'UNIVERSAL') {
              if (!parentCourse?.is_universal) return false;
            } else {
              if (parentCourse?.class_id !== batchClassFilter) return false;
            }
          }
          if (batchSearchTerm.trim()) {
            const q = batchSearchTerm.toLowerCase();
            const matchBatch = b.name.toLowerCase().includes(q) ||
                               b.code.toLowerCase().includes(q) ||
                               `division ${b.division}`.toLowerCase().includes(q) ||
                               (b.course_name && b.course_name.toLowerCase().includes(q));
            if (!matchBatch) return false;
          }
          return true;
        });

        // Filter pills definition
        const filterPills = [
          { id: 'ALL', label: 'All Courses', count: batches.length },
          ...classes.map((cl) => {
            const count = batches.filter((b) => {
              const c = courses.find((cr) => cr.id === b.course_id);
              return c?.class_id === cl.id;
            }).length;
            return { id: cl.id, label: cl.name, count };
          }),
          {
            id: 'UNIVERSAL',
            label: 'Skill & Universal',
            count: batches.filter((b) => {
              const c = courses.find((cr) => cr.id === b.course_id);
              return c?.is_universal;
            }).length
          }
        ];

        const allFilteredCourseIds = filteredCourseGroups.map((g) => g.course.id);
        const areAllExpanded = allFilteredCourseIds.length > 0 && allFilteredCourseIds.every((id) => !!expandedCourses[id]);

        const handleToggleExpandAll = () => {
          if (areAllExpanded) {
            collapseAllCourses();
          } else {
            expandAllCourses(allFilteredCourseIds);
          }
        };

        const renderDivisionCard = (b: BatchItem) => {
          const expiry = getBatchExpiryStatus(b.start_date, b.end_date);
          return (
            <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {b.code}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Division {b.division || 'A'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${expiry.color}`}>
                      {expiry.label}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mt-1">{b.name}</h4>
                  {b.course_name && (
                    <p className="text-[11px] text-blue-700 font-medium mt-0.5">
                      Course: {b.course_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    {b.enrolled_count || 0} / {b.max_capacity}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditBatch(b)}
                    title="Edit Batch & Validity Dates"
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingBatch(b)}
                    title="Delete Batch / Division"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Assigned Subjects in Batch */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-600">
                  Assigned Subjects & Lectures ({b.batch_subjects?.length || 0}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {b.batch_subjects && b.batch_subjects.length > 0 ? (
                    b.batch_subjects.map((bs) => (
                      <span
                        key={bs.id}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200"
                      >
                        ✓ {bs.subject_name || bs.subject_code}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-amber-700 font-medium">No subjects assigned yet</span>
                  )}
                </div>
              </div>

              {/* Manage Roster Action */}
              <button
                type="button"
                onClick={() => openRosterModal(b)}
                className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold text-xs border border-slate-200 hover:border-blue-300 rounded-xl transition cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Roster & Roll Numbers ({b.enrolled_count || 0})</span>
              </button>

              <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                <div className="flex items-center space-x-1.5 text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Duration: <strong className="text-slate-700">{b.start_date}</strong> → <strong className="text-slate-700">{b.end_date}</strong></span>
                </div>
                <span className={`text-[10px] font-bold ${expiry.statusTextClass}`}>
                  {expiry.subText}
                </span>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">Active Classroom Batches</h3>
                <p className="text-xs text-slate-500">Physical classroom sections, auto-provisioned subjects, capacity limits & attendance rosters.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* View Switcher Toggle */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setBatchViewMode('by_course')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                      batchViewMode === 'by_course'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Group by Course</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchViewMode('flat')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                      batchViewMode === 'flat'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>All Batches Grid</span>
                  </button>
                </div>

                {/* Create Batch Button */}
                <button
                  type="button"
                  onClick={() => openCreateBatch()}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Batch</span>
                </button>
              </div>
            </div>

            {/* Search & Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search course or division (e.g. 9th, Division B, BAT-09)..."
                  value={batchSearchTerm}
                  onChange={(e) => setBatchSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                {batchSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setBatchSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {batchViewMode === 'by_course' && (
                <button
                  type="button"
                  onClick={handleToggleExpandAll}
                  className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  {areAllExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                      <span>Collapse All Courses</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                      <span>Expand All Courses</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {filterPills.map((pill) => {
                const isSelected = batchClassFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setBatchClassFilter(pill.id)}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold transition border flex items-center space-x-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isSelected ? 'bg-blue-700/80 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Content Area */}
            {batchViewMode === 'by_course' ? (
              <div className="space-y-3.5">
                {filteredCourseGroups.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                    <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                    <h4 className="text-sm font-bold text-slate-700">No courses matching your filter</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Try selecting "All Courses" or clearing your search term to see teaching batches.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setBatchClassFilter('ALL');
                        setBatchSearchTerm('');
                      }}
                      className="mt-3.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 transition cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  filteredCourseGroups.map((grp) => {
                    const isExpanded = batchSearchTerm.trim() !== '' ? true : !!expandedCourses[grp.course.id];
                    return (
                      <div
                        key={grp.course.id}
                        className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-200 hover:border-blue-300"
                      >
                        {/* Course Accordion Header */}
                        <div
                          onClick={() => toggleCourseExpand(grp.course.id)}
                          className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer transition select-none ${
                            isExpanded ? 'bg-blue-50/40 border-b border-blue-100' : 'bg-white hover:bg-slate-50/80'
                          }`}
                        >
                          <div className="flex items-start sm:items-center space-x-3.5">
                            <div className={`p-2.5 rounded-xl border transition ${
                              isExpanded
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              <GraduationCap className="w-5 h-5" />
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {grp.course.code}
                                </span>
                                {grp.className && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {grp.className}
                                  </span>
                                )}
                                {grp.streamName && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                                    {grp.streamName}
                                  </span>
                                )}
                                {grp.course.is_universal && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                    Universal / Skill
                                  </span>
                                )}
                              </div>

                              <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center space-x-2">
                                <span>{grp.course.name}</span>
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                {grp.course.description || `${grp.course.duration_months || 12} months duration`}
                              </p>
                            </div>
                          </div>

                          {/* Right Controls: Stats, Add Division & Chevron */}
                          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center space-x-1">
                                <Layers className="w-3.5 h-3.5" />
                                <span>
                                  {grp.divisions.length} {grp.divisions.length === 1 ? 'Division' : 'Divisions'}
                                  {grp.divisions.length > 0 && ` (${grp.divisions.map((d) => d.division || 'A').join(', ')})`}
                                </span>
                              </span>
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                                <Users className="w-3.5 h-3.5" />
                                <span>{grp.totalEnrolled} / {grp.totalCapacity} Students</span>
                              </span>
                            </div>

                            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => openCreateBatch(grp.course.id)}
                                title={`Add Division to ${grp.course.name}`}
                                className="flex items-center space-x-1 px-3 py-1 bg-white hover:bg-blue-600 hover:text-white text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 hover:border-blue-600 shadow-sm transition cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Division</span>
                              </button>
                            </div>

                            <div className="p-1 text-slate-400 hover:text-slate-600 transition">
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-blue-600" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Child Divisions Grid */}
                        {isExpanded && (
                          <div className="p-4 sm:p-5 bg-slate-50/40 border-t border-slate-100">
                            {grp.divisions.length === 0 ? (
                              <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-300">
                                <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-xs font-semibold text-slate-700">No classroom divisions scheduled yet</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">Click "Add Division" above to schedule Division A for this course.</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {grp.divisions.map((b) => renderDivisionCard(b))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Orphan Batches Section (if any batches are not linked to courses) */}
                {orphanBatches.length > 0 && (
                  <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden mt-4">
                    <div className="p-4 sm:p-5 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">Standalone / Custom Batches</h4>
                          <p className="text-xs text-slate-500">Batches not linked to an active master course catalog entry.</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">
                        {orphanBatches.length} Batches
                      </span>
                    </div>
                    <div className="p-4 sm:p-5 bg-slate-50/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {orphanBatches.map((b) => renderDivisionCard(b))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Flat Grid View */
              <div>
                {filteredFlatBatches.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                    <LayoutGrid className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                    <h4 className="text-sm font-bold text-slate-700">No batches match the selected criteria</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setBatchClassFilter('ALL');
                        setBatchSearchTerm('');
                      }}
                      className="mt-3.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 transition cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredFlatBatches.map((b) => renderDivisionCard(b))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab 3: SUBJECTS */}
      {activeTab === 'SUBJECTS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800">Subjects Catalog</h3>
              <p className="text-xs text-slate-500">Master subject definitions, default marks, and standalone individual fees. Dynamic tests and flexible marks are managed in Exams & Results.</p>
            </div>
            <button
              onClick={openCreateSubject}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subject</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Subject Name</th>
                  <th className="py-3 px-6">Code</th>
                  <th className="py-3 px-6 text-center">Default Marks</th>
                  <th className="py-3 px-6 text-right">Individual Fee</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-6 font-semibold text-slate-900">{s.name}</td>
                    <td className="py-3.5 px-6 font-mono text-xs font-bold text-slate-600">{s.code}</td>
                    <td className="py-3.5 px-6 text-center text-xs font-semibold text-slate-700">
                      {s.default_theory_marks || 100} Marks
                    </td>
                    <td className="py-3.5 px-6 text-right font-bold text-emerald-600">
                      ₹{Number(s.default_individual_fee).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => openEditSubject(s)}
                          title="Edit Subject"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingSubject(s)}
                          title="Delete Subject"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: CLASSES */}
      {activeTab === 'CLASSES' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-800">Supported Standards & Classes (5th - 12th)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {classes.map((cls) => (
              <div key={cls.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">{cls.code}</span>
                <p className="font-bold text-slate-900 text-sm mt-1">{cls.name}</p>
                <p className="text-xs text-slate-500 mt-1">Level Index #{cls.order_index}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: STREAMS */}
      {activeTab === 'STREAMS' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-800">Academic Streams</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {streams.map((str) => (
              <div key={str.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <span className="text-[10px] font-mono text-blue-600 font-bold uppercase px-2 py-0.5 rounded bg-blue-50">
                  {str.code}
                </span>
                <h4 className="font-bold text-slate-900 text-base">{str.name}</h4>
                <p className="text-xs text-slate-500">{str.description || 'Configured stream for higher secondary.'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: COHORT PROMOTION & ROLLOVER */}
      {activeTab === 'ROLLOVER' && (
        <CohortPromotionWizard
          academicYears={academicYears}
          classes={classes}
          courses={courses}
          batches={batches}
          onRefreshAcademics={fetchAllAcademics}
        />
      )}

      {/* Add / Edit Subject Modal */}
      {showAddSubject && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingSubjectId ? 'Edit Subject' : 'Add Academic Subject'}
              </h3>
              <button
                onClick={() => {
                  setShowAddSubject(false);
                  setEditingSubjectId(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sanskrit / Computer Science"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS-01"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Max Marks</label>
                <input
                  type="number"
                  min="0"
                  value={subjectForm.default_theory_marks}
                  onChange={(e) => setSubjectForm({ ...subjectForm, default_theory_marks: Number(e.target.value), default_practical_marks: 0 })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  * No practical marks required. Exact test marks (e.g. 25, 50, 100, 300, 720) are customized when scheduling each test.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Individual Standalone Fee (₹)</label>
                <input
                  type="number"
                  value={subjectForm.default_individual_fee}
                  onChange={(e) => setSubjectForm({ ...subjectForm, default_individual_fee: Number(e.target.value) })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSubject(false);
                    setEditingSubjectId(null);
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
                >
                  {editingSubjectId ? 'Update Subject' : 'Establish Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Subject Confirmation Modal */}
      {deletingSubject && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 border-b pb-3">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Delete Subject</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete subject <span className="font-bold text-slate-900">"{deletingSubject.name}"</span> ({deletingSubject.code})?
            </p>
            <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              Note: The system checks for active student enrollments and examination records before allowing deletion to preserve institutional integrity.
            </p>
            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setDeletingSubject(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSubject(deletingSubject.id)}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Master Course Modal */}
      {showAddCourse && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingCourseId ? 'Edit Master Course' : 'Create New Master Course'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingCourseId
                    ? 'Update course curriculum specifications, tuition fees, and subject assignments'
                    : 'Define an academic curriculum offering visible during student admission'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddCourse(false);
                  setEditingCourseId(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 11th Science - Regular + CET Preparation"
                    value={courseForm.name}
                    onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CRS-11-SCI-CET"
                    value={courseForm.code}
                    onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course Type
                  </label>
                  <select
                    value={courseForm.course_type_id}
                    onChange={(e) => setCourseForm({ ...courseForm, course_type_id: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">-- Standard / Regular --</option>
                    {courseTypes.map((ct) => (
                      <option key={ct.id} value={ct.id}>
                        {ct.name} ({ct.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 bg-purple-50/70 p-3 rounded-xl border border-purple-200">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={courseForm.is_universal}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setCourseForm({
                          ...courseForm,
                          is_universal: isChecked,
                          class_id: isChecked ? '' : courseForm.class_id,
                          stream_id: isChecked ? '' : courseForm.stream_id
                        });
                      }}
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-purple-900">🌐 Universal / Skill Program (Open to all grades)</span>
                      <p className="text-[11px] text-purple-700">Check this for courses without class restrictions (e.g. Spoken English, Vedic Maths, Coding Bootcamps).</p>
                    </div>
                  </label>
                </div>

                {!courseForm.is_universal ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Target Academic Class *
                      </label>
                      <select
                        required={!courseForm.is_universal}
                        value={courseForm.class_id}
                        onChange={(e) => setCourseForm({ ...courseForm, class_id: e.target.value })}
                        className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="">-- Choose Class (5th to 12th) --</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} ({cls.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Stream (Optional)
                      </label>
                      <select
                        value={courseForm.stream_id}
                        onChange={(e) => setCourseForm({ ...courseForm, stream_id: e.target.value })}
                        className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="">-- None / All Streams --</option>
                        {streams.map((str) => (
                          <option key={str.id} value={str.id}>
                            {str.name} ({str.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2 p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-800 flex items-center gap-2">
                    <span className="text-base">ℹ️</span>
                    <span>This course will be available institute-wide across all standards, for direct standalone skill admissions, and as an optional add-on elective.</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Duration (Months) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    required
                    value={courseForm.duration_months}
                    onChange={(e) => setCourseForm({ ...courseForm, duration_months: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Base Tuition Fee (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      required
                      value={courseForm.initial_base_fee}
                      onChange={(e) => setCourseForm({ ...courseForm, initial_base_fee: Number(e.target.value) })}
                      className="w-full pl-7 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Dual Pricing Scheme (One-Time vs Installments)
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Optional: defaults to Base Fee if left blank
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-emerald-800 mb-1">
                        One-Time Full Upfront Fee (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400 text-xs">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          placeholder={courseForm.initial_base_fee ? `e.g. ${courseForm.initial_base_fee}` : 'e.g. 30000'}
                          value={courseForm.one_time_fee}
                          onChange={(e) => setCourseForm({ ...courseForm, one_time_fee: e.target.value === '' ? '' : Number(e.target.value) })}
                          className="w-full pl-6 pr-3 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-emerald-900"
                        />
                      </div>
                      <p className="text-[10px] text-emerald-600 mt-0.5">Discounted fee when paid 100% upfront</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-blue-800 mb-1">
                        Installment Plan Total Fee (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400 text-xs">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          placeholder={courseForm.initial_base_fee ? `e.g. ${courseForm.initial_base_fee}` : 'e.g. 35000'}
                          value={courseForm.installment_fee}
                          onChange={(e) => setCourseForm({ ...courseForm, installment_fee: e.target.value === '' ? '' : Number(e.target.value) })}
                          className="w-full pl-6 pr-3 py-1.5 text-xs bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-blue-900"
                        />
                      </div>
                      <p className="text-[10px] text-blue-600 mt-0.5">Total fee when split across 2–4 installments</p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description / Program Scope
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Comprehensive curriculum covering Board + CET syllabus"
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Core Subjects Checkbox Grid */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Included Core Subjects ({courseForm.subject_ids.length} Selected)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Click to include/exclude in curriculum
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50/50">
                  {subjects.map((sub) => {
                    const isSelected = courseForm.subject_ids.includes(sub.id);
                    return (
                      <button
                        type="button"
                        key={sub.id}
                        onClick={() => toggleCourseSubject(sub.id)}
                        className={`p-2 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300 text-blue-900 font-medium'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="truncate mr-1">
                          <span className="font-bold text-[10px] font-mono px-1 py-0.5 bg-slate-100 text-slate-700 rounded mr-1">
                            {sub.code}
                          </span>
                          <span className="truncate">{sub.name}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCourse(false);
                    setEditingCourseId(null);
                    setCourseForm(initialCourseForm);
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!courseForm.name || !courseForm.code || (!courseForm.is_universal && !courseForm.class_id)}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {editingCourseId ? 'Save & Update Course' : 'Save & Publish Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Archive Course Confirmation Modal */}
      {deletingCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete / Archive Course</h3>
                <p className="text-xs text-slate-500">Academic & Financial Protection</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove <strong className="text-slate-900">{deletingCourse.name}</strong> ({deletingCourse.code})?
            </p>
            <p className="text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <strong>Enterprise Integrity:</strong> If students are currently enrolled or teaching batches are scheduled, the system will safely archive/deactivate this course to preserve all historical financial and examination records.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCourse(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCourse(deletingCourse.id)}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Batch Confirmation Dialog */}
      {deletingBatch && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Delete Classroom Batch</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete <strong className="text-slate-900">{deletingBatch.name}</strong> ({deletingBatch.code}, Division {deletingBatch.division || 'A'})?
            </p>
            {deletingBatch.enrolled_count && deletingBatch.enrolled_count > 0 ? (
              <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                <strong>Active Enrollments Detected:</strong> This batch currently has {deletingBatch.enrolled_count} student(s) enrolled. You must first transfer or remove all students before deleting this batch.
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                This batch has 0 students enrolled and can be safely deleted.
              </p>
            )}
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingBatch(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingBatch.enrolled_count && deletingBatch.enrolled_count > 0)}
                onClick={() => handleDeleteBatch(deletingBatch.id)}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddBatch && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Create Academic Batch</h3>
              <button onClick={() => setShowAddBatch(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Associated Course *</label>
                <select
                  required
                  value={batchForm.course_id}
                  onChange={(e) => {
                    const newCourseId = e.target.value;
                    const targetCourse = courses.find((c) => c.id === newCourseId);
                    let nextDiv = batchForm.division || 'A';
                    let newName = batchForm.name;
                    let newCode = batchForm.code;
                    if (targetCourse) {
                      const existingDivs = batches
                        .filter((b) => b.course_id === targetCourse.id)
                        .map((b) => (b.division || 'A').toUpperCase());
                      const charCodes = existingDivs.map((d) => d.charCodeAt(0)).filter((c) => c >= 65 && c <= 90);
                      const maxChar = charCodes.length > 0 ? Math.max(...charCodes) : 64;
                      nextDiv = String.fromCharCode(maxChar + 1);
                      if (!batchForm.name || batchForm.name.includes(' - Division ')) {
                        newName = `${targetCourse.name} - Division ${nextDiv}`;
                      }
                      const cleanCode = (targetCourse.code || 'DIV').replace(/^CRS-/, '');
                      if (!batchForm.code || batchForm.code.startsWith('BAT-')) {
                        newCode = `BAT-${cleanCode}-${nextDiv}`;
                      }
                    }
                    setBatchForm({
                      ...batchForm,
                      course_id: newCourseId,
                      division: nextDiv,
                      name: newName,
                      code: newCode
                    });
                  }}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">-- Choose Course --</option>
                  {courses.map((c) => {
                    const isCombined = c.duration_months > 12 || c.name?.toLowerCase().includes('combined');
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {isCombined ? '★ (Multi-Year Combined)' : ''}
                      </option>
                    );
                  })}
                </select>

                {/* Multi-Year Combined Course Guidance */}
                {(() => {
                  const selectedBatchCourse = courses.find((c) => c.id === batchForm.course_id);
                  if (selectedBatchCourse && (selectedBatchCourse.duration_months > 12 || selectedBatchCourse.name?.toLowerCase().includes('combined'))) {
                    return (
                      <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                          <span>⚠️</span>
                          <span>Multi-Year Combined Program (Shared Classroom Batches)</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          Students in this combined program attend physical lectures in the regular batches of their entry grade ({classes.find((cls) => cls.id === selectedBatchCourse.class_id)?.name || 'Entry Standard'}).
                          To configure divisions or schedules, please select the standard's Regular Course instead.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Auto-Provisioned Subjects Preview */}
                {(() => {
                  const selectedBatchCourse = courses.find((c) => c.id === batchForm.course_id);
                  if (!selectedBatchCourse?.current_version?.subjects?.length) return null;
                  return (
                    <div className="mt-2.5 p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-blue-950">
                        <span>Auto-Provisioned Subjects ({selectedBatchCourse.current_version.subjects.length}):</span>
                        <span className="text-[10px] text-blue-700 font-medium">Inherited for Attendance</span>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {selectedBatchCourse.current_version.subjects.map((s) => (
                          <span
                            key={s.id}
                            className="text-[10px] font-medium px-2 py-0.5 rounded bg-white text-blue-800 border border-blue-200"
                          >
                            ✓ {s.name} ({s.code})
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 12th Sci Morning Elite"
                  value={batchForm.name}
                  onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="BATCH-01"
                    value={batchForm.code}
                    onChange={(e) => setBatchForm({ ...batchForm, code: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Division *</label>
                  <select
                    value={batchForm.division}
                    onChange={(e) => setBatchForm({ ...batchForm, division: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="A">Division A</option>
                    <option value="B">Division B</option>
                    <option value="C">Division C</option>
                    <option value="D">Division D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    value={batchForm.max_capacity}
                    onChange={(e) => setBatchForm({ ...batchForm, max_capacity: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Batch Duration & Expiry Dates */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Batch Start Date *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Commencement</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={batchForm.start_date}
                    onChange={(e) => setBatchForm({ ...batchForm, start_date: e.target.value })}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Batch End Date *</span>
                    <span className="text-[10px] text-amber-600 font-medium">Course Expiry</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={batchForm.start_date}
                    value={batchForm.end_date}
                    onChange={(e) => setBatchForm({ ...batchForm, end_date: e.target.value })}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {batchForm.start_date && batchForm.end_date && (
                  <div className="col-span-2 text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      Calculated Duration:
                    </span>
                    <span className="font-semibold text-slate-700">
                      {(() => {
                        const s = new Date(batchForm.start_date);
                        const e = new Date(batchForm.end_date);
                        const diffTime = e.getTime() - s.getTime();
                        if (diffTime < 0) return 'Invalid: End date precedes start date';
                        const days = Math.round(diffTime / (1000 * 3600 * 24));
                        const months = (days / 30.4).toFixed(1);
                        return `${days} Days (~${months} Months)`;
                      })()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddBatch(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!batchForm.course_id || (courses.find((c) => c.id === batchForm.course_id)?.duration_months || 0) > 12}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Establish Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {showEditBatch && editingBatchId && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Batch & Validity Dates</h3>
              </div>
              <button onClick={() => setShowEditBatch(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateBatch} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Name *</label>
                <input
                  type="text"
                  required
                  value={editBatchForm.name}
                  onChange={(e) => setEditBatchForm({ ...editBatchForm, name: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Code *</label>
                  <input
                    type="text"
                    required
                    value={editBatchForm.code}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, code: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Division *</label>
                  <select
                    value={editBatchForm.division}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, division: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="A">Division A</option>
                    <option value="B">Division B</option>
                    <option value="C">Division C</option>
                    <option value="D">Division D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    value={editBatchForm.max_capacity}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, max_capacity: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Batch Duration & Expiry Dates */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Batch Start Date *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Commencement</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editBatchForm.start_date}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, start_date: e.target.value })}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Batch End Date *</span>
                    <span className="text-[10px] text-amber-600 font-medium">Course Expiry</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={editBatchForm.start_date}
                    value={editBatchForm.end_date}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, end_date: e.target.value })}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {editBatchForm.start_date && editBatchForm.end_date && (
                  <div className="col-span-2 text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      Lifecycle Status:
                    </span>
                    <span className="font-semibold text-slate-700">
                      {(() => {
                        const status = getBatchExpiryStatus(editBatchForm.start_date, editBatchForm.end_date);
                        return status.subText;
                      })()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    const target = batches.find((b) => b.id === editingBatchId);
                    if (target) {
                      setShowEditBatch(false);
                      setDeletingBatch(target);
                    }
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Batch</span>
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowEditBatch(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Roster & Roll Numbers Modal */}
      {selectedBatchForRoster && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedBatchForRoster.name}
                  </h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Division {selectedBatchForRoster.division || 'A'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Classroom Roster & Roll Number Directory ({batchRoster.length} students enrolled)
                </p>
              </div>
              <button
                onClick={() => setSelectedBatchForRoster(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Auto-Assign Action Banner */}
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-bold text-blue-950 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Standard Prefix Roll Numbering</span>
                </p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Alphabetical sort by surname: 5th std &rarr; 501+, 10th std &rarr; 1001+ (Div B offset: +50).
                </p>
              </div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <div className="inline-flex rounded-lg shadow-sm">
                  <button
                    type="button"
                    onClick={() => handleSyncCourseStudents(false)}
                    disabled={syncingStudents || loadingSyncPreview}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-l-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    title="Smart sync students enrolled for this division"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{syncingStudents ? 'Syncing...' : 'Sync Course Students'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSyncCourseStudents(true)}
                    disabled={syncingStudents || loadingSyncPreview}
                    className="px-2 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-r-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer border-l border-emerald-500/50"
                    title="Review & Select Students from Course"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateRollNumbers}
                  disabled={generatingRoll || batchRoster.length === 0}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{generatingRoll ? 'Assigning...' : 'Auto-Assign Roll Numbers'}</span>
                </button>
              </div>
            </div>

            {/* Roster Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              {loadingRoster ? (
                <div className="p-10 text-center text-xs text-slate-400">Loading roster...</div>
              ) : batchRoster.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500 space-y-2">
                  <p className="font-semibold text-slate-700">No students enrolled in this division yet.</p>
                  <p className="text-[11px] text-slate-400">
                    Click &ldquo;Sync Course Students&rdquo; to auto-import students enrolled for Division {selectedBatchForRoster.division || 'A'}.
                  </p>
                  <div className="flex items-center justify-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSyncCourseStudents(false)}
                      disabled={syncingStudents}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{syncingStudents ? 'Syncing...' : `Sync Div ${selectedBatchForRoster.division || 'A'} Students`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSyncCourseStudents(true)}
                      disabled={syncingStudents}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer border border-slate-300"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Review All Course Students</span>
                    </button>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4 w-28">Roll No.</th>
                      <th className="py-2.5 px-4">PRN</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4">Gender</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchRoster.map((s) => {
                      const otherDivisions = batches.filter(
                        (b) => b.course_id === selectedBatchForRoster.course_id && b.id !== selectedBatchForRoster.id && b.is_active
                      );
                      return (
                        <tr key={s.student_id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-4">
                            {editingRollStudentId === s.student_id ? (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="number"
                                  autoFocus
                                  value={customRollInput}
                                  onChange={(e) => setCustomRollInput(e.target.value)}
                                  className="w-16 p-1 text-xs border border-blue-400 rounded bg-white text-slate-900 font-bold font-mono focus:outline-none"
                                />
                                <button
                                  onClick={() => handleSaveCustomRoll(s.student_id)}
                                  className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingRollStudentId(null)}
                                  className="px-1 py-0.5 text-slate-400 hover:text-slate-600 text-[10px]"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : s.roll_number ? (
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                                #{s.roll_number}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-purple-700">
                            {s.prn || (s.student_code ? s.student_code.replace('STU-', 'PRN-') : '—')}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-900">
                            {s.first_name} {s.last_name}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">{s.gender}</td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRollStudentId(s.student_id);
                                  setCustomRollInput(s.roll_number || '');
                                }}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition cursor-pointer"
                                title="Edit Roll Number"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {otherDivisions.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTransferModalStudent(s);
                                    setTargetTransferBatchId(otherDivisions[0]?.id || '');
                                  }}
                                  className="p-1 hover:bg-purple-50 rounded text-slate-500 hover:text-purple-600 transition cursor-pointer"
                                  title="Transfer Student to Another Division"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveStudentFromBatch(s.student_id)}
                                disabled={removingStudentId === s.student_id}
                                className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition cursor-pointer disabled:opacity-50"
                                title="Remove from this division roster"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setSelectedBatchForRoster(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Student Division Modal */}
      {transferModalStudent && selectedBatchForRoster && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Transfer Student Division</h3>
                  <p className="text-[11px] text-slate-500">Move student to another division in this course</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setTransferModalStudent(null);
                  setTargetTransferBatchId('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <p className="text-xs font-bold text-slate-900">
                {transferModalStudent.first_name} {transferModalStudent.last_name}
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                PRN: {transferModalStudent.prn || transferModalStudent.student_code} • Current: Division {selectedBatchForRoster.division || 'A'} (Roll #{transferModalStudent.roll_number || 'None'})
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Target Destination Division <span className="text-rose-500">*</span></label>
              <select
                value={targetTransferBatchId}
                onChange={(e) => setTargetTransferBatchId(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                {batches
                  .filter((b) => b.course_id === selectedBatchForRoster.course_id && b.id !== selectedBatchForRoster.id && b.is_active)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (Division {b.division || 'A'})
                    </option>
                  ))}
              </select>
            </div>

            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-[11px] text-purple-900 flex items-start space-x-2">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>
                New roll number will be automatically assigned based on the target division's offset (Option 1: Div B offset is +50). Previous roll #{transferModalStudent.roll_number} in Division {selectedBatchForRoster.division || 'A'} will be released.
              </span>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  setTransferModalStudent(null);
                  setTargetTransferBatchId('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransferStudent}
                disabled={transferringStudent || !targetTransferBatchId}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
              >
                {transferringStudent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                <span>{transferringStudent ? 'Transferring...' : 'Confirm Transfer'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review & Manual Selection Sync Modal */}
      {syncPreviewModalOpen && syncPreviewData && selectedBatchForRoster && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Review Course Students for {selectedBatchForRoster.name}
                  </h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Division {selectedBatchForRoster.division || 'A'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select which enrolled course students to import into this batch division.
                </p>
              </div>
              <button
                onClick={() => setSyncPreviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Enrolled</p>
                <p className="text-sm font-extrabold text-slate-900">{syncPreviewData.total_course_enrollments}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-[10px] font-bold text-emerald-700 uppercase">Div {selectedBatchForRoster.division || 'A'} Enrolled</p>
                <p className="text-sm font-extrabold text-emerald-800">{syncPreviewData.matched_count}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-[10px] font-bold text-amber-700 uppercase">Unassigned Div</p>
                <p className="text-sm font-extrabold text-amber-800">{syncPreviewData.unassigned_count}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-[10px] font-bold text-blue-700 uppercase">Already In Roster</p>
                <p className="text-sm font-extrabold text-blue-800">{syncPreviewData.already_in_this_batch_count}</p>
              </div>
            </div>

            {/* Student Checklist Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              {syncPreviewData.students.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400">
                  No active enrollments found for this course.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={
                            selectedSyncStudentIds.length > 0 &&
                            syncPreviewData.students.filter((s) => !s.is_assigned_to_this_batch).every((s) => selectedSyncStudentIds.includes(s.student_id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSyncStudentIds(
                                syncPreviewData.students.filter((s) => !s.is_assigned_to_this_batch).map((s) => s.student_id)
                              );
                            } else {
                              setSelectedSyncStudentIds([]);
                            }
                          }}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th className="py-2.5 px-4">Student</th>
                      <th className="py-2.5 px-4">Enrolled Division</th>
                      <th className="py-2.5 px-4">Current Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {syncPreviewData.students.map((stu) => {
                      const isSelected = selectedSyncStudentIds.includes(stu.student_id);
                      return (
                        <tr
                          key={stu.student_id}
                          className={`transition ${stu.is_assigned_to_this_batch ? 'bg-slate-50/60 opacity-60' : isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50/50'}`}
                        >
                          <td className="py-2.5 px-4 text-center">
                            {stu.is_assigned_to_this_batch ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSyncStudentIds((prev) => [...prev, stu.student_id]);
                                  } else {
                                    setSelectedSyncStudentIds((prev) => prev.filter((id) => id !== stu.student_id));
                                  }
                                }}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            <p className="font-semibold text-slate-900">{stu.first_name} {stu.last_name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">PRN: {stu.prn || stu.student_code} • {stu.gender}</p>
                          </td>
                          <td className="py-2.5 px-4">
                            {stu.enrolled_division ? (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stu.enrolled_division === (selectedBatchForRoster.division || 'A') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                Enrolled: Div {stu.enrolled_division}
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            {stu.is_assigned_to_this_batch ? (
                              <span className="text-[11px] font-semibold text-emerald-700 flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>In Roster (#{stu.current_roll_number})</span>
                              </span>
                            ) : stu.is_assigned_to_other_batch ? (
                              <span className="text-[11px] font-semibold text-amber-700 flex items-center space-x-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Active in Div {stu.current_division}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500">Ready to Import</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const eligible = syncPreviewData.students
                      .filter((s) => s.is_matched_for_this_batch && !s.is_assigned_to_this_batch)
                      .map((s) => s.student_id);
                    setSelectedSyncStudentIds(eligible);
                  }}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                >
                  Select Div {selectedBatchForRoster.division || 'A'} Only
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedSyncStudentIds([])}
                  className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSyncPreviewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmManualSync}
                  disabled={syncingStudents || selectedSyncStudentIds.length === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                >
                  {syncingStudents ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                  <span>Import Selected ({selectedSyncStudentIds.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
