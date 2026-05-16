import React from 'react';
import { Box, Skeleton, Paper } from '@mui/material';

/**
 * Skeleton loader for table components
 */
export const TableSkeleton = ({ rows = 5, columns = 4 }) => {
  return (
    <Paper sx={{ p: 2 }}>
      {/* Table header */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, pb: 2, borderBottom: '1px solid #e5e7eb' }}>
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} variant="text" width={`${100 / columns}%`} height={24} />
        ))}
      </Box>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box
          key={`row-${rowIndex}`}
          sx={{
            display: 'flex',
            gap: 2,
            mb: 1.5,
            py: 1,
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              variant="text"
              width={`${100 / columns}%`}
              height={20}
            />
          ))}
        </Box>
      ))}
    </Paper>
  );
};
