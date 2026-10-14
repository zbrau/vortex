import React, { useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  Switch,
  Image,
  Paper,
  Badge,
  Code,
  Button,
  Center,
  Alert
} from '@mantine/core';
import {
  QrCode,
  Smartphone,
  Wifi,
  Download,
  Check,
  Copy,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { QrServerStatus } from '../types';

interface QrShareModalProps {
  opened: boolean;
  onClose: () => void;
}

export const QrShareModal: React.FC<QrShareModalProps> = ({ opened, onClose }) => {
  const [status, setStatus] = useState<QrServerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [configuringFirewall, setConfiguringFirewall] = useState(false);
  const [firewallSuccess, setFirewallSuccess] = useState(false);

  const handleFixFirewall = async () => {
    setConfiguringFirewall(true);
    try {
      // @ts-ignore
      if (window.smasherAPI) {
        // @ts-ignore
        const ok = await window.smasherAPI.configureFirewallAndNetwork();
        if (ok) setFirewallSuccess(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConfiguringFirewall(false);
    }
  };

  const loadStatus = async () => {
    // @ts-ignore
    if (window.smasherAPI) {
      // @ts-ignore
      const s = await window.smasherAPI.getQrServerStatus();
      setStatus(s);
    }
  };

  useEffect(() => {
    if (opened) {
      loadStatus();
    }
  }, [opened]);

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    // @ts-ignore
    if (window.smasherAPI) {
      if (checked) {
        // @ts-ignore
        const s = await window.smasherAPI.startQrServer();
        setStatus(s);
      } else {
        // @ts-ignore
        const s = await window.smasherAPI.stopQrServer();
        setStatus(s);
      }
    }
    setLoading(false);
  };

  const handleCopy = () => {
    if (status?.serverUrl) {
      navigator.clipboard.writeText(status.serverUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <QrCode size={20} color="#ff2a85" />
          <Text fw={700}>Transferencia por Código QR (Wi-Fi)</Text>
        </Group>
      }
      size="md"
      radius="lg"
    >
      <Stack gap="md">
        <Paper p="sm" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <Group justify="space-between">
            <div>
              <Text size="sm" fw={600}>Servidor Web Local</Text>
              <Text size="xs" c="dimmed">
                Permite conectar tu teléfono en la misma red local
              </Text>
            </div>
            <Switch
              checked={status?.running || false}
              onChange={e => handleToggle(e.currentTarget.checked)}
              disabled={loading}
              color="pink"
            />
          </Group>
        </Paper>

        {status?.running ? (
          <Stack align="center" gap="sm">
            <Badge color="teal" variant="light" size="lg" leftSection={<Wifi size={14} />}>
              Servidor Activo en Red Local (Puerto {status.port})
            </Badge>

            {status.qrDataUrl && (
              <Paper
                p="xs"
                radius="md"
                style={{ background: '#fff', display: 'inline-block', lineHeight: 0 }}
              >
                <Image src={status.qrDataUrl} w={200} h={200} />
              </Paper>
            )}

            <Group gap="xs">
              <Code block style={{ fontSize: 13, padding: '6px 12px' }}>
                {status.serverUrl}
              </Code>
              <Button size="xs" variant="light" color="pink" onClick={handleCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </Group>

            <Alert
              icon={<Smartphone size={18} />}
              title="Funciones desde tu teléfono"
              color="pink"
              radius="md"
              variant="light"
            >
              <ul style={{ fontSize: 12, paddingLeft: 16, margin: 0 }}>
                <li><b>Descargar a tu móvil:</b> Guarda videos y canciones descargadas directamente en tu teléfono.</li>
                <li><b>Enviar enlaces al PC:</b> Pega cualquier URL en el navegador de tu móvil y tu PC lo descargará al instante.</li>
              </ul>
            </Alert>

            <Paper p="xs" radius="md" style={{ background: 'rgba(255,255,255,0.03)', width: '100%' }}>
              <Group gap={6} mb={4}>
                <AlertCircle size={14} color="#fcc419" />
                <Text size="xs" fw={700} c="yellow">Consejos de Conexión:</Text>
              </Group>
              <ul style={{ fontSize: 11, paddingLeft: 16, margin: 0, opacity: 0.85 }}>
                <li>Tu PC y celular deben estar en el <b>mismo módem o router</b> (Ethernet o Wi-Fi).</li>
                <li>Verifica que la URL coincida con la IP local asignada.</li>
                <li>Si tu red está en modo Público, Windows bloquea conexiones entrantes.</li>
              </ul>
            </Paper>

            <Button
              fullWidth
              color={firewallSuccess ? 'teal' : 'pink'}
              variant={firewallSuccess ? 'filled' : 'light'}
              size="sm"
              radius="md"
              loading={configuringFirewall}
              onClick={handleFixFirewall}
              leftSection={firewallSuccess ? <ShieldCheck size={16} /> : <ShieldCheck size={16} />}
            >
              {firewallSuccess
                ? 'Acceso Local y Firewall Autorizados'
                : 'Autorizar Conexión Móvil en Windows (1 Clic)'}
            </Button>
          </Stack>
        ) : (
          <Center py={30}>
            <Stack align="center" gap="xs">
              <QrCode size={48} color="rgba(255,255,255,0.15)" />
              <Text size="sm" c="dimmed">
                Activa el interruptor arriba para iniciar el servidor local.
              </Text>
            </Stack>
          </Center>
        )}
      </Stack>
    </Modal>
  );
};
