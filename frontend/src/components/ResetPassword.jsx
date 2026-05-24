import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { FolderKanban, Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import PremiumIcon from './PremiumIcon';
import AuthProductVisual from './AuthProductVisual';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    
    setLoading(true);
    setError('');

    try {
      await axios.post(`${API_BASE_URL}/auth/reset-password`, { 
        email, 
        token, 
        newPassword: password 
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
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
              Set New Password
            </Typography>
            <Typography sx={{ color: '#70809d', fontWeight: 700, mb: 3 }}>
              Enter a new secure password for {email}.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2.5, borderRadius: '8px' }}>Password reset successfully! Redirecting to login...</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                margin="normal"
                required
                fullWidth
                label="Confirm New Password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><Lock size={18} /></InputAdornment> } }}
              />
              <Button type="submit" fullWidth variant="contained" disabled={loading || success} sx={{ py: 1.4, mt: 3, mb: 2 }}>
                {loading ? <CircularProgress size={23} color="inherit" /> : 'Reset Password'}
              </Button>
            </Box>
          </Box>

          <AuthProductVisual
            title="Secure access to your work"
            subtitle="Reset your password securely to get back to managing your projects and team."
          />
        </Paper>
      </Container>
    </Box>
  );
}
