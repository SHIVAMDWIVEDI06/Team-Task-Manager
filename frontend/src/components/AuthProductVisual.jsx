import React from 'react';
import { Box, Typography } from '@mui/material';
import { CheckCircle2, Clock3, FolderKanban, TrendingUp, Users } from 'lucide-react';
import PremiumIcon from './PremiumIcon';

export default function AuthProductVisual({ title, subtitle }) {
  return (
    <Box
      sx={{
        minHeight: { xs: 300, md: 'auto' },
        p: { xs: 3, md: 5 },
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background:
          'radial-gradient(circle at 22% 16%, rgba(255,255,255,0.22), transparent 24%), linear-gradient(145deg, #31476e 0%, #526789 48%, #fb6a3f 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 'auto -64px -82px auto',
          width: 240,
          height: 240,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.12)',
        }}
      />
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1.5,
            maxWidth: 430,
          }}
        >
          <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <PremiumIcon tone="coral" size={46} radius="14px">
              <FolderKanban size={22} />
            </PremiumIcon>
            <Typography sx={{ mt: 2, fontWeight: 900 }}>Project pulse</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem', fontWeight: 700 }}>12 active boards</Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#fff', color: '#2f4367', transform: 'translateY(24px)', boxShadow: '0 22px 42px rgba(22, 34, 55, 0.22)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <PremiumIcon tone="green" size={42} radius="13px">
                <CheckCircle2 size={20} />
              </PremiumIcon>
              <Typography sx={{ color: '#22c98a', fontWeight: 900 }}>82%</Typography>
            </Box>
            <Typography sx={{ fontWeight: 900 }}>Completion</Typography>
            <Box sx={{ height: 8, mt: 1.5, borderRadius: 8, bgcolor: '#eef2f7', overflow: 'hidden' }}>
              <Box sx={{ width: '82%', height: '100%', bgcolor: '#22c98a' }} />
            </Box>
          </Box>
          <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#fff', color: '#2f4367', mt: 1, boxShadow: '0 22px 42px rgba(22, 34, 55, 0.18)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <PremiumIcon tone="amber" size={42} radius="13px">
                <Clock3 size={20} />
              </PremiumIcon>
              <Box>
                <Typography sx={{ fontWeight: 900 }}>Sprint focus</Typography>
                <Typography sx={{ color: '#70809d', fontSize: '0.8rem', fontWeight: 700 }}>Today, 6 tasks</Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.2)', mt: 4 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Users size={20} />
              <TrendingUp size={20} />
            </Box>
            <Typography sx={{ mt: 2, fontWeight: 900 }}>Team velocity</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem', fontWeight: 700 }}>Balanced workload</Typography>
          </Box>
        </Box>
      </Box>
      <Box sx={{ position: 'relative', zIndex: 1, mt: { xs: 6, md: 8 } }}>
        <Typography variant="h4" sx={{ color: '#fff', mb: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.86)', fontWeight: 700, lineHeight: 1.8, maxWidth: 430 }}>
          {subtitle}
        </Typography>
      </Box>
    </Box>
  );
}
