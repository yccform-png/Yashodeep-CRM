import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';

export interface InstituteProfile {
  id: string;
  name: string;
  code: string;
  tagline?: string | null;
  registration_number?: string | null;
  gstin?: string | null;
  logo_url?: string | null;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  secondary_phone?: string | null;
  website?: string | null;
  signatory_title?: string | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_branch?: string | null;
  upi_id?: string | null;
  invoice_terms?: string | null;
  admission_form_fee?: number;
  trial_period_days?: number;
  grace_period_days?: number;
  enable_admission_form_fee?: boolean;
  enable_trial_admission?: boolean;
  is_active: boolean;
}

interface InstituteContextType {
  institute: InstituteProfile | null;
  loading: boolean;
  refreshInstitute: () => Promise<void>;
  updateInstitute: (data: Partial<InstituteProfile>) => Promise<InstituteProfile>;
}

const InstituteContext = createContext<InstituteContextType | undefined>(undefined);

export const InstituteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [institute, setInstitute] = useState<InstituteProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<InstituteProfile>('/institutes/profile');
      setInstitute(res.data);
    } catch (err) {
      console.error('Failed to load institute profile', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const updateInstitute = async (data: Partial<InstituteProfile>) => {
    const res = await apiClient.put<InstituteProfile>('/institutes/profile', data);
    setInstitute(res.data);
    return res.data;
  };

  return (
    <InstituteContext.Provider
      value={{
        institute,
        loading,
        refreshInstitute: fetchProfile,
        updateInstitute
      }}
    >
      {children}
    </InstituteContext.Provider>
  );
};

export const useInstitute = () => {
  const context = useContext(InstituteContext);
  if (!context) {
    throw new Error('useInstitute must be used within an InstituteProvider');
  }
  return context;
};
