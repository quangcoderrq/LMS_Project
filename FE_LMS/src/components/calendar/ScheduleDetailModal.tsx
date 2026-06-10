import React from 'react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  schedule?: unknown;
  subjects?: unknown[];
  lecturers?: unknown[];
};

const ScheduleDetailModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Schedule Detail</h3>
        <p>Read-only detail (UI only)</p>
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDetailModal;





















