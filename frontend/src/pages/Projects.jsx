import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  Skeleton,
  IconButton,
  Chip,
  AvatarGroup,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { Plus, Trash2, FolderOpen, MoreHorizontal, Users, Calendar } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../config';
import toast from 'react-hot-toast';

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
        headers: { Authorization: `Bearer ${token}` }
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
        headers: { Authorization: `Bearer ${token}` }
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
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProjects();
      toast.success('Project deleted successfully');
    } catch (err) {
      console.error('Delete project failed', err);
      toast.error('Failed to delete project');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 6 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, color: 'slate.900', letterSpacing: -1 }}>
            My Projects
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your teams and keep track of all ongoing work.
          </Typography>
        </Box>
        {isAdmin && (
          <Button 
            variant="contained" 
            startIcon={<Plus size={18} />}
            onClick={() => setCreateModalOpen(true)}
            sx={{ borderRadius: 3, px: 3, py: 1.2, fontWeight: 700 }}
          >
            Create Project
          </Button>
        )}
      </Box>

      <Grid container spacing={4}>
        {loading ? (
          [...Array(3)].map((_, i) => (
            <Grid item xs={12} md={4} key={i}>
              <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 5 }} />
            </Grid>
          ))
        ) : (
          projects.map((project, index) => (
            <Grid item xs={12} md={4} key={project.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card sx={{ 
                  height: '100%', 
                  borderRadius: 5, 
                  border: '1px solid', 
                  borderColor: 'slate.100',
                  boxShadow: 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-6px)',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)'
                  }
                }}>
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                      <Box sx={{ 
                        p: 1.5, 
                        bgcolor: 'rgba(79, 70, 229, 0.08)', 
                        color: 'primary.main', 
                        borderRadius: 3, 
                        display: 'flex' 
                      }}>
                        <FolderOpen size={24} />
                      </Box>
                      <IconButton size="small"><MoreHorizontal size={20} color="#94a3b8" /></IconButton>
                    </Box>

                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: 'slate.900' }}>
                      {project.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ 
                      mb: 3, 
                      display: '-webkit-box', 
                      WebkitLineClamp: 2, 
                      WebkitBoxOrient: 'vertical', 
                      overflow: 'hidden',
                      minHeight: 40
                    }}>
                      {project.description}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                       <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'slate.400' }}>
                          <Users size={14} />
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>12 Members</Typography>
                       </Box>
                       <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'slate.400' }}>
                          <Calendar size={14} />
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>24 Tasks</Typography>
                       </Box>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.75rem' } }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>S</Avatar>
                        <Avatar sx={{ bgcolor: 'success.main' }}>J</Avatar>
                        <Avatar sx={{ bgcolor: 'warning.main' }}>A</Avatar>
                      </AvatarGroup>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {isAdmin && (
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                            sx={{ border: '1px solid', borderColor: 'error.light' }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        )}
                        <Button 
                          variant="outlined"
                          size="small" 
                          onClick={() => navigate(`/projects/${project.id}`)}
                          sx={{ 
                            borderRadius: 2, 
                            fontWeight: 700, 
                            px: 2,
                            borderColor: 'slate.200',
                            color: 'slate.600',
                            '&:hover': { bgcolor: 'primary.main', color: 'white', borderColor: 'primary.main' }
                          }}
                        >
                          View Board
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))
        )}
      </Grid>

      {/* Create Project Modal */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} PaperProps={{ sx: { borderRadius: 5, p: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            variant="outlined"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            sx={{ mb: 3, mt: 1 }}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setCreateModalOpen(false)} sx={{ color: 'slate-500' }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateProject} sx={{ borderRadius: 2, px: 4 }}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

