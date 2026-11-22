import React from 'react';
import { Armchair, Zap, Lock, AlertCircle, Clock, Check, ArrowUpDown } from 'lucide-react';

export interface StudySeatItem {
  id: string;
  study_room_id?: string;
  seat_number: string;
  row_identifier?: string | null;
  column_identifier?: string | number | null;
  gender_allowed: string; // 'BOYS' | 'GIRLS' | 'ANY'
  has_power_outlet?: boolean;
  has_locker?: boolean;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
  occupant_name?: string | null;
  occupant_code?: string | null;
  allocation_id?: string | null;
  allocation_start_date?: string | null;
  allocation_end_date?: string | null;
  plan_name?: string | null;
  billing_frequency?: string | null;
  unit_price?: number | null;
  deposit_amount?: number | null;
}

interface StudyRoomPhysicalFloorMapProps {
  seats: StudySeatItem[];
  selectedSeatId?: string | null;
  onSelectSeat?: (seat: StudySeatItem) => void;
  genderFilter?: 'ALL' | 'BOYS' | 'GIRLS';
  interactiveOnlyAvailable?: boolean;
  showSubscriptionDetails?: boolean;
  compact?: boolean;
}

// Generate number sequences helper
const rangeNumbers = (start: number, end: number, step = 1): number[] => {
  const result: number[] = [];
  if (step > 0) {
    for (let i = start; i <= end; i += step) result.push(i);
  } else {
    for (let i = start; i >= end; i += step) result.push(i);
  }
  return result;
};

// Physical Layout Blueprint Definitions
// Boys Hall: 105 Desks (B001 to B105)
const BOYS_LAYOUT = {
  block1: {
    title: 'Block 1 • Paired Bench Desks',
    desc: 'Rows R1 & R2 • 32 Desks (Front Facing)',
    upperRowName: 'Row R1 (Left-to-Right: 1 to 16)',
    upperSeats: rangeNumbers(1, 16, 1).map((n) => `B${String(n).padStart(3, '0')}`),
    lowerRowName: 'Row R2 (Facing Reverse: 32 down to 17)',
    lowerSeats: rangeNumbers(32, 17, -1).map((n) => `B${String(n).padStart(3, '0')}`),
  },
  block2: {
    title: 'Block 2 • Paired Bench Desks',
    desc: 'Rows R3 & R4 • 34 Desks (Middle Section)',
    upperRowName: 'Row R3 (Left-to-Right: 33 to 49)',
    upperSeats: rangeNumbers(33, 49, 1).map((n) => `B${String(n).padStart(3, '0')}`),
    lowerRowName: 'Row R4 (Facing Reverse: 66 down to 50)',
    lowerSeats: rangeNumbers(66, 50, -1).map((n) => `B${String(n).padStart(3, '0')}`),
  },
  block3: {
    title: 'Block 3 • Paired Bench Desks',
    desc: 'Rows R5 & R6 • 34 Desks (Rear Section)',
    upperRowName: 'Row R5 (Left-to-Right: 67 to 83)',
    upperSeats: rangeNumbers(67, 83, 1).map((n) => `B${String(n).padStart(3, '0')}`),
    lowerRowName: 'Row R6 (Facing Reverse: 100 down to 84)',
    lowerSeats: rangeNumbers(100, 84, -1).map((n) => `B${String(n).padStart(3, '0')}`),
  },
  block4: {
    title: 'Block 4 • Single Wall Bench',
    desc: 'Row R7 • 5 Desks (Rear Quiet Corner)',
    rowName: 'Row R7 (Left-to-Right: 101 to 105)',
    seats: rangeNumbers(101, 105, 1).map((n) => `B${String(n).padStart(3, '0')}`),
  },
};

