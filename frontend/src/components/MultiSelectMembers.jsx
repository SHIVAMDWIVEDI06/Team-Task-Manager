import React, { useState } from 'react';
import {
  Autocomplete,
  Avatar,
  Box,
  Checkbox,
  Chip,
  TextField,
  Typography,
} from '@mui/material';
import { Check } from 'lucide-react';

/**
 * MultiSelectMembers Component
 * Allows selecting multiple members with autocomplete and visual feedback
 * 
 * @param {Array} options - Array of user objects with {id, username, email}
 * @param {Array} value - Array of selected user IDs
 * @param {Function} onChange - Callback when selection changes
 * @param {String} label - Label for the input field
 * @param {String} placeholder - Placeholder text
 */
export default function MultiSelectMembers({ 
  options = [], 
  value = [], 
  onChange, 
  label = "Select Members",
  placeholder = "Search and select members..."
}) {
  const [inputValue, setInputValue] = useState('');

  // Convert value (array of IDs) to selected users
  const selectedUsers = options.filter(user => value.includes(user.id));

  const handleChange = (event, newValue) => {
    // newValue is array of user objects
    const selectedIds = newValue.map(user => user.id);
    onChange(selectedIds);
  };

  return (
    <Autocomplete
      multiple
      options={options}
      value={selectedUsers}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => setInputValue(newInputValue)}
      getOptionLabel={(option) => option.username || option.email}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      disableCloseOnSelect
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={selectedUsers.length === 0 ? placeholder : ''}
          variant="outlined"
        />
      )}
      renderOption={(props, option, { selected }) => (
        <li {...props} key={option.id}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
            <Checkbox
              icon={<Box sx={{ width: 18, height: 18, border: '2px solid #cbd5e0', borderRadius: '4px' }} />}
              checkedIcon={
                <Box sx={{ width: 18, height: 18, bgcolor: '#fb5b3f', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={12} color="#fff" />
                </Box>
              }
              checked={selected}
            />
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: selected ? '#fb5b3f' : '#e8edf5',
                color: selected ? '#fff' : '#70809d',
                fontSize: '0.875rem',
                fontWeight: 900,
              }}
            >
              {option.username?.[0]?.toUpperCase() || option.email?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, color: '#2f4367', fontSize: '0.875rem' }}>
                {option.username}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#70809d', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {option.email}
              </Typography>
            </Box>
            {option.role === 'Admin' && (
              <Chip
                label="Admin"
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: '#fff2e3',
                  color: '#fb5b3f',
                  fontWeight: 900,
                }}
              />
            )}
          </Box>
        </li>
      )}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            {...getTagProps({ index })}
            key={option.id}
            avatar={
              <Avatar
                sx={{
                  bgcolor: '#fb5b3f',
                  color: '#fff',
                  width: 24,
                  height: 24,
                  fontSize: '0.75rem',
                  fontWeight: 900,
                }}
              >
                {option.username?.[0]?.toUpperCase()}
              </Avatar>
            }
            label={option.username}
            sx={{
              bgcolor: '#fff2e3',
              color: '#2f4367',
              fontWeight: 700,
              '& .MuiChip-deleteIcon': {
                color: '#fb5b3f',
                '&:hover': {
                  color: '#d94a34',
                },
              },
            }}
          />
        ))
      }
      sx={{
        '& .MuiOutlinedInput-root': {
          padding: '8px',
        },
        '& .MuiAutocomplete-tag': {
          margin: '2px',
        },
      }}
    />
  );
}
