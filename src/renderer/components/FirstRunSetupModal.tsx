import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  Paper,
  Badge,
  Button,
  Progress,
  ThemeIcon,
  Alert
} from '@mantine/core';
import {
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  ArrowRight,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { SystemBinariesStatus, BootstrapProgress } from '../types';

interface FirstRunSetupModalProps {
  opened: boolean;
  onClose: () => void;
  binaryStatus: SystemBinariesStatus | null;
  onSuccess: () => void;
  accentColor?: string;
}

export const FirstRunSetupModal: React.FC<FirstRunSetupModalProps> = ({
  opened,
  onClose,
  binaryStatus,
  onSuccess,
  accentColor = '#00e5ff'
}) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const [progress, setProgress] = useState<BootstrapProgress>({
    step: 'idle',
    percent: 0,
    message: 'Listo para inicializar los motores multimedia.'
  });
  const [isDone, setIsDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const api = window.vortexAPI || window.smasherAPI;
    if (api?.onBootstrapProgress) {
      const unsub = api.onBootstrapProgress((p: BootstrapProgress) => {
        setProgress(p);
        if (p.step === 'completed') {
          setIsInstalling(false);
          setIsDone(true);
          onSuccess();
        } else if (p.step === 'error') {
          setIsInstalling(false);
          setErrorMessage(p.error || 'Ocurrió un error al configurar los ejecutables.');
        }
      });
      return () => unsub();
    }
  }, [onSuccess]);

  const handleStartSetup = async () => {
    setIsInstalling(true);
    setErrorMessage(null);
    setIsDone(false);
    setProgress({
      step: 'downloading-ytdlp',
      percent: 5,
      message: 'Iniciando descarga de dependencias oficiales...'
    });

    const api = window.vortexAPI || window.smasherAPI;
    if (api?.installBinaries) {
      try {
        await api.installBinaries();
        setIsDone(true);
        setIsInstalling(false);
        onSuccess();
      } catch (err: any) {
        setIsInstalling(false);
        setErrorMessage(err.message || 'Error de red o permisos al descargar.');
      }
    }
  };

  const hasYtdlp = binaryStatus?.ytdlp?.found;
  const hasFfmpeg = binaryStatus?.ffmpeg?.found;

  return (
    <Modal
      opened={opened}
      onClose={isInstalling ? () => {} : onClose}
      closeOnClickOutside={!isInstalling}
      closeOnEscape={!isInstalling}
      withCloseButton={!isInstalling}
      size="md"
      radius="lg"
      centered
      title={
        <Group gap="xs" align="center">
          <ThemeIcon size="md" radius="md" variant="gradient" gradient={{ from: 'cyan', to: 'pink' }}>
            <Sparkles size={16} />
          </ThemeIcon>
          <Text fw={800} size="md" style={{ letterSpacing: '0.3px' }}>
            Vortex • Configuración Inicial
          </Text>
        </Group>
      }
      styles={{
        content: {
          background: '#0d0b14',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
        },
        header: {
          background: 'transparent',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }
      }}
    >
      <Stack gap="md" py="xs">
        <div>
          <Text size="sm" c="dimmed">
            Para que Vortex descargue y procese videos sin restricciones en esta computadora, necesita configurar sus dos motores independientes:
          </Text>
        </div>

        {/* Modules status overview */}
        <Stack gap="xs">
          <Paper p="xs" radius="md" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Cpu size={16} color={hasYtdlp ? '#10b981' : '#f59e0b'} />
                <div>
                  <Text size="xs" fw={700}>yt-dlp (Motor de Extracción)</Text>
                  <Text size="10px" c="dimmed">Descarga de YouTube, TikTok, X, Twitch y 1,000+ sitios</Text>
                </div>
              </Group>
              <Badge size="xs" color={hasYtdlp ? 'teal' : 'yellow'} variant="light">
                {hasYtdlp ? 'Instalado' : 'Pendiente'}
              </Badge>
            </Group>
          </Paper>

          <Paper p="xs" radius="md" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Layers size={16} color={hasFfmpeg ? '#10b981' : '#f59e0b'} />
                <div>
                  <Text size="xs" fw={700}>FFmpeg (Transcodificador Universal)</Text>
                  <Text size="10px" c="dimmed">Ensambla video 1080p/4K con audio e incrusta carátulas</Text>
                </div>
              </Group>
              <Badge size="xs" color={hasFfmpeg ? 'teal' : 'yellow'} variant="light">
                {hasFfmpeg ? 'Instalado' : 'Pendiente'}
              </Badge>
            </Group>
          </Paper>
        </Stack>

        {/* Progress or Status Feedback */}
        {isInstalling && (
          <Paper p="sm" radius="md" style={{ background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)' }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" fw={600} c="cyan">
                  {progress.message}
                </Text>
                {progress.speed && (
                  <Badge size="xs" variant="outline" color="cyan">
                    {progress.speed}
                  </Badge>
                )}
              </Group>

              <Progress
                value={progress.percent}
                size="md"
                radius="xl"
                animated
                color="cyan"
              />

              <Group justify="space-between">
                <Text size="10px" c="dimmed">
                  Ubicación: %USERPROFILE%\.vortex\bin\
                </Text>
                {progress.transferred && (
                  <Text size="10px" fw={600} c="dimmed">
                    {progress.transferred} {progress.total ? `/ ${progress.total}` : ''}
                  </Text>
                )}
              </Group>
            </Stack>
          </Paper>
        )}

        {isDone && (
          <Alert
            icon={<CheckCircle2 size={16} />}
            title="¡Configuración Exitosa!"
            color="teal"
            radius="md"
          >
            Vortex está listo para descargar videos, audios y transmisiones con máxima calidad.
          </Alert>
        )}

        {errorMessage && (
          <Alert
            icon={<AlertCircle size={16} />}
            title="Aviso de Instalación"
            color="red"
            radius="md"
          >
            {errorMessage}
          </Alert>
        )}

        {/* Actions */}
        <Group justify="flex-end" mt="xs">
          {!isDone && (
            <Button
              fullWidth
              size="sm"
              radius="md"
              loading={isInstalling}
              onClick={handleStartSetup}
              variant="gradient"
              gradient={{ from: 'cyan', to: 'pink' }}
              leftSection={isInstalling ? <RefreshCw className="animate-spin" size={16} /> : <DownloadCloud size={16} />}
            >
              {isInstalling ? 'Instalando en este equipo...' : 'Instalar Todo con 1-Clic'}
            </Button>
          )}

          {isDone && (
            <Button
              fullWidth
              size="sm"
              radius="md"
              color="teal"
              onClick={onClose}
              rightSection={<ArrowRight size={16} />}
            >
              Comenzar a Descargar
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
};
