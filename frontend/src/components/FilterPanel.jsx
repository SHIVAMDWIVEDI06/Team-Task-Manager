import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  Drawer,
  FormControlLabel,
  FormGroup,
  IconButton,
  Typography,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Badge,
} from '@mui/material';
import { X, FilterX } from 'lucide-react';
import { useFilters } from '../context/FilterContext';

export default function FilterPanel({ open, onClose, members }) {
  const {
    filters,
    toggleFilterValue,
    updateFilter,
    clearFilters,
    activeFilterCount,
    hasActiveFilters,
  } = useFilters();

  const statuses = ['To Do', 'In Progress', 'Done'];
  const priorities = ['High', 'Medium', 'Low'];

  const handleDueDateChange = (field) => (e) => {
    updateFilter('dueDate', {
      ...filters.dueDate,
      [field]: e.target.value || null,
    });
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 340 },
          p: 3,
          boxShadow: '-10px 0 40px rgba(47, 67, 103, 0.08)',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ color: '#2f4367', fontWeight: 900 }}>Filters</Typography>
          {hasActiveFilters && (
            <Badge badgeContent={activeFilterCount} color="error" sx={{ '& .MuiBadge-badge': { fontWeight: 900 } }} />
          )}
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: '#70809d' }}>
          <X size={20} />
        </IconButton>
      </Box>

      {hasActiveFilters && (
        <Button
          variant="outlined"
          color="error"
          fullWidth
          size="small"
          startIcon={<FilterX size={16} />}
          onClick={clearFilters}
          sx={{ mb: 3, fontWeight: 700 }}
        >
          Clear all filters
        </Button>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* Status Filter */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ color: '#2f4367', fontWeight: 800, mb: 1 }}>Status</Typography>
        <FormGroup>
          {statuses.map((status) => (
            <FormControlLabel
              key={status}
              control={
                <Checkbox
                  checked={filters.status.includes(status)}
                  onChange={() => toggleFilterValue('status', status)}
                  sx={{ '&.Mui-checked': { color: '#fb5b3f' } }}
                />
              }
              label={<Typography sx={{ color: '#70809d', fontWeight: 600, fontSize: '0.85rem' }}>{status}</Typography>}
            />
          ))}
        </FormGroup>
      </Box>

      {/* Priority Filter */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ color: '#2f4367', fontWeight: 800, mb: 1 }}>Priority</Typography>
        <FormGroup>
          {priorities.map((priority) => (
            <FormControlLabel
              key={priority}
              control={
                <Checkbox
                  checked={filters.priority.includes(priority)}
                  onChange={() => toggleFilterValue('priority', priority)}
                  sx={{ '&.Mui-checked': { color: '#fb5b3f' } }}
                />
              }
              label={<Typography sx={{ color: '#70809d', fontWeight: 600, fontSize: '0.85rem' }}>{priority}</Typography>}
            />
          ))}
        </FormGroup>
      </Box>

      {/* Assignee Filter */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ color: '#2f4367', fontWeight: 800, mb: 1.5 }}>Assignee</Typography>
        <FormControl fullWidth size="small">
          <InputLabel>Select Members</InputLabel>
          <Select
            multiple
            value={filters.assignee}
            onChange={(e) => updateFilter('assignee', e.target.value)}
            label="Select Members"
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => {
                  const member = members?.find((m) => m.id === value);
                  return (
                    <Box key={value} sx={{ bgcolor: '#f0f4f8', px: 1, py: 0.2, borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {member?.username || 'Unknown'}
                    </Box>
                  );
                })}
              </Box>
            )}
          >
            {members?.map((member) => (
              <MenuItem key={member.id} value={member.id}>
                {member.username}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Due Date Filter */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ color: '#2f4367', fontWeight: 800, mb: 1.5 }}>Due Date Range</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
          <TextField
            label="From"
            type="date"
            size="small"
            value={filters.dueDate.start || ''}
            onChange={handleDueDateChange('start')}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={filters.dueDate.end || ''}
            onChange={handleDueDateChange('end')}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Box>
      </Box>

    </Drawer>
  );
}
