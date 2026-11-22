import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  User,
  GraduationCap,
  Home,
  Armchair,
  FileText,
  Calendar,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Shield,
  Clock,
  Sparkles,
  Layers,
  FileCheck,
  Check,
  BookOpen,
  Award,
  AlertTriangle,
  Building2
} from 'lucide-react';
import api from '../api/client';
import { useInstitute } from '../context/InstituteContext';

interface StudentAdmissionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
}

export const StudentAdmissionFormModal: React.FC<StudentAdmissionFormModalProps> = ({
  isOpen,
  onClose,
  studentId
}) => {
  const { institute } = useInstitute();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && studentId) {
      setLoading(true);
      setError(null);
      api
        .get(`/students/${studentId}/profile`)
        .then((res) => {
          setProfile(res.data);
        })
        .catch((err) => {
          console.error('Failed to load student dossier for printing:', err);
          setError(err.response?.data?.detail || 'Failed to load student admission records');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, studentId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const overview = profile?.overview || {};
  const academics: any[] = profile?.academics || [];
  const primaryGuardian = overview.guardians?.[0] || null;
  const hostel = profile?.hostel || null;
  const studyRoom = profile?.study_room || null;

  return (
    <>
      {/* Print-specific layout styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #admission-form-print-area, #admission-form-print-area * {
            visibility: visible !important;
          }
          #admission-form-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          .no-print {
            display: none !important;
          }
          .print-page-1 {
            page-break-after: always !important;
            break-after: page !important;
            min-height: 275mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .print-page-2 {
            min-height: 275mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Modal Backdrop (Screen View) */}
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 no-print overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] animate-in fade-in zoom-in-95 duration-150">
          
          {/* Modal Screen Top Bar */}
          <div className="px-4 sm:px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Official Student Admission Dossier</h3>
                <p className="text-[11px] text-slate-400">Standard 2-Page A4 Duplex Document • Front &amp; Back</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={loading || !!error}
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center space-x-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document (A4 Front &amp; Back)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-3 sm:p-6 overflow-y-auto bg-slate-100 flex flex-col items-center space-y-6">
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs text-slate-500 font-medium">Generating official student dossier...</p>
              </div>
            ) : error ? (
              <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs text-center max-w-md my-10">
                {error}
              </div>
            ) : (
              /* Printable A4 Document Area */
              <div
                id="admission-form-print-area"
                className="w-full max-w-[210mm] text-slate-800 text-xs space-y-6 print:space-y-0"
              >

                {/* ========================================================================= */}
                {/* PAGE 1: FRONT SIDE - ACADEMIC, DEMOGRAPHIC & FACILITY REGISTRATION       */}
                {/* ========================================================================= */}
                <div className="print-page-1 bg-white p-6 sm:p-8 shadow-sm rounded-xl border border-slate-200 print:p-0 print:border-none print:shadow-none space-y-3.5">
                  <div className="space-y-3.5">
                    
                    {/* 1. Header / Letterhead */}
                    <div className="border-b-2 border-slate-900 pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start space-x-3.5">
                          <div className="w-12 h-12 rounded-xl bg-slate-950 text-white flex items-center justify-center font-black text-xl shrink-0 print:border print:border-black">
                            {institute?.name ? institute.name[0] : 'Y'}
                          </div>
                          <div>
                            <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-950 uppercase">
                              {institute?.name || 'Yashodeep Coaching Classes'}
                            </h1>
                            {institute?.tagline && (
                              <p className="text-[11px] font-semibold text-emerald-800 italic">{institute.tagline}</p>
                            )}
                            <p className="text-[10px] text-slate-600 mt-0.5">
                              {institute?.address || 'Yashodeep Coaching Classes, Kuditre, Karveer, Kolhapur, Maharashtra'}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 text-[9px] text-slate-500 font-mono mt-0.5">
                              {institute?.registration_number && <span>Reg: <strong>{institute.registration_number}</strong></span>}
                              {institute?.contact_phone && <span>• Tel: <strong>{institute.contact_phone}</strong></span>}
                              {institute?.contact_email && <span>• Email: <strong>{institute.contact_email}</strong></span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="inline-block px-2.5 py-1 rounded bg-slate-900 text-white font-mono font-bold text-[10px] uppercase tracking-wider print:border print:border-black">
                            OFFICIAL ADMISSION DOSSIER
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium mt-1">Session: <strong className="text-slate-900">2026–2027</strong></p>
                          <p className="text-[10px] text-slate-500">Date: <strong className="text-slate-900">{overview.admission_date || new Date().toISOString().slice(0, 10)}</strong></p>
                        </div>
                      </div>
                    </div>

                    {/* 2. Registration & Identity Bar + Photo Box */}
                    <div className="flex items-stretch justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5 print:bg-slate-100">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1 text-[11px]">
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase font-semibold block">Permanent Reg. No (PRN)</span>
                          <strong className="font-mono text-purple-700 text-xs font-extrabold">{overview.prn || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase font-semibold block">Student Code</span>
                          <strong className="font-mono text-slate-900 text-xs font-extrabold">{overview.student_code || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase font-semibold block">Classroom Roll Number</span>
                          <strong className="font-mono text-blue-700 text-xs font-bold">
                            {overview.roll_number ? `#${overview.roll_number} (Div ${overview.division || 'A'})` : 'Assigned in Batch'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase font-semibold block">Enrollment Status</span>
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {overview.status || 'ACTIVE'}
                          </span>
                        </div>
                      </div>

                      {/* Passport Photo Affix Box */}
                      <div className="w-22 h-26 sm:w-24 sm:h-28 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-center p-1 shrink-0 bg-white">
                        <User className="w-5 h-5 text-slate-300 mb-1" />
                        <span className="text-[8px] font-semibold text-slate-400 uppercase leading-tight">
                          Affix Student Photo
                        </span>
                      </div>
                    </div>

                    {/* 3. Section: Student Demographics */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-0.5">
                        <User className="w-3.5 h-3.5 text-emerald-700" />
                        <h2 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">1. Student Demographics &amp; Bio</h2>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-slate-50/70 border border-slate-200 rounded-lg text-[10.5px]">
                        <div>
                          <span className="text-slate-500 text-[9px] block">Full Name</span>
                          <strong className="text-slate-900">{overview.first_name} {overview.middle_name ? `${overview.middle_name} ` : ''}{overview.last_name}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[9px] block">Date of Birth</span>
                          <strong className="text-slate-900">{overview.date_of_birth || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[9px] block">Gender</span>
                          <strong className="text-slate-900">{overview.gender || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[9px] block">Blood Group</span>
                          <strong className="text-slate-900">{overview.blood_group || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[9px] block">Aadhar / National ID</span>
                          <strong className="font-mono text-slate-900">{overview.aadhar_number || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[9px] block">Social Category</span>
                          <strong className="text-slate-900">{overview.category || 'GENERAL'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[9px] block">Contact Mobile</span>
                          <strong className="font-mono text-slate-900">{overview.mobile || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[9px] block">Email Address</span>
                          <span className="text-slate-900 truncate block">{overview.email || '—'}</span>
                        </div>
                        <div className="col-span-2 sm:col-span-4 border-t border-slate-200 pt-1">
                          <span className="text-slate-500 text-[9px] block">Permanent Native / Residential Address</span>
                          <span className="text-slate-800 font-medium">
                            {overview.village || overview.taluka || overview.district
                              ? `At/Post: ${overview.village || '—'}, Taluka: ${overview.taluka || '—'}, District: ${overview.district || '—'}`
                              : overview.address || '—'}
                          </span>
                        </div>
                        <div className="col-span-2 sm:col-span-4 border-t border-slate-200 pt-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <span className="text-slate-500 text-[9px] block">Regular {overview.institution_type === 'COLLEGE' ? 'Junior College' : 'School'}</span>
                            <strong className="text-slate-900">{overview.school_college_name || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[9px] block">Education Board</span>
                            <strong className="text-slate-900">{overview.education_board || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[9px] block">Previous Percentage</span>
                            <strong className="font-mono text-purple-700">{overview.previous_percentage != null ? `${overview.previous_percentage}%` : '—'}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. Section: Parent / Guardian Information */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-0.5">
                        <Shield className="w-3.5 h-3.5 text-emerald-700" />
                        <h2 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">2. Parent / Guardian Particulars</h2>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-slate-50/70 border border-slate-200 rounded-lg text-[10.5px]">
                        <div>
                          <span className="text-slate-500 text-[9px] block">Guardian Name</span>
                          <strong className="text-slate-900">{primaryGuardian ? primaryGuardian.name : '—'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[9px] block">Relationship</span>
                          <strong className="text-slate-900">{primaryGuardian ? primaryGuardian.relation : '—'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[9px] block">Primary Phone</span>
                          <strong className="font-mono text-slate-900">{primaryGuardian ? primaryGuardian.mobile : '—'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[9px] block">Emergency Phone</span>
                          <strong className="font-mono text-slate-900">{overview.emergency_contact_phone || overview.mobile || '—'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* 5. Section: Enrolled Academic & Skill Programs (ALL COURSES) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                        <div className="flex items-center space-x-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-emerald-700" />
                          <h2 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                            3. Enrolled Academic &amp; Skill Programs ({academics.length} Courses)
                          </h2>
                        </div>
                        <span className="text-[9px] font-semibold text-slate-500 font-mono">Session: 2026–2027</span>
                      </div>

                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white text-[10.5px]">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-100 border-b border-slate-200 text-[9px] uppercase font-bold text-slate-600">
                            <tr>
                              <th className="py-1.5 px-2.5">Course / Program</th>
                              <th className="py-1.5 px-2">Type</th>
                              <th className="py-1.5 px-2">Standard / Stream</th>
                              <th className="py-1.5 px-2">Batch &amp; Division</th>
                              <th className="py-1.5 px-2">Enrolled Subjects</th>
                              <th className="py-1.5 px-2 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {academics.map((ac: any, idx: number) => (
                              <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                                <td className="py-2 px-2.5">
                                  <strong className="text-slate-900 block font-bold">{ac.course_name}</strong>
                                  <span className="text-[9px] font-mono text-slate-400">{ac.course_code || 'CRS'}</span>
                                </td>
                                <td className="py-2 px-2">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold ${
                                    ac.is_universal
                                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}>
                                    {ac.is_universal ? 'SKILL / ELECTIVE' : 'CORE ACADEMIC'}
                                  </span>
                                </td>
                                <td className="py-2 px-2">
                                  <span className="font-semibold text-slate-800">{ac.class_name || 'All Standards'}</span>
                                  {ac.stream_name && <span className="text-[9px] text-slate-500 block">{ac.stream_name}</span>}
                                </td>
                                <td className="py-2 px-2 font-mono">
                                  <strong className="text-emerald-800">{ac.batch_name || overview.batch_name || 'Classroom Batch'}</strong>
                                  <span className="text-[9px] text-slate-500 block">Div: {ac.division || overview.division || 'A'}</span>
                                </td>
                                <td className="py-2 px-2">
                                  {ac.subjects && ac.subjects.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {ac.subjects.map((sub: any, sIdx: number) => (
                                        <span key={sIdx} className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-medium text-slate-700 border border-slate-200">
                                          {sub.name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[9px]">English / Module Curriculum</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <span className="font-mono font-bold text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    {ac.status || 'ACTIVE'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 6. Section: Facilities & Residential Tenancy */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-0.5">
                        <Home className="w-3.5 h-3.5 text-emerald-700" />
                        <h2 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">4. Facility &amp; Residential Tenancy</h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
                        {/* Hostel Card */}
                        <div className="p-2 rounded-lg border bg-slate-50/70 border-slate-200 flex items-start space-x-2">
                          <Home className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-slate-900 block font-bold">Hostel Residential Accommodation</strong>
                            {hostel ? (
                              <div className="space-y-0.5 text-[9.5px] text-slate-700 mt-0.5">
                                <p>Assigned Bed: <strong className="font-mono text-emerald-800 font-bold">{hostel.bed_number}</strong> (Room {hostel.room_number || '—'})</p>
                                <p className="text-slate-500">Period: {hostel.start_date} to {hostel.end_date}</p>
                              </div>
                            ) : (
                              <span className="text-[9.5px] text-slate-500 italic">Not Opted (Day Scholar)</span>
                            )}
                          </div>
                        </div>

                        {/* Study Room Card */}
                        <div className="p-2 rounded-lg border bg-slate-50/70 border-slate-200 flex items-start space-x-2">
                          <Armchair className="w-3.5 h-3.5 text-purple-700 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-slate-900 block font-bold">Dedicated Study Room Desk</strong>
                            {studyRoom ? (
                              <div className="space-y-0.5 text-[9.5px] text-slate-700 mt-0.5">
                                <p>Assigned Seat: <strong className="font-mono text-purple-800 font-bold">{studyRoom.seat_number}</strong></p>
                                <p className="text-slate-500">Period: {studyRoom.start_date} to {studyRoom.end_date}</p>
                              </div>
                            ) : (
                              <span className="text-[9.5px] text-slate-500 italic">Not Opted</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Page 1 Bottom Turn-Over Indicator */}
                  <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                    <span>{institute?.name || 'Yashodeep Coaching Classes'} • Official Academic Dossier</span>
                    <span className="font-bold text-slate-700">[ PAGE 1 OF 2 • TURN OVER FOR ACADEMIC REGULATIONS, CODE OF CONDUCT &amp; UNDERTAKING ]</span>
                    <span>Student PRN: {overview.prn}</span>
                  </div>
                </div>

                {/* On-screen visual divider between Page 1 and Page 2 */}
                <div className="no-print w-full flex items-center justify-center my-2">
                  <div className="h-px bg-slate-300 flex-1"></div>
                  <span className="px-3 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold uppercase rounded-full shadow-xs">
                    Page 2 (Back Side of A4 Document)
                  </span>
                  <div className="h-px bg-slate-300 flex-1"></div>
                </div>

                {/* ========================================================================= */}
                {/* PAGE 2: BACK SIDE - ACADEMIC REGULATIONS, DISCIPLINE & UNDERTAKING       */}
                {/* ========================================================================= */}
                <div className="print-page-2 bg-white p-6 sm:p-8 shadow-sm rounded-xl border border-slate-200 print:p-0 print:border-none print:shadow-none space-y-4">
                  <div className="space-y-4">

                    {/* Page 2 Running Header */}
                    <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                          {institute?.name || 'Yashodeep Coaching Classes'} — Academic Regulations &amp; Institutional Undertaking
                        </h2>
                        <p className="text-[10px] text-slate-600">
                          Student: <strong>{overview.first_name} {overview.last_name}</strong> • PRN: <strong className="font-mono text-purple-800">{overview.prn}</strong> • Code: <strong className="font-mono">{overview.student_code}</strong>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-[9px] uppercase tracking-wider print:border print:border-black">
                          PAGE 2 OF 2 (BACK SIDE)
                        </span>
                        <p className="text-[9px] text-slate-400 mt-0.5 font-mono">Academic Year 2026–2027</p>
                      </div>
                    </div>

                    {/* 5. Section: Academic Attendance, Test Series & Performance Standards */}
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-0.5">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                        <h2 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                          5. Academic Attendance, Examination &amp; Curriculum Regulations
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                        <div className="p-2.5 rounded-lg border bg-slate-50/70 border-slate-200 space-y-1">
                          <strong className="text-slate-900 font-bold block text-[10.5px]">80% Mandatory Class Attendance</strong>
                          <p className="text-slate-600 leading-relaxed text-[9.5px]">
                            Students are required to maintain a minimum of 80% regular attendance across all enrolled subjects, practical sessions, and tutorial hours. Daily attendance is tracked on batch rolls; unexcused absence is reported directly to parents.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg border bg-slate-50/70 border-slate-200 space-y-1">
                          <strong className="text-slate-900 font-bold block text-[10.5px]">Weekly Tests &amp; Performance Evaluation</strong>
                          <p className="text-slate-600 leading-relaxed text-[9.5px]">
                            Participation in all scheduled weekly unit tests, Chapter Assessment Tests (CAT), and terminal full-syllabus mock series is compulsory. Performance reports and ranking metrics are compiled and shared with guardians periodically.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg border bg-slate-50/70 border-slate-200 space-y-1">
                          <strong className="text-slate-900 font-bold block text-[10.5px]">Coaching Shift &amp; School Alignment</strong>
                          <p className="text-slate-600 leading-relaxed text-[9.5px]">
                            Lecture timings are scheduled around regular school/junior college shifts. Students must report strictly to their designated division batch. Transfer of batch requires prior academic approval from the Center Head.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg border bg-slate-50/70 border-slate-200 space-y-1">
                          <strong className="text-slate-900 font-bold block text-[10.5px]">Planned Leave &amp; Absence Protocol</strong>
                          <p className="text-slate-600 leading-relaxed text-[9.5px]">
                            Absence due to medical illness or unavoidable circumstances requires prior written intimation from the parent/guardian with appropriate medical documentation submitted upon return.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 6. Section: Campus Decorum, Facility Tenancy & Anti-Ragging Policy */}
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-0.5">
                        <Shield className="w-3.5 h-3.5 text-emerald-700" />
                        <h2 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                          6. Campus Decorum, Facility Tenancy &amp; Anti-Ragging Policy
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                        <div className="p-2.5 rounded-lg border bg-slate-50/70 border-slate-200 space-y-1">
                          <strong className="text-slate-900 font-bold block text-[10.5px]">Electronic Devices &amp; Classroom Etiquette</strong>
                          <p className="text-slate-600 leading-relaxed text-[9.5px]">
                            Mobile phones must be powered off or placed in silent mode during lectures and study sessions. Unauthorized audio/video recordings, eating inside classrooms, or disrupting lectures will attract disciplinary action.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg border bg-slate-50/70 border-slate-200 space-y-1">
                          <strong className="text-slate-900 font-bold block text-[10.5px]">Study Room &amp; Library Rules</strong>
                          <p className="text-slate-600 leading-relaxed text-[9.5px]">
                            Dedicated study desks are non-transferable and allocated for individual academic preparation only. Absolute pin-drop silence must be observed. Electrical outlets are strictly reserved for educational study devices (laptops/tablets).
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg border bg-slate-50/70 border-slate-200 space-y-1">
                          <strong className="text-slate-900 font-bold block text-[10.5px]">Hostel Tenancy &amp; Curfew Guidelines</strong>
                          <p className="text-slate-600 leading-relaxed text-[9.5px]">
                            Allocated beds and rooms are non-transferable. Residents must strictly observe campus curfew hours (9:30 PM), maintain room hygiene, and respect fellow students. External guests and visitors are not permitted in residential quarters.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg border bg-slate-50/70 border-slate-200 space-y-1">
                          <strong className="text-slate-900 font-bold block text-[10.5px]">Zero-Tolerance Anti-Ragging Code</strong>
                          <p className="text-slate-600 leading-relaxed text-[9.5px]">
                            The institute strictly complies with the Maharashtra Prohibition of Ragging Act. Any act of ragging, bullying, physical misconduct, or property damage results in instant expulsion and filing of a police FIR without exception.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 7. Section: Institutional Communication & Emergency Medical Consent */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-0.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-700" />
                        <h2 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                          7. Institutional Communication &amp; Emergency Medical Authorization
                        </h2>
                      </div>
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 text-[9.5px] text-slate-600 leading-relaxed space-y-1">
                        <p>
                          <strong>Official Communication Channel:</strong> All official notices, lecture updates, attendance alerts, and test reports will be communicated to the registered Guardian contact (<strong>{primaryGuardian ? `${primaryGuardian.name} (${primaryGuardian.relation}) • ${primaryGuardian.mobile}` : overview.mobile || 'Registered Contact'}</strong>). Any change in phone number or residential address must be updated immediately in office records.
                        </p>
                        <p>
                          <strong>Emergency Medical Care Authorization:</strong> In the event of a medical emergency during class hours, library sessions, or hostel stay, the institute authorities are authorized to administer emergency first aid and arrange for transportation to the nearest medical clinic or hospital while immediately informing the registered parent/guardian.
                        </p>
                      </div>
                    </div>

                    {/* 8. Section: Joint Student & Parent Declaration / Undertaking */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-0.5">
                        <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
                        <h2 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                          8. Joint Student &amp; Parent / Guardian Declaration &amp; Undertaking
                        </h2>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-300 bg-slate-100/80 text-[9.5px] text-slate-800 leading-relaxed space-y-1.5">
                        <p className="font-medium">
                          We, the undersigned student (<strong>{overview.first_name} {overview.last_name}</strong>) and parent / guardian (<strong>{primaryGuardian ? primaryGuardian.name : 'Parent/Guardian'}</strong>), hereby solemnly declare and affirm that:
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-700 text-[9px] pl-1">
                          <li>All particulars and personal credentials submitted in this admission dossier are true, correct, and complete to the best of our knowledge.</li>
                          <li>We have read and understood the academic guidelines, attendance requirements (80% minimum), facility tenancy terms, and disciplinary code of conduct of {institute?.name || 'Yashodeep Coaching Classes'}, and we undertake to abide by them unconditionally.</li>
                          <li>We understand that any breach of institutional discipline, absenteeism without approval, or violation of campus regulations will make the student liable for appropriate disciplinary action, including suspension or cancellation of enrollment.</li>
                        </ul>
                      </div>
                    </div>

                    {/* 9. Formal Signatures & Official Institute Seal */}
                    <div className="pt-4 space-y-3">
                      <div className="grid grid-cols-3 gap-6 text-center text-[10px]">
                        <div className="border-t-2 border-slate-400 pt-2 flex flex-col justify-between min-h-[55px]">
                          <div>
                            <p className="font-bold text-slate-900">Student Signature</p>
                            <p className="text-slate-500 text-[8.5px] mt-0.5 font-medium">{overview.first_name} {overview.last_name}</p>
                          </div>
                          <p className="text-slate-400 text-[8.5px]">Date: ____________________</p>
                        </div>

                        <div className="border-t-2 border-slate-400 pt-2 flex flex-col justify-between min-h-[55px]">
                          <div>
                            <p className="font-bold text-slate-900">Parent / Guardian Signature</p>
                            <p className="text-slate-500 text-[8.5px] mt-0.5 font-medium">{primaryGuardian ? primaryGuardian.name : 'Parent / Guardian'}</p>
                          </div>
                          <p className="text-slate-400 text-[8.5px]">Date: ____________________</p>
                        </div>

                        <div className="border-t-2 border-slate-400 pt-2 flex flex-col justify-between min-h-[55px]">
                          <div>
                            <p className="font-black text-slate-950 uppercase">Authorized Institute Signatory</p>
                            <p className="text-slate-500 text-[8.5px] mt-0.5 font-medium">{institute?.name || 'Yashodeep Coaching Classes'}</p>
                          </div>
                          <p className="text-slate-500 text-[8.5px]">Principal / Official Seal</p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Page 2 Bottom Footer */}
                  <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                    <span>{institute?.name || 'Yashodeep Coaching Classes'} • Certified Academic Admission Record</span>
                    <span className="font-bold text-slate-700">[ PAGE 2 OF 2 • ACADEMIC REGULATIONS, CODE OF CONDUCT &amp; UNDERTAKING ]</span>
                    <span>Student PRN: {overview.prn}</span>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Modal Footer (Screen View) */}
          <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between no-print">
            <span className="text-xs text-slate-500">
              Standard 2-Page A4 Duplex Format (Front &amp; Back) • Complete Academic Record &amp; Institutional Undertaking (Zero Fee Details)
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={loading || !!error}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center space-x-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Form (A4 Front &amp; Back)</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};
