import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const AddToHomeScreenButton = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setInstallPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (isInstalled || !installPromptEvent) return null;

  return (
    <button
      onClick={async () => {
        await installPromptEvent.prompt();
        await installPromptEvent.userChoice;
        setInstallPromptEvent(null);
      }}
      className="fixed bottom-4 right-4 z-[90] rounded-full border border-yellow-400/70 bg-[#0f172a]/95 px-4 py-2 text-xs font-semibold text-yellow-300 shadow-[0_0_16px_rgba(251,191,36,0.4)] md:hidden"
    >
      Add to Home Screen
    </button>
  );
};
