import { createDiscreteApi } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { getAdapter, markServiceShuttingDown, resetAdapter } from '../adapters';
import { resolveBackendPort } from '../utils/backendPort';
import { closeBrowserWindow } from '../utils/windowControls';

const { message, dialog } = createDiscreteApi(['message', 'dialog']);

const SHUTDOWN_SETTLE_MS = 300;

function isExpectedShutdownDisconnect(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return (
    errorMsg.includes('WebSocket disconnected') ||
    errorMsg.includes('WebSocket not connected') ||
    errorMsg.includes('Service shutdown')
  );
}

export function useCloseService() {
  const { t } = useI18n();

  const finishServiceShutdown = async (fallbackMessage: string) => {
    try {
      await resetAdapter();
    } catch {
      // ignore — backend is already gone
    }
    closeBrowserWindow(fallbackMessage);
  };

  const closeService = () => {
    const targetPort = resolveBackendPort();
    dialog.warning({
      title: t('task.closeService'),
      content: t('task.confirmCloseService', { port: targetPort }),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        try {
          const adapter = await getAdapter();
          const ports = await adapter.system.listPorts({ showAll: true });
          const targetPids = Array.from(
            new Set(ports.filter((p) => p.port === targetPort && p.pid > 0).map((p) => p.pid)),
          );

          if (targetPids.length === 0) {
            message.warning(t('task.closeServiceNotFound', { port: targetPort }));
            return;
          }

          markServiceShuttingDown();

          for (const pid of targetPids) {
            try {
              await adapter.system.killProcessForce(pid);
            } catch (error) {
              if (!isExpectedShutdownDisconnect(error)) {
                throw error;
              }
              break;
            }
          }

          const fallbackMessage = t('task.closeServiceTabHint');
          await new Promise((resolve) => window.setTimeout(resolve, SHUTDOWN_SETTLE_MS));
          await finishServiceShutdown(fallbackMessage);
        } catch (error) {
          if (isExpectedShutdownDisconnect(error)) {
            await finishServiceShutdown(t('task.closeServiceTabHint'));
            return;
          }
          const errorMsg = error instanceof Error ? error.message : String(error);
          message.error(t('task.closeServiceFailed', { error: errorMsg }));
        }
      },
    });
  };

  return { closeService };
}
