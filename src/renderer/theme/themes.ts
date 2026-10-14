import { createTheme, MantineThemeOverride } from '@mantine/core';
import { ThemePreset } from '../types';

export interface ThemeDefinition {
  id: ThemePreset;
  name: string;
  bg: string;
  accent: string;
  theme: MantineThemeOverride;
}

export const themes: Record<ThemePreset, ThemeDefinition> = {
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    bg: '#070714',
    accent: '#00f0ff',
    theme: createTheme({
      primaryColor: 'cyan',
      colors: {
        dark: ['#d8e2f0', '#b1c1d8', '#7f98bc', '#56739e', '#395279', '#253859', '#17243c', '#101a2e', '#0b1120', '#060914']
      }
    })
  },
  synthwave: {
    id: 'synthwave',
    name: 'Synthwave',
    bg: '#180a29',
    accent: '#ff2a85',
    theme: createTheme({
      primaryColor: 'pink',
      colors: {
        dark: ['#f5e6fc', '#e5c0f7', '#ce92f0', '#b562e8', '#9e39e0', '#831bc4', '#650fa0', '#470873', '#2c044a', '#180a29']
      }
    })
  },
  retroTerminal: {
    id: 'retroTerminal',
    name: 'Retro Terminal',
    bg: '#080808',
    accent: '#ffb000',
    theme: createTheme({
      primaryColor: 'yellow',
      fontFamily: 'Consolas, monospace',
      colors: {
        dark: ['#fff4db', '#ffe4a8', '#ffd06e', '#ffb000', '#db8e00', '#b86e00', '#8a4e00', '#5c3100', '#2e1600', '#0a0a0a']
      }
    })
  },
  hacker: {
    id: 'hacker',
    name: 'Hacker',
    bg: '#040b04',
    accent: '#00ff66',
    theme: createTheme({
      primaryColor: 'green',
      fontFamily: 'Consolas, monospace',
      colors: {
        dark: ['#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#052e16']
      }
    })
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    bg: '#0b0f19',
    accent: '#6366f1',
    theme: createTheme({
      primaryColor: 'indigo',
      colors: {
        dark: ['#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#090d16', '#04070d']
      }
    })
  },
  noir: {
    id: 'noir',
    name: 'Noir (OLED)',
    bg: '#000000',
    accent: '#ffffff',
    theme: createTheme({
      primaryColor: 'gray',
      colors: {
        dark: ['#ffffff', '#e5e5e5', '#cccccc', '#999999', '#666666', '#404040', '#262626', '#171717', '#0a0a0a', '#000000']
      }
    })
  },
  solarized: {
    id: 'solarized',
    name: 'Solarized',
    bg: '#002b36',
    accent: '#2aa198',
    theme: createTheme({
      primaryColor: 'teal',
      colors: {
        dark: ['#fdf6e3', '#eee8d5', '#93a1a1', '#839496', '#657b83', '#586e75', '#073642', '#002b36', '#00212b', '#00171f']
      }
    })
  },
  vapor: {
    id: 'vapor',
    name: 'Vapor',
    bg: '#140c24',
    accent: '#2de2e6',
    theme: createTheme({
      primaryColor: 'cyan',
      colors: {
        dark: ['#fad2e1', '#f3a4be', '#eb769b', '#e24878', '#d91b55', '#c10d44', '#990033', '#660022', '#330011', '#140c24']
      }
    })
  },
  cosmic: {
    id: 'cosmic',
    name: 'Cosmic',
    bg: '#0e061f',
    accent: '#a855f7',
    theme: createTheme({
      primaryColor: 'grape',
      colors: {
        dark: ['#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87', '#0e061f']
      }
    })
  },
  coffee: {
    id: 'coffee',
    name: 'Coffee',
    bg: '#1a120f',
    accent: '#d97706',
    theme: createTheme({
      primaryColor: 'orange',
      colors: {
        dark: ['#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f', '#1a120f']
      }
    })
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    bg: '#0a1610',
    accent: '#10b981',
    theme: createTheme({
      primaryColor: 'teal',
      colors: {
        dark: ['#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#0a1610']
      }
    })
  },
  autumn: {
    id: 'autumn',
    name: 'Autumn',
    bg: '#1c0d08',
    accent: '#ea580c',
    theme: createTheme({
      primaryColor: 'orange',
      colors: {
        dark: ['#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12', '#1c0d08']
      }
    })
  },
  christmas: {
    id: 'christmas',
    name: 'Christmas',
    bg: '#0a1a12',
    accent: '#ef4444',
    theme: createTheme({
      primaryColor: 'red',
      colors: {
        dark: ['#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#0a1a12']
      }
    })
  },
  halloween: {
    id: 'halloween',
    name: 'Halloween',
    bg: '#140803',
    accent: '#f97316',
    theme: createTheme({
      primaryColor: 'orange',
      colors: {
        dark: ['#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12', '#140803']
      }
    })
  },
  spring: {
    id: 'spring',
    name: 'Spring',
    bg: '#121814',
    accent: '#f472b6',
    theme: createTheme({
      primaryColor: 'pink',
      colors: {
        dark: ['#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d', '#831843', '#121814']
      }
    })
  }
};

export function buildCustomTheme(basePreset: ThemePreset, customAccent?: string): { theme: MantineThemeOverride; bg: string; accent: string } {
  const base = themes[basePreset] || themes.synthwave;
  if (!customAccent) {
    return { theme: base.theme, bg: base.bg, accent: base.accent };
  }

  return {
    bg: base.bg,
    accent: customAccent,
    theme: createTheme({
      ...base.theme,
      primaryColor: 'customAccent',
      colors: {
        ...base.theme.colors,
        customAccent: [
          customAccent,
          customAccent,
          customAccent,
          customAccent,
          customAccent,
          customAccent,
          customAccent,
          customAccent,
          customAccent,
          customAccent
        ]
      }
    })
  };
}
