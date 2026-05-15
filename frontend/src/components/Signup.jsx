import { useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Container, 
  Paper,
  Link,
  CircularProgress,
  InputAdornment,
  IconButton,
  MenuItem
} from '@mui/material';
import { User, Mail, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Signup({ onToggleMode }) {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'Member' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      bgcolor: 'background.default',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(79, 70, 229, 0.05) 0, transparent 50%), radial-gradient(at 50% 0%, rgba(71, 85, 105, 0.05) 0, transparent 50%)'
    }}>
      <Container maxWidth="xs">
        <Paper elevation={0} sx={{ p: 5, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', mb: 1 }}>
              Create Account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start managing your team's tasks effectively.
            </Typography>
          </Box>
          
          {error && (
            <Box sx={{ p: 1.5, mb: 3, bgcolor: 'error.light', borderRadius: 1.5, opacity: 0.8 }}>
              <Typography color="error.dark" variant="caption" sx={{ fontWeight: 600 }}>{error}</Typography>
            </Box>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              InputProps={{
                startAdornment: <InputAdornment position="start"><User size={18} /></InputAdornment>,
              }}
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
              InputProps={{
                startAdornment: <InputAdornment position="start"><Mail size={18} /></InputAdornment>,
              }}
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
              InputProps={{
                startAdornment: <InputAdornment position="start"><Lock size={18} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                ),
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
              InputProps={{
                startAdornment: <InputAdornment position="start"><Shield size={18} /></InputAdornment>,
              }}
            >
              <MenuItem value="Admin">Admin (Project Manager)</MenuItem>
              <MenuItem value="Member">Member (Team Contributor)</MenuItem>
            </TextField>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ py: 1.5, mt: 3, mb: 2, fontSize: '1rem' }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign Up'}
            </Button>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Link href="#" onClick={(e) => { e.preventDefault(); onToggleMode(); }} sx={{ fontWeight: 600, color: 'primary.main', textDecoration: 'none' }}>
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
