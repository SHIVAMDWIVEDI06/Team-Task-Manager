import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Box, 
  Grid, 
  Paper, 
  Chip, 
  Avatar, 
  IconButton, 
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Skeleton,
  AvatarGroup,
  Menu
} from '@mui/material';
import { 
  MoreVertical, 
  Plus, 
  Calendar, 
  ArrowLeft,
  Filter,
  Users,
  Trash2
} from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const priorityColors = {
  High: { color: '#ef4444', bg: '#fef2f2' },
  Medium: { color: '#f59e0b', bg: '#fffbeb' },
  Low: { color: '#10b981', bg: '#f0fdf4' }
};

const TaskCard = ({ task, onClick, onDelete }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);

  const handleMenuClick = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleMenuClose = (e) => {
    e?.stopPropagation();
    setAnchorEl(null);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(task.id);
    handleMenuClose();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
    >
      <Paper 
        onClick={() => onClick(task)}
        sx={{ 
          p: 2.5, 
          mb: 2, 
          cursor: 'pointer', 
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'slate.100',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          '&:hover': { boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', borderColor: 'primary.light' },
          transition: 'all 0.2s',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
          <Chip 
            label={task.priority} 
            size="small" 
            sx={{ 
              height: 20, 
              fontSize: '0.65rem', 
              fontWeight: 800,
              bgcolor: priorityColors[task.priority]?.bg,
              color: priorityColors[task.priority]?.color,
              borderRadius: 1
            }} 
          />
          <Box>
            <IconButton size="small" onClick={handleMenuClick} sx={{ p: 0 }}><MoreVertical size={14} /></IconButton>
            <Menu anchorEl={anchorEl} open={openMenu} onClose={handleMenuClose}>
              <MenuItem onClick={handleDelete} sx={{ color: 'error.main', fontWeight: 700, fontSize: '0.85rem' }}>
                Delete Task
              </MenuItem>
            </Menu>
          </Box>
        </Box>
        <Typography variant="body1" sx={{ fontWeight: 700, mb: 2, color: 'slate.900' }}>{task.title}</Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <AvatarGroup max={3}>
             <Avatar sx={{ width: 24, height: 24, fontSize: '0.65rem', bgcolor: 'primary.main' }}>
              {task.assigned_username?.[0]?.toUpperCase() || '?'}
            </Avatar>
          </AvatarGroup>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'slate.400' }}>
            <Calendar size={12} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </motion.div>
  );
};

