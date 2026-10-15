import React, { useEffect, useRef, useState } from 'react';
import {
  Group,
  Paper,
  Text,
  ActionIcon,
  Slider,
  Image,
  Badge,
  Tooltip,
  Box
} from '@mantine/core';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  ExternalLink,
  X,
  Repeat,
  Music,
  Film
} from 'lucide-react';
import { DownloadItem } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { useMediaQuery } from '@mantine/hooks';
import { getVortexApi, isMobileNative } from '../api';
import { Capacitor } from '@capacitor/core';

interface MiniPlayerBarProps {
  item: DownloadItem | null;
  onClose: () => void;
  onExpandToVideo: (item: DownloadItem, currentTime: number) => void;
  accentColor?: string;
}

export const MiniPlayerBar: React.FC<MiniPlayerBarProps> = ({
  item,
  onClose,
  onExpandToVideo,
  accentColor = '#ff2a85'
}) => {
  const { t } = useLanguage();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const isMobile = isSmallScreen || isMobileNative;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (item && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [item?.id]);

  if (!item) return null;

  const isVideo = ['mp4', 'mkv', 'webm', 'mov'].includes(item.format.toLowerCase());

  const streamSrc = isMobileNative && item.filepath
    ? Capacitor.convertFileSrc(item.filepath)
    : item.id && !isMobileNative
    ? `http://127.0.0.1:6767/api/stream/${encodeURIComponent(item.id)}`
    : item.filepath
    ? (isMobileNative ? Capacitor.convertFileSrc(item.filepath) : `http://127.0.0.1:6767/api/stream-file?path=${encodeURIComponent(item.filepath)}`)
    : '';

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (val: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(Math.max(0, audioRef.current.currentTime + seconds), duration);
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val > 0) setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const cycleRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleOpenExternal = () => {
    if (item.filepath) {
      const api = getVortexApi();
      api?.openFile?.(item.filepath);
    }
  };

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 78px)' : 0,
        left: isMobile ? 12 : 0,
        right: isMobile ? 12 : 0,
        maxWidth: isMobile ? 440 : 'none',
        margin: isMobile ? '0 auto' : undefined,
        borderRadius: isMobile ? 16 : 0,
        zIndex: 89,
        padding: isMobile ? '6px 12px' : '8px 16px',
        background: 'rgba(12, 10, 20, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        transform: 'translateZ(0)',
        border: isMobile ? `1px solid ${accentColor}50` : undefined,
        borderTop: isMobile ? undefined : `1px solid ${accentColor}40`,
        boxShadow: isMobile ? '0 12px 32px rgba(0,0,0,0.7)' : '0 -10px 40px rgba(0,0,0,0.6)',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <audio
        ref={audioRef}
        src={streamSrc}
        loop={isLoop}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Top progress seekbar spanning full width */}
      <Box style={{ margin: '-8px -16px 8px -16px' }}>
        <Slider
          value={currentTime}
          min={0}
          max={duration || 100}
          onChange={handleSeek}
          size="xs"
          color="pink"
          thumbSize={10}
          styles={{
            root: { height: 4 },
            track: { background: 'rgba(255,255,255,0.08)', cursor: 'pointer' },
            bar: { background: accentColor }
          }}
        />
      </Box>

      <Group justify="space-between" align="center" wrap="nowrap">
        {/* Left: Media Info */}
        <Group gap="sm" wrap="nowrap" style={{ minWidth: isMobile ? 120 : 240, maxWidth: isMobile ? 190 : 360, flex: 1 }}>
          <Box
            style={{
              position: 'relative',
              width: isMobile ? 40 : 48,
              height: isMobile ? 40 : 48,
              borderRadius: 8,
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: `0 0 12px ${accentColor}30`
            }}
          >
            {item.thumbnail_url ? (
              <Image src={item.thumbnail_url} width={isMobile ? 40 : 48} height={isMobile ? 40 : 48} fit="cover" />
            ) : (
              <Box
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isVideo ? <Film size={18} color={accentColor} /> : <Music size={18} color={accentColor} />}
              </Box>
            )}
          </Box>

          <Box style={{ overflow: 'hidden', minWidth: 0 }}>
            <Text fw={700} size={isMobile ? 'xs' : 'sm'} lineClamp={1} title={item.title}>
              {item.title}
            </Text>
            <Group gap={6} mt={2} wrap="nowrap">
              <Badge size="xs" variant="light" color="pink" style={{ height: 16, fontSize: 9 }}>
                {item.format.toUpperCase()}
              </Badge>
              <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Text>
            </Group>
          </Box>
        </Group>

        {/* Center: Playback Controls */}
        <Group gap="xs" align="center" wrap="nowrap">
          <Tooltip label="Retroceder 10s">
            <ActionIcon variant="subtle" color="gray" radius="xl" size="md" onClick={() => handleSkip(-10)}>
              <RotateCcw size={16} />
            </ActionIcon>
          </Tooltip>

          <ActionIcon
            variant="filled"
            color="pink"
            radius="xl"
            size="lg"
            onClick={togglePlay}
            style={{
              background: accentColor,
              boxShadow: `0 0 16px ${accentColor}60`
            }}
          >
            {isPlaying ? <Pause size={18} fill="#fff" /> : <Play size={18} fill="#fff" style={{ marginLeft: 2 }} />}
          </ActionIcon>

          <Tooltip label="Adelantar 10s">
            <ActionIcon variant="subtle" color="gray" radius="xl" size="md" onClick={() => handleSkip(10)}>
              <RotateCw size={16} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={isLoop ? 'Repetición activada' : 'Repetir pista'}>
            <ActionIcon
              variant="subtle"
              color={isLoop ? 'pink' : 'gray'}
              radius="xl"
              size="md"
              onClick={() => setIsLoop(!isLoop)}
            >
              <Repeat size={16} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Velocidad de reproducción">
            <Badge
              size="xs"
              variant="outline"
              color={playbackRate !== 1 ? 'pink' : 'gray'}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={cycleRate}
            >
              {playbackRate}x
            </Badge>
          </Tooltip>
        </Group>

        {/* Right: Volume & Extra Actions */}
        <Group gap={isMobile ? 4 : 'sm'} align="center" wrap="nowrap" style={{ minWidth: isMobile ? 'auto' : 220, justifyContent: 'flex-end' }}>
          {!isMobile && (
            <Group gap={6} align="center" wrap="nowrap" style={{ width: 120 }}>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </ActionIcon>
              <Slider
                value={isMuted ? 0 : volume}
                min={0}
                max={1}
                step={0.05}
                onChange={handleVolumeChange}
                size="xs"
                color="pink"
                styles={{
                  root: { flex: 1 },
                  track: { background: 'rgba(255,255,255,0.1)' }
                }}
              />
            </Group>
          )}

          {isVideo && (
            <Tooltip label={t('player.expand')}>
              <ActionIcon
                variant="light"
                color="pink"
                radius="md"
                size={isMobile ? 'sm' : 'md'}
                onClick={() => onExpandToVideo(item, currentTime)}
              >
                <Maximize2 size={isMobile ? 14 : 16} />
              </ActionIcon>
            </Tooltip>
          )}

          {!isMobile && (
            <Tooltip label="App Externa">
              <ActionIcon variant="subtle" color="gray" radius="md" size="md" onClick={handleOpenExternal}>
                <ExternalLink size={16} />
              </ActionIcon>
            </Tooltip>
          )}

          <Tooltip label={t('player.close')}>
            <ActionIcon variant="subtle" color="gray" radius="md" size={isMobile ? 'sm' : 'md'} onClick={onClose}>
              <X size={isMobile ? 14 : 16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Box>
  );
};
