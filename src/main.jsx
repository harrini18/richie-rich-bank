import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import '@fontsource-variable/inter';
import LiveBank from './LiveBank';
import bank from './bank-config';
import './style.css';

document.title = bank.name + ' | Account portal';
document.documentElement.dataset.bank = bank.theme;

const NAVY = '#101D35';
const GOLD = '#D7B66D';
const IVORY = '#F5F2EA';
const sans = '"Inter Variable", Inter, "DM Sans", system-ui, sans-serif';
const serif = '"Playfair Display", Georgia, "Times New Roman", serif';

function buildTheme(mode) {
  const dark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: dark ? { main: GOLD, contrastText: '#0B1220' } : { main: NAVY, contrastText: IVORY },
      background: dark ? { default: '#0B1220', paper: '#17243A' } : { default: IVORY, paper: '#FFFFFF' },
      text: dark ? { primary: IVORY, secondary: '#A8B0BE' } : { primary: NAVY, secondary: '#777B85' },
      divider: dark ? '#2B3A50' : '#E8E2D6',
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: sans,
      h1: { fontFamily: serif },
      h2: { fontFamily: serif },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '.01em' },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8, paddingInline: 20, paddingBlock: 9 },
          containedPrimary: {
            backgroundColor: GOLD,
            color: NAVY,
            '&:hover': { backgroundColor: '#E3C98E' },
            '&.Mui-disabled': { backgroundColor: dark ? '#2B3A50' : '#E8E2D6', color: dark ? '#6F7A8C' : '#9A9DA6' },
          },
          outlinedPrimary: {
            borderColor: dark ? '#2B3A50' : '#D9D2C2',
            '&:hover': { borderColor: GOLD, backgroundColor: dark ? '#1D2B43' : '#FAF7EF' },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: dark ? '#1D2B43' : '#FFFFFF',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: dark ? '#2B3A50' : '#E2DBCB' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: dark ? '#44566F' : '#CFC6B1' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: GOLD, borderWidth: 1.5 },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { '&.Mui-focused': { color: dark ? GOLD : NAVY } } },
      },
      MuiAlert: { styleOverrides: { root: { borderRadius: 10 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    },
  });
}

function readMode() {
  try { return localStorage.getItem('rrb-theme') === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}

function Root() {
  const [mode, setMode] = useState(readMode);
  const theme = useMemo(() => buildTheme(mode), [mode]);
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem('rrb-theme', mode); } catch { return; }
  }, [mode]);
  const switchUrl = 'https://sriramtpsiog.github.io/SharedDB/';
  return <ThemeProvider theme={theme}>
    <CssBaseline />
    <LiveBank bank={bank} switchUrl={switchUrl} mode={mode} onToggleMode={() => setMode(value => value === 'dark' ? 'light' : 'dark')} />
  </ThemeProvider>;
}

createRoot(document.getElementById('root')).render(<Root />);
