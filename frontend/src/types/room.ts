export interface ParticipantsInfo {
  current: number;
  max: number;
  label: string;
}

export interface Room {
  id?: string;
  name: string;
  created_at?: string;
  status?: string;
  max_participants?: number;
  participants?: ParticipantsInfo;
}