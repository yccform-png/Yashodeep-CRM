import React from 'react';
import { Bed, CheckCircle2, User, Clock, ArrowUp, ArrowDown } from 'lucide-react';

export interface HostelBedItem {
  id: string;
  room_id: string;
  bed_number: string;
  bed_label?: string | null;
  tier?: 'UPPER' | 'LOWER' | 'SINGLE' | string;
  bunk_group?: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | string;
  occupant_name?: string | null;
  occupant_code?: string | null;
  allocation_id?: string | null;
  allocation_start_date?: string | null;
  allocation_end_date?: string | null;
  deposit_amount?: number | null;
  unit_price?: number | null;
  plan_name?: string | null;
  billing_frequency?: string | null;
}

interface HostelBunkBedCardProps {
  bunkNumber?: number;
  upperBed?: HostelBedItem | null;
  lowerBed?: HostelBedItem | null;
  singleBed?: HostelBedItem | null;
  selectedBedId?: string | null;
  onSelectBed?: (bed: HostelBedItem) => void;
  interactiveOnlyAvailable?: boolean;
  showSubscriptionDetails?: boolean;
  compact?: boolean;
}

export const HostelBunkBedCard: React.FC<HostelBunkBedCardProps> = ({
  bunkNumber = 1,
  upperBed,
  lowerBed,
  singleBed,
  selectedBedId,
  onSelectBed,
  interactiveOnlyAvailable = false,
  showSubscriptionDetails = true,
  compact = false
}) => {
  // If it's a standalone single bed
  if (singleBed) {
    const isSelected = selectedBedId === singleBed.id;
    const isOccupied = singleBed.status === 'OCCUPIED';
    const isAvailable = singleBed.status === 'AVAILABLE';
    const canClick = isAvailable || !interactiveOnlyAvailable;

    return (
      <div
        onClick={() => {
          if (canClick && onSelectBed) onSelectBed(singleBed);
        }}
        className={`p-3 rounded-xl border transition-all text-left relative ${
          isSelected
            ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
            : isOccupied
            ? 'bg-rose-50/70 border-rose-200 text-rose-900'
            : canClick
            ? 'bg-emerald-50/70 border border-dashed border-emerald-300 text-emerald-900 hover:bg-emerald-100/70 hover:border-emerald-400 cursor-pointer'
            : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center space-x-1.5">
            <Bed className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : isOccupied ? 'text-rose-600' : 'text-emerald-600'}`} />
            <span className="font-bold text-xs">{singleBed.bed_number}</span>
            <span className="text-[10px] bg-slate-200/70 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
              Single Bed
            </span>
          </div>
          {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
        </div>

        {isOccupied ? (
          <div>
            <p className="text-xs font-bold text-slate-800 truncate">{singleBed.occupant_name}</p>
            <p className="text-[10px] font-mono text-emerald-700 font-semibold truncate">{singleBed.occupant_code}</p>
          </div>
        ) : (
          <p className="text-[11px] font-medium text-emerald-700">● Available</p>
        )}
      </div>
    );
  }

  // Double Bunk Bed Unit (Upper & Lower)
  const renderBerth = (bed: HostelBedItem | null | undefined, tierType: 'UPPER' | 'LOWER') => {
    if (!bed) {
      return (
        <div className="p-2.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-slate-400 text-center text-xs">
          No Berth Installed
        </div>
      );
    }

    const isSelected = selectedBedId === bed.id;
    const isOccupied = bed.status === 'OCCUPIED';
    const isAvailable = bed.status === 'AVAILABLE';
    const canClick = isAvailable || !interactiveOnlyAvailable;

    // Remaining days calculation
    let daysRemaining = null;
    if (bed.allocation_end_date) {
      const today = new Date();
      const end = new Date(bed.allocation_end_date);
      const diffTime = end.getTime() - today.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return (
      <div
        onClick={() => {
          if (canClick && onSelectBed) onSelectBed(bed);
        }}
        className={`p-2.5 rounded-xl border transition-all text-left relative ${
          isSelected
            ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm z-10'
            : isOccupied
            ? 'bg-rose-50/70 border-rose-200/80 text-rose-900'
            : canClick
            ? 'bg-emerald-50/70 border border-dashed border-emerald-300 text-emerald-900 hover:bg-emerald-100/70 hover:border-emerald-400 cursor-pointer shadow-2xs'
            : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            {tierType === 'UPPER' ? (
              <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200/60">
                <ArrowUp className="w-2.5 h-2.5 mr-0.5 text-blue-600 stroke-[3]" />
                Upper
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-900 border border-amber-200/60">
                <ArrowDown className="w-2.5 h-2.5 mr-0.5 text-amber-700 stroke-[3]" />
                Lower
              </span>
            )}
            <span className="font-mono font-bold text-xs text-slate-900">{bed.bed_number}</span>
          </div>

          <div>
            {isSelected ? (
              <span className="inline-flex items-center text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded-full">
                <CheckCircle2 className="w-3 h-3 mr-0.5 text-indigo-600" />
                Selected
              </span>
            ) : isOccupied ? (
              daysRemaining !== null && showSubscriptionDetails && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-200/80 text-rose-900">
                  {daysRemaining}d
                </span>
              )
            ) : (
              <span className="text-[10px] font-bold text-emerald-700">● Available</span>
            )}
          </div>
        </div>

        {/* Occupant Details or Vacant Prompt */}
        <div className="mt-1">
          {isOccupied ? (
            <div>
              <p className="text-xs font-bold text-slate-800 truncate">
                {bed.occupant_name || 'Occupied Student'}
              </p>
              <p className="text-[10px] font-mono text-emerald-700 font-bold truncate">
                {bed.occupant_code || ''}
              </p>
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 flex items-center justify-between">
              <span>{canClick ? 'Click to assign this berth' : 'Vacant Berth'}</span>
              <Bed className="w-3 h-3 text-emerald-500 opacity-60" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white/60 p-2 shadow-2xs hover:border-slate-300 transition-all">
      {/* Bunk Unit Header */}
      <div className="flex items-center justify-between px-1 pb-1.5 mb-1.5 border-b border-slate-100 text-[11px]">
        <span className="font-bold text-slate-700 flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span>Bunk {bunkNumber}</span>
          <span className="text-[10px] text-slate-400 font-normal">(Double Berth)</span>
        </span>
        <span className="text-[10px] text-slate-400 font-mono">2-Tier</span>
      </div>

      {/* Frame Container with stylized left ladder */}
      <div className="relative pl-6 space-y-1.5">
        {/* Stylized Vertical Ladder Rail */}
        <div
          className="absolute left-1.5 top-1 bottom-1 w-2.5 flex flex-col justify-between items-center pointer-events-none select-none"
          title="Bunk Ladder"
        >
          <div className="w-full border-b-2 border-slate-300" />
          <div className="h-full w-0.5 bg-slate-300 relative flex flex-col justify-around items-center">
            <div className="w-3 h-0.5 bg-slate-400 rounded" />
            <div className="w-3 h-0.5 bg-slate-400 rounded" />
            <div className="w-3 h-0.5 bg-slate-400 rounded" />
          </div>
          <div className="w-full border-t-2 border-slate-300" />
        </div>

        {/* Upper Berth (Top Deck) */}
        {renderBerth(upperBed, 'UPPER')}

        {/* Lower Berth (Bottom Deck) */}
        {renderBerth(lowerBed, 'LOWER')}
      </div>
    </div>
  );
};
