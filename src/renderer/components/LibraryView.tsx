import React, { useState } from 'react';
import {
  Stack,
  Group,
  TextInput,
  Paper,
  Text,
  Badge,
  ActionIcon,
  SimpleGrid,
  Card,
  Image,
  Button,
  Tooltip,
  Center,
  SegmentedControl,
  Select,
  Box
} from '@mantine/core';
import {
  Search,
  FolderOpen,
  Play,
  Trash2,
  Clock,
  FileText,
  Inbox,
  RotateCw,
  Video,
  Music,
  LayoutGrid,
  List,
  HardDrive,
  Film,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';
import { DownloadItem, Category } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { useMediaQuery } from '@mantine/hooks';
import { isMobileNative } from '../api';

interface LibraryViewProps {
  items: DownloadItem[];
  categories: Category[];
  onOpenFile: (filepath: string) => void;
  onOpenFolder: (filepath: string) => void;
  onDeleteItem: (id: string) => void;
  onPlayItem: (item: DownloadItem) => void;
  onRefetchMeta: (item: DownloadItem) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  items,
  categories,
  onOpenFile,
  onOpenFolder,
  onDeleteItem,
  onPlayItem,
  onRefetchMeta
}) => {
  const { t } = useLanguage();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const isMobile = isSmallScreen || isMobileNative;

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'audio'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<string>('newest');

  const isAudioItem = (format: string) => ['mp3', 'm4a', 'flac', 'wav', 'opus'].includes(format.toLowerCase());

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
                          item.url.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === null || item.category_id === selectedCategory;
    const isAudio = isAudioItem(item.format);
    const matchesType = typeFilter === 'all'
      ? true
      : typeFilter === 'audio' ? isAudio : !isAudio;

    return matchesSearch && matchesCat && matchesType;
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.download_date).getTime() - new Date(a.download_date).getTime();
    if (sortBy === 'oldest') return new Date(a.download_date).getTime() - new Date(b.download_date).getTime();
    if (sortBy === 'name') return a.title.localeCompare(b.title);
    if (sortBy === 'size') return (b.filesize || 0) - (a.filesize || 0);
    if (sortBy === 'duration') return (b.duration || 0) - (a.duration || 0);
    return 0;
  });

  const totalBytes = items.reduce((acc, curr) => acc + (curr.filesize || 0), 0);
  const videoCount = items.filter(i => !isAudioItem(i.format)).length;
  const audioCount = items.filter(i => isAudioItem(i.format)).length;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (secs: number) => {
    if (!secs || secs === 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Stack gap="md">
      {/* Overview Stats Bar */}
      <Paper
        p="sm"
        radius="lg"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="lg">
            <Group gap="xs">
              <Film size={18} color="#ff2a85" />
              <Text size="sm" fw={600}>
                {videoCount} <span style={{ opacity: 0.6 }}>{t('library.videos')}</span>
              </Text>
            </Group>

            <Group gap="xs">
              <Music size={18} color="#00f0ff" />
              <Text size="sm" fw={600}>
                {audioCount} <span style={{ opacity: 0.6 }}>{t('library.audios')}</span>
              </Text>
            </Group>

            <Group gap="xs">
              <HardDrive size={18} color="#10b981" />
              <Text size="sm" fw={600}>
                {formatBytes(totalBytes)} <span style={{ opacity: 0.6 }}>({t('library.totalStorage')})</span>
              </Text>
            </Group>
          </Group>

          <Group gap="xs">
            <Badge size="sm" variant="dot" color="teal">
              SQLite
            </Badge>
          </Group>
        </Group>
      </Paper>

      {/* Main Filter & Search Bar */}
      <Paper
        p={isMobile ? 'sm' : 'md'}
        radius="lg"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <Stack gap="sm">
          {isMobile ? (
            <Stack gap="xs">
              <TextInput
                placeholder={t('library.searchPlaceholder')}
                leftSection={<Search size={16} />}
                value={search}
                onChange={e => setSearch(e.target.value)}
                size="sm"
                radius="md"
              />

              <SegmentedControl
                fullWidth
                value={typeFilter}
                onChange={v => setTypeFilter(v as any)}
                size="xs"
                radius="md"
                data={[
                  { value: 'all', label: `${t('library.filterAll')} (${items.length})` },
                  { value: 'video', label: `${t('library.filterVideo')} (${videoCount})` },
                  { value: 'audio', label: `${t('library.filterAudio')} (${audioCount})` }
                ]}
              />

              <Group justify="space-between" align="center" wrap="nowrap">
                <Select
                  size="xs"
                  value={sortBy}
                  onChange={v => setSortBy(v || 'newest')}
                  leftSection={<ArrowUpDown size={14} />}
                  style={{ flex: 1 }}
                  radius="md"
                  data={[
                    { value: 'newest', label: t('library.sortNewest') },
                    { value: 'oldest', label: t('library.sortOldest') },
                    { value: 'name', label: t('library.sortName') },
                    { value: 'size', label: t('library.sortSize') },
                    { value: 'duration', label: t('library.sortDuration') },
                  ]}
                />

                <Group gap={4}>
                  <ActionIcon
                    variant={viewMode === 'grid' ? 'filled' : 'subtle'}
                    color={viewMode === 'grid' ? 'pink' : 'gray'}
                    size="md"
                    radius="md"
                    onClick={() => setViewMode('grid')}
                    title="Vista en Cuadrícula"
                  >
                    <LayoutGrid size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant={viewMode === 'list' ? 'filled' : 'subtle'}
                    color={viewMode === 'list' ? 'pink' : 'gray'}
                    size="md"
                    radius="md"
                    onClick={() => setViewMode('list')}
                    title="Vista en Lista Detallada"
                  >
                    <List size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Stack>
          ) : (
            <Group justify="space-between" align="center" wrap="wrap">
              <TextInput
                placeholder={t('library.searchPlaceholder')}
                leftSection={<Search size={16} />}
                value={search}
                onChange={e => setSearch(e.target.value)}
                size="sm"
                radius="md"
                style={{ flex: 1, minWidth: 240 }}
              />

              <SegmentedControl
                value={typeFilter}
                onChange={v => setTypeFilter(v as any)}
                size="xs"
                radius="md"
                data={[
                  { value: 'all', label: `${t('library.filterAll')} (${items.length})` },
                  { value: 'video', label: `${t('library.filterVideo')} (${videoCount})` },
                  { value: 'audio', label: `${t('library.filterAudio')} (${audioCount})` }
                ]}
              />

              <Select
                size="xs"
                value={sortBy}
                onChange={v => setSortBy(v || 'newest')}
                leftSection={<ArrowUpDown size={14} />}
                style={{ width: 170 }}
                radius="md"
                data={[
                  { value: 'newest', label: t('library.sortNewest') },
                  { value: 'oldest', label: t('library.sortOldest') },
                  { value: 'name', label: t('library.sortName') },
                  { value: 'size', label: t('library.sortSize') },
                  { value: 'duration', label: t('library.sortDuration') },
                ]}
              />

              <Group gap={4}>
                <ActionIcon
                  variant={viewMode === 'grid' ? 'filled' : 'subtle'}
                  color={viewMode === 'grid' ? 'pink' : 'gray'}
                  size="md"
                  radius="md"
                  onClick={() => setViewMode('grid')}
                  title="Vista en Cuadrícula"
                >
                  <LayoutGrid size={16} />
                </ActionIcon>
                <ActionIcon
                  variant={viewMode === 'list' ? 'filled' : 'subtle'}
                  color={viewMode === 'list' ? 'pink' : 'gray'}
                  size="md"
                  radius="md"
                  onClick={() => setViewMode('list')}
                  title="Vista en Lista Detallada"
                >
                  <List size={16} />
                </ActionIcon>
              </Group>
            </Group>
          )}

          {/* Category Filter Pills */}
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
            <Button
              size="xs"
              variant={selectedCategory === null ? 'filled' : 'subtle'}
              color="gray"
              radius="xl"
              style={{ flexShrink: 0 }}
              onClick={() => setSelectedCategory(null)}
            >
              Todas
            </Button>
            {categories.map(cat => (
              <Button
                key={cat.id}
                size="xs"
                variant={selectedCategory === cat.id ? 'filled' : 'subtle'}
                color="pink"
                radius="xl"
                style={{ flexShrink: 0 }}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </Box>
        </Stack>
      </Paper>

      {/* Content Rendering: Empty State vs Grid vs List */}
      {sortedItems.length === 0 ? (
        <Center py={60}>
          <Stack align="center" gap="xs">
            <Inbox size={48} strokeWidth={1.5} color="rgba(255,255,255,0.2)" />
            <Text fw={600} size="sm">
              {t('library.emptyTitle')}
            </Text>
            <Text c="dimmed" size="xs">
              {t('library.emptySubtitle')}
            </Text>
          </Stack>
        </Center>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
          {sortedItems.map(item => {
            const isAudio = isAudioItem(item.format);
            return (
              <Card
                key={item.id}
                p="sm"
                radius="lg"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative'
                }}
              >
                <div>
                  <Box
                    style={{
                      position: 'relative',
                      borderRadius: 8,
                      overflow: 'hidden',
                      height: 140,
                      background: '#0d0d12',
                      cursor: 'pointer'
                    }}
                    onClick={() => onPlayItem(item)}
                  >
                    {item.thumbnail_url ? (
                      <Image
                        src={item.thumbnail_url}
                        height={140}
                        fit="cover"
                        onError={(e: any) => {
                          if (e?.currentTarget) e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Center h={140}>
                        {isAudio ? <Music size={40} color="rgba(255,42,133,0.4)" /> : <Film size={40} color="rgba(0,240,255,0.4)" />}
                      </Center>
                    )}

                    {/* Quick play overlay icon on hover */}
                    <Box
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                      }}
                      className="hover-play-overlay"
                    >
                      <ActionIcon size="lg" radius="xl" color="pink" variant="filled">
                        <Play size={18} fill="#fff" />
                      </ActionIcon>
                    </Box>

                    {item.duration > 0 && (
                      <Badge
                        size="xs"
                        color="dark"
                        style={{ position: 'absolute', bottom: 6, right: 6, opacity: 0.9 }}
                      >
                        {formatTime(item.duration)}
                      </Badge>
                    )}
                  </Box>

                  <Text fw={600} size="sm" mt="xs" lineClamp={2} title={item.title}>
                    {item.title}
                  </Text>

                  <Group gap={6} mt="xs">
                    <Badge size="xs" color="pink" variant="light">
                      {item.format.toUpperCase()}
                    </Badge>
                    {item.filesize > 0 && (
                      <Badge size="xs" color="gray" variant="light">
                        {formatBytes(item.filesize)}
                      </Badge>
                    )}
                    <Badge
                      size="xs"
                      color={item.status === 'completed' ? 'teal' : item.status === 'error' ? 'red' : 'yellow'}
                    >
                      {item.status}
                    </Badge>
                  </Group>
                </div>

                <Group justify="space-between" mt="md" pt="xs" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <Group gap="xs">
                    <Tooltip label={t('library.play')}>
                      <ActionIcon
                        variant="filled"
                        color="pink"
                        size="sm"
                        radius="md"
                        onClick={() => onPlayItem(item)}
                      >
                        <Play size={14} fill="#fff" />
                      </ActionIcon>
                    </Tooltip>

                    <Tooltip label={t('library.play')}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        radius="md"
                        onClick={() => onOpenFile(item.filepath)}
                        disabled={!item.filepath}
                      >
                        <Film size={14} />
                      </ActionIcon>
                    </Tooltip>

                    <Tooltip label={t('library.openFolder')}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        radius="md"
                        onClick={() => onOpenFolder(item.filepath)}
                        disabled={!item.filepath}
                      >
                        <FolderOpen size={14} />
                      </ActionIcon>
                    </Tooltip>

                    <Tooltip label="Metadatos">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        radius="md"
                        onClick={() => onRefetchMeta(item)}
                      >
                        <RotateCw size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>

                  <Tooltip label={t('library.delete')}>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      radius="md"
                      onClick={() => onDeleteItem(item.id)}
                    >
                      <Trash2 size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Card>
            );
          })}
        </SimpleGrid>
      ) : (
        /* LIST VIEW */
        <Stack gap={6}>
          {sortedItems.map(item => {
            const isAudio = isAudioItem(item.format);
            return (
              <Paper
                key={item.id}
                p="xs"
                radius="md"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'background 0.15s ease'
                }}
              >
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                    <Box
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 6,
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: '#111'
                      }}
                    >
                      {item.thumbnail_url ? (
                        <Image src={item.thumbnail_url} width={44} height={44} fit="cover" />
                      ) : (
                        <Center h={44}>
                          {isAudio ? <Music size={18} color="#ff2a85" /> : <Film size={18} color="#00f0ff" />}
                        </Center>
                      )}
                    </Box>

                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={600} size="sm" lineClamp={1}>
                        {item.title}
                      </Text>
                      <Group gap={8} mt={2}>
                        <Badge size="xs" color="pink" variant="light">{item.format.toUpperCase()}</Badge>
                        {item.resolution && <Badge size="xs" color="gray" variant="light">{item.resolution}</Badge>}
                        <Text size="xs" c="dimmed">{formatBytes(item.filesize)}</Text>
                        {item.duration > 0 && <Text size="xs" c="dimmed">• {formatTime(item.duration)}</Text>}
                      </Group>
                    </Box>
                  </Group>

                  <Group gap="xs" wrap="nowrap">
                    <Tooltip label="Reproducir">
                      <ActionIcon variant="filled" color="pink" size="sm" radius="md" onClick={() => onPlayItem(item)}>
                        <Play size={13} fill="#fff" />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Abrir en carpeta">
                      <ActionIcon variant="subtle" color="gray" size="sm" radius="md" onClick={() => onOpenFolder(item.filepath)}>
                        <FolderOpen size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Eliminar">
                      <ActionIcon variant="subtle" color="red" size="sm" radius="md" onClick={() => onDeleteItem(item.id)}>
                        <Trash2 size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
};
