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
  DownloadCloud,
  Globe
} from 'lucide-react';
import { ThemePreset, SystemBinariesStatus, Category } from '../types';
import { themes } from '../theme/themes';
import { useLanguage } from '../i18n/LanguageContext';

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
  const { language, setLanguage, t, languages } = useLanguage();
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
          <Text fw={700}>{t('settings.title')}</Text>
        </Group>
      }
      size="lg"
      radius="lg"
    >
      <Stack gap="lg">
        {/* Language Selection Section */}
        <div>
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <Globe size={16} color="#00e5ff" />
              <Text size="sm" fw={700}>{t('settings.languageSection')}</Text>
            </Group>
            <Text size="xs" c="dimmed">{t('settings.languageHelp')}</Text>
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            {languages.map((l) => (
              <Button
                key={l.code}
                variant={language === l.code ? 'filled' : 'subtle'}
                color={language === l.code ? 'cyan' : 'gray'}
                size="xs"
                radius="md"
                onClick={() => setLanguage(l.code)}
                leftSection={<span style={{ fontSize: 16 }}>{l.flag}</span>}
                style={{
                  border: language === l.code ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.06)',
                  fontWeight: language === l.code ? 700 : 500
                }}
              >
                {l.nativeLabel}
              </Button>
            ))}
          </SimpleGrid>
        </div>

        <Divider />

        {/* Full 15-Theme Grid */}
        <div>
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <Palette size={16} color="#ff2a85" />
              <Text size="sm" fw={700}>{t('settings.themesSection')}</Text>
            </Group>
            <Badge size="xs" color="pink" variant="light">{t('settings.themesBadge')}</Badge>
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
            {themeList.map(tPreset => (
              <Button
                key={tPreset.id}
                variant={currentTheme === tPreset.id ? 'filled' : 'subtle'}
                color={currentTheme === tPreset.id ? 'pink' : 'gray'}
                size="xs"
                radius="md"
                justify="space-between"
                onClick={() => onSelectTheme(tPreset.id)}
                leftSection={
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: tPreset.accent,
                      border: '1px solid rgba(255,255,255,0.3)'
                    }}
                  />
                }
              >
                {tPreset.name}
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
                <Text size="xs" fw={700}>{t('settings.accentSection')}</Text>
                <Text size="xs" c="dimmed">{t('settings.accentPlaceholder')}</Text>
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
                {t('settings.accentReset')}
              </Button>
            </Group>
          </Group>
        </Paper>

        <Divider />

        {/* Engine & Binaries Status */}
        <div>
          <Group gap="xs" mb="xs">
            <Cpu size={16} color="#ff2a85" />
            <Text size="sm" fw={700}>{t('settings.diagnosticsSection')}</Text>
          </Group>

          {binaryStatus ? (
            <>
              <Stack gap="xs">
                <Paper p="xs" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <Group justify="space-between">
                    <Text size="xs" fw={600}>yt-dlp</Text>
                    <Badge size="xs" color={binaryStatus.ytdlp.found ? 'teal' : 'red'}>
                      {binaryStatus.ytdlp.found ? t('settings.detected') : 'Ausente'}
                    </Badge>
                  </Group>
                  {binaryStatus.ytdlp.path && (
                    <Code block mt={4} style={{ fontSize: 10 }}>{binaryStatus.ytdlp.path}</Code>
                  )}
                </Paper>

                <Paper p="xs" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <Group justify="space-between">
                    <Text size="xs" fw={600}>ffmpeg & ffprobe</Text>
                    <Badge size="xs" color={binaryStatus.ffmpeg.found ? 'teal' : 'yellow'}>
                      {binaryStatus.ffmpeg.found ? t('settings.detected') : t('settings.optional')}
                    </Badge>
                  </Group>
                  {binaryStatus.ffmpeg.path && (
                    <Code block mt={4} style={{ fontSize: 10 }}>{binaryStatus.ffmpeg.path}</Code>
                  )}
                </Paper>

                <Paper p="xs" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <Group justify="space-between">
                    <Text size="xs" fw={600}>{t('settings.denoTitle')}</Text>
                    <Badge size="xs" color={binaryStatus.deno.found ? 'teal' : 'gray'}>
                      {binaryStatus.deno.found ? t('settings.detected') : t('settings.optional')}
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
                {t('settings.reinstallEngines')}
              </Button>
            </>
          ) : (
            <Text size="xs" c="dimmed">Cargando...</Text>
          )}
        </div>

        <Divider />

        {/* Custom Category Management */}
        <div>
          <Group gap="xs" mb="xs">
            <FolderPlus size={16} color="#ff2a85" />
            <Text size="sm" fw={700}>{t('settings.categoriesSection')}</Text>
          </Group>
          <Group gap="xs">
            <TextInput
              placeholder={t('settings.newCategory')}
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
              {t('settings.addCategory')}
            </Button>
          </Group>
        </div>
      </Stack>
    </Modal>
  );
};
