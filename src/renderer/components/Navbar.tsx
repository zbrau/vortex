import React from 'react';
import {
  Group,
  Title,
  Badge,
  SegmentedControl,
  ActionIcon,
  Tooltip,
  Text,
  Button,
  Kbd,
  Menu
} from '@mantine/core';
import {
  Download,
  Library,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Wrench,
  Settings,
  Search,
  Globe
} from 'lucide-react';
import { SystemBinariesStatus } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  binaryStatus: SystemBinariesStatus | null;
  onOpenSettings: () => void;
  onOpenQrShare: () => void;
  onOpenMaintenance: () => void;
  onOpenCommandPalette: () => void;
  onOpenSetup?: () => void;
  itemCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  binaryStatus,
  onOpenSettings,
  onOpenQrShare,
  onOpenMaintenance,
  onOpenCommandPalette,
  onOpenSetup,
  itemCount
}) => {
  const { language, setLanguage, t, languages } = useLanguage();

  return (
    <Group
      justify="space-between"
      align="center"
      px="xl"
      py="sm"
      wrap="nowrap"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(10, 8, 16, 0.4)',
        backdropFilter: 'blur(20px)',
        minHeight: 64,
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}
    >
      {/* Brand Title */}
      <Title
        order={3}
        style={{
          letterSpacing: '2.5px',
          fontWeight: 900,
          margin: 0,
          lineHeight: 1,
          background: 'linear-gradient(135deg, #ffffff 40%, #00e5ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          userSelect: 'none',
          cursor: 'default'
        }}
      >
        VORTEX
      </Title>

      {/* Main Navigation Tabs */}
      <SegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        size="sm"
        radius="md"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
        data={[
          {
            value: 'download',
            label: (
              <Group gap={8} wrap="nowrap" align="center" px={12} py={4}>
                <Download size={16} strokeWidth={2.2} />
                <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                  {t('nav.download')}
                </Text>
              </Group>
            )
          },
          {
            value: 'library',
            label: (
              <Group gap={8} wrap="nowrap" align="center" px={12} py={4}>
                <Library size={16} strokeWidth={2.2} />
                <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                  {t('nav.library')} {itemCount > 0 && `(${itemCount})`}
                </Text>
              </Group>
            )
          }
        ]}
      />

      {/* Quick Search & Tools */}
      <Group gap="xs" align="center" wrap="nowrap">
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          radius="md"
          leftSection={<Search size={14} />}
          rightSection={<Kbd size="xs" style={{ fontSize: 10 }}>Ctrl+K</Kbd>}
          onClick={onOpenCommandPalette}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          {t('nav.search')}
        </Button>

        {/* Language Selector Dropdown */}
        <Menu shadow="md" width={180} position="bottom-end" radius="md">
          <Menu.Target>
            <Tooltip label={t('nav.language')}>
              <Button
                variant="subtle"
                size="xs"
                radius="md"
                color="gray"
                leftSection={<Globe size={15} color="#00e5ff" />}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  height: 30,
                  paddingLeft: 8,
                  paddingRight: 10
                }}
              >
                <Text size="xs" fw={700}>
                  {languages.find(l => l.code === language)?.flag} {language.toUpperCase()}
                </Text>
              </Button>
            </Tooltip>
          </Menu.Target>

          <Menu.Dropdown style={{ background: 'rgba(16, 14, 26, 0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Menu.Label>{t('settings.languageSection')}</Menu.Label>
            {languages.map((l) => (
              <Menu.Item
                key={l.code}
                onClick={() => setLanguage(l.code)}
                leftSection={<span style={{ fontSize: 16 }}>{l.flag}</span>}
                style={{
                  fontWeight: language === l.code ? 700 : 500,
                  color: language === l.code ? '#00e5ff' : 'inherit',
                  background: language === l.code ? 'rgba(0, 229, 255, 0.12)' : undefined
                }}
              >
                {l.nativeLabel}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>

        {binaryStatus && (
          <Tooltip label={binaryStatus.ready ? t('nav.engineTooltipReady') : t('nav.engineTooltipNotReady')}>
            <Badge
              leftSection={
                binaryStatus.ready ? (
                  <CheckCircle2 size={12} strokeWidth={2.5} />
                ) : (
                  <AlertTriangle size={12} strokeWidth={2.5} />
                )
              }
              color={binaryStatus.ready ? 'teal' : 'yellow'}
              variant="light"
              size="sm"
              onClick={!binaryStatus.ready || binaryStatus.needsBootstrap ? onOpenSetup : undefined}
              style={{
                textTransform: 'none',
                fontWeight: 600,
                cursor: !binaryStatus.ready || binaryStatus.needsBootstrap ? 'pointer' : 'default'
              }}
            >
              {binaryStatus.ready ? t('nav.engineReady') : t('nav.configureEngine')}
            </Badge>
          </Tooltip>
        )}

        <Tooltip label={t('nav.qrShare')}>
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="md"
            onClick={onOpenQrShare}
            color="pink"
            aria-label={t('nav.qrShare')}
          >
            <QrCode size={19} strokeWidth={2} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={t('nav.maintenance')}>
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="md"
            onClick={onOpenMaintenance}
            color="gray"
            aria-label={t('nav.maintenance')}
          >
            <Wrench size={19} strokeWidth={2} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={t('nav.settings')}>
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="md"
            onClick={onOpenSettings}
            color="gray"
            aria-label={t('nav.settings')}
          >
            <Settings size={19} strokeWidth={2} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
};
