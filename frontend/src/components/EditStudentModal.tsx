import React, { useState, useEffect } from 'react';
import { X, User, Phone, MapPin, ShieldAlert, Loader2, Save, School, Users } from 'lucide-react';
import api from '../api/client';

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  onSuccess: (updatedStudent: any) => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: 'MALE',
    date_of_birth: '',
    blood_group: '',
    aadhar_number: '',
    category: 'GENERAL',
    status: 'ACTIVE',
    institution_type: 'SCHOOL',
    school_college_name: '',
    education_board: 'STATE_BOARD',
    previous_percentage: '',
    mobile: '',
    email: '',
    village: '',
    taluka: '',
    district: 'Kolhapur',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    // Parent / Guardian details
    guardian_first_name: '',
    guardian_last_name: '',
    guardian_relation: 'FATHER',
    guardian_mobile: '',
    guardian_email: '',
    guardian_occupation: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (student && isOpen) {
      let gFirst = '';
      let gLast = '';
      let gRel = 'FATHER';
      let gMob = '';
      let gEmail = '';
      let gOcc = '';

      if (student.guardians && student.guardians.length > 0) {
        const primaryG = student.guardians.find((g: any) => g.is_primary) || student.guardians[0];
        gFirst = primaryG.first_name || '';
        gLast = primaryG.last_name || '';
        gRel = primaryG.relation ? primaryG.relation.toUpperCase() : 'FATHER';
        gMob = primaryG.mobile || '';
        gEmail = primaryG.email || '';
        gOcc = primaryG.occupation || '';
      } else if (student.guardian_name) {
        const parts = student.guardian_name.trim().split(/\s+/);
        gFirst = parts[0] || '';
        gLast = parts.slice(1).join(' ') || '';
        gRel = student.guardian_relation ? student.guardian_relation.toUpperCase() : 'FATHER';
        gMob = student.guardian_mobile || '';
        gEmail = student.guardian_email || '';
        gOcc = student.guardian_occupation || '';
      }

      setFormData({
        first_name: student.first_name || '',
        middle_name: student.middle_name || '',
        last_name: student.last_name || '',
        gender: student.gender ? student.gender.toUpperCase() : 'MALE',
        date_of_birth: student.date_of_birth ? String(student.date_of_birth).substring(0, 10) : '',
        blood_group: student.blood_group || '',
        aadhar_number: student.aadhar_number || '',
        category: student.category || 'GENERAL',
        status: student.status ? student.status.toUpperCase() : 'ACTIVE',
        institution_type: student.institution_type || 'SCHOOL',
        school_college_name: student.school_college_name || '',
        education_board: student.education_board || 'STATE_BOARD',
        previous_percentage: student.previous_percentage != null ? String(student.previous_percentage) : '',
        mobile: student.mobile || '',
        email: student.email || '',
        village: student.village || student.city || '',
        taluka: student.taluka || '',
        district: student.district || 'Kolhapur',
        emergency_contact_name: student.emergency_contact_name || '',
        emergency_contact_phone: student.emergency_contact_phone || '',
        emergency_contact_relation: student.emergency_contact_relation || '',
        guardian_first_name: gFirst,
        guardian_last_name: gLast,
        guardian_relation: gRel,
        guardian_mobile: gMob,
        guardian_email: gEmail,
        guardian_occupation: gOcc
      });
      setError('');

      // Fetch live guardian records directly from server to ensure fresh data
      if (student.id) {
        api.get(`/students/${student.id}/guardians`)
          .then((res) => {
            if (res.data && res.data.length > 0) {
              const primaryG = res.data.find((g: any) => g.is_primary) || res.data[0];
              setFormData((prev) => ({
                ...prev,
                guardian_first_name: primaryG.first_name || '',
                guardian_last_name: primaryG.last_name || '',
                guardian_relation: primaryG.relation ? primaryG.relation.toUpperCase() : 'FATHER',
                guardian_mobile: primaryG.mobile || '',
                guardian_email: primaryG.email || '',
                guardian_occupation: primaryG.occupation || ''
              }));
            }
          })
          .catch(() => {
            // fallback gracefully
          });
      }
    }
  }, [student, isOpen]);

  if (!isOpen || !student) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setError('First name and last name are required.');
      return;
    }

    if (!formData.date_of_birth) {
      setError('Date of birth is required.');
      return;
    }

    if (!formData.aadhar_number.trim() || formData.aadhar_number.replace(/\D/g, '').length !== 12) {
      setError('Aadhar / National ID is mandatory and must be exactly 12 digits.');
      return;
    }

    if (!formData.mobile.trim() || formData.mobile.replace(/\D/g, '').length < 10) {
      setError('Student mobile number is mandatory (at least 10 digits).');
      return;
    }

    if (formData.guardian_mobile.trim() && formData.guardian_mobile.replace(/\D/g, '').length < 10) {
      setError('Parent / Guardian mobile number must be at least 10 digits.');
      return;
    }

    if (!formData.village.trim() || !formData.taluka.trim() || !formData.district.trim()) {
      setError('Village (गाव), Taluka (तालुका), and District (जिल्हा) are mandatory fields.');
      return;
    }

    if (!formData.school_college_name.trim()) {
      setError(`${formData.institution_type === 'COLLEGE' ? 'Junior College' : 'School'} name is mandatory.`);
      return;
    }

    if (!formData.education_board) {
      setError('Education board / affiliation is mandatory.');
      return;
    }

    if (formData.previous_percentage === '' || formData.previous_percentage === null || formData.previous_percentage === undefined) {
      setError(`${formData.institution_type === 'COLLEGE' ? 'Previous College / 10th' : 'Previous school'} percentage is mandatory.`);
      return;
    }
    const pct = parseFloat(String(formData.previous_percentage));
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setError('Please enter a valid percentage between 0 and 100.');
      return;
    }

    setLoading(true);
    try {
      // Build payload with trimmed strings or null for empty
      const payload: Record<string, any> = {
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim() || null,
        last_name: formData.last_name.trim(),
        gender: formData.gender,
        date_of_birth: formData.date_of_birth,
        blood_group: formData.blood_group.trim() || null,
        aadhar_number: formData.aadhar_number.trim() || null,
        category: formData.category || null,
        status: formData.status,
        institution_type: formData.institution_type || 'SCHOOL',
        school_college_name: formData.school_college_name.trim() || null,
        education_board: formData.education_board || null,
        previous_percentage: formData.previous_percentage !== '' && formData.previous_percentage != null ? parseFloat(String(formData.previous_percentage)) : null,
        mobile: formData.mobile.trim() || null,
        email: formData.email.trim() || null,
        village: formData.village.trim(),
        taluka: formData.taluka.trim(),
        district: formData.district.trim(),
        city: formData.district.trim(),
        state: 'Maharashtra',
        address_line1: `${formData.village.trim()}, Tal. ${formData.taluka.trim()}`,
        emergency_contact_name: formData.emergency_contact_name.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone.trim() || null,
        emergency_contact_relation: formData.emergency_contact_relation.trim() || null,
        // Parent / Guardian details
        guardian_first_name: formData.guardian_first_name.trim() || null,
        guardian_last_name: formData.guardian_last_name.trim() || null,
        guardian_name: `${formData.guardian_first_name.trim()} ${formData.guardian_last_name.trim()}`.trim() || null,
        guardian_relation: formData.guardian_relation || 'FATHER',
        guardian_mobile: formData.guardian_mobile.trim() || null,
        guardian_email: formData.guardian_email.trim() || null,
        guardian_occupation: formData.guardian_occupation.trim() || null
      };

      const res = await api.patch(`/students/${student.id}`, payload);
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      console.error('Failed to update student:', err);
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg || `${d.loc?.join('.')}: error`).join(', '));
      } else {
        setError('Failed to update student details. Please verify your inputs.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Edit Student Record</h3>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                {student.prn || (student.student_code ? student.student_code.replace('STU-', 'PRN-') : 'PRN')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Update demographics, residential address, emergency contacts, or status.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Demographics */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-1.5">
              <User className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Demographics</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  placeholder="First name"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Middle Name</label>
                <input
                  type="text"
                  name="middle_name"
                  value={formData.middle_name}
                  onChange={handleChange}
                  placeholder="Middle name"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  placeholder="Last name"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gender *</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="MALE">Male (Boys)</option>
                  <option value="FEMALE">Female (Girls)</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  required
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Blood Group</label>
                <select
                  name="blood_group"
                  value={formData.blood_group}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Status *</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="PROMOTED">PROMOTED</option>
                  <option value="GRADUATED">GRADUATED</option>
                  <option value="WITHDRAWN">WITHDRAWN</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <span>Aadhar / National ID (12 Digits)</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="aadhar_number"
                  maxLength={14}
                  value={formData.aadhar_number}
                  onChange={handleChange}
                  placeholder="e.g. 5432-8765-1098"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Social Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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

          {/* Section 2: Current Regular Education */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <School className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Current Regular Education ({formData.institution_type === 'COLLEGE' ? 'Junior College' : 'School'})
                </h4>
              </div>

              {/* Education Type Switcher */}
              <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, institution_type: 'SCHOOL' }))}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    formData.institution_type === 'SCHOOL'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  School (5th–10th)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, institution_type: 'COLLEGE' }))}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    formData.institution_type === 'COLLEGE'
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Junior College (11th–12th)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <span>{formData.institution_type === 'COLLEGE' ? 'Current Junior College Name' : 'Current School Name'}</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="school_college_name"
                  value={formData.school_college_name}
                  onChange={handleChange}
                  placeholder={
                    formData.institution_type === 'COLLEGE'
                      ? 'e.g. Fergusson College / Modern College'
                      : 'e.g. St. Vincent High School'
                  }
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <span>Education Board / Affiliation</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <select
                  name="education_board"
                  value={formData.education_board}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="STATE_BOARD">Maharashtra State Board (SSC/HSC)</option>
                  <option value="CBSE">CBSE (Central Board)</option>
                  <option value="ICSE">ICSE / ISC</option>
                  <option value="IB_IGCSE">IB / Cambridge IGCSE</option>
                  <option value="OTHER">Other Board</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <span>
                    {formData.institution_type === 'COLLEGE'
                      ? 'Previous College / 10th %'
                      : 'Previous School %'}
                  </span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  name="previous_percentage"
                  value={formData.previous_percentage}
                  onChange={handleChange}
                  placeholder="e.g. 85.50"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact Information */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-1.5">
              <Phone className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Contact Details</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <span>Student Mobile Number</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="student@example.com"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
          </div>

          {/* Section: Parent / Guardian Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Parent / Guardian Details</h4>
              </div>
              <span className="text-[10px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                Official WhatsApp &amp; SMS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <span>Guardian First Name</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="guardian_first_name"
                  value={formData.guardian_first_name}
                  onChange={handleChange}
                  placeholder="e.g. Ramesh or Vaishnavi"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <span>Guardian Last Name</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="guardian_last_name"
                  value={formData.guardian_last_name}
                  onChange={handleChange}
                  placeholder="e.g. Patil"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <span>Relationship to Student</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <select
                  name="guardian_relation"
                  value={formData.guardian_relation}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="FATHER">Father</option>
                  <option value="MOTHER">Mother</option>
                  <option value="LEGAL_GUARDIAN">Legal Guardian</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <span>Parent Mobile (WhatsApp)</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="guardian_mobile"
                  value={formData.guardian_mobile}
                  onChange={handleChange}
                  placeholder="e.g. 9420010019"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Parent Occupation / Profession
                </label>
                <input
                  type="text"
                  name="guardian_occupation"
                  value={formData.guardian_occupation}
                  onChange={handleChange}
                  placeholder="e.g. Farmer / Business / Service"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Parent Email Address (Optional)
              </label>
              <input
                type="email"
                name="guardian_email"
                value={formData.guardian_email}
                onChange={handleChange}
                placeholder="parent@example.com"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          {/* Section 3: Native / Residential Address (Mandatory) */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-1.5">
              <MapPin className="w-4 h-4 text-purple-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Native / Residential Address <span className="text-rose-500">*</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <span>Village / Town (गाव)</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="village"
                  value={formData.village}
                  onChange={handleChange}
                  placeholder="e.g. Kuditre"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <span>Taluka (तालुका)</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="taluka"
                  value={formData.taluka}
                  onChange={handleChange}
                  placeholder="e.g. Karveer"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <span>District (जिल्हा)</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                  placeholder="e.g. Kolhapur / Sangli"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Emergency Contact */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Emergency Contact</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  name="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={handleChange}
                  placeholder="Contact person"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  name="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={handleChange}
                  placeholder="+91 ..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Relation</label>
                <input
                  type="text"
                  name="emergency_contact_relation"
                  value={formData.emergency_contact_relation}
                  onChange={handleChange}
                  placeholder="e.g. Father / Mother / Uncle"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs disabled:opacity-50 text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/15 transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
