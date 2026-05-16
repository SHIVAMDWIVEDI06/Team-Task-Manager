import React from 'react';
import { Box } from '@mui/material';

const tones = {
  coral: {
    bg: 'linear-gradient(135deg, #ff8a4c 0%, #fb4f3f 100%)',
    glow: 'rgba(251, 91, 63, 0.32)',
    ring: 'rgba(255, 255, 255, 0.48)',
  },
  green: {
    bg: 'linear-gradient(135deg, #4de3ad 0%, #22c98a 100%)',
    glow: 'rgba(34, 201, 138, 0.28)',
    ring: 'rgba(255, 255, 255, 0.48)',
  },
  rose: {
    bg: 'linear-gradient(135deg, #ff7d91 0%, #f43f5e 100%)',
    glow: 'rgba(244, 63, 94, 0.28)',
    ring: 'rgba(255, 255, 255, 0.48)',
  },
  amber: {
    bg: 'linear-gradient(135deg, #ffc46b 0%, #ff8a3d 100%)',
    glow: 'rgba(255, 155, 61, 0.3)',
    ring: 'rgba(255, 255, 255, 0.5)',
  },
  slate: {
    bg: 'linear-gradient(135deg, #526789 0%, #2f4367 100%)',
    glow: 'rgba(47, 67, 103, 0.24)',
    ring: 'rgba(255, 255, 255, 0.34)',
  },
  teal: {
    bg: 'linear-gradient(135deg, #57d8cf 0%, #2ec4b6 100%)',
    glow: 'rgba(46, 196, 182, 0.28)',
    ring: 'rgba(255, 255, 255, 0.48)',
  },
};

export default function PremiumIcon({ children, tone = 'coral', size = 56, radius = '16px', subtle = false }) {
  const palette = tones[tone] || tones.coral;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: radius,
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        flex: '0 0 auto',
        background: subtle ? '#fff' : palette.bg,
        boxShadow: subtle ? '0 12px 24px rgba(47, 67, 103, 0.1)' : `0 18px 34px ${palette.glow}`,
        border: subtle ? '1px solid #e8edf5' : '1px solid rgba(255, 255, 255, 0.22)',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 6,
          borderRadius: 'inherit',
          border: `1px solid ${palette.ring}`,
          opacity: subtle ? 0 : 1,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          width: '58%',
          height: '58%',
          top: -12,
          right: -10,
          borderRadius: '50%',
          background: subtle ? 'rgba(251, 91, 63, 0.08)' : 'rgba(255, 255, 255, 0.2)',
        },
        '& svg': {
          position: 'relative',
          zIndex: 1,
          filter: subtle ? 'none' : 'drop-shadow(0 2px 3px rgba(47, 67, 103, 0.22))',
        },
      }}
    >
      {children}
    </Box>
  );
}
