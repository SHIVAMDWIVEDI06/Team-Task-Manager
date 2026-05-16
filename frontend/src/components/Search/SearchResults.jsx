import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
} from '@mui/material';
import { FolderKanban, CheckSquare, User, ArrowRight, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSearch } from '../../context/SearchContext';

/**
 * SearchResults component to display full search results
 * Shows projects, tasks, and team members with highlighted matching text
 * Requirements: 1.3, 1.4, 1.6
 */
export default function SearchResults() {
  const navigate = useNavigate();

  const {
    searchResults,
    searchQuery,
    loading,
    executeSearch,
    clearSearch,
  } = useSearch();

  const { projects, tasks, teamMembers } = searchResults;
  const hasResults = projects?.length > 0 || tasks?.length > 0 || teamMembers?.length > 0;

  // Navigate to project detail
  const handleProjectClick = (projectId) => {
    navigate(`/projects/${projectId}`);
    clearSearch();
  };

  // Navigate to task in project
  const handleTaskClick = (task) => {
    navigate(`/projects/${task.project_id}?taskId=${task.id}`);
    clearSearch();
  };

  // Navigate to team page
  const handleTeamMemberClick = () => {
    navigate('/team');
    clearSearch();
  };

  // Helper to safely render highlighted HTML
  const renderHighlightedText = (text, highlightClass = '') => {
    if (!text) return null;
    return (
      <span
        dangerouslySetInnerHTML={{ __html: text }}
        className={highlightClass}
      />
    );
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'done':
        return 'success';
      case 'in progress':
        return 'info';
      case 'to do':
        return 'default';
      default:
        return 'default';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">Searching...</Typography>
      </Box>
    );
  }

  if (!searchQuery.trim()) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Enter a search term to find projects, tasks, and team members
        </Typography>
      </Box>
    );
  }

  if (!hasResults) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No results found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          We couldn't find anything matching "{searchQuery}"
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Suggestions:
        </Typography>
        <Typography variant="caption" color="text.secondary">
          • Check your spelling
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          • Try different keywords
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          • Try more general search terms
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Found {projects?.length + tasks?.length + teamMembers?.length} results for "{searchQuery}"
      </Typography>

      {/* Projects Section */}
      {projects?.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderKanban size={16} />
            Projects ({projects.length})
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <List disablePadding>
              {projects.map((project, index) => (
                <React.Fragment key={project.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => handleProjectClick(project.id)}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <FolderKanban size={20} color="#64748b" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight={600}>
                            {renderHighlightedText(project.highlighted_name || project.name)}
                          </Typography>
                        }
                        secondary={
                          project.description ? (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {renderHighlightedText(project.highlighted_description || project.description)}
                            </Typography>
                          ) : null
                        }
                      />
                      <ArrowRight size={16} color="#94a3b8" />
                    </ListItemButton>
                  </ListItem>
                  {index < projects.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Box>
      )}

      {/* Tasks Section */}
      {tasks?.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckSquare size={16} />
            Tasks ({tasks.length})
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <List disablePadding>
              {tasks.map((task, index) => (
                <React.Fragment key={task.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => handleTaskClick(task)}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <CheckSquare size={20} color="#64748b" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {renderHighlightedText(task.highlighted_title || task.title)}
                            </Typography>
                            <Chip
                              label={task.status}
                              size="small"
                              color={getStatusColor(task.status)}
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                            <Chip
                              label={task.priority}
                              size="small"
                              color={getPriorityColor(task.priority)}
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {task.project_name}
                            </Typography>
                            {task.due_date && (
                              <>
                                <Calendar size={12} color="#94a3b8" />
                                <Typography variant="caption" color="text.secondary">
                                  {formatDate(task.due_date)}
                                </Typography>
                              </>
                            )}
                          </Box>
                        }
                      />
                      <ArrowRight size={16} color="#94a3b8" />
                    </ListItemButton>
                  </ListItem>
                  {index < tasks.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Box>
      )}

      {/* Team Members Section */}
      {teamMembers?.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <User size={16} />
            Team Members ({teamMembers.length})
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <List disablePadding>
              {teamMembers.map((member, index) => (
                <React.Fragment key={member.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={handleTeamMemberClick}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <User size={20} color="#64748b" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight={600}>
                            {renderHighlightedText(member.highlighted_username || member.username)}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {renderHighlightedText(member.highlighted_email || member.email)}
                          </Typography>
                        }
                      />
                      <Chip
                        label={member.role}
                        size="small"
                        color={member.role === 'admin' ? 'primary' : 'default'}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      <ArrowRight size={16} color="#94a3b8" sx={{ ml: 1 }} />
                    </ListItemButton>
                  </ListItem>
                  {index < teamMembers.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Box>
      )}
    </Box>
  );
}