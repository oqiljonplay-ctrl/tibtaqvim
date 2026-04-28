import { ServiceType, AppointmentStatus, UserRole } from "@prisma/client";

export type { ServiceType, AppointmentStatus, UserRole };

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BookingRequest {
  clinicId: string;
  serviceId: string;
  doctorId?: string;
  slotId?: string;
  date: string;
  patientName: string;
  patientPhone: string;
  address?: string;
}

export interface ServiceWithBookingCount {
  id: string;
  name: string;
  type: ServiceType;
  price: number;
  requiresSlot: boolean;
  requiresAddress: boolean;
  dailyLimit: number | null;
  todayCount?: number;
  isAvailable?: boolean;
}
