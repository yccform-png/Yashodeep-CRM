import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  TrendingUp,
  FileCheck,
  Send,
  Eye,
  X,
  GraduationCap,
  Sparkles,
  Users,
  Clock,
  Layers,
  Filter,
  Check,
  Percent,
  Trash2,
  AlertTriangle,
  Folder,
  FolderOpen,
  FolderTree,
  Bell
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

interface ExamTypeOption {
  id: string;
  name: string;
  code: string;
  weightage_percent: number;
}

interface ExaminationItem {
  id: string;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
  is_published: boolean;
  class_id?: string | null;
  class_name?: string | null;
  course_id?: string | null;
  course_name?: string | null;
  subject_name?: string | null;
  max_marks?: number | null;
  passing_marks?: number | null;
}

interface ExamPaperDetail {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  class_id: string;
  class_name: string;
  course_id?: string | null;
  course_name?: string | null;
  exam_date: string;
  duration_minutes: number;
  max_marks: number;
  passing_marks: number;
  has_negative_marking: boolean;
  negative_mark_weight: number;
  theory_max_marks: number;
  practical_max_marks: number;
  marks: {
    student_id: string;
    student_name: string;
    student_code: string;
    prn?: string;
    marks_obtained?: number | null;
    total_marks_obtained: number;
    is_absent: boolean;
    is_withheld: boolean;
    status: string;
  }[];
}

interface ExamResultCard {
  student_id: string;
  student_name: string;
  student_code: string;
  prn?: string;
  total_obtained: number;
  total_possible: number;
  percentage: number;
  grade: string;
  is_pass: boolean;
}

interface ExamDetailResponse {
  id: string;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
  is_published: boolean;
  subjects: ExamPaperDetail[];
  results: ExamResultCard[];
}

interface ClassItem {
  id: string;
  name: string;
  code: string;
}

interface CourseItem {
  id: string;
  name: string;
  code: string;
  class_id?: string | null;
  current_version?: {
    id: string;
    version_number: number;
    subjects: SubjectItem[];
  };
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  default_theory_marks?: number;
}

interface MarksEntryRow {
  student_id: string;
  student_name: string;
  student_code: string;
  prn?: string;
  roll_number?: number | null;
  marks_obtained: number | string;
  is_absent: boolean;
}

