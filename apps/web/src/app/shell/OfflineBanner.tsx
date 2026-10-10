import { uiStore } from '../../lib/store.ts';
import { Icon } from '../../ui/Icon.tsx';

export function OfflineBanner() {
  const online = uiStore.use((s) => s.online);
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <Icon name="wifi-off" size={14} />
      You're offline — changes will fail until the connection is back.
    </div>
  );
}
