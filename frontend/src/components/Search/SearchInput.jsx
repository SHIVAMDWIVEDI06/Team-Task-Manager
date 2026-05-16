import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Search, FolderKanban, CheckSquare, User, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearch } from '../../context/SearchContext';

/**
 * SearchInput component with autocomplete dropdown
 * Provides real-time search suggestions with keyboard navigation
 * Requirements: 1.1, 1.3, 10.1, 10.2
 */
export default function SearchInput({ variant = 'default' }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const {
    searchQuery,
    suggestions,
    suggestionsLoading,
    isSearchOpen,
    selectedIndex,
    loading: searchLoading,
    updateSearchQuery,
    executeSearch,
    clearSearch,
    openSearch,
    closeSearch,
    navigateNext,
    navigatePrev,
    selectSuggestion,
    setSelectedIndex,
  } = useSearch();

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        closeSearch();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeSearch]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isSearchOpen || suggestions.length === 0) {
      if (e.key === 'Enter' && searchQuery.trim()) {
        executeSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        navigateNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigatePrev();
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSuggestionClick(selectedIndex);
        } else if (searchQuery.trim()) {
          executeSearch();
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeSearch();
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (index) => {
    const suggestion = selectSuggestion(index);
    if (suggestion) {
      // Navigate to the appropriate page based on type
      switch (suggestion.type) {
        case 'project':
          navigate(`/projects/${suggestion.id}`);
          break;
        case 'task':
          navigate(`/projects/${suggestion.project_id}?taskId=${suggestion.id}`);
          break;
        case 'user':
          navigate('/team');
          break;
        default:
          break;
      }
      clearSearch();
    }
  };

  // Handle input change
  const handleInputChange = (e) => {
    const value = e.target.value;
    updateSearchQuery(value);
    if (value.trim()) {
      openSearch();
    }
  };

  // Handle input focus
  const handleFocus = () => {
    if (searchQuery.trim() && suggestions.length > 0) {
      openSearch();
    }
  };

  // Get icon for suggestion type
  const getSuggestionIcon = (type) => {
    switch (type) {
      case 'project':
        return <FolderKanban size={18} />;
      case 'task':
        return <CheckSquare size={18} />;
      case 'user':
        return <User size={18} />;
      default:
        return <Search size={18} />;
    }
  };

  // Get route label for suggestion
  const getRouteLabel = (route) => {
    switch (route) {
      case 'projects':
        return 'Project';
      case 'tasks':
        return 'Task';
      case 'team':
        return 'Team';
      default:
        return '';
    }
  };

  const hasResults = suggestions.length > 0 || suggestionsLoading || searchLoading;
  const isTopbar = variant === 'topbar';

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: { xs: '100%', sm: isTopbar ? 245 : 300 },
      }}
    >
      <TextField
        ref={inputRef}
        value={searchQuery}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder="Search projects, tasks, team..."
        size="small"
        fullWidth
        autoComplete="off"
        aria-label="Search"
        aria-expanded={isSearchOpen && hasResults}
        aria-controls="search-results"
        role="combobox"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} color={isTopbar ? '#a7b1c2' : '#70809d'} />
              </InputAdornment>
            ),
            endAdornment: searchLoading ? (
              <InputAdornment position="end">
                <CircularProgress size={16} color="inherit" />
              </InputAdornment>
            ) : null,
            sx: {
              bgcolor: '#fff',
              borderRadius: '8px',
              boxShadow: isTopbar ? '0 10px 22px rgba(47, 67, 103, 0.11)' : 'none',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: isTopbar ? 'rgba(255,255,255,0.85)' : '#e8edf5',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: isTopbar ? '#fff' : '#fb8a4c',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#fb5b3f',
              },
              '& input': {
                py: 1.25,
                fontWeight: 600,
                color: '#2f4367',
              },
            },
          },
        }}
      />

      {/* Search Suggestions Dropdown */}
      <AnimatePresence>
        {isSearchOpen && hasResults && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <Paper
              id="search-results"
              elevation={4}
              sx={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                mt: 1,
                maxHeight: 400,
                overflow: 'auto',
                borderRadius: 2,
                border: '1px solid #e8edf5',
                zIndex: 1300,
              }}
            >
              {suggestionsLoading ? (
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: '#64748b' }} />
                </Box>
              ) : suggestions.length > 0 ? (
                <List dense disablePadding>
                  {suggestions.map((suggestion, index) => (
                    <ListItem key={`${suggestion.type}-${suggestion.id}`} disablePadding>
                      <ListItemButton
                        selected={index === selectedIndex}
                        onClick={() => handleSuggestionClick(index)}
                        sx={{
                          py: 1.5,
                          px: 2,
                          '&.Mui-selected': {
                            bgcolor: 'primary.light',
                            '&:hover': {
                              bgcolor: 'primary.light',
                            },
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
                          {getSuggestionIcon(suggestion.type)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {suggestion.title}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                {suggestion.subtitle}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 500 }}>
                                {getRouteLabel(suggestion.route)}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              ) : searchQuery.trim() && !suggestionsLoading ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No results found
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Try searching for project names, task titles, or team member names
                  </Typography>
                </Box>
              ) : null}
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
