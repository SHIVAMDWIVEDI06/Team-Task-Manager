import React, { useEffect, useState } from 'react';
import {
  Avatar,
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

const cardSx = {
  height: '100%',
  borderRadius: '8px',
  border: '1px solid #e8edf5',
  boxShadow: '0 16px 34px rgba(47, 67, 103, 0.08)',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    borderColor: '#ffb08b',
    boxShadow: '0 20px 40px rgba(47, 67, 103, 0.12)',
  },
};

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
          <Typography sx={{ color: '#fff', opacity: 0.86, fontWeight: 700 }}>
            Organize teams, task boards, and delivery milestones.
          </Typography>
        </Box>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => setCreateModalOpen(true)}
            sx={{ bgcolor: '#fff', color: '#fb5b3f', '&:hover': { bgcolor: '#fff2e3' } }}
          >
            Create Project
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 3 }}>
        {loading
          ? [...Array(6)].map((_, index) => (
              <Box key={index} sx={{ minWidth: 0 }}>
                <Skeleton variant="rectangular" height={245} sx={{ borderRadius: '8px' }} />
              </Box>
            ))
          : projects.map((project, index) => (
              <Box key={project.id} sx={{ minWidth: 0 }}>
                <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card sx={cardSx}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                        <PremiumIcon tone="coral" size={58} radius="16px">
                          <FolderOpen size={27} />
                        </PremiumIcon>
                        <Chip label="Workspace" size="small" sx={{ bgcolor: '#f6f8fb', color: '#70809d', fontWeight: 800 }} />
                      </Box>

                      <Typography variant="h6" sx={{ color: '#2f4367', mb: 1 }}>
                        {project.name}
                      </Typography>
                      <Typography
                        sx={{
                          color: '#70809d',
                          minHeight: 48,
                          lineHeight: 1.7,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
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

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {(project.members || []).slice(0, 3).map((member, avatarIndex) => (
                            <Avatar
                              key={`${project.id}-member-${member.id}`}
                              sx={{
                                width: 30,
                                height: 30,
                                ml: avatarIndex ? -0.8 : 0,
                                bgcolor: avatarIndex === 0 ? '#fb5b3f' : avatarIndex === 1 ? '#22c98a' : '#ff9b3d',
                                border: '2px solid #fff',
                                fontSize: '0.76rem',
                                fontWeight: 900,
                              }}
                            >
                              {member.username?.[0]?.toUpperCase() || '?'}
                            </Avatar>
                          ))}
                          {project.members?.length > 3 && (
                            <Avatar
                              sx={{
                                width: 30,
                                height: 30,
                                ml: -0.8,
                                bgcolor: '#e8edf5',
                                color: '#70809d',
                                border: '2px solid #fff',
                                fontSize: '0.76rem',
                                fontWeight: 900,
                              }}
                            >
                              +{project.members.length - 3}
                            </Avatar>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {isAdmin && (
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(project.id);
                              }}
                              sx={{
                                border: '1px solid #ffe4ea',
                                color: '#f43f5e',
                                borderRadius: '8px',
                                '&:hover': { bgcolor: '#fff7f8' },
                              }}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          )}
                          <Button
                            variant="outlined"
                            endIcon={<ArrowRight size={16} />}
                            onClick={() => navigate(`/projects/${project.id}`)}
                            sx={{ borderColor: '#e8edf5', color: '#2f4367', '&:hover': { borderColor: '#fb5b3f' } }}
                          >
                            View Board
                          </Button>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Box>
            ))}
      </Box>

      {!loading && projects.length === 0 && (
        <Box className="argon-card" sx={{ p: 4, textAlign: 'center', color: '#70809d' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <PremiumIcon tone="slate" size={66} radius="18px">
              <FolderOpen size={30} />
            </PremiumIcon>
          </Box>
          <Typography variant="h6" sx={{ color: '#2f4367', mb: 1 }}>
            No projects yet
          </Typography>
          <Typography sx={{ mb: 2 }}>Create your first workspace to start tracking team tasks.</Typography>
          {isAdmin && (
            <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setCreateModalOpen(true)}>
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
