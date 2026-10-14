import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  Badge,
  Button,
  Paper,
  ScrollArea,
  SimpleGrid,
  Select,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import {
  Play,
  Bookmark,
  Subtitles,
  Maximize,
  FolderOpen,
  ExternalLink,
  AlertCircle,
  X
} from 'lucide-react';
import { DownloadItem, PointOfInterest, SubtitleTrack } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { useMediaQuery } from '@mantine/hooks';
import { getVortexApi, isMobileNative } from '../api';

interface VideoPlayerModalProps {
  item: DownloadItem | null;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ item, onClose }) => {
  const { t } = useLanguage();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const isMobile = isSmallScreen || isMobileNative;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [chapters, setChapters] = useState<PointOfInterest[]>([]);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [playbackRate, setPlaybackRate] = useState<string>('1');
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setHasError(false);
    if (item) {
      const api = getVortexApi();
      if (api) {
        if (api.getPointsOfInterest) api.getPointsOfInterest(item.id).then(setChapters).catch(() => {});
        if (api.getSubtitles) api.getSubtitles(item.id).then(setSubtitles).catch(() => {});
      }
    } else {
      setChapters([]);
      setSubtitles([]);
    }
  }, [item?.id, item?.filepath]);

  if (!item) return null;

  const isMkv = !!(item.filepath?.toLowerCase().endsWith('.mkv') || item.format?.toLowerCase() === 'mkv');

  const handleSeek = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.play();
    }
  };

  const handleRateChange = (rate: string | null) => {
    if (rate && videoRef.current) {
      setPlaybackRate(rate);
      videoRef.current.playbackRate = parseFloat(rate);
    }
  };

  const handleOpenSystemPlayer = () => {
    if (item.filepath) {
      const api = getVortexApi();
      api?.openFile?.(item.filepath);
    }
  };

  const handleOpenFolder = () => {
    if (item.filepath) {
      const api = getVortexApi();
      api?.openFolder?.(item.filepath);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Safe HTTP 206 streamable URL through internal streaming server
  const videoSrc = item.id
    ? `http://127.0.0.1:6767/api/stream/${encodeURIComponent(item.id)}`
    : item.filepath
    ? `http://127.0.0.1:6767/api/stream-file?path=${encodeURIComponent(item.filepath)}`
    : '';

  return (
    <Modal
      opened={!!item}
      onClose={onClose}
      fullScreen={isMobile}
      title={
        <Group justify="space-between" align="center" style={{ width: '100%' }} pr="md">
          <Group gap="xs" align="center" style={{ flex: 1, minWidth: 0 }}>
            <Play size={18} color="#ff2a85" strokeWidth={2.5} />
            <Text fw={700} lineClamp={1}>{item.title}</Text>
          </Group>
          <Group gap="xs" align="center">
            {!isMobile ? (
              <Button
                size="xs"
                variant="light"
                color="pink"
                leftSection={<ExternalLink size={14} />}
                onClick={handleOpenSystemPlayer}
              >
                Abrir con Reproductor del Sistema
              </Button>
            ) : (
              <ActionIcon
                size="md"
                variant="light"
                color="pink"
                onClick={handleOpenSystemPlayer}
                title="Reproductor externo"
              >
                <ExternalLink size={16} />
              </ActionIcon>
            )}
            {!isMobile && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                title="Mostrar en carpeta"
                onClick={handleOpenFolder}
              >
                <FolderOpen size={16} />
              </ActionIcon>
            )}
          </Group>
        </Group>
      }
      size="xl"
      radius={isMobile ? 0 : 'lg'}
      styles={{ body: { padding: isMobile ? 8 : 16 } }}
    >
      <Stack gap="md">
        {(hasError || isMkv) && (
          <Paper p="sm" radius="md" style={{ background: 'rgba(255, 42, 133, 0.1)', border: '1px solid rgba(255, 42, 133, 0.3)' }}>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <AlertCircle size={20} color="#ff2a85" />
                <div>
                  <Text size="sm" fw={600} c="white">
                    {isMkv ? 'Formato Matroska (.mkv) detectado' : 'Aviso de compatibilidad de códec'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {isMkv
                      ? 'Los contenedores MKV se reproducen con aceleración completa y pistas múltiples en tu reproductor de Windows (VLC / Media Player).'
                      : 'Chromium no pudo decodificar este flujo de video. Puedes abrirlo instantáneamente con tu reproductor de escritorio.'}
                  </Text>
                </div>
              </Group>
              <Button
                size="xs"
                color="pink"
                leftSection={<ExternalLink size={14} />}
                onClick={handleOpenSystemPlayer}
              >
                Abrir en Reproductor de Windows
              </Button>
            </Group>
          </Paper>
        )}

        <SimpleGrid cols={{ base: 1, md: chapters.length > 0 ? 3 : 1 }} spacing="md">
          {/* Main Video View */}
          <div style={{ gridColumn: chapters.length > 0 ? 'span 2' : 'span 1' }}>
            <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
              <video
                ref={videoRef}
                src={videoSrc}
                poster={item.thumbnail_url || undefined}
                controls
                autoPlay
                onError={() => setHasError(true)}
                style={{ width: '100%', maxHeight: '60vh', display: 'block' }}
              >
                {subtitles.map(sub => (
                  <track
                    key={sub.id}
                    kind="subtitles"
                    src={sub.filepath ? `http://127.0.0.1:6767/api/stream-file?path=${encodeURIComponent(sub.filepath)}` : ''}
                    srcLang={sub.lang}
                    label={sub.lang.toUpperCase()}
                  />
                ))}
              </video>
            </div>

            <Group justify="space-between" mt="sm">
              <Group gap="xs">
                <Badge color="pink" variant="light">{item.format.toUpperCase()}</Badge>
                {item.resolution && <Badge color="gray">{item.resolution}</Badge>}
              </Group>

              <Group gap="xs" align="center">
                <Text size="xs" c="dimmed">{t('player.speed')}:</Text>
                <Select
                  size="xs"
                  value={playbackRate}
                  onChange={handleRateChange}
                  data={[
                    { value: '0.75', label: '0.75x' },
                    { value: '1', label: '1.0x' },
                    { value: '1.25', label: '1.25x' },
                    { value: '1.5', label: '1.5x' },
                    { value: '2', label: '2.0x' },
                  ]}
                  style={{ width: 100 }}
                />
              </Group>
            </Group>
          </div>

          {/* Chapters / Points of Interest Sidebar */}
          {chapters.length > 0 && (
            <Paper p="sm" radius="md" style={{ background: 'rgba(255,255,255,0.03)', height: '100%', maxHeight: '60vh' }}>
              <Group gap="xs" mb="xs">
                <Bookmark size={16} color="#ff2a85" />
                <Text size="sm" fw={700}>Capítulos ({chapters.length})</Text>
              </Group>

              <ScrollArea h="52vh">
                <Stack gap={6}>
                  {chapters.map((ch, idx) => (
                    <Button
                      key={idx}
                      variant="subtle"
                      color="gray"
                      size="xs"
                      justify="space-between"
                      fullWidth
                      onClick={() => handleSeek(ch.timestamp)}
                    >
                      <Text size="xs" lineClamp={1} style={{ flex: 1, textAlign: 'left' }}>
                        {ch.title}
                      </Text>
                      <Badge size="xs" color="pink" variant="light">
                        {formatTime(ch.timestamp)}
                      </Badge>
                    </Button>
                  ))}
                </Stack>
              </ScrollArea>
            </Paper>
          )}
        </SimpleGrid>
      </Stack>
    </Modal>
  );
};
