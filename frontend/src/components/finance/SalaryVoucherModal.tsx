import React, { useRef } from 'react';
import { X, Printer, CheckCircle2, Building2, Phone, Mail, Calendar, CreditCard, ShieldCheck } from 'lucide-react';

interface SalaryVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucherData: {
    voucher_number: string;
    title: string;
    category: string;
    amount: number;
    payment_date: string;
    payment_mode: string;
    reference_number?: string | null;
    staff_name?: string | null;
    staff_role?: string | null;
    pay_period_month?: number | null;
    pay_period_year?: number | null;
    notes?: string | null;
  } | null;
  institute: any;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function numberToWordsINR(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return 'Zero Rupees Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const twoDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tensMultiple = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 10) return singleDigits[n];
    if (n >= 10 && n < 20) return twoDigits[n - 10];
    return tensMultiple[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + singleDigits[n % 10] : '');
  }

  function convertThreeDigits(n: number): string {
    let str = '';
    if (Math.floor(n / 100) > 0) {
      str += singleDigits[Math.floor(n / 100)] + ' Hundred ';
    }
    const rem = n % 100;
    if (rem > 0) {
      str += convertTwoDigits(rem);
    }
    return str.trim();
  }

  let num = rounded;
  let words = '';

  const crores = Math.floor(num / 10000000);
  num %= 10000000;
  if (crores > 0) words += convertTwoDigits(crores) + ' Crore ';

  const lakhs = Math.floor(num / 100000);
  num %= 100000;
  if (lakhs > 0) words += convertTwoDigits(lakhs) + ' Lakh ';

  const thousands = Math.floor(num / 1000);
  num %= 1000;
  if (thousands > 0) words += convertTwoDigits(thousands) + ' Thousand ';

  if (num > 0) words += convertThreeDigits(num) + ' ';

  return (words.trim() + ' Rupees Only');
}

export const SalaryVoucherModal: React.FC<SalaryVoucherModalProps> = ({
  isOpen,
  onClose,
  voucherData,
  institute
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !voucherData) return null;

  const handlePrint = () => {
    window.print();
  };

  const monthLabel = voucherData.pay_period_month ? MONTH_NAMES[voucherData.pay_period_month - 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Top Control Bar (Hidden during Print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-wide">
              {voucherData.category === 'SALARY' ? 'Official Staff Salary Voucher' : 'Institute Expense Voucher'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              type="button"
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Paper */}
        <div ref={printAreaRef} className="p-8 sm:p-10 space-y-6 text-slate-800 bg-white">
          {/* Institute Header */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-tight">
                  {institute?.name || 'Yashodeep Coaching Classes'}
                </h2>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  {institute?.tagline || 'Excellence in Comprehensive Education & Coaching'}
                </p>
                <div className="mt-2 text-[11px] text-slate-500 space-y-0.5">
                  <p>{institute?.campus_address || institute?.address || 'Main Campus, Solapur Road, Maharashtra'}</p>
                  <p>
                    Contact: {institute?.phone || '+91 9428818019'}
                    {institute?.email ? ` • Email: ${institute.email}` : ''}
                    {institute?.gstin ? ` • GSTIN: ${institute.gstin}` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 font-extrabold text-xs uppercase tracking-wider rounded-lg">
                  {voucherData.category === 'SALARY' ? 'Salary Voucher' : 'Expense Slip'}
                </span>
                <p className="font-mono font-bold text-xs text-slate-900 mt-2">
                  #{voucherData.voucher_number}
                </p>
                <p className="text-[11px] text-slate-500">
                  Date: {voucherData.payment_date}
                </p>
              </div>
            </div>
          </div>

          {/* Payee / Staff Information */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {voucherData.category === 'SALARY' ? 'Staff / Employee Name' : 'Expense Payee / Title'}
                </span>
                <p className="font-black text-slate-900 text-sm sm:text-base mt-0.5">
                  {voucherData.staff_name || voucherData.title}
                </p>
                {voucherData.staff_role && (
                  <p className="text-xs font-semibold text-slate-600 mt-0.5">
                    Designation: {voucherData.staff_role}
                  </p>
                )}
              </div>

              {voucherData.category === 'SALARY' && monthLabel && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Salary Pay Period
                  </span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {monthLabel} {voucherData.pay_period_year}
                  </p>
                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded mt-1">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Disbursed &amp; Settled
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Details Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 text-left">Description</th>
                  <th className="py-2.5 px-4 text-center">Category</th>
                  <th className="py-2.5 px-4 text-center">Payment Mode</th>
                  <th className="py-2.5 px-4 text-right">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {voucherData.title}
                    {voucherData.reference_number && (
                      <span className="block text-[11px] font-mono text-slate-500 mt-0.5">
                        Ref / UTR: {voucherData.reference_number}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-700">
                      {voucherData.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-700">
                    {voucherData.payment_mode.replace('_', ' ')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                    ₹{Number(voucherData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="py-3 px-4 text-right uppercase text-slate-700">
                    Net Paid:
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-base text-emerald-800">
                    ₹{Number(voucherData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Amount in Words */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
              Amount In Words:
            </span>
            <span className="font-semibold text-slate-900 italic">
              {numberToWordsINR(Number(voucherData.amount))}
            </span>
          </div>

          {voucherData.notes && (
            <div className="text-xs text-slate-600">
              <span className="font-bold">Remarks / Notes: </span>
              <span>{voucherData.notes}</span>
            </div>
          )}

          {/* Signatures & Seal */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200">
            <div className="text-center pt-8 border-t border-dashed border-slate-300">
              <p className="text-xs font-bold text-slate-800">Receiver / Staff Signature</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Acknowledgment of payment received</p>
            </div>
            <div className="text-center pt-8 border-t border-dashed border-slate-300">
              <p className="text-xs font-bold text-slate-800">Authorized SuperAdmin</p>
              <p className="text-[10px] text-slate-500 mt-0.5">For {institute?.name || 'Yashodeep ERP'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
