import React, { useState } from 'react';
import {
  Modal,
  TextInput,
  Stack,
  Group,
  Text,
  Badge,
  Paper,
  ScrollArea,
  ActionIcon,
  Kbd
} from '@mantine/core';
import {
  Search,
  Play,
  FolderOpen,
  Download,
  Library,
  QrCode,
  Wrench,
  Palette,
  ArrowRight,
  Music,
  Video
} from 'lucide-react';
import { DownloadItem, ThemePreset } from '../types';
import { themes } from '../theme/themes';

interface CommandPaletteModalProps {
  opened: boolean;
  onClose: () => void;
  libraryItems: DownloadItem[];
  onPlayItem: (item: DownloadItem) => void;
  onOpenFolder: (filepath: string) => void;
  onNavigateTab: (tab: string) => void;
  onSelectTheme: (theme: ThemePreset) => void;
  onOpenQr: () => void;
  onOpenMaintenance: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  opened,
  onClose,
  libraryItems,
  onPlayItem,
  onOpenFolder,
  onNavigateTab,
  onSelectTheme,
  onOpenQr,
  onOpenMaintenance
}) => {
  const [query, setQuery] = useState('');

  const filteredItems = libraryItems.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.format.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  const themeList = Object.values(themes).filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      radius="lg"
      padding="md"
      withCloseButton={false}
      styles={{
        content: {
          background: 'rgba(18, 14, 28, 0.95)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 42, 133, 0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
        }
      }}
    >
      <Stack gap="md">
        <TextInput
          placeholder="Buscar descargas, canciones, videos o comandos (Ctrl+K)..."
          leftSection={<Search size={20} color="#ff2a85" />}
          rightSection={<Kbd size="xs">ESC</Kbd>}
          value={query}
          onChange={e => setQuery(e.target.value)}
          size="md"
          radius="md"
          autoFocus
          styles={{
            input: {
              background: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: '15px'
            }
          }}
        />

        <ScrollArea h={340} offsetScrollbars>
          <Stack gap="sm">
            {/* Quick Actions if query is empty or matches */}
            {query.length === 0 && (
              <div>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={6} style={{ letterSpacing: '0.6px' }}>
                  Acciones Rápidas
                </Text>
                <Stack gap={4}>
                  <Paper
                    p="xs"
                    radius="md"
                    style={{ background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}
                    onClick={() => handleAction(() => onNavigateTab('download'))}
                  >
                    <Group justify="space-between">
                      <Group gap="sm">
                        <Download size={16} color="#ff2a85" />
                        <Text size="sm">Ir al panel de Descargas</Text>
                      </Group>
                      <ArrowRight size={14} opacity={0.5} />
                    </Group>
                  </Paper>

                  <Paper
                    p="xs"
                    radius="md"
                    style={{ background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}
                    onClick={() => handleAction(() => onNavigateTab('library'))}
                  >
                    <Group justify="space-between">
                      <Group gap="sm">
                        <Library size={16} color="#ff2a85" />
                        <Text size="sm">Ver Biblioteca Completa</Text>
                      </Group>
                      <ArrowRight size={14} opacity={0.5} />
                    </Group>
                  </Paper>

                  <Paper
                    p="xs"
                    radius="md"
                    style={{ background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}
                    onClick={() => handleAction(onOpenQr)}
                  >
                    <Group justify="space-between">
                      <Group gap="sm">
                        <QrCode size={16} color="#ff2a85" />
                        <Text size="sm">Compartir con Celular (Código QR)</Text>
                      </Group>
                      <ArrowRight size={14} opacity={0.5} />
                    </Group>
                  </Paper>

                  <Paper
                    p="xs"
                    radius="md"
                    style={{ background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}
                    onClick={() => handleAction(onOpenMaintenance)}
                  >
                    <Group justify="space-between">
                      <Group gap="sm">
                        <Wrench size={16} color="#ff2a85" />
                        <Text size="sm">Mantenimiento y Respaldo</Text>
                      </Group>
                      <ArrowRight size={14} opacity={0.5} />
                    </Group>
                  </Paper>
                </Stack>
              </div>
            )}

            {/* Matching Library Items */}
            {filteredItems.length > 0 && (
              <div>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={6} style={{ letterSpacing: '0.6px' }}>
                  Archivos en Biblioteca ({filteredItems.length})
                </Text>
                <Stack gap={4}>
                  {filteredItems.map(item => {
                    const isAudio = ['mp3', 'm4a', 'flac', 'wav', 'opus'].includes(item.format.toLowerCase());
                    return (
                      <Paper
                        key={item.id}
                        p="xs"
                        radius="md"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <Group justify="space-between">
                          <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                            {isAudio ? <Music size={16} color="#ff2a85" /> : <Video size={16} color="#00f0ff" />}
                            <Text size="sm" lineClamp={1} fw={500} style={{ flex: 1 }}>
                              {item.title}
                            </Text>
                            <Badge size="xs" color="pink" variant="light">{item.format.toUpperCase()}</Badge>
                          </Group>

                          <Group gap={4}>
                            <ActionIcon
                              size="sm"
                              variant="filled"
                              color="pink"
                              radius="md"
                              onClick={() => handleAction(() => onPlayItem(item))}
                              title="Reproducir"
                            >
                              <Play size={13} fill="#fff" />
                            </ActionIcon>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="gray"
                              radius="md"
                              onClick={() => handleAction(() => onOpenFolder(item.filepath))}
                              title="Abrir en carpeta"
                            >
                              <FolderOpen size={13} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </div>
            )}

            {/* Quick Themes */}
            {query.length > 0 && themeList.length > 0 && (
              <div>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={6} style={{ letterSpacing: '0.6px' }}>
                  Cambiar Tema
                </Text>
                <Group gap="xs">
                  {themeList.map(t => (
                    <Badge
                      key={t.id}
                      size="sm"
                      variant="outline"
                      color="pink"
                      style={{ cursor: 'pointer' }}
                      leftSection={
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: t.accent
                          }}
                        />
                      }
                      onClick={() => handleAction(() => onSelectTheme(t.id))}
                    >
                      {t.name}
                    </Badge>
                  ))}
                </Group>
              </div>
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    </Modal>
  );
};