const KanbanColumn = ({ title, tasks, onTaskClick, onDelete, color }) => (
  <Grid item xs={12} md={4}>
    <Box sx={{ p: 1, borderRadius: 5, height: '100%', minHeight: '600px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, px: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
           <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
           <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'slate.900', letterSpacing: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="caption" sx={{ px: 1, py: 0.2, bgcolor: 'slate.100', borderRadius: 1, fontWeight: 700, color: 'slate.500' }}>
            {tasks.length}
          </Typography>
        </Box>
        <IconButton size="small" sx={{ bgcolor: 'white', border: '1px solid', borderColor: 'slate.100' }}><Plus size={16} /></IconButton>
      </Box>
      <AnimatePresence>
        {tasks.map(task => <TaskCard key={task.id} task={task} onClick={onTaskClick} onDelete={onDelete} />)}
      </AnimatePresence>
    </Box>
  </Grid>
);

export default function ProjectDetail() {
  const { isAdmin } = useAuth();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [editData, setEditData] = useState({ status: '', due_date: '' });
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'Medium', assigned_user_id: '', due_date: '' });
  const [allUsers, setAllUsers] = useState([]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [projRes, taskRes, memberRes, allUsersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/tasks/project/${projectId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/projects/${projectId}/members`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      const currentProj = projRes.data.find(p => p.id === parseInt(projectId));
      setProject(currentProj);
      setTasks(taskRes.data);
      setMembers(memberRes.data);
      setAllUsers(allUsersRes.data);
    } catch (err) {
      console.error('Fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const handleDeleteProject = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/projects');
    } catch (err) {
      console.error('Delete failed', err);
    }
  };
  const handleDeleteTask = async (taskId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
      toast.success('Task deleted successfully');
    } catch (err) {
      console.error('Delete task failed', err);
      toast.error('Failed to delete task');
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setEditData({ status: task.status, due_date: task.due_date ? task.due_date.split('T')[0] : '' });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/tasks/${selectedTask.id}`, editData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
      setEditModalOpen(false);
      toast.success('Task updated successfully');
    } catch (err) { 
      console.error('Update failed', err);
      toast.error('Failed to update task');
    }
  };

  const handleCreateTask = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/tasks`, { ...newTask, project_id: projectId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
      setCreateModalOpen(false);
      setNewTask({ title: '', description: '', priority: 'Medium', assigned_user_id: '', due_date: '' });
      toast.success('Task created successfully');
    } catch (err) { 
      console.error('Create task failed', err);
      toast.error('Failed to create task');
    }
  };

  const handleAddMember = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/projects/${projectId}/members`, { userId: newMemberId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMemberModalOpen(false);
      setNewMemberId('');
      fetchData();
    } catch (err) { console.error('Add member failed', err); }
  };

  if (loading) return <Box sx={{ p: 4 }}><Skeleton variant="text" width={200} height={40} /><Skeleton variant="rectangular" height={600} sx={{ mt: 2, borderRadius: 5 }} /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Button startIcon={<ArrowLeft size={16} />} onClick={() => navigate('/projects')} sx={{ mb: 1.5, p: 0, color: 'slate.500', minWidth: 0, '&:hover': { bgcolor: 'transparent', color: 'primary.main' } }}>
            Back to Projects
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 900, color: 'slate.900', letterSpacing: -1 }}>{project?.name}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
           {isAdmin && (
             <Button variant="outlined" color="primary" startIcon={<Users size={16} />} onClick={() => setMemberModalOpen(true)} sx={{ borderRadius: 2 }}>
               Manage Team
             </Button>
           )}
           {isAdmin && (
             <Button variant="outlined" color="error" startIcon={<Trash2 size={16} />} onClick={() => setDeleteConfirmOpen(true)} sx={{ borderRadius: 2 }}>
               Delete Project
             </Button>
           )}
           <Button variant="outlined" startIcon={<Filter size={16} />} sx={{ borderRadius: 2, borderColor: 'slate.200', color: 'slate.600' }}>Filter</Button>
           {isAdmin && (
             <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setCreateModalOpen(true)} sx={{ borderRadius: 2 }}>Add Task</Button>
           )}
        </Box>
      </Box>

      <Grid container spacing={4}>
        <KanbanColumn title="TO DO" color="#94a3b8" tasks={tasks.filter(t => t.status === 'To Do')} onTaskClick={handleTaskClick} onDelete={handleDeleteTask} />
        <KanbanColumn title="IN PROGRESS" color="#6366f1" tasks={tasks.filter(t => t.status === 'In Progress')} onTaskClick={handleTaskClick} onDelete={handleDeleteTask} />
        <KanbanColumn title="DONE" color="#10b981" tasks={tasks.filter(t => t.status === 'Done')} onTaskClick={handleTaskClick} onDelete={handleDeleteTask} />
      </Grid>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle sx={{ fontWeight: 900 }}>Delete Project?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete <strong>{project?.name}</strong>? This action cannot be undone and all tasks will be removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteProject}>Delete Forever</Button>
        </DialogActions>
      </Dialog>

      {/* Quick Edit Modal */}
      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)} PaperProps={{ sx: { borderRadius: 5, p: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>Update Task</DialogTitle>
        <DialogContent>
          <TextField select fullWidth label="Status" value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })} sx={{ mb: 3, mt: 1 }}>
            <MenuItem value="To Do">To Do</MenuItem>
            <MenuItem value="In Progress">In Progress</MenuItem>
            <MenuItem value="Done">Done</MenuItem>
          </TextField>
          <TextField fullWidth type="date" label="Due Date" InputLabelProps={{ shrink: true }} value={editData.due_date} onChange={(e) => setEditData({ ...editData, due_date: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setEditModalOpen(false)} sx={{ color: 'slate.500' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} sx={{ borderRadius: 2, px: 4 }}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Create Task Modal */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} PaperProps={{ sx: { borderRadius: 5, p: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Create New Task</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Task Title"
            fullWidth
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            sx={{ mb: 3, mt: 1 }}
          />
          <TextField
            select
            fullWidth
            label="Assign To"
            value={newTask.assigned_user_id}
            onChange={(e) => setNewTask({ ...newTask, assigned_user_id: e.target.value })}
            sx={{ mb: 3 }}
          >
            {members.map(u => <MenuItem key={u.id} value={u.id}>{u.username}</MenuItem>)}
          </TextField>
          <TextField
            select
            fullWidth
            label="Priority"
            value={newTask.priority}
            onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
            sx={{ mb: 3 }}
          >
            <MenuItem value="High">High</MenuItem>
            <MenuItem value="Medium">Medium</MenuItem>
            <MenuItem value="Low">Low</MenuItem>
          </TextField>
          <TextField
            fullWidth
            type="date"
            label="Due Date"
            InputLabelProps={{ shrink: true }}
            value={newTask.due_date}
            onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateTask}>Create Task</Button>
        </DialogActions>
      </Dialog>

      {/* Manage Members Modal */}
      <Dialog open={memberModalOpen} onClose={() => setMemberModalOpen(false)} PaperProps={{ sx: { borderRadius: 5, p: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Manage Project Team</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Add new members to this project to assign them tasks.
          </Typography>
          <TextField
            select
            fullWidth
            label="Select User"
            value={newMemberId}
            onChange={(e) => setNewMemberId(e.target.value)}
          >
            {allUsers.map(u => <MenuItem key={u.id} value={u.id}>{u.username} ({u.email})</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setMemberModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddMember}>Add Member</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
