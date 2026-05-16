import React from 'react';
import { Box, Skeleton, Paper, Grid } from '@mui/material';

/**
 * Skeleton loader for dashboard stats cards
 */
export const StatCardSkeleton = () => {
  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={32} sx={{ mt: 1 }} />
        </Box>
        <Skeleton variant="circular" width={48} height={48} />
      </Box>
      <Skeleton variant="text" width="50%" height={16} />
    </Paper>
  );
};

/**
 * Skeleton loader for dashboard chart
 */
export const ChartSkeleton = ({ height = 300 }) => {
  return (
    <Paper sx={{ p: 3 }}>
      <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" width="100%" height={height} sx={{ borderRadius: 2 }} />
    </Paper>
  );
};

/**
 * Complete dashboard skeleton
 */
export const DashboardSkeleton = () => {
  return (
    <Box>
      {/* Stats cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <StatCardSkeleton />
          </Grid>
        ))}
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <ChartSkeleton height={350} />
        </Grid>
        <Grid item xs={12} md={4}>
          <ChartSkeleton height={350} />
        </Grid>
      </Grid>
    </Box>
  );
};
