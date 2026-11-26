import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';

export interface AcademicYear {
  id: string;
  name: string;
  code: string;
  is_current: boolean;
  start_date: string;
  end_date: string;
}

interface AcademicYearContextType {
  academicYears: AcademicYear[];
  selectedAcademicYear: AcademicYear | null;
  setSelectedAcademicYear: (year: AcademicYear) => void;
  setSelectedAcademicYearById: (yearId: string) => void;
  currentAcademicYear: AcademicYear | null;
  setAsCurrentYear: (yearId: string) => Promise<void>;
  loadingYears: boolean;
  refreshAcademicYears: () => Promise<void>;
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export const AcademicYearProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYearState] = useState<AcademicYear | null>(null);
  const [loadingYears, setLoadingYears] = useState<boolean>(true);

  const fetchYears = async () => {
    try {
      setLoadingYears(true);
      const res = await apiClient.get<AcademicYear[]>('/academics/years');
      const years = res.data;
      setAcademicYears(years);

      const storedYearId = localStorage.getItem('ycc_selected_ay_id');
      let matchedYear: AcademicYear | undefined;
      if (storedYearId) {
        matchedYear = years.find((y) => y.id === storedYearId);
      }
      if (!matchedYear) {
        matchedYear = years.find((y) => y.is_current) || years[0];
      }

      if (matchedYear) {
        setSelectedAcademicYearState(matchedYear);
        localStorage.setItem('ycc_selected_ay_id', matchedYear.id);
      }
    } catch (err) {
      console.error('Failed to load academic years', err);
    } finally {
      setLoadingYears(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  const setSelectedAcademicYear = (year: AcademicYear) => {
    setSelectedAcademicYearState(year);
    localStorage.setItem('ycc_selected_ay_id', year.id);
  };

  const setSelectedAcademicYearById = (yearId: string) => {
    const found = academicYears.find((y) => y.id === yearId);
    if (found) {
      setSelectedAcademicYear(found);
    }
  };

  const setAsCurrentYear = async (yearId: string) => {
    await apiClient.post(`/academics/years/${yearId}/set-current`);
    await fetchYears();
  };

  const currentAcademicYear = academicYears.find((y) => y.is_current) || null;

  return (
    <AcademicYearContext.Provider
      value={{
        academicYears,
        selectedAcademicYear,
        setSelectedAcademicYear,
        setSelectedAcademicYearById,
        currentAcademicYear,
        setAsCurrentYear,
        loadingYears,
        refreshAcademicYears: fetchYears
      }}
    >
      {children}
    </AcademicYearContext.Provider>
  );
};

export const useAcademicYear = () => {
  const context = useContext(AcademicYearContext);
  if (!context) {
    throw new Error('useAcademicYear must be used within an AcademicYearProvider');
  }
  return context;
};
