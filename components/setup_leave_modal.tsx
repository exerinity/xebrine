import { useSetupFlow } from '../context/setup_flow_context';
import { Modal } from './modal';

export function SetupLeaveModal() {
  const { leavePromptOpen, stayInSetup, leaveSetup } = useSetupFlow();

  if (!leavePromptOpen) return null;

  return (
    <Modal title="Leave setup?" onClose={stayInSetup}>
      <p className="xe_setup__leave-message">You haven't finished setup yet - leave?</p>
      <div className="xe_modal__actions">
        <button type="button" className="xe_btn xe_btn--quiet" onClick={stayInSetup}>
          Keep setting up
        </button>
        <button type="button" className="xe_btn xe_btn--accent" onClick={leaveSetup}>
          Leave setup
        </button>
      </div>
    </Modal>
  );
}
