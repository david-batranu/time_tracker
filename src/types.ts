export interface Project {
  id: string;
  title: string;
  color: string;
}

export interface TimeEntry {
  id: string;
  title: string;
  start: Date;
  end: Date;
  projectId?: string;
  description?: string;
}

export type ModalState =
  | { isOpen: false; mode?: never; event?: never; slot?: never; selectedDate?: never }
  | { isOpen: true; mode: 'create'; slot: { start: Date; end: Date }; selectedDate: Date; event?: never }
  | { isOpen: true; mode: 'edit'; event: TimeEntry; selectedDate: Date; slot?: never };

export interface Settings {
  showWeekends: boolean;
}

export const COLORS = [
  '#fce7f3',
  '#dcfce7',
  '#fef08a',
  '#e0e7ff',
  '#ffedd5'
];

export const formatMs = (ms: number) => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const pad = (num: number) => num.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}`;
  }
  return `${minutes}m`;
};

export const formatDuration = (start: Date, end: Date) => {
  return formatMs(end.getTime() - start.getTime());
};
