import { ReactNode } from 'react';

export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface InstructionItem {
  id: string;
  title: string;
  icon: ReactNode;
  steps: string[];
}

export interface ClientData {
  domain: string;
  email: string;
  onboardingComplete: boolean;
  metrics: {
    roas: string;
    spend: string;
    conversions: string;
    revenue: string;
  };
  tasks: Array<{ id: string; title: string; status: 'todo' | 'done' }>;
}
