import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2, CheckCircle2 } from 'lucide-react';
import api from '../api/client';

interface DeleteStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any | null;
  onSuccess: (deletedId: string) => void;
}

export const DeleteStudentModal: React.FC<DeleteStudentModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !student) return null;

  const handleDelete = async () => {
    setError('');
    setLoading(true);
    try {
      await api.delete(`/students/${student.id}`);
      onSuccess(student.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to delete student:', err);
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Failed to delete student record. Please try again or check server logs.');
      }
    } finally {
      setLoading(false);
    }
  };

  const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
  const prn = student.prn || (student.student_code ? student.student_code.replace('STU-', 'PRN-') : student.id);

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-red-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200 shadow-xs">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Delete Student Record</h3>
              <p className="text-xs text-red-600 font-medium">Permanent destructive action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Target Student Identity Card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">{studentName}</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                {prn}
              </span>
            </div>
            {student.status && (
              <div className="text-[11px] text-slate-500">
                Status:{' '}
                <span className="font-semibold text-slate-700 uppercase">
                  {student.status}
                </span>
              </div>
            )}
          </div>

          {/* Warning Impact Description */}
          <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="font-semibold flex items-center space-x-1.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Are you sure you want to proceed?</span>
            </div>
            <ul className="list-disc pl-5 text-[11px] text-amber-800 space-y-1">
              <li>Demographics, guardians, and academic enrollments will be wiped.</li>
              <li>Any allocated <strong>Study Desk</strong> or <strong>Hostel Bed</strong> will be immediately released back to available inventory.</li>
              <li>Associated invoices, payment receipts, and exam marks will be cleared.</li>
            </ul>
          </div>
        </div>

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
            onClick={handleDelete}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-600/20 transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting Student...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Permanent Deletion</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
