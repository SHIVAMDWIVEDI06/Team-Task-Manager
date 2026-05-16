import React from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';
import { AlertTriangle, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Reusable Error Fallback Component
 * Can be used as a custom fallback for ErrorBoundary
 */
export const ErrorFallback = ({ 
  error, 
  resetError, 
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  showHomeButton = true 
}) => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    if (resetError) resetError();
    navigate('/');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        p: 3,
      }}
    >
      <Paper
        sx={{
          maxWidth: 500,
          p: 4,
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <AlertTriangle size={48} color="#f59e0b" />
        </Box>

        <Typography variant="h5" gutterBottom fontWeight={600}>
          {title}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {message}
        </Typography>

        {error && process.env.NODE_ENV === 'development' && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: '#fef2f2',
              borderRadius: 1,
              textAlign: 'left',
            }}
          >
            <Typography variant="caption" color="error" component="pre" sx={{ fontSize: '0.75rem' }}>
              {error.toString()}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          {resetError && (
            <Button variant="contained" onClick={resetError}>
              Try Again
            </Button>
          )}
          {showHomeButton && (
            <Button
              variant="outlined"
              startIcon={<Home size={18} />}
              onClick={handleGoHome}
            >
              Go Home
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default ErrorFallback;
