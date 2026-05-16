import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#fb5b3f',
      light: '#ff8a4c',
      dark: '#e74732',
      contrastText: '#fff',
    },
    secondary: {
      main: '#334767',
      light: '#64748b',
      dark: '#22314d',
    },
    success: {
      main: '#22c98a',
      light: '#dff8ee',
      dark: '#159664',
    },
    warning: {
      main: '#ff9b3d',
      light: '#fff2e3',
      dark: '#d96c12',
    },
    error: {
      main: '#f43f5e',
      light: '#ffe4ea',
      dark: '#be123c',
    },
    info: {
      main: '#2ec4b6',
      light: '#ddf8f5',
      dark: '#168b81',
    },
    background: {
      default: '#f5f7fb',
      paper: '#ffffff',
    },
    text: {
      primary: '#2f4367',
      secondary: '#70809d',
    },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Outfit", sans-serif',
    h1: { fontFamily: '"Outfit", sans-serif', fontWeight: 800 },
    h2: { fontFamily: '"Outfit", sans-serif', fontWeight: 800 },
    h3: { fontFamily: '"Outfit", sans-serif', fontWeight: 800 },
    h4: { fontFamily: '"Outfit", sans-serif', fontWeight: 800 },
    h5: { fontFamily: '"Outfit", sans-serif', fontWeight: 800 },
    h6: { fontFamily: '"Outfit", sans-serif', fontWeight: 800 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '9px 18px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 10px 24px rgba(251, 91, 63, 0.2)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 16px 34px rgba(47, 67, 103, 0.08)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 16px 34px rgba(47, 67, 103, 0.08)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#fff',
        },
        notchedOutline: {
          borderColor: '#e8edf5',
        },
      },
    },
  },
});

export default theme;
