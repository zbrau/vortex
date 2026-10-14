import React, { useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  Paper,
  Badge,
  Button,
  TextInput,
  ColorInput,
  Divider,
  Code,
  SimpleGrid
} from '@mantine/core';
import {
  Palette,
  Cpu,
  FolderPlus,
  Pipette,
  Check,
  DownloadCloud
} from 'lucide-react';
import { ThemePreset, SystemBinariesStatus, Category } from '../types';
import { themes } from '../theme/themes';

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
  currentTheme: ThemePreset;
  onSelectTheme: (t: ThemePreset) => void;
  customAccent: string;
  onSelectAccent: (color: string) => void;
  binaryStatus: SystemBinariesStatus | null;
  categories: Category[];
  onAddCategory: (name: string, color: string) => void;
  onOpenSetup?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  opened,
  onClose,
  currentTheme,
  onSelectTheme,
  customAccent,
  onSelectAccent,
  binaryStatus,
  categories,
  onAddCategory,
  onOpenSetup
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#ff2a85');

  const handleAddCat = () => {
    if (!newCatName.trim()) return;
    onAddCategory(newCatName.trim(), newCatColor);
    setNewCatName('');
  };

  const themeList = Object.values(themes);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Palette size={20} color="#ff2a85" />
          <Text fw={700}>Ajustes y Personalización de Vortex</Text>
        </Group>
      }
      size="lg"
      radius="lg"
    >
      <Stack gap="lg">
        {/* Full 15-Theme Grid */}
        <div>
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <Palette size={16} color="#ff2a85" />
              <Text size="sm" fw={700}>Temas Visuales Desbloqueados (15)</Text>
            </Group>
            <Badge size="xs" color="pink" variant="light">100% LIBRE / SIN RESTRICCIONES</Badge>
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
            {themeList.map(t => (
              <Button
                key={t.id}
                variant={currentTheme === t.id ? 'filled' : 'subtle'}
                color={currentTheme === t.id ? 'pink' : 'gray'}
                size="xs"
                radius="md"
                justify="space-between"
                onClick={() => onSelectTheme(t.id)}
                leftSection={
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: t.accent,
                      border: '1px solid rgba(255,255,255,0.3)'
                    }}
                  />
                }
              >
                {t.name}
              </Button>
            ))}
          </SimpleGrid>
        </div>

        {/* Custom Accent Color Picker */}
        <Paper p="sm" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Pipette size={16} color="#ff2a85" />
              <div>
                <Text size="xs" fw={700}>Color de Acento Personalizado (Accent Color)</Text>
                <Text size="xs" c="dimmed">Ajusta el color primario de botones y badges a tu gusto</Text>
              </div>
            </Group>

            <Group gap="xs">
              <ColorInput
                size="xs"
                value={customAccent}
                onChange={onSelectAccent}
                swatches={['#ff2a85', '#00f0ff', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#ef4444', '#a855f7']}
                style={{ width: 140 }}
              />
              <Button size="xs" variant="subtle" color="gray" onClick={() => onSelectAccent('')}>
                Reset
              </Button>
            </Group>
          </Group>
        </Paper>

        <Divider />

        {/* Engine & Binaries Status */}
        <div>
          <Group gap="xs" mb="xs">
            <Cpu size={16} color="#ff2a85" />
            <Text size="sm" fw={700}>Motores y Binarios del Sistema</Text>
          </Group>

          {binaryStatus ? (
            <>
              <Stack gap="xs">
                <Paper p="xs" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <Group justify="space-between">
                    <Text size="xs" fw={600}>yt-dlp (Motor Principal)</Text>
                    <Badge size="xs" color={binaryStatus.ytdlp.found ? 'teal' : 'red'}>
                      {binaryStatus.ytdlp.found ? 'Detectado' : 'Ausente'}
                    </Badge>
                  </Group>
                  {binaryStatus.ytdlp.path && (
                    <Code block mt={4} style={{ fontSize: 10 }}>{binaryStatus.ytdlp.path}</Code>
                  )}
                </Paper>

                <Paper p="xs" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <Group justify="space-between">
                    <Text size="xs" fw={600}>ffmpeg (Conversor & Post-procesador)</Text>
                    <Badge size="xs" color={binaryStatus.ffmpeg.found ? 'teal' : 'yellow'}>
                      {binaryStatus.ffmpeg.found ? 'Detectado' : 'Opcional / Ausente'}
                    </Badge>
                  </Group>
                  {binaryStatus.ffmpeg.path && (
                    <Code block mt={4} style={{ fontSize: 10 }}>{binaryStatus.ffmpeg.path}</Code>
                  )}
                </Paper>

                <Paper p="xs" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <Group justify="space-between">
                    <Text size="xs" fw={600}>Deno (Motor JS para n-sig)</Text>
                    <Badge size="xs" color={binaryStatus.deno.found ? 'teal' : 'gray'}>
                      {binaryStatus.deno.found ? 'Detectado' : 'Opcional'}
                    </Badge>
                  </Group>
                  {binaryStatus.deno.path && (
                    <Code block mt={4} style={{ fontSize: 10 }}>{binaryStatus.deno.path}</Code>
                  )}
                </Paper>
              </Stack>

              <Button
                size="xs"
                variant="light"
                color="cyan"
                fullWidth
                mt="xs"
                leftSection={<DownloadCloud size={14} />}
                onClick={() => {
                  onClose();
                  if (onOpenSetup) onOpenSetup();
                }}
              >
                Reinstalar o Actualizar Motores (yt-dlp y FFmpeg)
              </Button>
            </>
          ) : (
            <Text size="xs" c="dimmed">Cargando estado...</Text>
          )}
        </div>

        <Divider />

        {/* Custom Category Management */}
        <div>
          <Group gap="xs" mb="xs">
            <FolderPlus size={16} color="#ff2a85" />
            <Text size="sm" fw={700}>Crear Nueva Categoría</Text>
          </Group>
          <Group gap="xs">
            <TextInput
              placeholder="Nombre (ej. Animes, Tutoriales)..."
              size="xs"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              style={{ flex: 1 }}
            />
            <ColorInput
              size="xs"
              value={newCatColor}
              onChange={setNewCatColor}
              style={{ width: 110 }}
            />
            <Button size="xs" color="pink" onClick={handleAddCat}>
              Añadir
            </Button>
          </Group>
        </div>
      </Stack>
    </Modal>
  );
};
