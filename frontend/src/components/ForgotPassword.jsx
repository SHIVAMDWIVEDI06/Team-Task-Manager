import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  InputAdornment,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { FolderKanban, Mail, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import PremiumIcon from './PremiumIcon';
import AuthProductVisual from './AuthProductVisual';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
      setMessage(res.data.message || 'Check your email for a reset link.');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
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
              Forgot Password
            </Typography>
            <Typography sx={{ color: '#70809d', fontWeight: 700, mb: 3 }}>
              Enter your email address and we'll send you a link to reset your password.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }}>{error}</Alert>}
            {message && <Alert severity="success" sx={{ mb: 2.5, borderRadius: '8px' }}>{message}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><Mail size={18} /></InputAdornment> } }}
              />
              <Button type="submit" fullWidth variant="contained" disabled={loading} sx={{ py: 1.4, mt: 3, mb: 2 }}>
                {loading ? <CircularProgress size={23} color="inherit" /> : 'Send Reset Link'}
              </Button>
              <Button 
                fullWidth 
                variant="outlined" 
                startIcon={<ArrowLeft size={16} />}
                onClick={() => navigate('/login')}
                sx={{ py: 1.4, mb: 2, borderColor: '#e8edf5', color: '#2f4367', '&:hover': { bgcolor: '#f6f8fb' } }}
              >
                Back to Login
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
