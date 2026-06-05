import { ToolbarProps, Views } from 'react-big-calendar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { TimeEntry } from '../types';

export interface CustomToolbarProps extends ToolbarProps<TimeEntry> {
  showWeekends: boolean;
  setShowWeekends: (show: boolean) => void;
  onManageProjects: () => void;
}

export const CustomToolbar = ({ 
  onNavigate, 
  onView, 
  view, 
  date, 
  showWeekends, 
  setShowWeekends, 
  onManageProjects 
}: CustomToolbarProps) => {
  
  const goToBack = () => {
    onNavigate('PREV');
  };

  const goToNext = () => {
    onNavigate('NEXT');
  };

  const goToCurrent = () => {
    onNavigate('TODAY');
  };

  const labelNode = () => {
    return (
      <span className="toolbar-title">
        {format(date, 'MMMM yyyy')}
      </span>
    );
  };

  return (
    <div className="toolbar-container">
      <div className="toolbar-buttons">
        <button className="btn" onClick={goToBack}>
          <ChevronLeft size={18} />
        </button>
        <button className="btn" onClick={goToCurrent}>
          Today
        </button>
        <button className="btn" onClick={goToNext}>
          <ChevronRight size={18} />
        </button>
        <button className="btn" onClick={onManageProjects}>
          Projects
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div>{labelNode()}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500 }}>
          <span>Weekends</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={showWeekends}
              onChange={(e) => {
                const checked = e.target.checked;
                setShowWeekends(checked);
              }}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="toolbar-buttons">
        <button
          className={`btn ${view === Views.MONTH ? 'primary' : ''}`}
          onClick={() => onView(Views.MONTH)}
        >
          Month
        </button>
        <button
          className={`btn ${(view === Views.WEEK || view === Views.WORK_WEEK) ? 'primary' : ''}`}
          onClick={() => onView(showWeekends ? Views.WEEK : Views.WORK_WEEK)}
        >
          Week
        </button>
        <button
          className={`btn ${view === Views.DAY ? 'primary' : ''}`}
          onClick={() => onView(Views.DAY)}
        >
          Day
        </button>
      </div>
    </div>
  );
};
