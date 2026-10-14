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
  const [loadingReconcile, setLoadingReconcile] = useState(false);
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);

  const handleReconcile = async () => {
    setLoadingReconcile(true);
    try {
      // @ts-ignore
      if (window.smasherAPI) {
        // @ts-ignore
        const res = await window.smasherAPI.reconcileLibrary();
        notifications.show({
          title: 'Reconciliación Completada',
          message: `Se reconectaron ${res.reconciledCount} archivos de ${res.checkedCount} revisados.`,
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
      // @ts-ignore
      if (window.smasherAPI) {
        // @ts-ignore
        const savedPath = await window.smasherAPI.backupDatabase();
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
      // @ts-ignore
      if (window.smasherAPI) {
        // @ts-ignore
        const res = await window.smasherAPI.restoreDatabase();
        if (res) {
          notifications.show({
            title: 'Base de Datos Restaurada',
            message: `Se restauraron ${res.restoredItems} elementos y ${res.restoredCategories} categorías.`,
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
      title={
        <Group gap="xs">
          <Wrench size={20} color="#ff2a85" />
          <Text fw={700}>Mantenimiento y Copias de Seguridad</Text>
        </Group>
      }
      size="md"
      radius="lg"
    >
      <Stack gap="md">
        {/* Reconcile Section */}
        <Paper p="md" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <Stack gap="xs">
            <Group gap="xs">
              <FolderSearch size={18} color="#ff2a85" />
              <Text size="sm" fw={600}>Reconciliar Archivos Faltantes (Reconcile)</Text>
            </Group>
            <Text size="xs" c="dimmed">
              Escanea tus carpetas de descarga para volver a enlazar archivos que hayas movido de sitio o renombrado.
            </Text>
            <Button
              size="xs"
              color="pink"
              variant="light"
              leftSection={<RefreshCw size={14} />}
              onClick={handleReconcile}
              loading={loadingReconcile}
            >
              Escanear y Reconectar Archivos
            </Button>
          </Stack>
        </Paper>

        <Divider />

        {/* Backup & Restore Section */}
        <Paper p="md" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <Stack gap="sm">
            <Group gap="xs">
              <Database size={18} color="#ff2a85" />
              <Text size="sm" fw={600}>Copia de Seguridad de la Base de Datos</Text>
            </Group>
            <Text size="xs" c="dimmed">
              Exporta o restaura todo tu catálogo (`smasher.db`) a archivos JSON legibles para migrar entre equipos o guardar respaldo.
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
                Exportar a JSON
              </Button>
              <Button
                size="xs"
                color="violet"
                variant="outline"
                leftSection={<UploadCloud size={14} />}
                onClick={handleRestore}
                loading={loadingRestore}
              >
                Restaurar desde JSON
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Modal>
  );
};
