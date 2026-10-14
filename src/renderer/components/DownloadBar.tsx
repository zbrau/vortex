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
import { useLanguage } from '../i18n/LanguageContext';
import { useMediaQuery } from '@mantine/hooks';
import { getVortexApi, isMobileNative } from '../api';

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
  const { t } = useLanguage();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const isMobile = isSmallScreen || isMobileNative;

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
      const api = getVortexApi();
      if (api?.fetchMetadata) {
        const meta = await api.fetchMetadata(targetUrl);
        setMetadata(meta);
      }
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
          <Stack gap="xs">
            <Group justify="space-between" align="center" wrap="nowrap">
              <SegmentedControl
                size="xs"
                radius="md"
                value={batchMode ? 'batch' : 'single'}
                onChange={val => setBatchMode(val === 'batch')}
                data={[
                  { value: 'single', label: t('download.singleUrl') },
                  {
                    value: 'batch',
                    label: (
                      <Group gap={6} wrap="nowrap" align="center">
                        <Layers size={13} />
                        <span>{t('download.batchMode')}</span>
                      </Group>
                    )
                  }
                ]}
              />

              {!isMobile && (
                <Text size="xs" c="dimmed" fw={600}>
                  Perfiles Rápidos
                </Text>
              )}
            </Group>

            {/* Smart 1-Click Profile Presets - Horizontal scrollable pills */}
            <Box
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: 4,
                msOverflowStyle: 'none',
                scrollbarWidth: 'none'
              }}
            >
              {[
                { id: 'mp4-1080p', label: '1080p MP4' },
                { id: 'mp3-320k', label: 'MP3 320k' },
                { id: 'fast-720p', label: '720p HD' },
                { id: 'flac-hires', label: 'FLAC Hi-Res' }
              ].map(p => (
                <Button
                  key={p.id}
                  size="xs"
                  variant="subtle"
                  color="gray"
                  radius="xl"
                  leftSection={<Sparkles size={12} color="#ff2a85" />}
                  style={{
                    flexShrink: 0,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    fontWeight: 600,
                    paddingLeft: 12,
                    paddingRight: 12
                  }}
                  onClick={() => applySmartPreset(p.id as any)}
                >
                  {p.label}
                </Button>
              ))}
            </Box>
          </Stack>

          {/* Input Area */}
          {!batchMode ? (
            isMobile ? (
              <Stack gap="xs">
                <TextInput
                  placeholder={t('download.inputPlaceholder')}
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
                  size="md"
                  radius="md"
                  rightSection={
                    <Tooltip label={t('download.paste')}>
                      <ActionIcon variant="subtle" onClick={handlePaste} color="pink" size="md">
                        <ClipboardCopy size={18} />
                      </ActionIcon>
                    </Tooltip>
                  }
                />

                <Button
                  size="lg"
                  radius="md"
                  color="pink"
                  fullWidth
                  leftSection={<Download size={20} strokeWidth={2.3} />}
                  onClick={handleSubmit}
                  disabled={!url.trim()}
                  loading={isDownloading}
                  style={{
                    height: 48,
                    fontWeight: 700,
                    letterSpacing: '0.4px',
                    boxShadow: url.trim() ? '0 4px 18px rgba(255, 42, 133, 0.35)' : 'none'
                  }}
                >
                  {t('download.start')} {mediaType === 'video' ? `(${videoContainer.toUpperCase()})` : `(${audioFormat.toUpperCase()})`}
                </Button>
              </Stack>
            ) : (
              <Group gap="xs" align="flex-end">
                <TextInput
                  placeholder={t('download.inputPlaceholder')}
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
                    <Tooltip label={t('download.paste')}>
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
                  {t('download.start')} {mediaType === 'video' ? `(${videoContainer.toUpperCase()})` : `(${audioFormat.toUpperCase()})`}
                </Button>
              </Group>
            )
          ) : (
            <Stack gap="xs">
              <Textarea
                placeholder={t('download.batchPlaceholder')}
                minRows={3}
                maxRows={6}
                value={batchUrls}
                onChange={e => setBatchUrls(e.target.value)}
                radius="md"
                styles={{ input: { background: 'rgba(255,255,255,0.04)', color: '#fff' } }}
              />
              <Group justify="space-between" wrap={isMobile ? 'wrap' : 'nowrap'}>
                <Text size="xs" c="dimmed">
                  {t('download.batchCount', { count: batchUrls.split('\n').filter(l => l.trim().startsWith('http')).length })}
                </Text>
                <Group gap="xs" style={{ width: isMobile ? '100%' : 'auto' }}>
                  <Button size="xs" variant="subtle" color="gray" onClick={handlePaste} style={{ flex: isMobile ? 1 : undefined }}>
                    {t('download.paste')}
                  </Button>
                  <Button
                    size={isMobile ? 'md' : 'sm'}
                    color="pink"
                    radius="md"
                    leftSection={<Download size={16} />}
                    onClick={handleSubmit}
                    disabled={!batchUrls.trim()}
                    loading={isDownloading}
                    style={{ flex: isMobile ? 2 : undefined }}
                  >
                    {t('download.start')}
                  </Button>
                </Group>
              </Group>
            </Stack>
          )}

          {/* Quick Metadata Preview Card */}
          {loadingMeta && (
            <Text size="sm" c="dimmed">
              {t('download.fetchingMeta')}
            </Text>
          )}

          {metadata && !batchMode && (
            <Card p="sm" radius="md" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <Group gap="md">
                {metadata.thumbnail && (
                  <Image src={metadata.thumbnail} w={isMobile ? 90 : 120} h={isMobile ? 54 : 68} radius="sm" fit="cover" />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={600} size="sm" lineClamp={1}>
                    {metadata.title}
                  </Text>
                  <Group gap="xs" mt={4} wrap="nowrap">
                    <Badge size="xs" color="gray">{metadata.uploader}</Badge>
                    <Badge size="xs" color="dark">{Math.round(metadata.duration / 60)} min</Badge>
                    {metadata.chapters && metadata.chapters.length > 0 && (
                      <Badge size="xs" color="pink" variant="light">
                        {metadata.chapters.length} Caps
                      </Badge>
                    )}
                  </Group>
                </div>
              </Group>
            </Card>
          )}

          {/* Mode Selector: Video vs Audio */}
          <SimpleGrid cols={{ base: 1, sm: mediaType === 'video' ? 2 : 1 }} spacing="md">
            <div>
              <Text size="xs" fw={700} c="dimmed" mb={6} tt="uppercase" style={{ letterSpacing: '0.8px' }}>
                {t('download.format')}
              </Text>
              <SegmentedControl
                fullWidth
                value={mediaType}
                onChange={val => setMediaType(val as 'video' | 'audio')}
                color="pink"
                size="sm"
                radius="md"
                data={[
                  {
                    value: 'video',
                    label: (
                      <Group gap={8} justify="center" wrap="nowrap" align="center" py={2}>
                        <Video size={16} strokeWidth={2.2} />
                        <span style={{ fontWeight: 600 }}>{t('download.video')}</span>
                      </Group>
                    )
                  },
                  {
                    value: 'audio',
                    label: (
                      <Group gap={8} justify="center" wrap="nowrap" align="center" py={2}>
                        <Music size={16} strokeWidth={2.2} />
                        <span style={{ fontWeight: 600 }}>{t('download.audio')}</span>
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
                  Contenedor
                </Text>
                <SegmentedControl
                  fullWidth
                  value={videoContainer}
                  onChange={val => setVideoContainer(val as any)}
                  color="pink"
                  size="sm"
                  radius="md"
                  data={[
                    { value: 'mp4', label: 'MP4' },
                    { value: 'mkv', label: 'MKV' },
                    { value: 'webm', label: 'WebM' }
                  ]}
                />
              </div>
            )}
          </SimpleGrid>

          <Divider style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

          {/* Detailed Quality / Format Selection */}
          {mediaType === 'video' ? (
            <div>
              <Text size="xs" fw={700} c="dimmed" mb={6} tt="uppercase" style={{ letterSpacing: '0.8px' }}>
                {t('download.resolution')} ({videoContainer.toUpperCase()})
              </Text>
              <SimpleGrid cols={{ base: 3, sm: 6 }} spacing="xs">
                {[
                  { id: 'best', label: t('download.bestQuality'), icon: true },
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
                    style={{
                      background: videoResolution === r.id ? undefined : 'rgba(255,255,255,0.03)',
                      border: videoResolution === r.id ? undefined : '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    {r.label}
                  </Button>
                ))}
              </SimpleGrid>
            </div>
          ) : (
            <div>
              <Text size="xs" fw={700} c="dimmed" mb={6} tt="uppercase" style={{ letterSpacing: '0.8px' }}>
                {t('download.format')}
              </Text>
              <SimpleGrid cols={{ base: 3, sm: 5 }} spacing="xs">
                {[
                  { id: 'mp3', label: 'MP3 320k', icon: true },
                  { id: 'm4a', label: 'M4A / AAC' },
                  { id: 'flac', label: 'FLAC' },
                  { id: 'wav', label: 'WAV' },
                  { id: 'opus', label: 'Opus' }
                ].map(a => (
                  <Button
                    key={a.id}
                    variant={audioFormat === a.id ? 'filled' : 'subtle'}
                    color={audioFormat === a.id ? 'pink' : 'gray'}
                    size="xs"
                    radius="md"
                    leftSection={a.icon ? <Sparkles size={13} strokeWidth={2} /> : undefined}
                    onClick={() => setAudioFormat(a.id as any)}
                    style={{
                      background: audioFormat === a.id ? undefined : 'rgba(255,255,255,0.03)',
                      border: audioFormat === a.id ? undefined : '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    {a.label}
                  </Button>
                ))}
              </SimpleGrid>
            </div>
          )}

          {/* Advanced Switches & Options */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" pt="xs">
            <Switch
              label="SponsorBlock"
              description={t('download.sponsorblock')}
              checked={enableSponsorblock}
              onChange={e => setEnableSponsorblock(e.currentTarget.checked)}
              color="pink"
              size="sm"
              thumbIcon={<ShieldCheck size={12} />}
            />

            <Switch
              label={t('download.embedThumbnail')}
              checked={embedThumbnail}
              onChange={e => setEmbedThumbnail(e.currentTarget.checked)}
              color="pink"
              size="sm"
              thumbIcon={<ImageIcon size={12} />}
            />

            <Switch
              label={t('download.embedSubtitles')}
              checked={embedSubtitles}
              onChange={e => setEmbedSubtitles(e.currentTarget.checked)}
              color="pink"
              size="sm"
              thumbIcon={<Subtitles size={12} />}
            />

            {!isMobileNative && (
              <Select
                label={t('download.browserCookies')}
                size="xs"
                value={browserCookies}
                onChange={v => setBrowserCookies(v || 'none')}
                data={[
                  { value: 'none', label: t('download.cookiesNone') },
                  { value: 'brave', label: 'Brave' },
                  { value: 'chrome', label: 'Chrome' },
                  { value: 'firefox', label: 'Firefox' },
                  { value: 'edge', label: 'Edge' },
                ]}
                leftSection={<Cookie size={14} />}
              />
            )}
          </SimpleGrid>
        </Stack>
      </Paper>
    </Stack>
  );
};
