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
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Eye, EyeOff, FolderKanban, Lock, Mail, Shield, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PremiumIcon from './PremiumIcon';
import AuthProductVisual from './AuthProductVisual';

export default function Signup({ onToggleMode }) {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'Member' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => setFormData({ ...formData, [event.target.name]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const result = await signup(formData.username, formData.email, formData.password, formData.role);
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
            gridTemplateColumns: { xs: '1fr', md: '0.95fr 1.05fr' },
          }}
        >
          <AuthProductVisual
            title="Build your task command center"
            subtitle="Create a workspace identity with boards, delivery health, and team visibility from day one."
          />

          <Box sx={{ p: { xs: 3, sm: 5 }, bgcolor: '#fff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, mb: 4 }}>
              <PremiumIcon tone="coral" size={44} radius="14px">
                <FolderKanban size={23} />
              </PremiumIcon>
              <Typography variant="h6" sx={{ color: '#2f4367' }}>TeamTask Manager</Typography>
            </Box>

            <Typography variant="h3" sx={{ color: '#2f4367', mb: 1 }}>
              Create account
            </Typography>
            <Typography sx={{ color: '#70809d', fontWeight: 700, mb: 3 }}>
              Start coordinating projects with your team.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }}>{error}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><User size={18} /></InputAdornment> } }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Email Address"
                name="email"
                autoComplete="email"
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
              <TextField
                select
                fullWidth
                margin="normal"
                label="Select Role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><Shield size={18} /></InputAdornment> } }}
              >
                <MenuItem value="Admin">Admin (Project Manager)</MenuItem>
                <MenuItem value="Member">Member (Team Contributor)</MenuItem>
              </TextField>
              <Button type="submit" fullWidth variant="contained" disabled={loading} sx={{ py: 1.4, mt: 3, mb: 2 }}>
                {loading ? <CircularProgress size={23} color="inherit" /> : 'Sign Up'}
              </Button>
              <Typography sx={{ textAlign: 'center', color: '#70809d', fontWeight: 700 }}>
                Already have an account?{' '}
                <Link href="#" onClick={(event) => { event.preventDefault(); onToggleMode(); }} sx={{ color: '#fb5b3f', fontWeight: 900, textDecoration: 'none' }}>
                  Log In
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
