import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SETUP_PATH = '/i/flow/setup';

interface SetupFlowContextValue {
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  setNavigationGuard(active: boolean): void;
  leavePromptOpen: boolean;
  stayInSetup(): void;
  leaveSetup(): void;
}

const SetupFlowContext = createContext<SetupFlowContextValue | null>(null);

export function SetupFlowProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [guarded, setGuarded] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!guarded || pendingPath || location.pathname === SETUP_PATH) return;
    setPendingPath(`${location.pathname}${location.search}${location.hash}`);
    navigate(SETUP_PATH, { replace: true });
  }, [guarded, location, navigate, pendingPath]);

  const stayInSetup = () => setPendingPath(null);

  const leaveSetup = () => {
    if (!pendingPath) return;
    const target = pendingPath;
    setPendingPath(null);
    setGuarded(false);
    navigate(target);
  };

  return (
    <SetupFlowContext.Provider
      value={{
        step,
        setStep,
        setNavigationGuard: setGuarded,
        leavePromptOpen: pendingPath !== null,
        stayInSetup,
        leaveSetup
      }}
    >
      {children}
    </SetupFlowContext.Provider>
  );
}

export function useSetupFlow(): SetupFlowContextValue {
  const context = useContext(SetupFlowContext);
  if (!context) throw new Error('useSetupFlow must be used within SetupFlowProvider');
  return context;
}
