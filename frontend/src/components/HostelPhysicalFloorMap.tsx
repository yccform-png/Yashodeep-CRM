import React, { useState, useMemo } from 'react';
import {
  Home,
  Building,
  Layers,
  DoorOpen,
  Snowflake,
  Bath,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Bed,
  Search,
  Check
} from 'lucide-react';
import { HostelBunkBedCard, HostelBedItem } from './HostelBunkBedCard';

export interface HostelPhysicalFloorMapProps {
  hostels: any[];
  selectedBedId?: string | null;
  onSelectBed?: (bed: HostelBedItem, room: any) => void;
  genderFilter?: 'ALL' | 'BOYS' | 'GIRLS';
  interactiveOnlyAvailable?: boolean;
  compact?: boolean;
}

export const HostelPhysicalFloorMap: React.FC<HostelPhysicalFloorMapProps> = ({
  hostels,
  selectedBedId,
  onSelectBed,
  genderFilter = 'ALL',
  interactiveOnlyAvailable = true,
  compact = false
}) => {
  // Filter hostels by gender if specified
  const filteredHostels = useMemo(() => {
    if (!hostels || hostels.length === 0) return [];
    if (genderFilter === 'ALL') return hostels;
    return hostels.filter((h) => h.gender_type === genderFilter);
  }, [hostels, genderFilter]);

  // Selected Building and Floor
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [roomFilter, setRoomFilter] = useState<'ALL' | 'VACANT' | 'AC'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Default selection if not set
  const currentHostel = filteredHostels[0] || hostels[0] || null;
  const currentBuilding = useMemo(() => {
    if (!currentHostel || !currentHostel.buildings || currentHostel.buildings.length === 0) return null;
    if (selectedBuildingId) {
      const found = currentHostel.buildings.find((b: any) => b.id === selectedBuildingId);
      if (found) return found;
    }
    return currentHostel.buildings[0];
  }, [currentHostel, selectedBuildingId]);

  const currentFloor = useMemo(() => {
    if (!currentBuilding || !currentBuilding.floors || currentBuilding.floors.length === 0) return null;
    if (selectedFloorId) {
      const found = currentBuilding.floors.find((f: any) => f.id === selectedFloorId);
      if (found) return found;
    }
    return currentBuilding.floors[0];
  }, [currentBuilding, selectedFloorId]);

  // Filtered Rooms on current floor
  const displayRooms = useMemo(() => {
    if (!currentFloor || !currentFloor.rooms) return [];
    return currentFloor.rooms.filter((r: any) => {
      const hasVacancy = r.beds.some((b: any) => b.status === 'AVAILABLE');
      if (roomFilter === 'VACANT' && !hasVacancy) return false;
      if (roomFilter === 'AC' && !r.is_ac) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesRoom = r.room_number.toLowerCase().includes(q);
        const matchesOccupant = r.beds.some(
          (b: any) =>
            (b.occupant_name && b.occupant_name.toLowerCase().includes(q)) ||
            (b.occupant_code && b.occupant_code.toLowerCase().includes(q)) ||
            (b.bed_number && b.bed_number.toLowerCase().includes(q))
        );
        if (!matchesRoom && !matchesOccupant) return false;
      }
      return true;
    });
  }, [currentFloor, roomFilter, searchTerm]);

  // Find currently selected bed and its room details
  const selectedBedDetails = useMemo(() => {
    if (!selectedBedId || !currentHostel) return null;
    for (const bld of currentHostel.buildings || []) {
      for (const flr of bld.floors || []) {
        for (const rm of flr.rooms || []) {
          const bed = rm.beds.find((b: any) => b.id === selectedBedId);
          if (bed) {
            return {
              bed,
              room: rm,
              floor: flr,
              building: bld
            };
          }
        }
      }
    }
    return null;
  }, [selectedBedId, currentHostel]);

  if (!currentHostel) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold">No Hostel facilities found matching gender preference.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Navigation Strip: Buildings & Floors */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        {/* Buildings / Blocks */}
        {currentHostel.buildings && currentHostel.buildings.length > 1 && (
          <div className="flex items-center space-x-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center">
              <Building className="w-3.5 h-3.5 mr-1" /> Block:
            </span>
            {currentHostel.buildings.map((bld: any) => (
              <button
                key={bld.id}
                type="button"
                onClick={() => {
                  setSelectedBuildingId(bld.id);
                  if (bld.floors && bld.floors[0]) setSelectedFloorId(bld.floors[0].id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  currentBuilding?.id === bld.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {bld.name} ({bld.code})
              </button>
            ))}
          </div>
        )}

        {/* Floors Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center space-x-2 overflow-x-auto">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center">
              <Layers className="w-3.5 h-3.5 mr-1" /> Floor:
            </span>
            {(currentBuilding?.floors || []).map((flr: any) => {
              const floorAvail = flr.rooms.reduce(
                (sum: number, r: any) => sum + r.beds.filter((b: any) => b.status === 'AVAILABLE').length,
                0
              );
              return (
                <button
                  key={flr.id}
                  type="button"
                  onClick={() => setSelectedFloorId(flr.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                    currentFloor?.id === flr.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{flr.name || `Floor ${flr.floor_number}`}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      currentFloor?.id === flr.id
                        ? 'bg-emerald-400 text-slate-950'
                        : floorAvail > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {floorAvail} Avail
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Filter pills */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search room # or student..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
              />
            </div>
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value as any)}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-slate-50 focus:outline-none"
            >
              <option value="ALL">All Rooms</option>
              <option value="VACANT">Has Vacancy</option>
              <option value="AC">AC Rooms</option>
            </select>
          </div>
        </div>
      </div>

      {/* Legend Ribbon */}
      <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
        <span className="font-bold text-slate-800">Legend:</span>
        <div className="flex items-center space-x-1.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <ArrowUp className="w-2.5 h-2.5 mr-0.5" /> Upper
          </span>
          <span className="text-slate-700">Upper Berth</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
            <ArrowDown className="w-2.5 h-2.5 mr-0.5" /> Lower
          </span>
          <span className="text-slate-700">Lower Berth</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          <span className="text-emerald-900 font-semibold">Available</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded bg-rose-400" />
          <span className="text-rose-900">Occupied</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded bg-indigo-600 ring-2 ring-indigo-400" />
          <span className="text-indigo-900 font-bold">Selected</span>
        </div>
      </div>

      {/* Rooms Floor Plan Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayRooms.map((rm: any) => {
          const availCount = rm.beds.filter((b: any) => b.status === 'AVAILABLE').length;
          const isFull = availCount === 0;

          // Group beds into bunks
          // If capacity == 1: single bed
          // If capacity >= 2: group by bunk_group or pairs
          const bunksMap: Record<number, { upper?: HostelBedItem; lower?: HostelBedItem }> = {};

          if (rm.capacity === 1 || rm.beds.length === 1) {
            // single bed
          } else {
            rm.beds.forEach((bed: HostelBedItem, idx: number) => {
              const grp = bed.bunk_group || Math.floor(idx / 2) + 1;
              if (!bunksMap[grp]) bunksMap[grp] = {};

              const isUpper = bed.tier === 'UPPER' || bed.bed_number.endsWith('-U') || bed.bed_number.endsWith('-B');
              if (isUpper) {
                bunksMap[grp].upper = bed;
              } else {
                bunksMap[grp].lower = bed;
              }
            });
          }

          const hasSelectedBedInRoom = rm.beds.some((b: any) => b.id === selectedBedId);

          return (
            <div
              key={rm.id}
              className={`p-4 rounded-2xl border transition-all ${
                hasSelectedBedInRoom
                  ? 'bg-indigo-50/30 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                  : isFull
                  ? 'bg-slate-50/60 border-slate-200'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
              }`}
            >
              {/* Room Card Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <DoorOpen className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Room {rm.room_number}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold uppercase">
                      {rm.room_type}
                    </span>
                  </div>

                  {/* Amenities */}
                  <div className="flex items-center space-x-1.5 mt-1 text-[10px]">
                    {rm.is_ac && (
                      <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-medium flex items-center border border-blue-100">
                        <Snowflake className="w-2.5 h-2.5 mr-0.5 text-blue-600" /> AC
                      </span>
                    )}
                    {rm.has_attached_bathroom && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-medium flex items-center border border-emerald-100">
                        <Bath className="w-2.5 h-2.5 mr-0.5 text-emerald-600" /> Bath
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isFull ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {availCount} / {rm.capacity} Vacant
                </span>
              </div>

              {/* Bunk Beds Layout */}
              <div>
                {rm.capacity === 1 ? (
                  <HostelBunkBedCard
                    singleBed={rm.beds[0]}
                    selectedBedId={selectedBedId}
                    onSelectBed={(bed) => onSelectBed && onSelectBed(bed, rm)}
                    interactiveOnlyAvailable={interactiveOnlyAvailable}
                    compact={compact}
                  />
                ) : (
                  <div className={`grid gap-2.5 ${Object.keys(bunksMap).length > 2 ? 'grid-cols-1 sm:grid-cols-2 max-h-[480px] overflow-y-auto pr-1' : 'grid-cols-1'}`}>
                    {Object.keys(bunksMap).map((grpKey) => {
                      const grpNum = Number(grpKey);
                      const bunk = bunksMap[grpNum];
                      return (
                        <HostelBunkBedCard
                          key={grpNum}
                          bunkNumber={grpNum}
                          upperBed={bunk.upper}
                          lowerBed={bunk.lower}
                          selectedBedId={selectedBedId}
                          onSelectBed={(bed) => onSelectBed && onSelectBed(bed, rm)}
                          interactiveOnlyAvailable={interactiveOnlyAvailable}
                          compact={compact}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Bed Strip */}
      {selectedBedDetails && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="font-bold text-indigo-950">
              Selected: Room {selectedBedDetails.room.room_number} • Bed {selectedBedDetails.bed.bed_number}{' '}
              <span className="font-mono text-indigo-700">
                ({selectedBedDetails.bed.tier === 'UPPER' ? 'Upper Berth' : 'Lower Berth'})
              </span>{' '}
              • {selectedBedDetails.building.name} ({selectedBedDetails.floor.name})
            </span>
          </div>
          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">Locked In</span>
        </div>
      )}
    </div>
  );
};
