import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Search,
  Filter,
  RefreshCw,
  Plus,
  BookOpen,
  Calendar,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import apiClient from '../api/client';

interface BatchSubjectOption {
  id: string;
  batch_id: string;
  batch_name: string;
  batch_code: string;
  division?: string;
  enrolled_count?: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  teacher_name?: string | null;
  classroom_name: string;
}

interface BatchGroup {
  batch_id: string;
  batch_name: string;
  batch_code: string;
  division: string;
  enrolled_count: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  subjects: BatchSubjectOption[];
}

interface StudentRosterItem {
  student_id: string;
  student_code: string;
  prn?: string;
  roll_number?: number | null;
  first_name: string;
  last_name: string;
  gender: string;
  marked_status?: 'PRESENT' | 'ABSENT' | 'LATE' | null;
  remarks?: string | null;
  session_topic?: string | null;
}

interface AttendanceSessionItem {
  id: string;
  session_date: string;
  start_time?: string | null;
  end_time?: string | null;
  topic_covered?: string | null;
  batch_name: string;
  subject_name: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  total_marked: number;
  attendance_rate: number;
}

export const AttendanceMarking: React.FC = () => {
  const [batchSubjects, setBatchSubjects] = useState<BatchSubjectOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedBatchSubjectId, setSelectedBatchSubjectId] = useState<string>('');
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE'>>({});
  const [recentSessions, setRecentSessions] = useState<AttendanceSessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isAlreadyMarked, setIsAlreadyMarked] = useState<boolean>(false);

  // Group batchSubjects by batch_id into unique batches
  const batchGroups: BatchGroup[] = React.useMemo(() => {
    const map = new Map<string, BatchGroup>();
    batchSubjects.forEach((bs) => {
      if (!map.has(bs.batch_id)) {
        map.set(bs.batch_id, {
          batch_id: bs.batch_id,
          batch_name: bs.batch_name,
          batch_code: bs.batch_code,
          division: bs.division || 'A',
          enrolled_count: bs.enrolled_count ?? 0,
          start_date: bs.start_date,
          end_date: bs.end_date,
          is_active: bs.is_active ?? true,
          subjects: []
        });
      }
      map.get(bs.batch_id)!.subjects.push(bs);
    });
    return Array.from(map.values());
  }, [batchSubjects]);

  const activeBatch = React.useMemo(() => {
    return batchGroups.find((b) => b.batch_id === selectedBatchId) || batchGroups[0] || null;
  }, [batchGroups, selectedBatchId]);

  const availableSubjects = React.useMemo(() => {
    return activeBatch?.subjects || [];
  }, [activeBatch]);

  // Session metadata
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [topicCovered, setTopicCovered] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [bsRes, sessRes] = await Promise.all([
        apiClient.get<BatchSubjectOption[]>('/attendance/batch-subjects'),
        apiClient.get<AttendanceSessionItem[]>('/attendance/sessions')
      ]);

      setBatchSubjects(bsRes.data);
      setRecentSessions(sessRes.data);

      if (bsRes.data.length > 0) {
        const firstBatchId = bsRes.data[0].batch_id;
        const firstSubjectId = bsRes.data[0].id;
        setSelectedBatchId(firstBatchId);
        setSelectedBatchSubjectId(firstSubjectId);
        fetchRoster(firstSubjectId, sessionDate);
      }
    } catch (err: any) {
      console.error('Failed to load attendance initial data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoster = async (bsId: string, targetDate?: string) => {
    try {
      const dateToUse = targetDate || sessionDate;
      const res = await apiClient.get<StudentRosterItem[]>(`/attendance/batch-subjects/${bsId}/students?session_date=${dateToUse}`);
      setRoster(res.data);

      const hasMarked = res.data.some((s) => s.marked_status != null);
      setIsAlreadyMarked(hasMarked);

      if (hasMarked && res.data[0]?.session_topic) {
        setTopicCovered(res.data[0].session_topic);
      } else {
        setTopicCovered('');
      }

      const initialMap: Record<string, 'PRESENT' | 'ABSENT' | 'LATE'> = {};
      res.data.forEach((s) => {
        initialMap[s.student_id] = s.marked_status || 'PRESENT';
      });
      setAttendanceMap(initialMap);
    } catch (err: any) {
      console.error('Failed to fetch batch students', err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleBatchChange = (newBatchId: string) => {
    setSelectedBatchId(newBatchId);
    const targetGroup = batchGroups.find((b) => b.batch_id === newBatchId);
    if (targetGroup && targetGroup.subjects.length > 0) {
      const firstSubj = targetGroup.subjects[0];
      setSelectedBatchSubjectId(firstSubj.id);
      fetchRoster(firstSubj.id, sessionDate);
    } else {
      setSelectedBatchSubjectId('');
      setRoster([]);
      setIsAlreadyMarked(false);
    }
  };

  const handleSubjectChange = (newBatchSubjId: string) => {
    setSelectedBatchSubjectId(newBatchSubjId);
    if (newBatchSubjId) {
      fetchRoster(newBatchSubjId, sessionDate);
    }
  };

  const handleDateChange = (newDate: string) => {
    setSessionDate(newDate);
    if (selectedBatchSubjectId) {
      fetchRoster(selectedBatchSubjectId, newDate);
    }
  };

  const setStatusForStudent = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE') => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: status
    }));
  };

  const setAllStatus = (status: 'PRESENT' | 'ABSENT' | 'LATE') => {
    const updated: Record<string, 'PRESENT' | 'ABSENT' | 'LATE'> = {};
    roster.forEach((s) => {
      updated[s.student_id] = status;
    });
    setAttendanceMap(updated);
  };

  const handleSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchSubjectId || roster.length === 0 || submitting) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      // 1. Create or retrieve existing Session (idempotent across clicks)
      const sessRes = await apiClient.post<{ id: string }>('/attendance/sessions', {
        batch_subject_id: selectedBatchSubjectId,
        session_date: sessionDate,
        topic_covered: topicCovered.trim() || undefined
      });

      // 2. Submit Bulk Records (upserts records into this session)
      const records = roster.map((s) => ({
        student_id: s.student_id,
        status: attendanceMap[s.student_id] || 'PRESENT',
        remarks: attendanceMap[s.student_id] === 'ABSENT' ? 'Marked absent by teacher' : undefined
      }));

      await apiClient.post('/attendance/records', {
        session_id: sessRes.data.id,
        records
      });

      setIsAlreadyMarked(true);
      setFeedback({
        type: 'success',
        text: isAlreadyMarked
          ? `Attendance updated successfully for ${records.length} students!`
          : `Attendance recorded and locked for ${records.length} students!`
      });

      // Refresh session history
      const updatedSess = await apiClient.get<AttendanceSessionItem[]>('/attendance/sessions');
      setRecentSessions(updatedSess.data);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to submit attendance.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBs = batchSubjects.find((b) => b.id === selectedBatchSubjectId);
  const presentCount = Object.values(attendanceMap).filter((v) => v === 'PRESENT').length;
  const absentCount = Object.values(attendanceMap).filter((v) => v === 'ABSENT').length;
  const lateCount = Object.values(attendanceMap).filter((v) => v === 'LATE').length;

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 shrink-0">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Academic Attendance Terminal</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Batch Rosters • Real-Time Teacher Marking • Audit Trails • Topic Progress Tracking
            </p>
          </div>
        </div>

        <button
          onClick={fetchInitialData}
          className="flex items-center justify-center space-x-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Terminal</span>
        </button>
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
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Layout: Attendance Terminal (Left 2/3) + Session History (Right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Terminal Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Class / Subject Selector Box */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            {/* Cascading Row 1: Batch & Division -> Subject */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Dropdown 1: Teaching Batch & Division */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>1. Teaching Batch &amp; Division *</span>
                  {activeBatch && (
                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Div {activeBatch.division} • {activeBatch.enrolled_count} Enrolled
                    </span>
                  )}
                </label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => handleBatchChange(e.target.value)}
                  className="w-full p-2.5 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  {batchGroups.map((bg) => {
                    const hasDiv = /div(ision)?/i.test(bg.batch_name);
                    const label = hasDiv
                      ? `${bg.batch_name} (${bg.enrolled_count} ${bg.enrolled_count === 1 ? 'Student' : 'Students'})`
                      : `${bg.batch_name} — Division ${bg.division} (${bg.enrolled_count} ${bg.enrolled_count === 1 ? 'Student' : 'Students'})`;
                    return (
                      <option key={bg.batch_id} value={bg.batch_id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                {activeBatch?.start_date && activeBatch?.end_date && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Validity: <strong className="text-slate-700">{activeBatch.start_date}</strong> → <strong className="text-slate-700">{activeBatch.end_date}</strong>
                    </span>
                    {(() => {
                      const today = new Date().toISOString().split('T')[0];
                      if (today > activeBatch.end_date) {
                        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Course Expired</span>;
                      }
                      const daysLeft = Math.ceil((new Date(activeBatch.end_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
                      return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Active ({daysLeft}d left)</span>;
                    })()}
                  </div>
                )}
              </div>

              {/* Dropdown 2: Subject / Lecture */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>2. Subject / Lecture *</span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {availableSubjects.length} subjects
                  </span>
                </label>
                <select
                  value={selectedBatchSubjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  disabled={availableSubjects.length === 0}
                  className="w-full p-2.5 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 disabled:opacity-50"
                >
                  {availableSubjects.length === 0 ? (
                    <option value="">No subjects configured for this batch</option>
                  ) : (
                    availableSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject_name} ({s.classroom_name}{s.teacher_name ? ` • ${s.teacher_name}` : ''})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Row 2: Date & Topic */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Session Date *
                </label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Topic / Curriculum Unit Covered
                </label>
                <input
                  type="text"
                  value={topicCovered}
                  onChange={(e) => setTopicCovered(e.target.value)}
                  placeholder=""
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            </div>

            {/* Batch Lifecycle & Expiry Alerts */}
            {activeBatch?.end_date && sessionDate > activeBatch.end_date && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Course Expiry Alert: </span>
                  <span>
                    Selected session date (<strong>{sessionDate}</strong>) is past this batch's scheduled end date (<strong>{activeBatch.end_date}</strong>). 
                    The course curriculum period has concluded. Attendance will be recorded as a post-expiry revision/extra session.
                  </span>
                </div>
              </div>
            )}

            {activeBatch?.start_date && sessionDate < activeBatch.start_date && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start space-x-2 text-xs text-blue-800">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Batch Commencement Notice: </span>
                  <span>
                    Selected session date (<strong>{sessionDate}</strong>) precedes this batch's scheduled start date (<strong>{activeBatch.start_date}</strong>).
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Session Already Locked Indicator Banner */}
          {isAlreadyMarked && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>Attendance already recorded for this date:</strong> Showing saved marks. Submitting will update this session without adding duplicate entries.
                </span>
              </div>
              <span className="font-bold text-[10px] px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 whitespace-nowrap">
                LOCKED SESSION
              </span>
            </div>
          )}

          {/* Student Roster Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-teal-600" />
                <span className="font-bold text-slate-900 text-sm">Enrolled Roster ({roster.length} Students)</span>
              </div>

              {/* Fast Bulk Actions */}
              <div className="flex items-center space-x-2 text-xs font-semibold">
                <span className="text-slate-500">Mark All:</span>
                <button
                  type="button"
                  onClick={() => setAllStatus('PRESENT')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-all"
                >
                  All Present
                </button>
                <button
                  type="button"
                  onClick={() => setAllStatus('ABSENT')}
                  className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 hover:bg-rose-200 transition-all"
                >
                  All Absent
                </button>
              </div>
            </div>

            {roster.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No active students currently enrolled in this batch.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {roster.map((s, idx) => {
                  const currentStatus = attendanceMap[s.student_id] || 'PRESENT';

                  return (
                    <div
                      key={s.student_id}
                      className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-all"
                    >
                      <div className="flex items-center space-x-3">
                        {s.roll_number ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono font-bold text-xs border border-blue-200 shrink-0">
                            Roll #{s.roll_number}
                          </span>
                        ) : (
                          <span className="text-xs font-mono font-bold text-slate-400 w-6 shrink-0">
                            {idx + 1}.
                          </span>
                        )}
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {s.first_name} {s.last_name}
                          </p>
                          <p className="text-xs font-mono text-emerald-600 font-semibold">
                            PRN: {s.prn || (s.student_code ? s.student_code.replace('STU-', 'PRN-') : '—')}
                          </p>
                        </div>
                      </div>

                      {/* Status Toggle Buttons */}
                      <div className="inline-flex w-full sm:w-auto p-1 bg-slate-100 rounded-xl space-x-1">
                        <button
                          type="button"
                          onClick={() => setStatusForStudent(s.student_id, 'PRESENT')}
                          className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                            currentStatus === 'PRESENT'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-emerald-700'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Present</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setStatusForStudent(s.student_id, 'ABSENT')}
                          className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                            currentStatus === 'ABSENT'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-rose-700'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Absent</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setStatusForStudent(s.student_id, 'LATE')}
                          className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                            currentStatus === 'LATE'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'text-slate-600 hover:text-amber-700'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Late</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Submission Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 sm:space-x-4 text-xs font-bold">
                <span className="text-emerald-600">Present: {presentCount}</span>
                <span className="text-rose-600">Absent: {absentCount}</span>
                <span className="text-amber-600">Late: {lateCount}</span>
              </div>

              <button
                type="button"
                disabled={submitting || roster.length === 0}
                onClick={handleSubmitAttendance}
                className="w-full sm:w-auto px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {submitting ? 'Saving Records...' : isAlreadyMarked ? 'Update & Lock Attendance' : 'Save & Lock Attendance'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Recent Past Sessions */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>Recent Recorded Sessions</span>
            </h3>

            {recentSessions.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No recent attendance sessions found.</p>
            ) : (
              <div className="space-y-3">
                {recentSessions.slice(0, 8).map((sess) => (
                  <div key={sess.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-slate-900 text-xs">{sess.batch_name}</p>
                        <p className="text-[11px] text-teal-600 font-semibold">{sess.subject_name}</p>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 font-semibold">
                        {sess.session_date}
                      </span>
                    </div>

                    {sess.topic_covered && (
                      <p className="text-[11px] text-slate-500 italic truncate">{sess.topic_covered}</p>
                    )}

                    <div className="pt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Turnout:</span>
                      <span className="font-bold text-emerald-600">{sess.attendance_rate}% ({sess.present_count}/{sess.total_marked})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
