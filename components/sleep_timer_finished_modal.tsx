import { usePlayer } from '../context/player_context';
import { Modal } from './modal';

export function SleepTimerFinishedModal() {
  const { sleepTimerFinished, dismissSleepTimerFinished } = usePlayer();

  if (!sleepTimerFinished) return null;

  return (
    <Modal title="Sleep timer finished" onClose={dismissSleepTimerFinished}>
      <p className="xe_update-modal__text">
        Your sleep timer has finished, but if you're still awake, you can always add more time
      </p>
    </Modal>
  );
}