// Girls Hall: 45 Desks (G001 to G045)
const GIRLS_LAYOUT = {
  block1: {
    title: 'Block 1 • Single Wall Row',
    desc: 'Row R1 • 10 Desks (Front Section)',
    rowName: 'Row R1 (Left-to-Right: 1 to 10)',
    seats: rangeNumbers(1, 10, 1).map((n) => `G${String(n).padStart(3, '0')}`),
  },
  block2: {
    title: 'Block 2 • Paired Bench Desks',
    desc: 'Rows R2 & R3 • 24 Desks (Facing Center)',
    upperRowName: 'Row R2 (Facing Reverse: 22 down to 11)',
    upperSeats: rangeNumbers(22, 11, -1).map((n) => `G${String(n).padStart(3, '0')}`),
    lowerRowName: 'Row R3 (Left-to-Right: 23 to 34)',
    lowerSeats: rangeNumbers(23, 34, 1).map((n) => `G${String(n).padStart(3, '0')}`),
  },
  block3: {
    title: 'Block 3 • Single Wall Row',
    desc: 'Row R4 • 11 Desks (Rear Wall)',
    rowName: 'Row R4 (Facing Reverse: 45 down to 35)',
    seats: rangeNumbers(45, 35, -1).map((n) => `G${String(n).padStart(3, '0')}`),
  },
};

