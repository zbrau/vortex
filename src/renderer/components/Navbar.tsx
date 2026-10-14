import React from 'react';
import {
  Group,
  Title,
  Badge,
  SegmentedControl,
  ActionIcon,
  Tooltip,
  Text,
  Button,
  Kbd
} from '@mantine/core';
import {
  Download,
  Library,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Wrench,
  Settings,
  Search
} from 'lucide-react';
import { SystemBinariesStatus } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  binaryStatus: SystemBinariesStatus | null;
  onOpenSettings: () => void;
  onOpenQrShare: () => void;
  onOpenMaintenance: () => void;
  onOpenCommandPalette: () => void;
  onOpenSetup?: () => void;
  itemCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  binaryStatus,
  onOpenSettings,
  onOpenQrShare,
  onOpenMaintenance,
  onOpenCommandPalette,
  onOpenSetup,
  itemCount
}) => {
  return (
    <Group
      justify="space-between"
      align="center"
      px="xl"
      py="sm"
      wrap="nowrap"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(10, 8, 16, 0.4)',
        backdropFilter: 'blur(20px)',
        minHeight: 64,
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}
    >
      {/* Brand Title */}
      <Title
        order={3}
        style={{
          letterSpacing: '2.5px',
          fontWeight: 900,
          margin: 0,
          lineHeight: 1,
          background: 'linear-gradient(135deg, #ffffff 40%, #00e5ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          userSelect: 'none',
          cursor: 'default'
        }}
      >
        VORTEX
      </Title>

      {/* Main Navigation Tabs */}
      <SegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        size="sm"
        radius="md"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
        data={[
          {
            value: 'download',
            label: (
              <Group gap={8} wrap="nowrap" align="center" px={12} py={4}>
                <Download size={16} strokeWidth={2.2} />
                <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                  Descargar
                </Text>
              </Group>
            )
          },
          {
            value: 'library',
            label: (
              <Group gap={8} wrap="nowrap" align="center" px={12} py={4}>
                <Library size={16} strokeWidth={2.2} />
                <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                  Biblioteca {itemCount > 0 && `(${itemCount})`}
                </Text>
              </Group>
            )
          }
        ]}
      />

      {/* Quick Search & Tools */}
      <Group gap="xs" align="center" wrap="nowrap">
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          radius="md"
          leftSection={<Search size={14} />}
          rightSection={<Kbd size="xs" style={{ fontSize: 10 }}>Ctrl+K</Kbd>}
          onClick={onOpenCommandPalette}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          Buscar...
        </Button>

        {binaryStatus && (
          <Tooltip label={binaryStatus.ready ? `Motor activo: ${binaryStatus.ytdlp.path}` : 'Haz clic para instalar yt-dlp y ffmpeg automáticamente'}>
            <Badge
              leftSection={
                binaryStatus.ready ? (
                  <CheckCircle2 size={12} strokeWidth={2.5} />
                ) : (
                  <AlertTriangle size={12} strokeWidth={2.5} />
                )
              }
              color={binaryStatus.ready ? 'teal' : 'yellow'}
              variant="light"
              size="sm"
              onClick={!binaryStatus.ready || binaryStatus.needsBootstrap ? onOpenSetup : undefined}
              style={{
                textTransform: 'none',
                fontWeight: 600,
                cursor: !binaryStatus.ready || binaryStatus.needsBootstrap ? 'pointer' : 'default'
              }}
            >
              {binaryStatus.ready ? 'Motor Listo' : 'Configurar Motor'}
            </Badge>
          </Tooltip>
        )}

        <Tooltip label="Transferencia QR a Celular">
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="md"
            onClick={onOpenQrShare}
            color="pink"
            aria-label="Compartir QR"
          >
            <QrCode size={19} strokeWidth={2} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Mantenimiento y Respaldo">
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="md"
            onClick={onOpenMaintenance}
            color="gray"
            aria-label="Mantenimiento"
          >
            <Wrench size={19} strokeWidth={2} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Ajustes y Temas Visuales">
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="md"
            onClick={onOpenSettings}
            color="gray"
            aria-label="Ajustes"
          >
            <Settings size={19} strokeWidth={2} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
};
