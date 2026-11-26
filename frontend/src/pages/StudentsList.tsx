import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, UserPlus, Filter, ArrowUpRight, ChevronLeft, ChevronRight, X, Edit3, Trash2, CheckCircle2, Printer, Calendar } from 'lucide-react';
import api from '../api/client';
import { useAcademicYear } from '../context/AcademicYearContext';
import { EditStudentModal } from '../components/EditStudentModal';
import { DeleteStudentModal } from '../components/DeleteStudentModal';
import { StudentAdmissionFormModal } from '../components/StudentAdmissionFormModal';

export const StudentsList: React.FC = () => {
  const { academicYears, selectedAcademicYear } = useAcademicYear();
  const [selectedAyFilter, setSelectedAyFilter] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Sync with global academic year
  useEffect(() => {
    if (selectedAcademicYear && !selectedAyFilter) {
      setSelectedAyFilter(selectedAcademicYear.id);
    }
  }, [selectedAcademicYear]);

  // Edit & Delete modal states
  const [studentToEdit, setStudentToEdit] = useState<any | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<any | null>(null);
  const [printStudentId, setPrintStudentId] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isInitialMount = useRef(true);

  const fetchStudents = async (
    currentPage = page,
    currentSearch = search,
    currentGender = genderFilter,
    currentAy = selectedAyFilter,
    currentPageSize = pageSize
  ) => {
    setLoading(true);
    try {
      const skip = (currentPage - 1) * currentPageSize;
      const res = await api.get('/students', {
        params: {
          skip,
          limit: currentPageSize,
          search: currentSearch.trim() || undefined,
          gender_filter: currentGender || undefined,
          academic_year_id: currentAy || undefined
        }
      });
      setStudents(res.data);

      const headerCount = res.headers['x-total-count'];
      if (headerCount !== undefined) {
        setTotalCount(parseInt(headerCount, 10) || 0);
      } else {
        setTotalCount(res.data.length);
      }
    } catch (err) {
      console.error('Failed to load students', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load & filter change
  useEffect(() => {
    fetchStudents(page, search, genderFilter, selectedAyFilter, pageSize);
  }, [page, genderFilter, selectedAyFilter, pageSize]);

  // Real-time debounced live search
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setPage(1);
      fetchStudents(1, search, genderFilter, selectedAyFilter, pageSize);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStudents(1, search, genderFilter, selectedAyFilter, pageSize);
  };

  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    fetchStudents(1, '', genderFilter, selectedAyFilter, pageSize);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startItem = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endItem = Math.min(page * pageSize, totalCount);

  // Pagination page pills helper (displays max 5 surrounding page buttons)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (page >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const renderStatusBadge = (s: any) => {
    if (s.promotion_status === 'PROMOTED_TO_NEXT') {
      return (
        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200" title="Promoted to next class in upcoming year">
          ✨ Promoted to Next
        </span>
      );
    }
    const status = s.enrollment_status || s.status;
    switch (status) {
      case 'PROVISIONAL_TRIAL':
        return (
          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
            ⏳ Trial Active
          </span>
        );
      case 'TRIAL_DROPOUT':
        return (
          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Trial Closed
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            ACTIVE
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            COMPLETED
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            SUSPENDED
          </span>
        );
      default:
        return (
          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Toast / Notification Banner */}
      {feedbackNotice && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition animate-in fade-in ${
          feedbackNotice.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedbackNotice.message}</span>
          </div>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Students Registry</h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              {totalCount.toLocaleString('en-IN')} Total Students
            </span>
          </div>
          <p className="text-xs text-slate-500">Central repository of all enrolled students, services and facility tenancies.</p>
        </div>
        <Link
          to="/admissions"
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/15 transition"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>New Admission</span>
        </Link>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search instantly by name, PRN (e.g. PRN-2026-00350), or phone number..."
            className="w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        <div className="flex items-center space-x-2 w-full sm:w-auto flex-wrap gap-y-2">
          {/* Academic Session Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <select
              value={selectedAyFilter}
              onChange={(e) => {
                setSelectedAyFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer py-1.5"
            >
              <option value="">All Academic Years</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  AY: {ay.name} {ay.is_current ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={genderFilter}
              onChange={(e) => {
                setGenderFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs text-slate-700 focus:outline-none cursor-pointer py-1.5"
            >
              <option value="">All Genders</option>
              <option value="MALE">Male (Boys)</option>
              <option value="FEMALE">Female (Girls)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-14 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading student directory...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="p-14 text-center text-xs text-slate-400 space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600">No students found</p>
            <p className="text-[11px] text-slate-400">Try adjusting your search criteria, academic year, or gender filter.</p>
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5 pl-5">PRN</th>
                    <th className="p-3.5">Student Name</th>
                    <th className="p-3.5">Enrolled Class</th>
                    <th className="p-3.5">Gender</th>
                    <th className="p-3.5">Contact Phone</th>
                    <th className="p-3.5">Admission Date</th>
                    <th className="p-3.5">Session Status</th>
                    <th className="p-3.5 pr-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5 pl-5 font-mono font-bold text-purple-700">
                        {s.prn || (s.student_code ? s.student_code.replace('STU-', 'PRN-') : '—')}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-900">
                        {s.first_name} {s.last_name}
                      </td>
                      <td className="p-3.5">
                        {s.class_name ? (
                          <div>
                            <span className="font-bold text-slate-900">{s.class_name}</span>
                            {s.course_name && (
                              <p className="text-[10px] text-slate-400 truncate max-w-[170px]" title={s.course_name}>
                                {s.course_name}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not Enrolled</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${s.gender === 'FEMALE' ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                          {s.gender === 'FEMALE' ? 'Female' : 'Male'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600 font-mono text-[11px]">{s.mobile || '—'}</td>
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">{s.admission_date || '—'}</td>
                      <td className="p-3.5">
                        {renderStatusBadge(s)}
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <Link
                            to={`/students/${s.id}`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                            title="View Student 360° Profile"
                          >
                            <span>360° Profile</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setStudentToEdit(s)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition cursor-pointer"
                            title="Edit Student Information"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentToDelete(s)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition cursor-pointer"
                            title="Delete Student Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Optimized Card List View (< md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {students.map((s) => (
                <div key={s.id} className="p-4 space-y-2.5 hover:bg-slate-50/70 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-purple-700">
                          {s.prn || (s.student_code ? s.student_code.replace('STU-', 'PRN-') : '—')}
                        </span>
                        <span className={`inline-flex px-1.5 py-0.2 rounded text-[9px] font-semibold ${s.gender === 'FEMALE' ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                          {s.gender === 'FEMALE' ? 'Female' : 'Male'}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mt-0.5">
                        {s.first_name} {s.last_name}
                      </h4>
                      {s.class_name && (
                        <p className="text-xs text-blue-700 font-semibold mt-0.5">
                          {s.class_name} {s.course_name ? `• ${s.course_name}` : ''}
                        </p>
                      )}
                    </div>
                    {renderStatusBadge(s)}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-mono">
                    {s.mobile && <span>📞 {s.mobile}</span>}
                    {s.admission_date && <span>📅 Adm: {s.admission_date}</span>}
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                    <Link
                      to={`/students/${s.id}`}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                    >
                      <span>360° Profile</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>

                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setPrintStudentId(s.id)}
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 rounded-lg transition cursor-pointer"
                        title="Print Official Admission Dossier (A4 Front & Back)"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentToEdit(s)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition cursor-pointer"
                        title="Edit Student Information"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentToDelete(s)}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg transition cursor-pointer"
                        title="Delete Student Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Toolbar */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/40">
              <div className="text-slate-500 text-[11px]">
                Showing <span className="font-semibold text-slate-800">{startItem}</span> to{' '}
                <span className="font-semibold text-slate-800">{endItem}</span> of{' '}
                <span className="font-bold text-slate-900">{totalCount.toLocaleString('en-IN')}</span> students
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value, 10));
                      setPage(1);
                    }}
                    className="p-1 px-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="hidden sm:flex items-center space-x-1">
                    {getPageNumbers().map((p, idx) => (
                      typeof p === 'number' ? (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                            page === p
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      ) : (
                        <span key={idx} className="px-1 text-slate-400">...</span>
                      )
                    ))}
                  </div>

                  <span className="sm:hidden text-xs text-slate-600 font-medium px-2">
                    {page} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Student Modal */}
      {studentToEdit && (
        <EditStudentModal
          isOpen={!!studentToEdit}
          student={studentToEdit}
          onClose={() => setStudentToEdit(null)}
          onSuccess={(updated) => {
            setFeedbackNotice({
              type: 'success',
              message: `Student "${updated.first_name} ${updated.last_name}" updated successfully.`
            });
            fetchStudents(page, search, genderFilter, selectedAyFilter, pageSize);
            setTimeout(() => setFeedbackNotice(null), 4000);
          }}
        />
      )}

      {/* Delete Student Confirmation Modal */}
      {studentToDelete && (
        <DeleteStudentModal
          isOpen={!!studentToDelete}
          student={studentToDelete}
          onClose={() => setStudentToDelete(null)}
          onSuccess={() => {
            setFeedbackNotice({
              type: 'success',
              message: `Student record deleted successfully.`
            });
            fetchStudents(page, search, genderFilter, selectedAyFilter, pageSize);
            setTimeout(() => setFeedbackNotice(null), 4000);
          }}
        />
      )}

      {/* Official Student Admission Dossier Modal (Printable A4 Front & Back) */}
      {printStudentId && (
        <StudentAdmissionFormModal
          isOpen={!!printStudentId}
          studentId={printStudentId}
          onClose={() => setPrintStudentId(null)}
        />
      )}
    </div>
  );
};