export type CountryISO = 'PE' | 'CL';

export type AppointmentStatus = 'pending' | 'completed';

export interface AppointmentRequest {
  insuredId: string;
  scheduleId: number;
  countryISO: CountryISO;
}

export interface AppointmentRecord extends AppointmentRequest {
  id: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentProcessedEventMessage {
  insuredId: string;
  scheduleId: number;
  countryISO: CountryISO;
}
