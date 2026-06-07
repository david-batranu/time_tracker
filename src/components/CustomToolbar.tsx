import { ToolbarProps, Views } from 'react-big-calendar';
import { ChevronLeft, ChevronRight, Settings, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { TimeEntry } from '../types';

export interface CustomToolbarProps extends ToolbarProps<TimeEntry> {
  onManageSettings: () => void;
  quotaUsage: { percentage: number };
}

export const CustomToolbar = ({ 
  onNavigate, 
  onView, 
  view, 
  date, 
  onManageSettings,
  quotaUsage
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
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div>{labelNode()}</div>
      </div>

      <div className="toolbar-buttons" style={{ alignItems: 'center' }}>
        <button
          className={`btn ${view === Views.MONTH ? 'primary' : ''}`}
          onClick={() => onView(Views.MONTH)}
        >
          Month
        </button>
        <button
          className={`btn ${(view === Views.WEEK || view === Views.WORK_WEEK) ? 'primary' : ''}`}
          onClick={() => onView(Views.WEEK)}
        >
          Week
        </button>
        <button
          className={`btn ${view === Views.DAY ? 'primary' : ''}`}
          onClick={() => onView(Views.DAY)}
        >
          Day
        </button>
        
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 8px' }} />
        
        <button 
           className="btn" 
           onClick={onManageSettings} 
           style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 10px' }}
           title={quotaUsage.percentage > 80 ? "Storage limit approaching. Older data will be kept locally." : "Settings"}
        >
          {quotaUsage.percentage > 80 && (
            <AlertTriangle size={16} color="var(--delete-color)" />
          )}
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
};
