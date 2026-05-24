import React from 'react';
import { Backdrop, Box, CircularProgress, Typography } from '@mui/material';
import { FolderKanban } from 'lucide-react';
import PremiumIcon from './PremiumIcon';
import { motion } from 'framer-motion';

export default function GlobalLoader({ open, message = "Loading Workspace..." }) {
  return (
    <Backdrop
      sx={{
        color: '#fff',
        zIndex: (theme) => theme.zIndex.drawer + 9999,
        backdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }}
      open={open}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress 
            size={90} 
            thickness={2.5} 
            sx={{ color: '#fb5b3f', position: 'absolute', top: -11, left: -11, zIndex: 0 }} 
          />
          <PremiumIcon tone="coral" size={68} radius="20px" sx={{ zIndex: 1, position: 'relative' }}>
            <FolderKanban size={32} />
          </PremiumIcon>
        </Box>
      </motion.div>
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
      >
        <Typography 
          variant="h6" 
          sx={{ 
            color: '#2f4367', 
            fontWeight: 800,
            letterSpacing: '-0.01em'
          }}
        >
          {message}
        </Typography>
      </motion.div>
    </Backdrop>
  );
}
