import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Eye, EyeOff, FolderKanban, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import PremiumIcon from './PremiumIcon';
import AuthProductVisual from './AuthProductVisual';

export default function Login({ onToggleMode }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => setFormData({ ...formData, [event.target.name]: event.target.value });

  const fillTestCredentials = () => {
    setFormData({ email: 'admin@test.com', password: 'admin123' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.email, formData.password);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <Box className="argon-gradient" sx={{ minHeight: '100vh', py: { xs: 3, md: 6 }, display: 'flex', alignItems: 'center' }}>
      <Container maxWidth="lg">
        <Paper
          sx={{
            overflow: 'hidden',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.45)',
            boxShadow: '0 24px 60px rgba(47, 67, 103, 0.22)',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
          }}
        >
          <Box sx={{ p: { xs: 3, sm: 5 }, bgcolor: '#fff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, mb: 5 }}>
              <PremiumIcon tone="coral" size={44} radius="14px">
                <FolderKanban size={23} />
              </PremiumIcon>
              <Typography variant="h6" sx={{ color: '#2f4367' }}>TeamTask Manager</Typography>
            </Box>

            <Typography variant="h3" sx={{ color: '#2f4367', mb: 1 }}>
              Welcome back
            </Typography>
            <Typography sx={{ color: '#70809d', fontWeight: 700, mb: 3 }}>
              Sign in to continue managing your project boards.
            </Typography>

            <Box sx={{ mb: 2, p: 2, bgcolor: '#f7fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <Typography variant="body2" sx={{ color: '#4a5568', fontWeight: 600, mb: 1 }}>
                🧪 Test Credentials
              </Typography>
              <Typography variant="caption" sx={{ color: '#718096', display: 'block', mb: 1 }}>
                Email: admin@test.com | Password: admin123
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={fillTestCredentials}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.5,
                  px: 1.5,
                  borderColor: '#cbd5e0',
                  color: '#4a5568',
                  '&:hover': { borderColor: '#a0aec0', bgcolor: '#edf2f7' }
                }}
              >
                Fill Test Credentials
              </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }}>{error}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={formData.email}
                onChange={handleChange}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><Mail size={18} /></InputAdornment> } }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start"><Lock size={18} /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button type="submit" fullWidth variant="contained" disabled={loading} sx={{ py: 1.4, mt: 3, mb: 2 }}>
                {loading ? <CircularProgress size={23} color="inherit" /> : 'Sign In'}
              </Button>
              <Typography sx={{ textAlign: 'center', color: '#70809d', fontWeight: 700 }}>
                Don't have an account?{' '}
                <Link href="#" onClick={(event) => { event.preventDefault(); onToggleMode(); }} sx={{ color: '#fb5b3f', fontWeight: 900, textDecoration: 'none' }}>
                  Sign Up
                </Link>
              </Typography>
            </Box>
          </Box>

          <AuthProductVisual
            title="Bring every task into focus"
            subtitle="A polished command center for tracking teams, risk, progress, and delivery momentum."
          />
        </Paper>
      </Container>
    </Box>
  );
}
