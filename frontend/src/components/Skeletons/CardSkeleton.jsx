import React from 'react';
import { Box, Skeleton, Paper } from '@mui/material';

/**
 * Skeleton loader for card components
 */
export const CardSkeleton = ({ height = 200, variant = 'rectangular' }) => {
  return (
    <Paper
      sx={{
        p: 2,
        height: height,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Skeleton variant="text" width="60%" height={24} />
      <Skeleton variant={variant} width="100%" height={height - 100} />
      <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton variant="text" width="40%" height={24} />
      </Box>
    </Paper>
  );
};

/**
 * Multiple card skeletons
 */
export const CardSkeletonGroup = ({ count = 3, height = 200 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} height={height} />
      ))}
    </>
  );
};
