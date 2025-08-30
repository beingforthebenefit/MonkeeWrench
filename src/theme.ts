import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#B71C1C' },          // spec primary red
    secondary: { main: '#00BCD4' },        // cool cyan accent
    background: { default: '#0b0b0b', paper: '#111111' },
    divider: 'rgba(255,255,255,0.08)',
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
    h5: { fontWeight: 700 },
    button: { fontWeight: 600 },
  },
  components: {
    MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
          border: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none' },
        containedPrimary: { boxShadow: '0 8px 24px rgba(183,28,28,0.25)' },
      },
    },
    MuiContainer: { defaultProps: { maxWidth: 'lg' } },
  },
})
