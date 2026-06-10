import React from 'react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  event?: unknown;
};

const EventModal: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Event</h3>
        <p>UI only placeholder</p>
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
          {onSave && <button onClick={onSave}>Save</button>}
        </div>
      </div>
    </div>
  );
};

export default EventModal;





















