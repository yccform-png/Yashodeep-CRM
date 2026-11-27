import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Landmark,
  Scissors,
  FileText,
  Loader2,
  DollarSign
} from 'lucide-react';
import apiClient from '../api/client';
import { useInstitute } from '../context/InstituteContext';

interface InvoiceDetailModalProps {
  isOpen: boolean;
  invoiceId: string | null;
  onClose: () => void;
  onCollectFee?: (invoice: any) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  isOpen,
  invoiceId,
  onClose,
  onCollectFee
}) => {
  const { institute } = useInstitute();
  const [invoice, setInvoice] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'DUAL' | 'SINGLE'>('DUAL');

  useEffect(() => {
    if (isOpen && invoiceId) {
      setLoading(true);
      setError(null);
      apiClient.get(`/fees/invoices/${invoiceId}/detailed`)
        .then((res) => setInvoice(res.data))
        .catch((err) => {
          console.error('Failed to load invoice details:', err);
          setError(err.response?.data?.detail || 'Failed to load invoice record.');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, invoiceId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // Reusable Single Copy Slip Renderer
  const renderInvoiceSlip = (copyType: 'STUDENT COPY' | 'OFFICE COPY', isCompact = false) => {
    if (!invoice) return null;
    const stu = invoice.student;

    return (
      <div className={`invoice-slip bg-white border border-slate-300 rounded-xl p-4 text-slate-800 ${isCompact ? 'text-[11px] leading-tight space-y-2.5' : 'text-xs space-y-3'}`}>
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row items-start justify-between border-b border-slate-300 pb-2.5 gap-3 sm:gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shrink-0 print:border print:border-black">
              {institute?.name ? institute.name[0] : 'Y'}
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight text-slate-900 uppercase">
                {institute?.name || 'Yashodeep Coaching Classes'}
              </h2>
              {institute?.tagline && (
                <p className="text-[10px] italic font-semibold text-emerald-800">{institute.tagline}</p>
              )}
              <p className="text-[10px] text-slate-600">
                {institute?.address || 'Yashodeep Coaching Classes, Kuditre, Karveer, Kolhapur, Maharashtra'}
              </p>
              <div className="flex items-center gap-x-2 text-[9px] text-slate-500 font-mono mt-0.5">
                {institute?.registration_number && <span>Reg No: <strong>{institute.registration_number}</strong></span>}
                {institute?.gstin && <span>• GST: <strong>{institute.gstin}</strong></span>}
                <span>• Phone: <strong>{institute?.contact_phone || '—'}</strong></span>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <span className={`inline-block px-2.5 py-1 rounded font-mono font-extrabold text-[10px] uppercase tracking-wider border ${
              copyType === 'STUDENT COPY'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-purple-50 text-purple-900 border-purple-300'
            }`}>
              [ {copyType} ]
            </span>
            <p className="font-mono font-bold text-xs text-slate-900 mt-1">{invoice.invoice_number}</p>
            <p className="text-[10px] text-slate-500">
              Date: <strong className="text-slate-800">{invoice.issue_date}</strong> • Due: <strong className="text-slate-800">{invoice.due_date}</strong>
            </p>
          </div>
        </div>

        {/* Student & Academic Dossier Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[10px] print:bg-slate-100">
          <div>
            <span className="text-slate-500 block">Student Name</span>
            <strong className="text-slate-900 text-[11px]">{stu.first_name} {stu.last_name}</strong>
            <span className="text-purple-700 font-mono font-bold block">{stu.prn || stu.student_code}</span>
          </div>

          <div>
            <span className="text-slate-500 block">Enrolled Program</span>
            <strong className="text-slate-900">{invoice.course_name || invoice.class_name || 'Academic Course'}</strong>
            <span className="text-slate-600 block">{invoice.class_name ? invoice.class_name : (invoice.course_name ? '🌐 Universal / All Grades' : 'Academic Program')}</span>
          </div>

          <div>
            <span className="text-slate-500 block">Parent / Guardian</span>
            <strong className="text-slate-900">{stu.guardian_name || 'Guardian'}</strong>
            <span className="text-slate-600 font-mono block">{stu.guardian_mobile || stu.mobile || '—'}</span>
          </div>

          <div>
            <span className="text-slate-500 block">Day School / College</span>
            <strong className="text-slate-900 truncate block">{stu.school_college_name || 'Not Specified'}</strong>
            <span className="text-slate-600 block">{stu.education_board || 'State Board'}</span>
          </div>
        </div>

        {/* Itemized Particulars Table */}
        <div className="border border-slate-300 rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-[10px] min-w-[340px]">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <tr>
                <th className="py-1 px-2.5 w-8 text-center">#</th>
                <th className="py-1 px-2.5">Fee Particulars / Services Description</th>
                <th className="py-1 px-2.5 text-right w-24">Type</th>
                <th className="py-1 px-2.5 text-right w-28">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((item: any, idx: number) => (
                  <tr key={item.id || idx}>
                    <td className="py-1 px-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-1 px-2.5 font-medium text-slate-900">{item.description}</td>
                    <td className="py-1 px-2.5 text-right font-mono text-[9px] uppercase text-slate-500">{item.service_type_code || 'TUITION'}</td>
                    <td className="py-1 px-2.5 text-right font-bold text-slate-900 font-mono">
                      ₹{Number(item.total_amount).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-1 px-2.5 text-center text-slate-400 italic">Curriculum Package Tuition Fee</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t border-slate-300">
              {Number(invoice.discount_amount) > 0 && (
                <tr className="text-emerald-700 text-[10px]">
                  <td colSpan={3} className="py-0.5 px-2.5 text-right font-medium">Scholarship / Special Concession:</td>
                  <td className="py-0.5 px-2.5 text-right font-mono font-bold">-₹{Number(invoice.discount_amount).toLocaleString('en-IN')}</td>
                </tr>
              )}
              <tr className="text-slate-900 border-t border-slate-200">
                <td colSpan={3} className="py-1 px-2.5 text-right uppercase text-[9px] tracking-wider text-slate-600">
                  Net Total Billed:
                </td>
                <td className="py-1 px-2.5 text-right text-xs font-mono font-extrabold text-slate-950">
                  ₹{Number(invoice.total_amount).toLocaleString('en-IN')}
                </td>
              </tr>
              <tr className="border-t border-slate-200 text-[10px]">
                <td colSpan={2} className="py-1 px-2.5 text-slate-500">
                  Paid to Date: <strong className="text-emerald-700 font-mono">₹{Number(invoice.paid_amount).toLocaleString('en-IN')}</strong>
                </td>
                <td className="py-1 px-2.5 text-right font-bold text-slate-700">
                  Remaining Balance Due:
                </td>
                <td className="py-1 px-2.5 text-right font-mono font-extrabold text-rose-700">
                  ₹{Number(invoice.balance_amount).toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Installments & Payment Instructions Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200 text-[10px]">
          <div>
            <p className="font-bold text-slate-800 text-[9px] uppercase tracking-wider mb-0.5">Scheduled Installments</p>
            {invoice.installments && invoice.installments.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {[...invoice.installments].sort((a: any, b: any) => a.installment_number - b.installment_number).map((inst: any) => (
                  <span key={inst.id} className="px-1.5 py-0.5 bg-slate-100 rounded border text-[9px] font-mono">
                    Inst #{inst.installment_number}: ₹{Number(inst.amount).toLocaleString('en-IN')} ({inst.due_date}) [{inst.status}]
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic text-[9px]">Full Single Payment (No Installments)</p>
            )}
            <p className="text-[9px] text-slate-500 mt-1 font-mono">
              Bank: <strong>{institute?.bank_name || 'HDFC Bank'}</strong> • A/C: <strong>{institute?.bank_account_number || '—'}</strong> ({institute?.bank_ifsc || '—'}) • UPI: <strong>{institute?.upi_id || '—'}</strong>
            </p>
          </div>

          <div className="flex flex-col justify-between items-end text-right">
            <div className="text-[9px] text-slate-400 italic">
              Status: <span className="font-bold uppercase text-slate-700">{invoice.status}</span>
            </div>
            <div className="pt-3">
              <div className="border-t border-slate-400 w-40 text-center text-[9px]">
                <p className="font-bold text-slate-900">{institute?.signatory_title || 'Authorized Signatory'}</p>
                <p className="text-slate-400 text-[8px]">(Office Stamp &amp; Signature)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Dynamic Print Isolation CSS */}
      <style>{`
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          .print-modal-backdrop,
          .print-modal-container,
          .print-modal-body {
            position: static !important;
            display: block !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            backdrop-filter: none !important;
            transform: none !important;
          }
          #invoice-print-area, #invoice-print-area * {
            visibility: visible !important;
          }
          #invoice-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
        }
      `}</style>

      <div className="print-modal-backdrop fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        <div className="print-modal-container bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] animate-in fade-in zoom-in-95 duration-150">
          {/* Modal Top Bar */}
          <div className="no-print px-4 sm:px-6 py-3 sm:py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  Official Admission Invoice &amp; Fee Bill
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-mono">
                  {invoice ? `Invoice #${invoice.invoice_number}` : 'Loading...'}
                </p>
              </div>
            </div>

            {/* Controls Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Format Switcher */}
              <div className="inline-flex p-0.5 bg-slate-200 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('DUAL')}
                  className={`px-2 py-1 sm:px-2.5 rounded-md font-semibold text-[11px] sm:text-xs transition ${
                    viewMode === 'DUAL'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Dual Copy: Student Copy + Office Copy on 1 sheet of A4 paper"
                >
                  Dual Copy (2-in-1 A4)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('SINGLE')}
                  className={`px-2 py-1 sm:px-2.5 rounded-md font-semibold text-[11px] sm:text-xs transition ${
                    viewMode === 'SINGLE'
                      ? 'bg-white text-blue-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Single Full Page A4 View"
                >
                  Full Page A4
                </button>
              </div>

              {invoice && Number(invoice.balance_amount) > 0 && onCollectFee && (
                <button
                  onClick={() => {
                    onClose();
                    onCollectFee(invoice);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Collect Fee</span>
                </button>
              )}

              <button
                onClick={handlePrint}
                className="inline-flex items-center space-x-1.5 px-3 sm:px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-900/20 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>

              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="print-modal-body p-2.5 sm:p-6 overflow-y-auto bg-slate-100 flex-1 flex justify-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <p className="text-xs font-medium">Generating official invoice preview...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            ) : invoice ? (
              <div id="invoice-print-area" className="w-full max-w-[210mm] bg-white p-4 sm:p-6 shadow-sm rounded-xl space-y-4 print:p-0 print:shadow-none print:border-none print:rounded-none">
                {viewMode === 'DUAL' ? (
                  <div className="space-y-4">
                    {/* Top Slip: STUDENT COPY */}
                    {renderInvoiceSlip('STUDENT COPY', true)}

                    {/* Perforation Divider Line */}
                    <div className="relative py-2 flex items-center justify-center">
                      <div className="w-full border-t border-dashed border-slate-400"></div>
                      <div className="absolute bg-white px-3 flex items-center space-x-1 text-[10px] font-mono text-slate-500">
                        <Scissors className="w-3.5 h-3.5 text-slate-400 -scale-x-100" />
                        <span>Tear or Cut Along Perforation Line</span>
                        <Scissors className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>

                    {/* Bottom Slip: OFFICE COPY */}
                    {renderInvoiceSlip('OFFICE COPY', true)}
                  </div>
                ) : (
                  <div>
                    {/* Full Page Single Copy */}
                    {renderInvoiceSlip('STUDENT COPY', false)}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
