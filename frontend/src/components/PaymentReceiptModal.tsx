import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Building,
  CreditCard,
  Landmark,
  Loader2,
  FileText
} from 'lucide-react';
import apiClient from '../api/client';
import { useInstitute } from '../context/InstituteContext';

interface PaymentReceiptModalProps {
  isOpen: boolean;
  paymentId: string | null;
  initialReceiptData?: any | null;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  paymentId,
  initialReceiptData,
  onClose
}) => {
  const { institute } = useInstitute();
  const [receipt, setReceipt] = useState<any | null>(initialReceiptData || null);
  const [loading, setLoading] = useState<boolean>(!initialReceiptData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialReceiptData) {
        setReceipt(initialReceiptData);
        setLoading(false);
      } else if (paymentId) {
        setLoading(true);
        setError(null);
        apiClient.get(`/fees/payments/${paymentId}/receipt`)
          .then((res) => setReceipt(res.data))
          .catch((err) => {
            console.error('Failed to load payment receipt details:', err);
            setError(err.response?.data?.detail || 'Failed to load payment receipt.');
          })
          .finally(() => setLoading(false));
      }
    }
  }, [isOpen, paymentId, initialReceiptData]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const stu = receipt?.student;

  return (
    <>
      {/* Print CSS Isolation for Receipts */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #receipt-print-area, #receipt-print-area * {
            visibility: visible !important;
          }
          #receipt-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 15mm;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 no-print overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] my-auto animate-in fade-in zoom-in-95 duration-150">
          {/* Modal Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">Official Payment Receipt Voucher</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-mono">
                  {receipt?.receipt_number ? `Receipt #${receipt.receipt_number}` : 'Electronic Cash Voucher'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center space-x-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
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
          <div className="p-2.5 sm:p-6 overflow-y-auto bg-slate-100 flex justify-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <p className="text-xs font-medium">Generating official receipt voucher...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            ) : receipt ? (
              <div id="receipt-print-area" className="w-full max-w-[190mm] bg-white p-4 sm:p-6 shadow-sm rounded-xl border border-slate-200 text-xs space-y-4 print:p-0 print:border-none print:shadow-none">
                {/* Institute Header */}
                <div className="flex flex-col sm:flex-row items-start justify-between border-b-2 border-slate-900 pb-3 gap-3 sm:gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shrink-0 print:border print:border-black">
                      {institute?.name ? institute.name[0] : 'Y'}
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold tracking-tight text-slate-900 uppercase">
                        {institute?.name || 'Yashodeep Coaching Classes'}
                      </h2>
                      {institute?.tagline && (
                        <p className="text-[11px] font-semibold text-emerald-800 italic">{institute.tagline}</p>
                      )}
                      <p className="text-[11px] text-slate-600">
                        {institute?.address || 'Yashodeep Coaching Classes, Kuditre, Karveer, Kolhapur, Maharashtra'}
                      </p>
                      <div className="flex items-center gap-x-2 text-[10px] text-slate-500 font-mono mt-0.5">
                        {institute?.registration_number && <span>Reg: <strong>{institute.registration_number}</strong></span>}
                        {institute?.gstin && <span>• GST: <strong>{institute.gstin}</strong></span>}
                        <span>• Phone: <strong>{institute?.contact_phone || '—'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span className="inline-block px-3 py-1 rounded-md font-mono font-extrabold text-xs uppercase tracking-wider bg-emerald-50 text-emerald-900 border border-emerald-300">
                      OFFICIAL RECEIPT
                    </span>
                    <p className="font-mono font-bold text-xs text-slate-900 mt-1.5">
                      Receipt #: {receipt.receipt_number || receipt.payment_number}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Date: <strong className="text-slate-800">{receipt.payment_date}</strong>
                    </p>
                  </div>
                </div>

                {/* Student & Course Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Student Name</span>
                    <strong className="text-slate-900 text-xs">{stu?.first_name} {stu?.last_name}</strong>
                    <span className="text-purple-700 font-mono font-bold block">{stu?.prn || stu?.student_code}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Enrolled Program</span>
                    <strong className="text-slate-900">{receipt.course_name || receipt.class_name || 'Academic Course'}</strong>
                    <span className="text-slate-600 block">{receipt.class_name || 'Standard'}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Parent / Guardian</span>
                    <strong className="text-slate-900">{stu?.guardian_name || 'Guardian'}</strong>
                    <span className="text-slate-600 font-mono block">{stu?.guardian_mobile || stu?.mobile || '—'}</span>
                  </div>
                </div>

                {/* Amount Highlight Card */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Amount Received</span>
                    <p className="text-2xl font-black text-emerald-950 font-mono">
                      ₹{Number(receipt.amount).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Amount in Words</span>
                    <p className="text-xs font-bold text-slate-800 italic">
                      {receipt.amount_in_words || 'Thirty-Eight Thousand One Hundred Rupees Only'}
                    </p>
                  </div>
                </div>

                {/* Payment Allocation Table */}
                <div className="border border-slate-300 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[360px]">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                      <tr>
                        <th className="py-2 px-3">Settled Invoice</th>
                        <th className="py-2 px-3">Payment Channel</th>
                        <th className="py-2 px-3">Txn Reference #</th>
                        <th className="py-2 px-3 text-right">Allocated Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {receipt.allocations && receipt.allocations.length > 0 ? (
                        receipt.allocations.map((alloc: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                              {alloc.invoice_number}
                              {alloc.installment_number && (
                                <span className="ml-1 text-[10px] font-normal text-slate-500 font-sans">
                                  (Inst #{alloc.installment_number})
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-700">{receipt.payment_method}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{receipt.transaction_reference || 'COUNTER_CASH'}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                              ₹{Number(alloc.allocated_amount).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">Direct Fee Allocation</td>
                          <td className="py-2 px-3 font-semibold text-slate-700">{receipt.payment_method}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{receipt.transaction_reference || 'COUNTER_CASH'}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            ₹{Number(receipt.amount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-300">
                      <tr>
                        <td colSpan={3} className="py-2 px-3 text-right text-slate-600">
                          Remaining Outstanding Balance Due:
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-extrabold text-rose-700 text-sm">
                          ₹{Number(receipt.total_student_balance ?? 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Signatory & Institutional Seal Footer */}
                <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 text-xs">
                  <div className="text-slate-500 space-y-1">
                    <p className="text-[10px]">● This is an official computer-generated receipt issued by {institute?.name || 'Yashodeep Coaching Classes'}.</p>
                    <p className="text-[10px]">● Please preserve this receipt for academic verification and audit compliance.</p>
                  </div>

                  <div className="text-center">
                    <div className="w-44 border-t border-slate-400 pt-1">
                      <p className="font-bold text-slate-900">{institute?.signatory_title || 'Authorized Signatory'}</p>
                      <p className="text-[10px] text-slate-400">Cashier / Accounts Office Seal</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