export const Examinations: React.FC = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole(['SUPER_ADMIN', 'ADMIN', 'TEACHER']);

  const [examinations, setExaminations] = useState<ExaminationItem[]>([]);
  const [examTypes, setExamTypes] = useState<ExamTypeOption[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);

  // Filtering States
  const [filterClassId, setFilterClassId] = useState<string>('ALL');
  const [filterCourseId, setFilterCourseId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedExamDetail, setSelectedExamDetail] = useState<ExamDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [showCreateExam, setShowCreateExam] = useState<boolean>(false);
  const [showEnterMarks, setShowEnterMarks] = useState<boolean>(false);
  const [selectedPaper, setSelectedPaper] = useState<ExamPaperDetail | null>(null);

  // Create Exam Form state (Flexible Marks, No Practicals)
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    exam_type_id: '',
    academic_year_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    selected_class_id: '',
    selected_course_id: '',
    selected_subject_id: '',
    duration_minutes: 60,
    max_marks: 50,
    passing_marks: 20,
    has_negative_marking: false,
    negative_weight: 0.25
  });

  // Marks Entry Form state
  const [marksFormEntries, setMarksFormEntries] = useState<MarksEntryRow[]>([]);
  const [loadingEligibleStudents, setLoadingEligibleStudents] = useState<boolean>(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Helper: Get subjects available for a given class and optional course
  const getSubjectsForContext = (targetClassId?: string, targetCourseId?: string): SubjectItem[] => {
    if (!targetClassId) return subjects;

    if (targetCourseId && targetCourseId !== 'unassigned_course') {
      const crs = courses.find((c) => c.id === targetCourseId);
      if (crs?.current_version?.subjects && crs.current_version.subjects.length > 0) {
        return crs.current_version.subjects;
      }
    }

    // Gather from all courses under this class
    const relevantCourses = courses.filter((c) => c.class_id === targetClassId);
    const subjMap = new Map<string, SubjectItem>();
    for (const cr of relevantCourses) {
      if (cr.current_version?.subjects) {
        for (const s of cr.current_version.subjects) {
          subjMap.set(s.id, s);
        }
      }
    }
    if (subjMap.size > 0) {
      return Array.from(subjMap.values());
    }
    return subjects;
  };

  // Helper: Auto-generate unique test code
  const generateTestCode = (targetClassId?: string, targetSubjectId?: string): string => {
    const cls = classes.find((c) => c.id === targetClassId);
    const sub = subjects.find((s) => s.id === targetSubjectId);

    const subCode = sub ? sub.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : 'TEST';
    const clsCode = cls ? cls.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : 'GEN';
    const prefix = `${subCode}-${clsCode}-T`;

    let num = 1;
    while (examinations.some((e) => e.code.toUpperCase() === `${prefix}${num}`)) {
      num += 1;
    }
    return `${prefix}${num}`;
  };

  // Helper: Suggest test title
  const suggestTestName = (targetClassId?: string, targetSubjectId?: string, targetExamTypeId?: string): string => {
    const cls = classes.find((c) => c.id === targetClassId);
    const sub = subjects.find((s) => s.id === targetSubjectId);
    const et = examTypes.find((t) => t.id === targetExamTypeId);

    const clsName = cls ? cls.name : '';
    const subName = sub ? sub.name : '';
    const etName = et ? et.name : 'Assessment';

    const parts = [clsName, subName, etName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'New Academic Assessment';
  };

  // Contextual modal launcher with intelligent pre-selection for Class, Course, and Subject
  const openCreateExamForContext = (
    targetClassId?: string,
    targetCourseId?: string,
    targetSubjectIdOrName?: string
  ) => {
    const resolvedClassId = targetClassId || (classes.length > 0 ? classes[0].id : '');
    const classCourses = courses.filter((c) => c.class_id === resolvedClassId);
    const resolvedCourseId = (targetCourseId && targetCourseId !== 'unassigned_course')
      ? targetCourseId
      : (classCourses.length === 1 ? classCourses[0].id : '');

    const availableSubjs = getSubjectsForContext(resolvedClassId, resolvedCourseId);

    let resolvedSubjectId = '';
    if (targetSubjectIdOrName) {
      const byId = availableSubjs.find((s) => s.id === targetSubjectIdOrName) || subjects.find((s) => s.id === targetSubjectIdOrName);
      if (byId) {
        resolvedSubjectId = byId.id;
      } else {
        const byName =
          availableSubjs.find((s) => s.name.toLowerCase() === targetSubjectIdOrName.toLowerCase()) ||
          subjects.find((s) => s.name.toLowerCase() === targetSubjectIdOrName.toLowerCase());
        if (byName) {
          resolvedSubjectId = byName.id;
        }
      }
    }
    if (!resolvedSubjectId) {
      resolvedSubjectId = availableSubjs.length > 0 ? availableSubjs[0].id : (subjects[0]?.id || '');
    }

    const resolvedExamTypeId = examTypes.length > 0 ? examTypes[0].id : '';
    const resolvedAcademicYearId = academicYears.find((y) => y.is_current)?.id || (academicYears[0]?.id || '');

    const newCode = generateTestCode(resolvedClassId, resolvedSubjectId);
    const newName = suggestTestName(resolvedClassId, resolvedSubjectId, resolvedExamTypeId);

    setCreateForm({
      name: newName,
      code: newCode,
      exam_type_id: resolvedExamTypeId,
      academic_year_id: resolvedAcademicYearId,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      selected_class_id: resolvedClassId,
      selected_course_id: resolvedCourseId,
      selected_subject_id: resolvedSubjectId,
      duration_minutes: 60,
      max_marks: 50,
      passing_marks: 20,
      has_negative_marking: false,
      negative_weight: 0.25
    });

    setFeedback(null);
    setShowCreateExam(true);
  };

  const fetchExaminations = async () => {
    try {
      setLoading(true);
      const [exRes, tyRes, clsRes, crsRes, subRes, ayRes] = await Promise.all([
        apiClient.get<ExaminationItem[]>('/examinations'),
        apiClient.get<ExamTypeOption[]>('/examinations/types'),
        apiClient.get<ClassItem[]>('/academics/classes'),
        apiClient.get<CourseItem[]>('/academics/courses'),
        apiClient.get<SubjectItem[]>('/academics/subjects'),
        apiClient.get<any[]>('/academics/years')
      ]);

      setExaminations(exRes.data);
      setExamTypes(tyRes.data);
      setClasses(clsRes.data);
      setCourses(crsRes.data);
      setSubjects(subRes.data);
      setAcademicYears(ayRes.data);

      if (exRes.data.length > 0) {
        const exists = exRes.data.some((e) => e.id === selectedExamId);
        if (!selectedExamId || !exists) {
          setSelectedExamId(exRes.data[0].id);
          fetchExamDetails(exRes.data[0].id);
        }
      } else {
        setSelectedExamId('');
        setSelectedExamDetail(null);
      }
    } catch (err: any) {
      console.error('Failed to load examinations', err);
    } finally {
      setLoading(false);
    }
  };

  // Test Deletion Modal states & actions
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [examToDelete, setExamToDelete] = useState<ExaminationItem | null>(null);
  const [deletingExam, setDeletingExam] = useState<boolean>(false);

  const handleInitiateDelete = (exam: ExaminationItem) => {
    setExamToDelete(exam);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!examToDelete) return;
    setDeletingExam(true);
    try {
      await apiClient.delete(`/examinations/${examToDelete.id}`);
      setFeedback({
        type: 'success',
        text: `Test "${examToDelete.name}" deleted successfully.`
      });
      setShowDeleteModal(false);

      // Re-fetch examinations
      const exRes = await apiClient.get<ExaminationItem[]>('/examinations');
      setExaminations(exRes.data);

      if (exRes.data.length > 0) {
        const nextExam = exRes.data.find((e) => e.id !== examToDelete.id) || exRes.data[0];
        setSelectedExamId(nextExam.id);
        fetchExamDetails(nextExam.id);
      } else {
        setSelectedExamId('');
        setSelectedExamDetail(null);
      }
      setExamToDelete(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to delete test.'
      });
    } finally {
      setDeletingExam(false);
    }
  };

  const fetchExamDetails = async (examId: string) => {
    try {
      const res = await apiClient.get<ExamDetailResponse>(`/examinations/${examId}/details`);
      setSelectedExamDetail(res.data);
    } catch (err: any) {
      console.error('Failed to load examination details', err);
    }
  };

  useEffect(() => {
    fetchExaminations();
  }, []);

  const handleSelectExam = (id: string) => {
    setSelectedExamId(id);
    fetchExamDetails(id);
  };

  // Quick preset for max marks
  const applyMarksPreset = (presetMax: number) => {
    setCreateForm((prev) => ({
      ...prev,
      max_marks: presetMax,
      passing_marks: Math.round(presetMax * 0.4)
    }));
  };

  const handleCreateExamination = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);

    try {
      const payload = {
        academic_year_id: createForm.academic_year_id,
        exam_type_id: createForm.exam_type_id,
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        subjects: [
          {
            subject_id: createForm.selected_subject_id,
            class_id: createForm.selected_class_id,
            course_id: createForm.selected_course_id || null,
            exam_date: createForm.start_date,
            duration_minutes: Number(createForm.duration_minutes),
            max_marks: Number(createForm.max_marks),
            passing_marks: Number(createForm.passing_marks),
            has_negative_marking: createForm.has_negative_marking,
            negative_mark_weight: Number(createForm.negative_weight),
            theory_max_marks: Number(createForm.max_marks),
            practical_max_marks: 0
          }
        ]
      };

      const res = await apiClient.post<ExaminationItem>('/examinations', payload);
      setFeedback({ type: 'success', text: `Test "${createForm.name}" created successfully with ${createForm.max_marks} Total Marks!` });
      setShowCreateExam(false);
      await fetchExaminations();
      handleSelectExam(res.data.id);
      if (res.data.class_id) {
        setExpandedClasses((prev) => ({ ...prev, [res.data.class_id!]: true }));
      }
      if (res.data.course_id) {
        setExpandedCourses((prev) => ({ ...prev, [res.data.course_id!]: true }));
      }
      if (res.data.subject_name) {
        const crsKey = res.data.course_id || 'unassigned_course';
        setExpandedSubjects((prev) => ({ ...prev, [`${crsKey}___${res.data.subject_name!.trim()}`]: true }));
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to create test.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Marks Entry Modal
  const openMarksEntry = async (paper: ExamPaperDetail) => {
    setSelectedPaper(paper);
    setLoadingEligibleStudents(true);
    setShowEnterMarks(true);

    try {
      const res = await apiClient.get<any[]>(`/examinations/papers/${paper.id}/eligible-students`);
      const defaultPassMarks = Math.round(paper.max_marks * 0.7);

      const entries: MarksEntryRow[] = res.data.map((stu) => {
        return {
          student_id: stu.student_id,
          student_name: stu.student_name,
          student_code: stu.student_code,
          prn: stu.prn,
          roll_number: stu.roll_number,
          marks_obtained: stu.marks_obtained !== null && stu.marks_obtained !== undefined ? stu.marks_obtained : defaultPassMarks,
          is_absent: stu.is_absent || false
        };
      });
      setMarksFormEntries(entries);
    } catch (err: any) {
      console.error('Failed to load eligible students for paper', err);
    } finally {
      setLoadingEligibleStudents(false);
    }
  };

  // Save Marks (No practicals)
  const handleSaveMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaper) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const payload = {
        exam_subject_id: selectedPaper.id,
        marks: marksFormEntries.map((m) => ({
          student_id: m.student_id,
          marks_obtained: m.is_absent ? 0 : Number(m.marks_obtained || 0),
          theory_marks_obtained: m.is_absent ? 0 : Number(m.marks_obtained || 0),
          practical_marks_obtained: 0,
          is_absent: m.is_absent
        }))
      };

      await apiClient.post('/examinations/marks', payload);
      setFeedback({ type: 'success', text: `Marks successfully saved for ${marksFormEntries.length} students!` });
      setShowEnterMarks(false);
      if (selectedExamId) fetchExamDetails(selectedExamId);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to save marks.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Publish Results
  const handlePublishResults = async () => {
    if (!selectedExamId) return;
    if (!window.confirm('Publish results and calculate final ranks, percentages, and merit lists?')) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      await apiClient.post(`/examinations/${selectedExamId}/publish`);
      setFeedback({ type: 'success', text: 'Test results published! Official scorecards dispatched to parents via WhatsApp & Email.' });
      await fetchExaminations();
      fetchExamDetails(selectedExamId);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to publish results.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Dispatch Scorecards to Parents on demand
  const [notifyingScorecards, setNotifyingScorecards] = useState(false);
  const handleNotifyScorecards = async () => {
    if (!selectedExamId) return;
    setNotifyingScorecards(true);
    setFeedback(null);
    try {
      await apiClient.post(`/examinations/${selectedExamId}/notify`);
      setFeedback({ type: 'success', text: 'Scorecard notifications dispatched to parents and students via WhatsApp & Email!' });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to dispatch scorecard notifications.'
      });
    } finally {
      setNotifyingScorecards(false);
    }
  };

  // Filtered Examinations List (Memoized to prevent unnecessary re-renders)
  const filteredExaminations = useMemo(() => {
    return examinations.filter((ex) => {
      if (filterClassId !== 'ALL' && ex.class_id !== filterClassId) {
        return false;
      }
      if (filterCourseId !== 'ALL' && ex.course_id !== filterCourseId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = ex.name.toLowerCase().includes(q);
        const matchCode = ex.code.toLowerCase().includes(q);
        const matchClass = ex.class_name && ex.class_name.toLowerCase().includes(q);
        const matchCourse = ex.course_name && ex.course_name.toLowerCase().includes(q);
        const matchSub = ex.subject_name && ex.subject_name.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchClass && !matchCourse && !matchSub) return false;
      }
      return true;
    });
  }, [examinations, filterClassId, filterCourseId, searchQuery]);

  // Helper: Visual theme for subject badges & folders to distinguish disciplines easily
  const getSubjectTheme = (subjectName: string) => {
    const lower = (subjectName || '').toLowerCase();
    if (lower.includes('math') || lower.includes('algebra') || lower.includes('geom') || lower.includes('calculus')) {
      return {
        bg: 'bg-blue-50/70',
        border: 'border-blue-200/90',
        text: 'text-blue-900',
        icon: 'text-blue-600',
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        hover: 'hover:bg-blue-100/50'
      };
    }
    if (lower.includes('sci') || lower.includes('bio') || lower.includes('bot') || lower.includes('zoo')) {
      return {
        bg: 'bg-emerald-50/70',
        border: 'border-emerald-200/90',
        text: 'text-emerald-900',
        icon: 'text-emerald-600',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        hover: 'hover:bg-emerald-100/50'
      };
    }
    if (lower.includes('phy') || lower.includes('chem')) {
      return {
        bg: 'bg-purple-50/70',
        border: 'border-purple-200/90',
        text: 'text-purple-900',
        icon: 'text-purple-600',
        badge: 'bg-purple-100 text-purple-800 border-purple-200',
        hover: 'hover:bg-purple-100/50'
      };
    }
    if (lower.includes('eng') || lower.includes('lang') || lower.includes('mar') || lower.includes('hin') || lower.includes('sans')) {
      return {
        bg: 'bg-amber-50/70',
        border: 'border-amber-200/90',
        text: 'text-amber-900',
        icon: 'text-amber-600',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        hover: 'hover:bg-amber-100/50'
      };
    }
    if (lower.includes('soc') || lower.includes('hist') || lower.includes('geo') || lower.includes('civ')) {
      return {
        bg: 'bg-orange-50/70',
        border: 'border-orange-200/90',
        text: 'text-orange-900',
        icon: 'text-orange-600',
        badge: 'bg-orange-100 text-orange-800 border-orange-200',
        hover: 'hover:bg-orange-100/50'
      };
    }
    return {
      bg: 'bg-slate-50/90',
      border: 'border-slate-200',
      text: 'text-slate-800',
      icon: 'text-slate-600',
      badge: 'bg-slate-200/70 text-slate-700 border-slate-300',
      hover: 'hover:bg-slate-100/60'
    };
  };

  // Grouped Hierarchy: Class -> Course -> Subject Folders -> Tests (Approach 1)
  interface SubjectGroup {
    subject_key: string;
    subject_name: string;
    tests: ExaminationItem[];
  }

  interface CourseGroup {
    course_id: string;
    course_name: string;
    total_tests: number;
    subjects: Record<string, SubjectGroup>;
  }

  interface ClassGroup {
    class_id: string;
    class_name: string;
    total_tests: number;
    courses: Record<string, CourseGroup>;
  }

  const groupedHierarchy = useMemo(() => {
    const tree: Record<string, ClassGroup> = {};

    for (const ex of filteredExaminations) {
      const classKey = ex.class_id || 'unassigned_class';
      const className = ex.class_name || 'General / Unassigned Standard';
      const courseKey = ex.course_id || 'unassigned_course';
      const courseName = ex.course_name || 'General Curriculum / Batches';
      const subjectKey = (ex.subject_name || 'General Subject').trim();
      const subjectName = ex.subject_name || 'General Subject';

      if (!tree[classKey]) {
        tree[classKey] = {
          class_id: classKey,
          class_name: className,
          total_tests: 0,
          courses: {}
        };
      }

      tree[classKey].total_tests += 1;

      if (!tree[classKey].courses[courseKey]) {
        tree[classKey].courses[courseKey] = {
          course_id: courseKey,
          course_name: courseName,
          total_tests: 0,
          subjects: {}
        };
      }

      tree[classKey].courses[courseKey].total_tests += 1;

      if (!tree[classKey].courses[courseKey].subjects[subjectKey]) {
        tree[classKey].courses[courseKey].subjects[subjectKey] = {
          subject_key: subjectKey,
          subject_name: subjectName,
          tests: []
        };
      }

      tree[classKey].courses[courseKey].subjects[subjectKey].tests.push(ex);
    }

    return tree;
  }, [filteredExaminations]);

  // Sort class keys by standard order from classes list
  const sortedClassKeys = useMemo(() => {
    const keys = Object.keys(groupedHierarchy);
    return keys.sort((a, b) => {
      const idxA = classes.findIndex((c) => c.id === a);
      const idxB = classes.findIndex((c) => c.id === b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (groupedHierarchy[a]?.class_name || '').localeCompare(groupedHierarchy[b]?.class_name || '');
    });
  }, [groupedHierarchy, classes]);

  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  const toggleSubject = (compositeKey: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [compositeKey]: !prev[compositeKey]
    }));
  };

  const toggleClass = (classKey: string) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [classKey]: !prev[classKey]
    }));
  };

  const toggleCourse = (courseKey: string) => {
    setExpandedCourses((prev) => ({
      ...prev,
      [courseKey]: !prev[courseKey]
    }));
  };

  // Track the last exam ID that triggered an auto-expansion so user can freely collapse/expand nodes
  const autoExpandedExamIdRef = useRef<string | null>(null);
  const prevSearchQueryRef = useRef<string>('');

  // Smart Auto-Expansion:
  // 1. Expand on search query entry
  // 2. Expand on new exam selection, without overriding subsequent manual collapses
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed && trimmed !== prevSearchQueryRef.current) {
      prevSearchQueryRef.current = trimmed;
      const newExpClasses: Record<string, boolean> = {};
      const newExpCourses: Record<string, boolean> = {};
      const newExpSubjects: Record<string, boolean> = {};
      Object.keys(groupedHierarchy).forEach((clsKey) => {
        newExpClasses[clsKey] = true;
        Object.keys(groupedHierarchy[clsKey].courses).forEach((crsKey) => {
          newExpCourses[crsKey] = true;
          Object.keys(groupedHierarchy[clsKey].courses[crsKey].subjects).forEach((subKey) => {
            newExpSubjects[`${crsKey}___${subKey}`] = true;
          });
        });
      });
      setExpandedClasses(newExpClasses);
      setExpandedCourses(newExpCourses);
      setExpandedSubjects(newExpSubjects);
    } else if (!trimmed && prevSearchQueryRef.current) {
      prevSearchQueryRef.current = '';
    }
  }, [searchQuery, groupedHierarchy]);

  useEffect(() => {
    if (selectedExamId && selectedExamId !== autoExpandedExamIdRef.current) {
      autoExpandedExamIdRef.current = selectedExamId;
      const selectedExam = examinations.find((e) => e.id === selectedExamId);
      if (selectedExam) {
        const clsKey = selectedExam.class_id || 'unassigned_class';
        const crsKey = selectedExam.course_id || 'unassigned_course';
        const subKey = (selectedExam.subject_name || 'General Subject').trim();
        setExpandedClasses((prev) => ({ ...prev, [clsKey]: true }));
        setExpandedCourses((prev) => ({ ...prev, [crsKey]: true }));
        setExpandedSubjects((prev) => ({ ...prev, [`${crsKey}___${subKey}`]: true }));
      }
    }
  }, [selectedExamId, examinations]);

  // Check if any node is currently expanded across classes, courses, or subjects
  const isAnyExpanded = useMemo(() => {
    return (
      Object.values(expandedClasses).some(Boolean) ||
      Object.values(expandedCourses).some(Boolean) ||
      Object.values(expandedSubjects).some(Boolean)
    );
  }, [expandedClasses, expandedCourses, expandedSubjects]);

  const toggleExpandAll = () => {
    if (isAnyExpanded) {
      setExpandedClasses({});
      setExpandedCourses({});
      setExpandedSubjects({});
    } else {
      const newExpClasses: Record<string, boolean> = {};
      const newExpCourses: Record<string, boolean> = {};
      const newExpSubjects: Record<string, boolean> = {};
      Object.keys(groupedHierarchy).forEach((clsKey) => {
        newExpClasses[clsKey] = true;
        Object.keys(groupedHierarchy[clsKey].courses).forEach((crsKey) => {
          newExpCourses[crsKey] = true;
          Object.keys(groupedHierarchy[clsKey].courses[crsKey].subjects).forEach((subKey) => {
            newExpSubjects[`${crsKey}___${subKey}`] = true;
          });
        });
      });
      setExpandedClasses(newExpClasses);
      setExpandedCourses(newExpCourses);
      setExpandedSubjects(newExpSubjects);
    }
  };

  // KPI Calculations for selected exam
  const totalResults = selectedExamDetail?.results?.length || 0;
  const passedCount = selectedExamDetail?.results?.filter((r) => r.is_pass).length || 0;
  const highestScore = selectedExamDetail?.results?.reduce((max, r) => Math.max(max, r.total_obtained), 0) || 0;
  const avgPercentage =
    totalResults > 0
      ? Math.round((selectedExamDetail?.results?.reduce((acc, r) => acc + Number(r.percentage), 0) || 0) / totalResults)
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Academic Tests &amp; Performance Assessment</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Class &amp; Course-Wise Dynamic Tests • Flexible Custom Marks (20 to 720) • Rapid Single-Column Marks Entry
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto">
          {canManage && (
            <button
              onClick={() => openCreateExamForContext(filterClassId !== 'ALL' ? filterClassId : undefined, filterCourseId !== 'ALL' ? filterCourseId : undefined)}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Test</span>
            </button>
          )}
          <button
            onClick={fetchExaminations}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200"
            title="Refresh Tests"
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

      {/* Class & Course Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Class Filter */}
          <div className="flex items-center space-x-1.5">
            <GraduationCap className="w-4 h-4 text-purple-600" />
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white"
            >
              <option value="ALL">All Standards / Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* Course Filter */}
          <div className="flex items-center space-x-1.5">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <select
              value={filterCourseId}
              onChange={(e) => setFilterCourseId(e.target.value)}
              className="text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white"
            >
              <option value="ALL">All Courses / Batches</option>
              {courses.map((cr) => (
                <option key={cr.id} value={cr.id}>
                  {cr.name}
                </option>
              ))}
            </select>
          </div>

          {(filterClassId !== 'ALL' || filterCourseId !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setFilterClassId('ALL');
                setFilterCourseId('ALL');
                setSearchQuery('');
              }}
              className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search test name, code, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
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
      </div>

      {/* Main Layout: Tests List (Left 5/12) + Test Performance & Scorecards (Right 7/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Elevated Academic Examination Directory & Tree Hierarchy */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            {/* Elevated Header */}
            <div className="p-4 bg-gradient-to-r from-purple-50/90 via-indigo-50/50 to-white border-b border-purple-100/80">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm shadow-purple-600/30 shrink-0">
                    <FolderTree className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-slate-900 text-sm tracking-tight truncate">
                      Academic Examination Directory
                    </h3>
                    <p className="text-[11px] font-semibold text-purple-700/90 truncate">
                      Class &amp; Course Hierarchy
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => openCreateExamForContext(filterClassId !== 'ALL' ? filterClassId : undefined, filterCourseId !== 'ALL' ? filterCourseId : undefined)}
                      className="h-7 px-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center space-x-1 cursor-pointer"
                      title="Schedule new examination"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Schedule</span>
                    </button>
                  )}
                  {filteredExaminations.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleExpandAll}
                      className="h-7 px-2.5 text-[11px] font-semibold text-slate-700 hover:text-purple-900 bg-white hover:bg-purple-50/80 border border-slate-200/80 rounded-lg transition shadow-2xs flex items-center space-x-1 cursor-pointer"
                      title={isAnyExpanded ? "Collapse All Branches" : "Expand All Branches"}
                    >
                      <ChevronsUpDown className="w-3 h-3 text-purple-600" />
                      <span>{isAnyExpanded ? 'Collapse All' : 'Expand All'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Counter Strip */}
              <div className="mt-3 flex items-center gap-2 flex-wrap pt-2.5 border-t border-purple-100/60 text-[11px]">
                <span className="px-2 py-0.5 rounded-md font-bold bg-purple-100/80 text-purple-800">
                  {sortedClassKeys.length} {sortedClassKeys.length === 1 ? 'Standard' : 'Standards'}
                </span>
                <span className="text-slate-300">•</span>
                <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {filteredExaminations.length} {filteredExaminations.length === 1 ? 'Test Scheduled' : 'Tests Scheduled'}
                </span>
                {searchQuery && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-[10px] font-semibold text-slate-500 italic truncate max-w-[140px]">
                      Filter: "{searchQuery}"
                    </span>
                  </>
                )}
              </div>
            </div>

            {filteredExaminations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <FileCheck className="w-8 h-8 mx-auto text-slate-300" />
                <p>No tests found matching the selected class or course.</p>
                {canManage && (
                  <button
                    onClick={() => openCreateExamForContext(filterClassId !== 'ALL' ? filterClassId : undefined, filterCourseId !== 'ALL' ? filterCourseId : undefined)}
                    className="text-xs font-bold text-purple-600 hover:underline"
                  >
                    + Create a new test now
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3.5 space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
                {sortedClassKeys.map((classKey) => {
                  const classGroup = groupedHierarchy[classKey];
                  const isClassExpanded = !!expandedClasses[classKey];
                  const courseKeys = Object.keys(classGroup.courses);

                  return (
                    <div
                      key={classKey}
                      className="border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-2xs transition-all"
                    >
                      {/* Level 1: Standard / Class Accordion Header */}
                      <div
                        className={`w-full flex items-center justify-between p-3 text-left transition-colors cursor-pointer select-none ${
                          isClassExpanded
                            ? 'bg-purple-50/70 border-b border-purple-100/80 text-purple-950 font-bold'
                            : 'bg-white hover:bg-slate-50 text-slate-800 font-semibold'
                        }`}
                        onClick={() => toggleClass(classKey)}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 pr-2 flex-1">
                          <div className={`p-1 rounded-md transition ${isClassExpanded ? 'text-purple-700 bg-purple-100' : 'text-slate-400'}`}>
                            {isClassExpanded ? (
                              <ChevronDown className="w-4 h-4 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 shrink-0" />
                            )}
                          </div>
                          <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                            <GraduationCap className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs sm:text-sm font-bold truncate text-slate-900">{classGroup.class_name}</span>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100/80 text-purple-800 border border-purple-200/50">
                            {classGroup.total_tests} {classGroup.total_tests === 1 ? 'Test' : 'Tests'}
                          </span>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => openCreateExamForContext(classKey)}
                              className="p-1 hover:bg-purple-200/70 text-purple-700 hover:text-purple-900 rounded-md transition cursor-pointer"
                              title={`Schedule new test for ${classGroup.class_name}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Level 2: Courses inside Class (Tree Guide Lines) */}
                      {isClassExpanded && (
                        <div className="p-3 space-y-3 bg-slate-50/30">
                          {courseKeys.map((courseKey) => {
                            const courseGroup = classGroup.courses[courseKey];
                            const isCourseExpanded = !!expandedCourses[courseKey];
                            const subjectKeys = Object.keys(courseGroup.subjects).sort((a, b) =>
                              courseGroup.subjects[a].subject_name.localeCompare(courseGroup.subjects[b].subject_name)
                            );

                            return (
                              <div key={courseKey} className="relative pl-3 border-l-2 border-indigo-200/80 space-y-2">
                                {/* Course Branch Header */}
                                <div
                                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer select-none ${
                                    isCourseExpanded
                                      ? 'bg-indigo-50/80 text-indigo-950 font-bold shadow-2xs'
                                      : 'bg-white hover:bg-slate-100/70 text-slate-700 font-semibold border border-slate-200/70'
                                  }`}
                                  onClick={() => toggleCourse(courseKey)}
                                >
                                  <div className="flex items-center space-x-2 min-w-0 pr-2 flex-1">
                                    {isCourseExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    )}
                                    {isCourseExpanded ? (
                                      <FolderOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                                    ) : (
                                      <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
                                    )}
                                    <span className="text-xs truncate font-bold">{courseGroup.course_name}</span>
                                  </div>

                                  <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200/50">
                                      {courseGroup.total_tests} {courseGroup.total_tests === 1 ? 'Test' : 'Tests'}
                                    </span>
                                    {canManage && (
                                      <button
                                        type="button"
                                        onClick={() => openCreateExamForContext(classKey, courseKey !== 'unassigned_course' ? courseKey : undefined)}
                                        className="p-1 hover:bg-indigo-200/70 text-indigo-700 hover:text-indigo-900 rounded-md transition cursor-pointer"
                                        title={`Schedule new test for ${courseGroup.course_name}`}
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Level 3: Subject Sub-Nodes */}
                                {isCourseExpanded && (
                                  <div className="pl-3.5 border-l-2 border-slate-200/80 space-y-2 mt-1">
                                    {subjectKeys.map((subjectKey) => {
                                      const subjectGroup = courseGroup.subjects[subjectKey];
                                      const subCompositeKey = `${courseKey}___${subjectKey}`;
                                      const isSubjectExpanded = !!expandedSubjects[subCompositeKey];
                                      const theme = getSubjectTheme(subjectGroup.subject_name);

                                      return (
                                        <div key={subCompositeKey} className="space-y-1.5">
                                          {/* Subject Header Chip */}
                                          <div
                                            className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left transition cursor-pointer select-none border ${
                                              isSubjectExpanded
                                                ? `${theme.bg} ${theme.border} ${theme.text} font-bold shadow-2xs`
                                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold'
                                            }`}
                                            onClick={() => toggleSubject(subCompositeKey)}
                                          >
                                            <div className="flex items-center space-x-2 min-w-0 pr-1.5 flex-1">
                                              {isSubjectExpanded ? (
                                                <ChevronDown className={`w-3 h-3 ${theme.icon} shrink-0`} />
                                              ) : (
                                                <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                                              )}
                                              <BookOpen className={`w-3.5 h-3.5 ${theme.icon} shrink-0`} />
                                              <span className="text-xs truncate">{subjectGroup.subject_name}</span>
                                            </div>

                                            <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${theme.badge}`}>
                                                {subjectGroup.tests.length} {subjectGroup.tests.length === 1 ? 'Test' : 'Tests'}
                                              </span>
                                              {canManage && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    openCreateExamForContext(
                                                      classKey,
                                                      courseKey !== 'unassigned_course' ? courseKey : undefined,
                                                      subjectGroup.subject_name
                                                    )
                                                  }
                                                  className={`p-0.5 rounded text-slate-500 hover:text-slate-900 ${theme.hover} transition cursor-pointer`}
                                                  title={`Schedule new ${subjectGroup.subject_name} test`}
                                                >
                                                  <Plus className="w-3 h-3" />
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          {/* Level 4: Test Item Cards */}
                                          {isSubjectExpanded && (
                                            <div className="pl-2 space-y-1.5 pt-0.5">
                                              {subjectGroup.tests.map((ex) => {
                                                const isSelected = selectedExamId === ex.id;
                                                return (
                                                  <div
                                                    key={ex.id}
                                                    onClick={() => handleSelectExam(ex.id)}
                                                    className={`group relative p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                                                      isSelected
                                                        ? 'bg-purple-50/90 border-purple-400 border-l-4 border-l-purple-600 ring-2 ring-purple-500/20 shadow-xs'
                                                        : 'bg-white border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                                                    }`}
                                                  >
                                                    <div className="flex items-start justify-between gap-2">
                                                      <div className="space-y-1 min-w-0 flex-1">
                                                        <div className="flex items-center space-x-1.5 flex-wrap">
                                                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                                            {ex.code}
                                                          </span>
                                                        </div>

                                                        <h4 className="font-bold text-slate-900 text-xs sm:text-[13px] leading-snug line-clamp-2">
                                                          {ex.name}
                                                        </h4>

                                                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 flex-wrap">
                                                          {ex.max_marks && (
                                                            <span className="font-bold text-purple-700">
                                                              {ex.max_marks} Marks
                                                            </span>
                                                          )}
                                                          {ex.start_date && (
                                                            <>
                                                              <span className="text-slate-300">•</span>
                                                              <span className="flex items-center space-x-1">
                                                                <Calendar className="w-3 h-3 text-slate-400" />
                                                                <span>{ex.start_date}</span>
                                                              </span>
                                                            </>
                                                          )}
                                                        </div>
                                                      </div>

                                                      <div className="flex flex-col items-end space-y-1.5 shrink-0">
                                                        <span
                                                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                                            ex.is_published
                                                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                          }`}
                                                        >
                                                          {ex.is_published ? 'Published' : 'Draft'}
                                                        </span>
                                                        {canManage && (
                                                          <button
                                                            type="button"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleInitiateDelete(ex);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                                            title="Delete Test"
                                                          >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                          </button>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 7/12: Selected Test Papers, Marks Entry, & Official Scorecards */}
        <div className="lg:col-span-7 space-y-6">
          {selectedExamDetail ? (
            <div className="space-y-6">
              {/* Test Details Header Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <h2 className="text-lg font-bold text-slate-900">{selectedExamDetail.name}</h2>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        selectedExamDetail.is_published
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {selectedExamDetail.is_published ? 'Results Published' : 'Draft / Marks Entry in Progress'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    Code: {selectedExamDetail.code} • Scheduled: {selectedExamDetail.start_date}
                  </p>
                </div>

                <div className="flex items-center space-x-2.5 self-start sm:self-auto">
                  {!selectedExamDetail.is_published && canManage && (
                    <button
                      onClick={handlePublishResults}
                      disabled={actionLoading}
                      className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Publish Results &amp; Merit List</span>
                    </button>
                  )}

                  {selectedExamDetail.is_published && canManage && (
                    <button
                      type="button"
                      onClick={handleNotifyScorecards}
                      disabled={notifyingScorecards}
                      className="flex items-center space-x-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      title="Dispatch or resend official scorecards to parents and students via WhatsApp & Email"
                    >
                      <Bell className={`w-3.5 h-3.5 text-amber-600 ${notifyingScorecards ? 'animate-bounce' : ''}`} />
                      <span>{notifyingScorecards ? 'Sending Scorecards...' : 'Send Scorecards to Parents'}</span>
                    </button>
                  )}

                  {canManage && (
                    <button
                      onClick={() => {
                        const examObj = examinations.find((e) => e.id === selectedExamDetail.id) || {
                          id: selectedExamDetail.id,
                          name: selectedExamDetail.name,
                          code: selectedExamDetail.code,
                          start_date: selectedExamDetail.start_date,
                          end_date: selectedExamDetail.end_date,
                          is_published: selectedExamDetail.is_published,
                          class_name: selectedExamDetail.subjects[0]?.class_name,
                          course_name: selectedExamDetail.subjects[0]?.course_name
                        };
                        handleInitiateDelete(examObj as ExaminationItem);
                      }}
                      disabled={actionLoading}
                      className="flex items-center space-x-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-sm transition-all"
                      title="Permanently Delete This Test"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete Test</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Subject Test Papers Accordion */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-sm">Question Paper & Marks Configuration</h3>
                  <span className="text-xs text-slate-400">Total Marks Based • No Practicals</span>
                </div>

                <div className="space-y-3">
                  {selectedExamDetail.subjects.map((paper) => (
                    <div
                      key={paper.id}
                      className="p-3.5 sm:p-4 bg-slate-50/80 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4"
                    >
                      <div className="space-y-2 min-w-0">
                        {/* Title & Hierarchy Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-sm sm:text-base mr-1">
                            {paper.subject_name}
                          </span>
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 whitespace-nowrap">
                            {paper.subject_code}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800 whitespace-nowrap">
                            {paper.class_name}
                          </span>
                          {paper.course_name && (
                            <span
                              className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 whitespace-nowrap max-w-[260px] truncate"
                              title={paper.course_name}
                            >
                              {paper.course_name}
                            </span>
                          )}
                        </div>

                        {/* Marks & Timing Metadata Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 font-medium pt-0.5">
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-100 whitespace-nowrap">
                            Max: {paper.max_marks} Marks
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium whitespace-nowrap">
                            Passing: {paper.passing_marks} Marks
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium whitespace-nowrap">
                            Duration: {paper.duration_minutes} Mins
                          </span>
                          {paper.has_negative_marking && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-medium border border-rose-100 whitespace-nowrap">
                              Negative: -{paper.negative_mark_weight}
                            </span>
                          )}
                        </div>
                      </div>

                      {canManage && (
                        <button
                          onClick={() => openMarksEntry(paper)}
                          className="w-full md:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center space-x-1.5 shrink-0"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>
                            Enter Student Marks ({paper.marks?.length || 0} entered)
                          </span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Published Result Scorecards & Merit List */}
              {selectedExamDetail.is_published && selectedExamDetail.results?.length > 0 && (
                <div className="space-y-4">
                  {/* KPI Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                      <span className="text-xs text-slate-400 font-medium">Students Appeared</span>
                      <p className="text-lg font-bold text-slate-900 mt-0.5">{totalResults}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                      <span className="text-xs text-slate-400 font-medium">Highest Score</span>
                      <p className="text-lg font-bold text-purple-700 mt-0.5">
                        {highestScore} / {selectedExamDetail.results[0]?.total_possible}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                      <span className="text-xs text-slate-400 font-medium">Class Average</span>
                      <p className="text-lg font-bold text-indigo-700 mt-0.5">{avgPercentage}%</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                      <span className="text-xs text-slate-400 font-medium">Pass Percentage</span>
                      <p className="text-lg font-bold text-emerald-600 mt-0.5">
                        {totalResults > 0 ? Math.round((passedCount / totalResults) * 100) : 0}%
                      </p>
                    </div>
                  </div>

                  {/* Student Performance Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span>Official Class Merit List &amp; Student Scorecards</span>
                      </h3>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm min-w-[550px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="py-3 px-4 sm:px-6">Student</th>
                            <th className="py-3 px-4 sm:px-6 text-right">Marks Obtained</th>
                            <th className="py-3 px-4 sm:px-6 text-right">Max Marks</th>
                            <th className="py-3 px-4 sm:px-6 text-right">Percentage</th>
                            <th className="py-3 px-4 sm:px-6 text-center">Grade</th>
                            <th className="py-3 px-4 sm:px-6 text-center">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedExamDetail.results.map((r) => (
                            <tr key={r.student_id} className="hover:bg-slate-50">
                              <td className="py-3.5 px-4 sm:px-6">
                                <p className="font-semibold text-slate-900">{r.student_name}</p>
                                <p className="text-xs font-mono text-purple-600 font-medium">
                                  PRN: {r.prn || (r.student_code ? r.student_code.replace('STU-', 'PRN-') : '—')}
                                </p>
                              </td>
                              <td className="py-3.5 px-4 sm:px-6 text-right font-bold text-slate-900">{r.total_obtained}</td>
                              <td className="py-3.5 px-4 sm:px-6 text-right text-slate-500">{r.total_possible}</td>
                              <td className="py-3.5 px-4 sm:px-6 text-right font-bold text-emerald-600">{r.percentage}%</td>
                              <td className="py-3.5 px-4 sm:px-6 text-center font-bold text-purple-700">{r.grade}</td>
                              <td className="py-3.5 px-4 sm:px-6 text-center">
                                <span
                                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                    r.is_pass
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  {r.is_pass ? 'PASSED' : 'FAILED'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Select a Test to Inspect</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Choose any scheduled test from the left to enter student marks, view question paper details, or publish official results.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Dynamic Test Modal (Flexible Marks, No Practicals) */}
      {showCreateExam && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">Schedule Class / Course Test</h3>
              </div>
              <button onClick={() => setShowCreateExam(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExamination} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Test Title / Name *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const suggested = suggestTestName(createForm.selected_class_id, createForm.selected_subject_id, createForm.exam_type_id);
                      setCreateForm((prev) => ({ ...prev, name: suggested }));
                    }}
                    className="text-[11px] font-semibold text-purple-600 hover:text-purple-800"
                  >
                    Auto-Suggest Title
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10th Standard Science A Unit Test"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Test Code *</label>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      required
                      placeholder="e.g. SCIA-STD10-T1"
                      value={createForm.code}
                      onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono font-bold text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextCode = generateTestCode(createForm.selected_class_id, createForm.selected_subject_id);
                        setCreateForm((prev) => ({ ...prev, code: nextCode }));
                      }}
                      className="p-2.5 bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-xl border border-slate-200 transition shrink-0"
                      title="Auto-generate fresh unique test code"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Test Category *</label>
                  <select
                    value={createForm.exam_type_id}
                    onChange={(e) => {
                      const newTypeId = e.target.value;
                      setCreateForm((prev) => ({
                        ...prev,
                        exam_type_id: newTypeId,
                        name: suggestTestName(prev.selected_class_id, prev.selected_subject_id, newTypeId)
                      }));
                    }}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  >
                    {examTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Class & Course Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Class *</label>
                  <select
                    value={createForm.selected_class_id}
                    onChange={(e) => {
                      const newClassId = e.target.value;
                      const classCourses = courses.filter((c) => c.class_id === newClassId);
                      const newCourseId = classCourses.length === 1 ? classCourses[0].id : '';
                      const availableSubjs = getSubjectsForContext(newClassId, newCourseId);
                      const newSubjId = availableSubjs[0]?.id || subjects[0]?.id || '';
                      setCreateForm((prev) => ({
                        ...prev,
                        selected_class_id: newClassId,
                        selected_course_id: newCourseId,
                        selected_subject_id: newSubjId,
                        name: suggestTestName(newClassId, newSubjId, prev.exam_type_id),
                        code: generateTestCode(newClassId, newSubjId)
                      }));
                    }}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium text-slate-800"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Course (Optional)</label>
                  <select
                    value={createForm.selected_course_id}
                    onChange={(e) => {
                      const newCourseId = e.target.value;
                      const availableSubjs = getSubjectsForContext(createForm.selected_class_id, newCourseId);
                      const newSubjId = availableSubjs.some((s) => s.id === createForm.selected_subject_id)
                        ? createForm.selected_subject_id
                        : (availableSubjs[0]?.id || createForm.selected_subject_id);

                      setCreateForm((prev) => ({
                        ...prev,
                        selected_course_id: newCourseId,
                        selected_subject_id: newSubjId,
                        name: suggestTestName(prev.selected_class_id, newSubjId, prev.exam_type_id),
                        code: generateTestCode(prev.selected_class_id, newSubjId)
                      }));
                    }}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  >
                    <option value="">-- All Batches in Class --</option>
                    {courses
                      .filter((cr) => !createForm.selected_class_id || cr.class_id === createForm.selected_class_id)
                      .map((cr) => (
                        <option key={cr.id} value={cr.id}>
                          {cr.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Curriculum Subject *</label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {createForm.selected_class_id ? 'Class-scoped subjects' : 'All subjects'}
                  </span>
                </div>
                <select
                  value={createForm.selected_subject_id}
                  onChange={(e) => {
                    const newSubjId = e.target.value;
                    setCreateForm((prev) => ({
                      ...prev,
                      selected_subject_id: newSubjId,
                      name: suggestTestName(prev.selected_class_id, newSubjId, prev.exam_type_id),
                      code: generateTestCode(prev.selected_class_id, newSubjId)
                    }));
                  }}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium text-slate-800"
                >
                  {(() => {
                    const classSubjs = getSubjectsForContext(createForm.selected_class_id, createForm.selected_course_id);
                    const otherSubjs = subjects.filter((s) => !classSubjs.some((cs) => cs.id === s.id));

                    if (otherSubjs.length > 0 && classSubjs.length > 0) {
                      return (
                        <>
                          <optgroup label="Class Curriculum Subjects">
                            {classSubjs.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.code})
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Other Institute Subjects">
                            {otherSubjs.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.code})
                              </option>
                            ))}
                          </optgroup>
                        </>
                      );
                    }
                    return subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ));
                  })()}
                </select>
              </div>

              {/* Flexible Non-Fixed Marks (No practicals) */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900">Custom Test Marks (Total Marks Only)</span>
                  <span className="text-[10px] text-purple-600 font-semibold">No practicals required</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-medium">Quick Presets:</span>
                  {[25, 50, 100, 300, 720].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyMarksPreset(preset)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition ${
                        createForm.max_marks === preset
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-100'
                      }`}
                    >
                      {preset} M {preset === 300 ? '(JEE)' : preset === 720 ? '(NEET)' : ''}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Maximum Marks *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={createForm.max_marks}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCreateForm({
                          ...createForm,
                          max_marks: val,
                          passing_marks: Math.round(val * 0.4)
                        });
                      }}
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg font-bold text-purple-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Passing Marks *</label>
                    <input
                      type="number"
                      min="0"
                      max={createForm.max_marks}
                      required
                      value={createForm.passing_marks}
                      onChange={(e) => setCreateForm({ ...createForm, passing_marks: Number(e.target.value) })}
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Date & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Test Date *</label>
                  <input
                    type="date"
                    required
                    value={createForm.start_date}
                    onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value, end_date: e.target.value })}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={createForm.duration_minutes}
                    onChange={(e) => setCreateForm({ ...createForm, duration_minutes: Number(e.target.value) })}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Competitive Negative Marking */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="negMark"
                  checked={createForm.has_negative_marking}
                  onChange={(e) => setCreateForm({ ...createForm, has_negative_marking: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="negMark" className="text-xs font-semibold text-slate-700">
                  Enable Competitive Negative Marking (-0.25 weightage per wrong answer)
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateExam(false)}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition-all"
                >
                  {actionLoading ? 'Scheduling...' : 'Create Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Streamlined Marks Entry Modal (Single Total Marks, No Practicals) */}
      {showEnterMarks && selectedPaper && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Enter Marks: {selectedPaper.subject_name} ({selectedPaper.class_name})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Maximum Marks: <strong className="text-purple-700">{selectedPaper.max_marks}</strong> • Passing Threshold: <strong>{selectedPaper.passing_marks}</strong>
                </p>
              </div>
              <button onClick={() => setShowEnterMarks(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick action bar */}
            <div className="px-4 sm:px-5 py-2.5 bg-slate-50 border-b flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-600">
                Enrolled Students: <strong>{marksFormEntries.length}</strong>
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const passScore = Math.round(selectedPaper.max_marks * 0.7);
                    setMarksFormEntries((prev) =>
                      prev.map((item) => ({ ...item, marks_obtained: passScore, is_absent: false }))
                    );
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition"
                >
                  Fill Sample Passing Marks
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMarksFormEntries((prev) =>
                      prev.map((item) => ({ ...item, marks_obtained: 0, is_absent: false }))
                    );
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Students Marks List */}
            <form onSubmit={handleSaveMarks} className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-2.5">
                {loadingEligibleStudents ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Loading enrolled students...
                  </div>
                ) : marksFormEntries.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No active students enrolled in this class or course yet.
                  </div>
                ) : (
                  marksFormEntries.map((entry, idx) => {
                    const numMarks = Number(entry.marks_obtained || 0);
                    const pct = selectedPaper.max_marks > 0 ? Math.round((numMarks / selectedPaper.max_marks) * 100) : 0;
                    const isPass = numMarks >= selectedPaper.passing_marks;

                    return (
                      <div
                        key={entry.student_id}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all ${
                          entry.is_absent
                            ? 'bg-slate-100 border-slate-200 opacity-60'
                            : isPass
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-rose-50/40 border-rose-200'
                        }`}
                      >
                        {/* Student Name & PRN */}
                        <div className="min-w-[190px] w-full sm:w-auto">
                          <div className="flex items-center space-x-2">
                            {entry.roll_number && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold font-mono text-[10px] border border-blue-200">
                                #{entry.roll_number}
                              </span>
                            )}
                            <p className="font-bold text-slate-900 text-sm">{entry.student_name}</p>
                          </div>
                          <p className="text-[11px] font-mono text-purple-600 font-semibold">
                            PRN: {entry.prn || (entry.student_code ? entry.student_code.replace('STU-', 'PRN-') : '—')}
                          </p>
                        </div>

                        {/* Marks Input & Status Badge */}
                        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 sm:space-x-4 w-full sm:w-auto">
                          <div className="flex items-center space-x-2">
                            <label className="text-[11px] text-slate-500 font-semibold">Marks:</label>
                            <input
                              type="number"
                              disabled={entry.is_absent}
                              max={selectedPaper.max_marks}
                              min={0}
                              step="0.5"
                              value={entry.marks_obtained}
                              onChange={(e) => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                setMarksFormEntries((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, marks_obtained: val } : item))
                                );
                              }}
                              className="w-20 p-2 border border-slate-300 rounded-lg text-center font-bold text-sm bg-white focus:ring-2 focus:ring-purple-500/20"
                            />
                            <span className="text-slate-400 font-mono text-xs">/ {selectedPaper.max_marks}</span>
                          </div>

                          {/* Live Score Badge */}
                          <div className="min-w-[70px] text-right">
                            {entry.is_absent ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                ABSENT
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isPass
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {isPass ? `PASS (${pct}%)` : `FAIL (${pct}%)`}
                              </span>
                            )}
                          </div>

                          {/* Absent Checkbox */}
                          <label className="flex items-center space-x-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={entry.is_absent}
                              onChange={(e) => {
                                const chk = e.target.checked;
                                setMarksFormEntries((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, is_absent: chk } : item))
                                );
                              }}
                              className="rounded text-rose-600 focus:ring-rose-500"
                            />
                            <span className="text-[10px] text-slate-500 font-medium">Absent</span>
                          </label>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Submit Footer */}
              <div className="p-3.5 sm:p-4 border-t bg-slate-50 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:space-x-2">
                <button
                  type="button"
                  onClick={() => setShowEnterMarks(false)}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || marksFormEntries.length === 0}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {actionLoading ? 'Saving Marks...' : 'Save & Record All Marks'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Test Confirmation Modal with Enterprise Safeguards */}
      {showDeleteModal && examToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Delete Assessment Test</h3>
                  <p className="text-xs text-slate-500 font-mono">Code: {examToDelete.code}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!deletingExam) {
                    setShowDeleteModal(false);
                    setExamToDelete(null);
                  }
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="text-sm font-bold text-slate-900">{examToDelete.name}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  {examToDelete.class_name && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                      {examToDelete.class_name}
                    </span>
                  )}
                  {examToDelete.course_name && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                      {examToDelete.course_name}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-semibold">
                    {examToDelete.start_date}
                  </span>
                </div>
              </div>

              {/* Safeguard Warning based on published status */}
              {examToDelete.is_published ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-rose-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>⚠️ Published Assessment Safeguard Warning</span>
                  </div>
                  <p className="text-xs text-rose-700 leading-relaxed font-medium">
                    This test has already been <strong>Published</strong> with live student report cards and merit rankings. Removing it will <strong>permanently delete all scorecards from student records</strong> and cannot be undone.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-amber-800 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Permanent Deletion Notice</span>
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed font-medium">
                    Are you sure you want to delete this test? This will permanently remove its question paper configuration and all recorded student marks.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                disabled={deletingExam}
                onClick={() => {
                  setShowDeleteModal(false);
                  setExamToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingExam}
                onClick={handleConfirmDelete}
                className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {deletingExam ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Delete Test</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
