import React, { useEffect, useState } from 'react';
import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowRight, CalendarDays, FolderOpen, Plus, Trash2, Users } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../config';
import toast from 'react-hot-toast';
import PremiumIcon from '../components/PremiumIcon';

// Premium styles now handled by theme and index.css classes

export default function Projects() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(res.data);
    } catch (err) {
      console.error('Projects fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/projects`, newProject, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCreateModalOpen(false);
      setNewProject({ name: '', description: '' });
      fetchProjects();
      toast.success('Project created successfully');
    } catch (err) {
      console.error('Create project failed', err);
      toast.error('Failed to create project');
    }
  };

  const handleDeleteProject = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchProjects();
      toast.success('Project deleted successfully');
    } catch (err) {
      console.error('Delete project failed', err);
      toast.error('Failed to delete project');
    }
  };

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 3.5,
        }}
      >
        <Box>
          <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', mb: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            Organize teams, task boards, and delivery milestones.
          </Typography>
        </Box>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => setCreateModalOpen(true)}
            sx={{ background: 'linear-gradient(135deg, #ff7a55 0%, #fb5b3f 100%)', color: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(251, 91, 63, 0.25)', '&:hover': { boxShadow: '0 6px 16px rgba(251, 91, 63, 0.35)' } }}
          >
            Create Project
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 3 }}>
        {loading
          ? [...Array(6)].map((_, index) => (
              <Box key={index} sx={{ minWidth: 0 }}>
                <Skeleton variant="rectangular" height={245} sx={{ borderRadius: '16px' }} />
              </Box>
            ))
          : projects.map((project, index) => (
              <Box key={project.id} sx={{ minWidth: 0 }}>
                <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card className="glass-panel premium-shadow hover-lift" sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: '16px' }}>
                    <CardContent sx={{ flexGrow: 1, p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <PremiumIcon tone="slate" size={48} radius="12px">
                          <FolderOpen size={24} />
                        </PremiumIcon>
                        <Chip
                          label={`${project.task_count || 0} tasks`}
                          size="small"
                          sx={{ bgcolor: 'rgba(47,67,103,0.06)', color: 'var(--text-primary)', fontWeight: 800 }}
                        />
                      </Box>

                      <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--text-primary)', mb: 1, lineHeight: 1.3 }}>
                        {project.name}
                      </Typography>
                      <Typography
                        sx={{
                          color: 'var(--text-secondary)',
                          minHeight: 48,
                          lineHeight: 1.7,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          fontSize: '0.9rem'
                        }}
                      >
                        {project.description || 'No description has been added for this project yet.'}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1.5, mt: 3, mb: 3, flexWrap: 'wrap' }}>
                        <Chip
                          icon={<Users size={15} />}
                          label="Team board"
                          sx={{ bgcolor: '#effaf5', color: '#159664', fontWeight: 800 }}
                        />
                        <Chip
                          icon={<CalendarDays size={15} />}
                          label="Task timeline"
                          sx={{ bgcolor: '#f6f8fb', color: '#70809d', fontWeight: 800 }}
                        />
                      </Box>
                    </CardContent>
                    <Box sx={{ px: 3, pb: 3, pt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 30, height: 30, fontSize: '0.76rem', fontWeight: 900, border: '2px solid #fff' } }}>
                        {(project.members || []).map((member) => (
                          <Avatar
                            key={`${project.id}-member-${member.id}`}
                            sx={{ bgcolor: 'var(--bg-app)', color: 'var(--text-primary)' }}
                          >
                            {member.username?.[0]?.toUpperCase()}
                          </Avatar>
                        ))}
                      </AvatarGroup>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {isAdmin && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project.id);
                            }}
                            className="btn-icon-danger"
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        )}
                        <Button
                          variant="outlined"
                          endIcon={<ArrowRight size={16} />}
                          onClick={() => navigate(`/projects/${project.id}`)}
                          className="btn-outline"
                        >
                          View
                        </Button>
                      </Box>
                    </Box>
                  </Card>
                </motion.div>
              </Box>
            ))}
      </Box>

      {!loading && projects.length === 0 && (
        <Box className="glass-panel" sx={{ p: 6, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <PremiumIcon tone="slate" size={66} radius="18px">
              <FolderOpen size={30} />
            </PremiumIcon>
          </Box>
          <Typography variant="h5" sx={{ color: 'var(--text-primary)', fontWeight: 900, mb: 1 }}>
            No projects yet
          </Typography>
          <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 700, mb: 2 }}>Create your first workspace to start tracking team tasks.</Typography>
          {isAdmin && (
            <Button variant="contained" sx={{ mt: 2, background: 'linear-gradient(135deg, #ff7a55 0%, #fb5b3f 100%)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(251, 91, 63, 0.25)' }} startIcon={<Plus size={18} />} onClick={() => setCreateModalOpen(true)}>
              Create Project
            </Button>
          )}
        </Box>
      )}

      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} PaperProps={{ sx: { borderRadius: '8px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#2f4367' }}>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            sx={{ mb: 3, mt: 1 }}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setCreateModalOpen(false)} sx={{ color: '#70809d' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateProject}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
