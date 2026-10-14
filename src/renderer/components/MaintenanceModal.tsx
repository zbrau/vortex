import React, { useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  Paper,
  Button,
  Divider
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  Wrench,
  FolderSearch,
  RefreshCw,
  Database,
  UploadCloud,
  Check
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useMediaQuery } from '@mantine/hooks';
import { getVortexApi, isMobileNative } from '../api';

interface MaintenanceModalProps {
  opened: boolean;
  onClose: () => void;
  onRefreshLibrary: () => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  opened,
  onClose,
  onRefreshLibrary
}) => {
  const { t } = useLanguage();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const isMobile = isSmallScreen || isMobileNative;

  const [loadingReconcile, setLoadingReconcile] = useState(false);
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);

  const handleReconcile = async () => {
    setLoadingReconcile(true);
    try {
      const api = getVortexApi();
      if (api?.reconcileLibrary) {
        const res = await api.reconcileLibrary();
        notifications.show({
          title: 'Reconciliación Completada',
          message: `Se reconectaron ${res.reconciledCount || 0} archivos de ${res.checkedCount || 0} revisados.`,
          color: 'teal',
          icon: <Check size={16} />
        });
        onRefreshLibrary();
      }
    } catch (e: any) {
      notifications.show({
        title: 'Error en reconciliación',
        message: e.message,
        color: 'red'
      });
    } finally {
      setLoadingReconcile(false);
    }
  };

  const handleBackup = async () => {
    setLoadingBackup(true);
    try {
      const api = getVortexApi();
      if (api?.backupDatabase) {
        const savedPath = await api.backupDatabase();
        if (savedPath) {
          notifications.show({
            title: 'Copia de Seguridad Creada',
            message: `Guardada en: ${savedPath}`,
            color: 'teal'
          });
        }
      }
    } catch (e: any) {
      notifications.show({
        title: 'Error al exportar',
        message: e.message,
        color: 'red'
      });
    } finally {
      setLoadingBackup(false);
    }
  };

  const handleRestore = async () => {
    setLoadingRestore(true);
    try {
      const api = getVortexApi();
      if (api?.restoreDatabase) {
        const res = await api.restoreDatabase();
        if (res) {
          notifications.show({
            title: 'Base de Datos Restaurada',
            message: `Se restauraron ${res.restoredItems || 0} elementos y ${res.restoredCategories || 0} categorías.`,
            color: 'teal'
          });
          onRefreshLibrary();
        }
      }
    } catch (e: any) {
      notifications.show({
        title: 'Error al restaurar',
        message: e.message,
        color: 'red'
      });
    } finally {
      setLoadingRestore(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen={isMobile}
      title={
        <Group gap="xs">
          <Wrench size={20} color="#ff2a85" />
          <Text fw={700}>{t('maintenance.title')}</Text>
        </Group>
      }
      size="md"
      radius={isMobile ? 0 : 'lg'}
    >
      <Stack gap="md">
        {/* Reconcile Section */}
        <Paper p="md" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <Stack gap="xs">
            <Group gap="xs">
              <FolderSearch size={18} color="#ff2a85" />
              <Text size="sm" fw={600}>{t('maintenance.reconcile')}</Text>
            </Group>
            <Text size="xs" c="dimmed">
              {t('maintenance.reconcileDesc')}
            </Text>
            <Button
              size="xs"
              color="pink"
              variant="light"
              leftSection={<RefreshCw size={14} />}
              onClick={handleReconcile}
              loading={loadingReconcile}
            >
              {t('maintenance.reconcile')}
            </Button>
          </Stack>
        </Paper>

        <Divider />

        {/* Backup & Restore Section */}
        <Paper p="md" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <Stack gap="sm">
            <Group gap="xs">
              <Database size={18} color="#ff2a85" />
              <Text size="sm" fw={600}>{t('maintenance.exportBackup')}</Text>
            </Group>
            <Text size="xs" c="dimmed">
              {t('maintenance.exportDesc')}
            </Text>

            <Group grow>
              <Button
                size="xs"
                color="pink"
                variant="outline"
                leftSection={<Database size={14} />}
                onClick={handleBackup}
                loading={loadingBackup}
              >
                {t('maintenance.exportBackup')}
              </Button>
              <Button
                size="xs"
                color="violet"
                variant="outline"
                leftSection={<UploadCloud size={14} />}
                onClick={handleRestore}
                loading={loadingRestore}
              >
                {t('maintenance.importBackup')}
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Modal>
  );
};