export const StudyRoomPhysicalFloorMap: React.FC<StudyRoomPhysicalFloorMapProps> = ({
  seats,
  selectedSeatId,
  onSelectSeat,
  genderFilter = 'ALL',
  interactiveOnlyAvailable = false,
  showSubscriptionDetails = false,
  compact = false,
}) => {
  // Index seats by seat_number
  const seatMap = React.useMemo(() => {
    const map = new Map<string, StudySeatItem>();
    seats.forEach((s) => map.set(s.seat_number, s));
    return map;
  }, [seats]);

  const getSubStatus = (seat: StudySeatItem) => {
    if (!showSubscriptionDetails || seat.status !== 'OCCUPIED' || !seat.allocation_end_date) {
      return null;
    }
    const today = new Date().toISOString().split('T')[0];
    const endDate = seat.allocation_end_date;
    if (today > endDate) {
      const daysAgo = Math.floor((new Date(today).getTime() - new Date(endDate).getTime()) / (1000 * 60 * 60 * 24));
      return {
        type: 'EXPIRED',
        label: `Expired ${daysAgo}d ago`,
        subText: `Expired (${endDate})`,
        deskClass: 'bg-rose-900 text-white border-2 border-rose-950 font-bold',
      };
    }
    const daysLeft = Math.ceil((new Date(endDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7) {
      return {
        type: 'RENEWAL_DUE',
        label: `Renewal due (${daysLeft}d)`,
        subText: `Expires in ${daysLeft}d`,
        deskClass: 'bg-amber-100 text-amber-950 border-2 border-amber-500 font-bold',
      };
    }
    return {
      type: 'ACTIVE',
      label: `Active (${daysLeft}d left)`,
      subText: `Valid until ${endDate}`,
      deskClass: 'bg-rose-50 text-rose-800 border border-rose-200',
    };
  };

  const renderDeskCell = (seatNum: string) => {
    const seat = seatMap.get(seatNum);
    const isAvailable = seat?.status === 'AVAILABLE';
    const isOccupied = seat?.status === 'OCCUPIED';
    const isSelected = seat ? selectedSeatId === seat.id : false;
    const subStatus = seat ? getSubStatus(seat) : null;

    const canClick = onSelectSeat && (!interactiveOnlyAvailable || isAvailable);

    let statusClasses = 'bg-slate-100 text-slate-500 border border-slate-200';
    if (isSelected) {
      statusClasses = 'bg-indigo-600 text-white border-2 border-indigo-700 shadow-lg ring-4 ring-indigo-200 scale-105 z-20';
    } else if (isAvailable) {
      statusClasses = 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 hover:border-emerald-500 hover:shadow-md cursor-pointer';
    } else if (isOccupied) {
      if (subStatus?.type === 'EXPIRED') {
        statusClasses = 'bg-rose-900 text-white border-2 border-rose-950 shadow-inner cursor-pointer';
      } else if (subStatus?.type === 'RENEWAL_DUE') {
        statusClasses = 'bg-amber-100 text-amber-950 border-2 border-amber-500 shadow-sm cursor-pointer';
      } else {
        statusClasses = interactiveOnlyAvailable
          ? 'bg-rose-50/70 text-rose-700 border border-rose-200 cursor-not-allowed opacity-90'
          : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 cursor-pointer';
      }
    }

    const tooltip = seat
      ? `Desk ${seat.seat_number} (${seat.row_identifier || ''}-${seat.column_identifier || ''})\nStatus: ${seat.status}${
          seat.occupant_name ? `\nOccupant: ${seat.occupant_name} (${seat.occupant_code || ''})` : ''
        }${subStatus ? `\n${subStatus.label}` : ''}${seat.has_power_outlet ? '\n⚡ Power Outlet Available' : ''}${
          seat.has_locker ? '\n🔒 Locker Included' : ''
        }`
      : `Desk ${seatNum}`;

    const cellWidth = compact ? 'w-[52px] min-w-[52px]' : 'w-[58px] min-w-[58px]';
    const cellHeight = compact ? 'h-[62px]' : 'h-[68px]';

    return (
      <button
        key={seatNum}
        type="button"
        disabled={!canClick}
        onClick={() => {
          if (seat && canClick) {
            onSelectSeat(seat);
          }
        }}
        title={tooltip}
        className={`group relative rounded-xl flex flex-col items-center justify-between p-1.5 transition-all text-center select-none ${cellWidth} ${cellHeight} ${statusClasses} ${
          isSelected ? 'font-bold' : ''
        }`}
      >
        {/* Top Indicators: Selection check or Outlets */}
        <div className="w-full flex items-center justify-between px-0.5 text-[10px]">
          {isSelected ? (
            <span className="w-4 h-4 rounded-full bg-white text-indigo-700 flex items-center justify-center mx-auto shadow-sm">
              <Check className="w-3 h-3 stroke-[3]" />
            </span>
          ) : (
            <>
              <div className="flex items-center space-x-0.5">
                {seat?.has_power_outlet && (
                  <Zap
                    className={`w-2.5 h-2.5 ${
                      subStatus?.type === 'EXPIRED' ? 'text-amber-300' : 'text-amber-500'
                    }`}
                  />
                )}
                {seat?.has_locker && (
                  <Lock
                    className={`w-2.5 h-2.5 ${
                      subStatus?.type === 'EXPIRED' ? 'text-blue-300' : 'text-blue-500'
                    }`}
                  />
                )}
              </div>
              {subStatus?.type === 'RENEWAL_DUE' && (
                <Clock className="w-2.5 h-2.5 text-amber-700 shrink-0" />
              )}
              {subStatus?.type === 'EXPIRED' && (
                <AlertCircle className="w-2.5 h-2.5 text-rose-300 shrink-0" />
              )}
            </>
          )}
        </div>

        {/* Center: Desk Armchair & Seat Number */}
        <div className="flex flex-col items-center my-auto">
          <Armchair
            className={`w-3.5 h-3.5 ${
              isSelected
                ? 'text-white'
                : isAvailable
                ? 'text-emerald-600'
                : isOccupied && subStatus?.type === 'EXPIRED'
                ? 'text-white'
                : isOccupied && subStatus?.type === 'RENEWAL_DUE'
                ? 'text-amber-800'
                : isOccupied
                ? 'text-rose-600'
                : 'text-slate-400'
            }`}
          />
          <span className={`text-[11px] leading-tight font-extrabold tracking-tight mt-0.5 ${isSelected ? 'text-white' : ''}`}>
            {seatNum}
          </span>
        </div>

        {/* Bottom: Row & Column Tag or Occupant Snippet */}
        <div className="w-full truncate text-[9px] font-semibold text-center opacity-85 leading-none">
          {seat?.row_identifier ? `${seat.row_identifier}-${seat.column_identifier}` : isOccupied ? 'Occupied' : 'Vacant'}
        </div>
      </button>
    );
  };

  // Render a Paired Facing Bench Block (Two rows with a central partition divider)
  const renderPairedBenchBlock = (
    block: {
      title: string;
      desc: string;
      upperRowName: string;
      upperSeats: string[];
      lowerRowName: string;
      lowerSeats: string[];
    },
    blockIndex: number
  ) => {
    return (
      <div key={blockIndex} className="bg-slate-50/80 rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-sm space-y-3">
        {/* Block Header */}
        <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">{block.title}</span>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">• {block.desc}</span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
            {block.upperSeats.length + block.lowerSeats.length} Desks
          </span>
        </div>

        {/* Bench Grid with Central Facing Partition */}
        <div className="overflow-x-auto pb-1.5 pt-0.5">
          <div className="min-w-max space-y-2">
            {/* Upper Row */}
            <div>
              <div className="text-[10px] font-semibold text-slate-500 mb-1.5 flex items-center justify-between sticky left-0 pr-3">
                <span className="font-bold text-slate-700">{block.upperRowName}</span>
                <span className="text-[9px] font-semibold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">Facing ⬇️</span>
              </div>
              <div className="flex items-center gap-1.5">
                {block.upperSeats.map((seatNum) => renderDeskCell(seatNum))}
              </div>
            </div>

            {/* Central Partition Divider with Power Cable Channel */}
            <div className="relative my-2.5 sm:my-3 py-1 flex items-center w-full">
              <div className="w-full border-t-2 border-dashed border-slate-300" />
              <div className="sticky left-4 bg-white/95 backdrop-blur-xs px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-slate-300 text-[9px] sm:text-[10px] font-bold tracking-wider text-slate-600 uppercase flex items-center space-x-1.5 shadow-xs whitespace-nowrap z-10 shrink-0">
                <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 shrink-0" />
                <span className="hidden sm:inline">Facing Divider • Central Power &amp; Data Conduit</span>
                <span className="sm:hidden">Facing Divider • Power &amp; LAN</span>
                <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 shrink-0" />
              </div>
            </div>

            {/* Lower Row */}
            <div>
              <div className="text-[10px] font-semibold text-slate-500 mb-1.5 flex items-center justify-between sticky left-0 pr-3">
                <span className="font-bold text-slate-700">{block.lowerRowName}</span>
                <span className="text-[9px] font-semibold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">Facing ⬆️</span>
              </div>
              <div className="flex items-center gap-1.5">
                {block.lowerSeats.map((seatNum) => renderDeskCell(seatNum))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render a Single Wall Bench Block
  const renderSingleBenchBlock = (
    block: {
      title: string;
      desc: string;
      rowName: string;
      seats: string[];
    },
    blockIndex: number
  ) => {
    return (
      <div key={blockIndex} className="bg-slate-50/80 rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-sm space-y-3">
        {/* Block Header */}
        <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">{block.title}</span>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">• {block.desc}</span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
            {block.seats.length} Desks
          </span>
        </div>

        {/* Bench Grid */}
        <div className="overflow-x-auto pb-1.5 pt-0.5">
          <div className="min-w-max space-y-1.5">
            <div className="text-[10px] font-semibold text-slate-500 mb-1 sticky left-0">
              <span className="font-bold text-slate-700">{block.rowName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {block.seats.map((seatNum) => renderDeskCell(seatNum))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Walking Aisle Component
  const renderWalkingAisle = (label: string, widthFt: string) => {
    return (
      <div className="py-2.5 px-4 bg-amber-50/50 rounded-xl border border-dashed border-amber-200/80 flex items-center justify-between text-xs text-amber-900/80 select-none">
        <div className="flex items-center space-x-2">
          <span className="text-sm">🚶</span>
          <span className="font-bold text-slate-700">{label}</span>
          <span className="text-[10px] text-slate-400">({widthFt} Clearance Pathway)</span>
        </div>
        <div className="hidden sm:flex items-center space-x-2 text-[10px] text-slate-400 font-medium tracking-wide">
          <span>◀️ WEST PASSAGE</span>
          <span className="w-8 border-t border-slate-300" />
          <span>EAST PASSAGE ▶️</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Boys Study Hall */}
      {(genderFilter === 'ALL' || genderFilter === 'BOYS') && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-blue-200 shadow-sm space-y-5">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-3.5 h-3.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Boys Study Hall • Classroom Blueprint</h3>
                <p className="text-xs text-slate-500">105 Dedicated Desks • B001 to B105 (4 Physical Blocks & Walkways)</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                {seats.filter((s) => s.gender_allowed === 'BOYS' && s.status === 'AVAILABLE').length} Available
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold border border-rose-200">
                {seats.filter((s) => s.gender_allowed === 'BOYS' && s.status === 'OCCUPIED').length} Occupied
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200">
                105 Total
              </span>
            </div>
          </div>

          {/* Front of Classroom Marker */}
          <div className="py-1 px-4 bg-slate-100 rounded-lg text-center text-[10px] font-bold text-slate-500 tracking-wider uppercase border border-slate-200">
            FRONT OF STUDY HALL • DIGITAL WHITEBOARD, PODIUM & MAIN ENTRANCE (NORTH)
          </div>

          {/* Block 1 */}
          {renderPairedBenchBlock(BOYS_LAYOUT.block1, 1)}

          {/* Walkway 1 */}
          {renderWalkingAisle('Central Corridor Aisle 1', '4.5 ft')}

          {/* Block 2 */}
          {renderPairedBenchBlock(BOYS_LAYOUT.block2, 2)}

          {/* Walkway 2 */}
          {renderWalkingAisle('Central Corridor Aisle 2', '4.5 ft')}

          {/* Block 3 */}
          {renderPairedBenchBlock(BOYS_LAYOUT.block3, 3)}

          {/* Walkway 3 */}
          {renderWalkingAisle('Central Corridor Aisle 3', '4.5 ft')}

          {/* Block 4 */}
          {renderSingleBenchBlock(BOYS_LAYOUT.block4, 4)}

          {/* Rear Wall Marker */}
          <div className="py-1 px-4 bg-slate-100 rounded-lg text-center text-[10px] font-bold text-slate-500 tracking-wider uppercase border border-slate-200">
            REAR WALL • NATURAL VENTILATION & FIRE EXIT (SOUTH)
          </div>
        </div>
      )}

      {/* Girls Study Hall */}
      {(genderFilter === 'ALL' || genderFilter === 'GIRLS') && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-purple-200 shadow-sm space-y-5">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-3.5 h-3.5 rounded-full bg-purple-500 ring-4 ring-purple-100" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Girls Study Hall • Classroom Blueprint</h3>
                <p className="text-xs text-slate-500">45 Dedicated Desks • G001 to G045 (3 Physical Blocks & Walkways)</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                {seats.filter((s) => s.gender_allowed === 'GIRLS' && s.status === 'AVAILABLE').length} Available
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold border border-rose-200">
                {seats.filter((s) => s.gender_allowed === 'GIRLS' && s.status === 'OCCUPIED').length} Occupied
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-bold border border-purple-200">
                45 Total
              </span>
            </div>
          </div>

          {/* Front of Classroom Marker */}
          <div className="py-1 px-4 bg-slate-100 rounded-lg text-center text-[10px] font-bold text-slate-500 tracking-wider uppercase border border-slate-200">
            FRONT OF STUDY HALL • DIGITAL WHITEBOARD & MAIN ENTRANCE (NORTH)
          </div>

          {/* Block 1 */}
          {renderSingleBenchBlock(GIRLS_LAYOUT.block1, 1)}

          {/* Walkway 1 */}
          {renderWalkingAisle('Girls Hall Main Walkway Aisle 1', '4.0 ft')}

          {/* Block 2 */}
          {renderPairedBenchBlock(GIRLS_LAYOUT.block2, 2)}

          {/* Walkway 2 */}
          {renderWalkingAisle('Girls Hall Main Walkway Aisle 2', '4.0 ft')}

          {/* Block 3 */}
          {renderSingleBenchBlock(GIRLS_LAYOUT.block3, 3)}

          {/* Rear Wall Marker */}
          <div className="py-1 px-4 bg-slate-100 rounded-lg text-center text-[10px] font-bold text-slate-500 tracking-wider uppercase border border-slate-200">
            REAR WALL • WINDOWS & FIRE EXIT (SOUTH)
          </div>
        </div>
      )}
    </div>
  );
};
