import React from 'react';
import { Box, Skeleton, Paper } from '@mui/material';

/**
 * Skeleton loader for list components
 */
export const ListSkeleton = ({ items = 5, showAvatar = true }) => {
  return (
    <Paper sx={{ p: 2 }}>
      {Array.from({ length: items }).map((_, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: index < items - 1 ? 2 : 0,
            pb: index < items - 1 ? 2 : 0,
            borderBottom: index < items - 1 ? '1px solid #e5e7eb' : 'none',
          }}
        >
          {showAvatar && <Skeleton variant="circular" width={40} height={40} />}
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="70%" height={20} />
            <Skeleton variant="text" width="50%" height={16} />
          </Box>
          <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
        </Box>
      ))}
    </Paper>
  );
};
