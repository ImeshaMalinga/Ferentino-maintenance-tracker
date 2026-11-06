import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api',
});

export type Summary = {
  machines: number;
  scheduled: number;
  done: number;
  toDo: number;
  today: number;
  upcoming: number;
  completed: number;
  overdue: number;
  notDone: number;
  maintenanceTypeCounts: Record<string, number>;
  maintenanceStatusCounts: {
    mechanical: Record<string, number>;
    electrical: Record<string, number>;
    all: Record<string, number>;
  };
};

export type Machine = {
  id: string;
  machineName: string;
  machineCode: string | null;
  serialNumber: string | null;
  scheduledCount: number;
  nextDate: string | null;
  maintenanceTypeCounts: Record<string, number>;
  mechanicalCount: number;
  electricalCount: number;
};

export type Activity = {
  id: string;
  maintenanceType: string;
  maintenanceStatus: 'PLAN' | 'ACTUAL';
  status?: 'PLAN' | 'ACTUAL';
  scheduledDate: string;
  completionDate: string | null;
  completedBy: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  machine?: Machine;
};

export type AdditionalMaintenance = {
  id: string;
  machineId: string;
  discipline: 'MECHANICAL' | 'ELECTRICAL';
  description: string;
  isCompleted: boolean;
  completionDate: string | null;
  completedBy: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  createdAt: string;
};
