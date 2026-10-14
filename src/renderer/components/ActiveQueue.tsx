import React from 'react';
import { Paper, Group, Text, Progress, Button, Stack, Badge, ActionIcon } from '@mantine/core';
import { X, ArrowDown, Clock, Gauge } from 'lucide-react';
import { DownloadProgress } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface ActiveQueueProps {
  progressList: DownloadProgress[];
  onCancel: (id: string) => void;
}

export const ActiveQueue: React.FC<ActiveQueueProps> = ({ progressList, onCancel }) => {
  const { t } = useLanguage();
  const activeItems = progressList.filter(p => p.status === 'downloading');

  if (activeItems.length === 0) return null;

  return (
    <Stack gap="sm" mt="md">
      <Text size="sm" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.8px' }}>
        {t('queue.title')} ({activeItems.length})
      </Text>

      {activeItems.map(item => (
        <Paper
          key={item.id}
          p="md"
          radius="md"
          style={{ background: 'rgba(255,42,133,0.06)', border: '1px solid rgba(255,42,133,0.2)' }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Group gap="xs">
                <Badge color="pink" variant="dot">
                  {t('queue.active')}
                </Badge>
                {item.totalSize && (
                  <Badge size="xs" color="gray" variant="light">
                    {item.totalSize}
                  </Badge>
                )}
              </Group>

              <Group gap="md">
                {item.speed && (
                  <Group gap={4}>
                    <Gauge size={14} color="#ff2a85" />
                    <Text size="xs" fw={600} c="pink">{item.speed}</Text>
                  </Group>
                )}
                {item.eta && (
                  <Group gap={4}>
                    <Clock size={14} />
                    <Text size="xs" c="dimmed">ETA {item.eta}</Text>
                  </Group>
                )}
                <ActionIcon
                  size="sm"
                  color="red"
                  variant="subtle"
                  onClick={() => onCancel(item.id)}
                  title={t('queue.cancel')}
                >
                  <X size={14} />
                </ActionIcon>
              </Group>
            </Group>

            <Text size="sm" fw={600} lineClamp={1}>
              {item.title || 'Iniciando descarga...'}
            </Text>

            <Group gap="xs" align="center">
              <Progress
                value={item.percent || 0}
                color="pink"
                size="md"
                radius="xl"
                animated
                style={{ flex: 1 }}
              />
              <Text size="xs" fw={700} c="pink" style={{ minWidth: 45, textAlign: 'right' }}>
                {Math.round(item.percent || 0)}%
              </Text>
            </Group>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
};
