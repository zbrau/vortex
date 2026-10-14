import React, { useState, useEffect } from 'react';
import {
  Paper,
  TextInput,
  Textarea,
  Button,
  Group,
  Stack,
  Text,
  Select,
  Switch,
  SimpleGrid,
  Card,
  Image,
  Badge,
  ActionIcon,
  Tooltip,
  SegmentedControl,
  Divider,
  Box
} from '@mantine/core';
import {
  Search,
  Download,
  ClipboardCopy,
  ShieldCheck,
  Cookie,
  Image as ImageIcon,
  Subtitles,
  Video,
  Music,
  Sparkles,
  Layers,
  Zap,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { DownloadOptions, VideoMetadata, Category } from '../types';

interface DownloadBarProps {
  onStartDownload: (options: DownloadOptions) => void;
  categories: Category[];
  isDownloading: boolean;
}

export const DownloadBar: React.FC<DownloadBarProps> = ({
  onStartDownload,
  categories,
  isDownloading
}) => {
  const [url, setUrl] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState('');

  // Media Type: Video vs Solo Audio
  const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
  
  // Video Options
  const [videoContainer, setVideoContainer] = useState<'mp4' | 'mkv' | 'webm'>('mp4');
  const [videoResolution, setVideoResolution] = useState<'best' | '4k' | '1440p' | '1080p' | '720p' | '480p'>('best');
  
  // Audio Options
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'm4a' | 'flac' | 'wav' | 'opus'>('mp3');

  const [enableSponsorblock, setEnableSponsorblock] = useState(true);
  const [browserCookies, setBrowserCookies] = useState<any>('none');
  const [embedThumbnail, setEmbedThumbnail] = useState(true);
  const [embedSubtitles, setEmbedSubtitles] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);

  // Auto-detect platform from URL
  useEffect(() => {
    const raw = url.toLowerCase();
    if (raw.includes('youtube.com') || raw.includes('youtu.be')) setDetectedPlatform('YouTube');
    else if (raw.includes('tiktok.com')) setDetectedPlatform('TikTok');
    else if (raw.includes('twitter.com') || raw.includes('x.com')) setDetectedPlatform('X / Twitter');
    else if (raw.includes('instagram.com')) setDetectedPlatform('Instagram');
    else if (raw.includes('soundcloud.com')) {
      setDetectedPlatform('SoundCloud');
      // Auto-switch to audio for SoundCloud
      setMediaType('audio');
    }
    else if (raw.includes('twitch.tv')) setDetectedPlatform('Twitch');
    else if (raw.includes('reddit.com')) setDetectedPlatform('Reddit');
    else if (raw.includes('facebook.com') || raw.includes('fb.watch')) setDetectedPlatform('Facebook');
    else if (raw.startsWith('http')) setDetectedPlatform('Web Universal');
    else setDetectedPlatform(null);
  }, [url]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (batchMode) {
          setBatchUrls(prev => (prev ? `${prev}\n${text}` : text));
        } else {
          setUrl(text);
          inspectUrl(text);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const inspectUrl = async (targetUrl: string) => {
    if (!targetUrl.startsWith('http')) return;
    setLoadingMeta(true);
    try {
      // @ts-ignore
      const meta = await window.smasherAPI.fetchMetadata(targetUrl);
      setMetadata(meta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleSubmit = () => {
    if (batchMode) {
      const lines = batchUrls.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
      if (lines.length === 0) return;
      lines.forEach(targetUrl => {
        onStartDownload({
          url: targetUrl,
          formatPreset: mediaType === 'video' ? videoContainer : audioFormat,
          mediaType,
          videoResolution,
          videoContainer,
          audioFormat,
          enableSponsorblock,
          browserCookies,
          embedThumbnail,
          embedSubtitles,
          categoryId: categoryId ? parseInt(categoryId) : undefined
        });
      });
      setBatchUrls('');
    } else {
      if (!url.trim()) return;
      onStartDownload({
        url: url.trim(),
        formatPreset: mediaType === 'video' ? videoContainer : audioFormat,
        mediaType,
        videoResolution,
        videoContainer,
        audioFormat,
        enableSponsorblock,
        browserCookies,
        embedThumbnail,
        embedSubtitles,
        categoryId: categoryId ? parseInt(categoryId) : undefined
      });
      setUrl('');
      setMetadata(null);
    }
  };

  const applySmartPreset = (type: 'mp4-1080p' | 'mp3-320k' | 'fast-720p' | 'flac-hires') => {
    if (type === 'mp4-1080p') {
      setMediaType('video');
      setVideoContainer('mp4');
      setVideoResolution('1080p');
    } else if (type === 'mp3-320k') {
      setMediaType('audio');
      setAudioFormat('mp3');
    } else if (type === 'fast-720p') {
      setMediaType('video');
      setVideoContainer('mp4');
      setVideoResolution('720p');
    } else if (type === 'flac-hires') {
      setMediaType('audio');
      setAudioFormat('flac');
    }
  };

  return (
    <Stack gap="md">
      <Paper
        p="lg"
        radius="lg"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <Stack gap="md">
          {/* Header Row: Mode Switch & Smart Presets */}
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs">
              <Button
                size="xs"
                radius="md"
                variant={!batchMode ? 'filled' : 'subtle'}
                color={!batchMode ? 'pink' : 'gray'}
                onClick={() => setBatchMode(false)}
              >
                Descarga Individual
              </Button>
              <Button
                size="xs"
                radius="md"
                variant={batchMode ? 'filled' : 'subtle'}
                color={batchMode ? 'pink' : 'gray'}
                leftSection={<Layers size={14} />}
                onClick={() => setBatchMode(true)}
              >
                Modo Lote (Múltiples Enlaces)
              </Button>
            </Group>

            {/* Smart 1-Click Profile Presets */}
            <Group gap={6}>
              <Text size="xs" c="dimmed">Perfiles Rápidos:</Text>
              <Button size="xs" variant="subtle" color="gray" radius="md" onClick={() => applySmartPreset('mp4-1080p')}>
                1080p MP4
              </Button>
              <Button size="xs" variant="subtle" color="gray" radius="md" onClick={() => applySmartPreset('mp3-320k')}>
                MP3 320k
              </Button>
              <Button size="xs" variant="subtle" color="gray" radius="md" onClick={() => applySmartPreset('fast-720p')}>
                Rápido 720p
              </Button>
              <Button size="xs" variant="subtle" color="gray" radius="md" onClick={() => applySmartPreset('flac-hires')}>
                FLAC Hi-Res
              </Button>
            </Group>
          </Group>

          {/* Input Area */}
          {!batchMode ? (
            <Group gap="xs" align="flex-end">
              <TextInput
                placeholder="Pega aquí el enlace de YouTube, TikTok, Twitter/X, SoundCloud..."
                leftSection={
                  detectedPlatform ? (
                    <Badge size="xs" variant="filled" color="pink" style={{ textTransform: 'none' }}>
                      {detectedPlatform}
                    </Badge>
                  ) : (
                    <Search size={18} />
                  )
                }
                value={url}
                onChange={e => {
                  setUrl(e.target.value);
                  if (e.target.value.includes('http') && !metadata) {
                    inspectUrl(e.target.value);
                  }
                }}
                style={{ flex: 1 }}
                size="md"
                radius="md"
                rightSection={
                  <Tooltip label="Pegar del portapapeles">
                    <ActionIcon variant="subtle" onClick={handlePaste} color="gray">
                      <ClipboardCopy size={18} />
                    </ActionIcon>
                  </Tooltip>
                }
              />

              <Button
                size="md"
                radius="md"
                color="pink"
                leftSection={<Download size={18} strokeWidth={2.2} />}
                onClick={handleSubmit}
                disabled={!url.trim()}
                loading={isDownloading}
              >
                Descargar {mediaType === 'video' ? `Video (${videoContainer.toUpperCase()})` : `Audio (${audioFormat.toUpperCase()})`}
              </Button>
            </Group>
          ) : (
            <Stack gap="xs">
              <Textarea
                placeholder="Pega múltiples enlaces aquí (uno por línea):&#10;https://youtube.com/watch?v=...&#10;https://soundcloud.com/..."
                minRows={3}
                maxRows={6}
                value={batchUrls}
                onChange={e => setBatchUrls(e.target.value)}
                radius="md"
                styles={{ input: { background: 'rgba(255,255,255,0.04)', color: '#fff' } }}
              />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {batchUrls.split('\n').filter(l => l.trim().startsWith('http')).length} enlaces detectados para descargar
                </Text>
                <Group gap="xs">
                  <Button size="xs" variant="subtle" color="gray" onClick={handlePaste}>
                    Pegar del portapapeles
                  </Button>
                  <Button
                    size="sm"
                    color="pink"
                    radius="md"
                    leftSection={<Download size={16} />}
                    onClick={handleSubmit}
                    disabled={!batchUrls.trim()}
                    loading={isDownloading}
                  >
                    Iniciar Descarga en Cola
                  </Button>
                </Group>
              </Group>
            </Stack>
          )}

          {/* Quick Metadata Preview Card */}
          {loadingMeta && (
            <Text size="sm" c="dimmed">
              Consultando detalles y capítulos del video...
            </Text>
          )}

          {metadata && !batchMode && (
            <Card p="sm" radius="md" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <Group gap="md">
                {metadata.thumbnail && (
                  <Image src={metadata.thumbnail} w={120} h={68} radius="sm" fit="cover" />
                )}
                <div style={{ flex: 1 }}>
                  <Text fw={600} size="sm" lineClamp={1}>
                    {metadata.title}
                  </Text>
                  <Group gap="xs" mt={4}>
                    <Badge size="xs" color="gray">{metadata.uploader}</Badge>
                    <Badge size="xs" color="dark">{Math.round(metadata.duration / 60)} min</Badge>
                    {metadata.chapters && metadata.chapters.length > 0 && (
                      <Badge size="xs" color="pink" variant="light">
                        {metadata.chapters.length} Capítulos
                      </Badge>
                    )}
                  </Group>
                </div>
              </Group>
            </Card>
          )}

          {/* Mode Selector: Video vs Audio */}
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <div>
              <Text size="xs" fw={700} c="dimmed" mb={6} tt="uppercase" style={{ letterSpacing: '0.8px' }}>
                Tipo de Descarga
              </Text>
              <SegmentedControl
                value={mediaType}
                onChange={val => setMediaType(val as 'video' | 'audio')}
                color="pink"
                size="sm"
                radius="md"
                data={[
                  {
                    value: 'video',
                    label: (
                      <Group gap={8} wrap="nowrap" align="center" px={6}>
                        <Video size={16} strokeWidth={2} />
                        <span style={{ fontWeight: 600 }}>Video Completo</span>
                      </Group>
                    )
                  },
                  {
                    value: 'audio',
                    label: (
                      <Group gap={8} wrap="nowrap" align="center" px={6}>
                        <Music size={16} strokeWidth={2} />
                        <span style={{ fontWeight: 600 }}>Solo Audio</span>
                      </Group>
                    )
                  }
                ]}
              />
            </div>

            {/* Video Container Choice */}
            {mediaType === 'video' && (
              <div>
                <Text size="xs" fw={700} c="dimmed" mb={6} tt="uppercase" style={{ letterSpacing: '0.8px' }}>
                  Contenedor de Video
                </Text>
                <Group gap="xs" wrap="nowrap">
                  {[
                    { id: 'mp4', label: 'MP4 (Universal)' },
                    { id: 'mkv', label: 'MKV' },
                    { id: 'webm', label: 'WebM' }
                  ].map(c => (
                    <Button
                      key={c.id}
                      variant={videoContainer === c.id ? 'filled' : 'light'}
                      color={videoContainer === c.id ? 'pink' : 'gray'}
                      size="xs"
                      radius="md"
                      onClick={() => setVideoContainer(c.id as any)}
                    >
                      {c.label}
                    </Button>
                  ))}
                </Group>
              </div>
            )}
          </Group>

          <Divider style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

          {/* Detailed Quality / Format Selection */}
          {mediaType === 'video' ? (
            <div>
              <Text size="xs" fw={700} c="dimmed" mb={6} tt="uppercase" style={{ letterSpacing: '0.8px' }}>
                Resolución ({videoContainer.toUpperCase()})
              </Text>
              <Group gap="xs" wrap="wrap">
                {[
                  { id: 'best', label: 'Mejor Calidad Original', icon: true },
                  { id: '4k', label: '4K (2160p)' },
                  { id: '1440p', label: '2K (1440p)' },
                  { id: '1080p', label: '1080p FHD' },
                  { id: '720p', label: '720p HD' },
                  { id: '480p', label: '480p SD' }
                ].map(r => (
                  <Button
                    key={r.id}
                    variant={videoResolution === r.id ? 'filled' : 'subtle'}
                    color={videoResolution === r.id ? 'pink' : 'gray'}
                    size="xs"
                    radius="md"
                    leftSection={r.icon ? <Sparkles size={13} strokeWidth={2} /> : undefined}
                    onClick={() => setVideoResolution(r.id as any)}
                  >
                    {r.label}
                  </Button>
                ))}
              </Group>
            </div>
          ) : (
            <div>
              <Text size="xs" fw={700} c="dimmed" mb={6} tt="uppercase" style={{ letterSpacing: '0.8px' }}>
                Formato de Audio
              </Text>
              <Group gap="xs" wrap="wrap">
                {[
                  { id: 'mp3', label: 'MP3 320k (Universal)', icon: true },
                  { id: 'm4a', label: 'M4A / AAC (Universal)' },
                  { id: 'flac', label: 'FLAC (Sin Pérdida)' },
                  { id: 'wav', label: 'WAV (Estudio PCM)' },
                  { id: 'opus', label: 'Opus (Alta Fidelidad)' }
                ].map(a => (
                  <Button
                    key={a.id}
                    variant={audioFormat === a.id ? 'filled' : 'light'}
                    color={audioFormat === a.id ? 'pink' : 'gray'}
                    size="xs"
                    radius="md"
                    leftSection={a.icon ? <Sparkles size={13} strokeWidth={2} /> : undefined}
                    onClick={() => setAudioFormat(a.id as any)}
                  >
                    {a.label}
                  </Button>
                ))}
              </Group>
            </div>
          )}

          {/* Advanced Switches & Options */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" pt="xs">
            <Switch
              label="SponsorBlock"
              description="Saltar intros, sponsors y promos"
              checked={enableSponsorblock}
              onChange={e => setEnableSponsorblock(e.currentTarget.checked)}
              color="pink"
              size="sm"
              thumbIcon={<ShieldCheck size={12} />}
            />

            <Switch
              label="Incrustar Miniatura"
              description="Guardar carátula en el archivo"
              checked={embedThumbnail}
              onChange={e => setEmbedThumbnail(e.currentTarget.checked)}
              color="pink"
              size="sm"
              thumbIcon={<ImageIcon size={12} />}
            />

            <Switch
              label="Incrustar Subtítulos"
              description="Descargar pistas de subtítulos"
              checked={embedSubtitles}
              onChange={e => setEmbedSubtitles(e.currentTarget.checked)}
              color="pink"
              size="sm"
              thumbIcon={<Subtitles size={12} />}
            />

            <Select
              label="Cookies del Navegador"
              size="xs"
              value={browserCookies}
              onChange={v => setBrowserCookies(v || 'none')}
              data={[
                { value: 'none', label: 'Ninguno' },
                { value: 'brave', label: 'Brave Browser' },
                { value: 'chrome', label: 'Google Chrome' },
                { value: 'firefox', label: 'Mozilla Firefox' },
                { value: 'edge', label: 'Microsoft Edge' },
              ]}
              leftSection={<Cookie size={14} />}
            />
          </SimpleGrid>
        </Stack>
      </Paper>
    </Stack>
  );
};
