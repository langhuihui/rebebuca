import { createDiscreteApi } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { getAdapter } from '../adapters';
import { resolveBackendPort } from '../utils/backendPort';
import { closeBrowserWindow } from '../utils/windowControls';

const { message, dialog } = createDiscreteApi(['message', 'dialog']);

export function useCloseService() {
  const { t } = useI18n();

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

          for (const pid of targetPids) {
            await adapter.system.killProcessForce(pid);
          }

          message.success(t('task.closeServiceSuccess', { count: targetPids.length }));
          window.setTimeout(() => closeBrowserWindow(t('task.closeServiceTabHint')), 400);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          message.error(t('task.closeServiceFailed', { error: errorMsg }));
        }
      },
    });
  };

  return { closeService };
}
