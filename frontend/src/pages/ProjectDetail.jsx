import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowLeft, Calendar, Filter, FolderKanban, MoreVertical, Plus, Trash2, Users, Bell, BellRing, Activity } from 'lucide-react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PremiumIcon from '../components/PremiumIcon';
import MultiSelectMembers from '../components/MultiSelectMembers';
import FilterPanel from '../components/FilterPanel';
import { useFilters } from '../context/FilterContext';
import TaskModal from '../components/TaskModal';
import ActivityFeed from '../components/ActivityFeed';

const priorityColors = {
  High: { color: '#f43f5e', bg: '#fff7f8', border: '#ffe4ea' },
  Medium: { color: '#ff9b3d', bg: '#fff8ef', border: '#ffe6ca' },
  Low: { color: '#22c98a', bg: '#effaf5', border: '#dff8ee' },
};

const TaskCard = ({ task, onClick, onDelete }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const colors = priorityColors[task.priority] || priorityColors.Medium;

  const closeMenu = (event) => {
    event?.stopPropagation();
    setAnchorEl(null);
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <Paper
        onClick={() => onClick(task)}
        sx={{
          p: 2,
          mb: 1.6,
          cursor: 'pointer',
          borderRadius: '8px',
          border: '1px solid #e8edf5',
          boxShadow: '0 10px 24px rgba(47, 67, 103, 0.07)',
          '&:hover': { borderColor: '#ffb08b', transform: 'translateY(-2px)' },
          transition: 'all 0.2s ease',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
          <Chip
            label={task.priority}
            size="small"
            sx={{ bgcolor: colors.bg, color: colors.color, border: `1px solid ${colors.border}`, fontWeight: 900 }}
          />
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              setAnchorEl(event.currentTarget);
            }}
            sx={{ color: '#a0abc0' }}
          >
            <MoreVertical size={16} />
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
            <MenuItem
              onClick={(event) => {
                event.stopPropagation();
                onDelete(task.id);
                setAnchorEl(null);
              }}
              sx={{ color: '#f43f5e', fontWeight: 800 }}
            >
              Delete Task
            </MenuItem>
          </Menu>
        </Box>
        <Typography sx={{ fontWeight: 900, color: '#2f4367', mb: 2, lineHeight: 1.35 }}>{task.title}</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: '#fff2e3', color: '#fb5b3f', fontWeight: 900 }}>
            {task.assigned_username?.[0]?.toUpperCase() || '?'}
          </Avatar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, color: '#70809d' }}>
            <Calendar size={13} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 800 }}>
              {task.due_date
                ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'No date'}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </motion.div>
  );
};

const KanbanColumn = ({ title, tasks, onTaskClick, onDelete, color }) => (
  <Box sx={{ minWidth: 0 }}>
    <Box
      sx={{
        borderRadius: '8px',
        border: '1px solid #e8edf5',
        bgcolor: 'rgba(255,255,255,0.72)',
        p: 2,
        minHeight: 560,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color }} />
          <Typography sx={{ color: '#2f4367', fontWeight: 900, letterSpacing: 0.4 }}>{title}</Typography>
          <Chip label={tasks.length} size="small" sx={{ height: 22, bgcolor: '#eef2f7', color: '#70809d', fontWeight: 900 }} />
        </Box>
        <IconButton size="small" sx={{ bgcolor: '#fff', border: '1px solid #e8edf5', color }}>
          <Plus size={16} />
        </IconButton>
      </Box>
      <AnimatePresence>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onClick={onTaskClick} onDelete={onDelete} />
        ))}
      </AnimatePresence>
    </Box>
  </Box>
);

export default function ProjectDetail() {
  const { isAdmin } = useAuth();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const urlTaskId = searchParams.get('taskId');
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [editData, setEditData] = useState({ status: '', due_date: '' });
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'Medium', assigned_user_ids: [], due_date: '' });
  const [allUsers, setAllUsers] = useState([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [activityFeedOpen, setActivityFeedOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { applyFilters, activeFilterCount } = useFilters();

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [projRes, taskRes, memberRes, allUsersRes, subRes, actRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/tasks/project/${projectId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/projects/${projectId}/members`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/auth/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/collaboration/projects/${projectId}/subscription`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { isSubscribed: false } })),
        axios.get(`${API_BASE_URL}/collaboration/projects/${projectId}/activity`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
      ]);

      setProject(projRes.data.find((item) => item.id === parseInt(projectId, 10)));
      setTasks(taskRes.data);
      setMembers(memberRes.data);
      setAllUsers(allUsersRes.data);
      setIsSubscribed(subRes.data.isSubscribed);
      setActivities(actRes.data);
      
      // Handle URL task opening
      if (urlTaskId && taskRes.data) {
        const taskToOpen = taskRes.data.find(t => t.id === parseInt(urlTaskId, 10));
        if (taskToOpen) {
          setSelectedTask(taskToOpen);
          setEditModalOpen(true);
        }
      }
    } catch (err) {
      console.error('Fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const groupedTasks = useMemo(() => {
    const filteredTasks = applyFilters(tasks);
    return {
      todo: filteredTasks.filter((task) => task.status === 'To Do'),
      progress: filteredTasks.filter((task) => task.status === 'In Progress'),
      done: filteredTasks.filter((task) => task.status === 'Done'),
    };
  }, [tasks, applyFilters]);

  const handleDeleteProject = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
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
    setEditModalOpen(true);
  };

  const toggleSubscription = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/collaboration/projects/${projectId}/subscription`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setIsSubscribed(res.data.isSubscribed);
      toast.success(res.data.message);
    } catch (err) {
      toast.error('Failed to toggle subscription');
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title) {
      toast.error('Please enter a task title');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // If multiple users selected, create a task for each
      if (newTask.assigned_user_ids.length > 1) {
        await Promise.all(
          newTask.assigned_user_ids.map(userId =>
            axios.post(
              `${API_BASE_URL}/tasks`,
              { ...newTask, assigned_user_id: userId, project_id: projectId },
              { headers: { Authorization: `Bearer ${token}` } }
            )
          )
        );
        toast.success(`Created ${newTask.assigned_user_ids.length} tasks`);
      } else {
        // Single user or no assignment
        await axios.post(
          `${API_BASE_URL}/tasks`,
          { ...newTask, assigned_user_id: newTask.assigned_user_ids[0] || null, project_id: projectId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Task created successfully');
      }

      fetchData();
      setCreateModalOpen(false);
      setNewTask({ title: '', description: '', priority: 'Medium', assigned_user_ids: [], due_date: '' });
    } catch (err) {
      console.error('Create task failed', err);
      toast.error('Failed to create task');
    }
  };

  const handleAddMember = async () => {
    if (selectedMemberIds.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Add multiple members in parallel
      await Promise.all(
        selectedMemberIds.map(userId =>
          axios.post(
            `${API_BASE_URL}/projects/${projectId}/members`,
            { userId },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      );

      setMemberModalOpen(false);
      setSelectedMemberIds([]);
      fetchData();
      toast.success(`Successfully added ${selectedMemberIds.length} member(s)`);
    } catch (err) {
      console.error('Add member failed', err);
      toast.error('Failed to add some members');
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API_BASE_URL}/projects/${projectId}/members/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData();
      toast.success('Member removed successfully');
    } catch (err) {
      console.error('Remove member failed', err);
      toast.error('Failed to remove member');
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={100} sx={{ borderRadius: '8px', mb: 3 }} />
        <Skeleton variant="rectangular" height={560} sx={{ borderRadius: '8px' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          mb: 3,
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.65)',
          bgcolor: 'rgba(255,255,255,0.92)',
          boxShadow: '0 16px 34px rgba(47, 67, 103, 0.1)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PremiumIcon tone="coral" size={58} radius="16px">
              <FolderKanban size={27} />
            </PremiumIcon>
            <Box>
              <Button
                startIcon={<ArrowLeft size={16} />}
                onClick={() => navigate('/projects')}
                sx={{ p: 0, mb: 1, color: '#70809d', '&:hover': { bgcolor: 'transparent', color: '#fb5b3f', boxShadow: 'none' } }}
              >
                Back to Projects
              </Button>
              <Typography variant="h4" sx={{ color: '#2f4367', mb: 0.5 }}>
                {project?.name}
              </Typography>
              <Typography sx={{ color: '#70809d', fontWeight: 700 }}>{project?.description || 'Project board and delivery tracker'}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <AvatarGroup max={4} sx={{ mr: 1, '& .MuiAvatar-root': { width: 34, height: 34, fontSize: '0.78rem', fontWeight: 900 } }}>
              {members.map((member) => (
                <Avatar key={member.id} sx={{ bgcolor: '#fb5b3f' }}>
                  {member.username?.[0]?.toUpperCase()}
                </Avatar>
              ))}
            </AvatarGroup>
            {isAdmin && (
              <Button variant="outlined" startIcon={<Users size={16} />} onClick={() => setMemberModalOpen(true)}>
                Manage Team
              </Button>
            )}
            <Button 
              variant="outlined" 
              onClick={toggleSubscription}
              sx={{ color: isSubscribed ? '#fb5b3f' : '#70809d', borderColor: '#e8edf5' }}
            >
              {isSubscribed ? <BellRing size={16} /> : <Bell size={16} />}
            </Button>
            <Button 
              variant="outlined" 
              onClick={() => setActivityFeedOpen(true)}
              sx={{ color: '#70809d', borderColor: '#e8edf5' }}
            >
              <Activity size={16} />
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<Filter size={16} />}
              onClick={() => setFilterPanelOpen(true)}
              sx={{ position: 'relative' }}
            >
              Filter
              {activeFilterCount > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    bgcolor: '#fb5b3f',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 18,
                    height: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                  }}
                >
                  {activeFilterCount}
                </Box>
              )}
            </Button>
            {isAdmin && (
              <Button variant="outlined" color="error" startIcon={<Trash2 size={16} />} onClick={() => setDeleteConfirmOpen(true)}>
                Delete
              </Button>
            )}
            {isAdmin && (
              <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setCreateModalOpen(true)}>
                Add Task
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 3 }}>
        <KanbanColumn title="TO DO" color="#8795ad" tasks={groupedTasks.todo} onTaskClick={handleTaskClick} onDelete={handleDeleteTask} />
        <KanbanColumn title="IN PROGRESS" color="#fb5b3f" tasks={groupedTasks.progress} onTaskClick={handleTaskClick} onDelete={handleDeleteTask} />
        <KanbanColumn title="DONE" color="#22c98a" tasks={groupedTasks.done} onTaskClick={handleTaskClick} onDelete={handleDeleteTask} />
      </Box>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} PaperProps={{ sx: { borderRadius: '8px' } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#2f4367' }}>Delete Project?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#70809d' }}>
            Are you sure you want to delete <strong>{project?.name}</strong>? This action cannot be undone and all tasks will be removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteProject}>Delete Forever</Button>
        </DialogActions>
      </Dialog>

      <TaskModal 
        open={editModalOpen} 
        onClose={() => setEditModalOpen(false)} 
        task={selectedTask} 
        projectId={projectId} 
        onUpdated={fetchData} 
      />

      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '8px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#2f4367' }}>Create New Task</DialogTitle>
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
          
          <MultiSelectMembers
            options={members}
            value={newTask.assigned_user_ids}
            onChange={(ids) => setNewTask({ ...newTask, assigned_user_ids: ids })}
            label="Assign To (Multiple)"
            placeholder="Select one or more team members..."
          />

          <Typography variant="caption" sx={{ display: 'block', color: '#70809d', mt: 1, mb: 3 }}>
            💡 Tip: Select multiple members to create a copy of this task for each person
          </Typography>

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
            slotProps={{ inputLabel: { shrink: true } }} 
            value={newTask.due_date} 
            onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} 
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateTask}>
            Create Task{newTask.assigned_user_ids.length > 1 ? `s (${newTask.assigned_user_ids.length})` : ''}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={memberModalOpen} onClose={() => setMemberModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '8px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#2f4367' }}>Manage Project Team</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#70809d', mb: 3 }}>
            Select multiple members to add to this project. They will be able to receive task assignments.
          </Typography>
          
          <MultiSelectMembers
            options={allUsers.filter(user => !members.some(member => member.id === user.id))}
            value={selectedMemberIds}
            onChange={setSelectedMemberIds}
            label="Select Team Members"
            placeholder="Search and select members..."
          />

          {members.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography sx={{ color: '#2f4367', fontWeight: 700, mb: 1.5, fontSize: '0.875rem' }}>
                Current Team Members ({members.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {members.map((member) => (
                  <Chip
                    key={member.id}
                    avatar={
                      <Avatar sx={{ bgcolor: '#e8edf5', color: '#70809d', fontSize: '0.75rem', fontWeight: 900 }}>
                        {member.username?.[0]?.toUpperCase()}
                      </Avatar>
                    }
                    label={member.username}
                    onDelete={isAdmin ? () => handleRemoveMember(member.id) : undefined}
                    sx={{ bgcolor: '#f6f8fb', color: '#2f4367', fontWeight: 700 }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => { setMemberModalOpen(false); setSelectedMemberIds([]); }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAddMember}
            disabled={selectedMemberIds.length === 0}
          >
            Add {selectedMemberIds.length > 0 ? `${selectedMemberIds.length} ` : ''}Member{selectedMemberIds.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>
      
      <FilterPanel 
        open={filterPanelOpen} 
        onClose={() => setFilterPanelOpen(false)} 
        members={members} 
      />

      <ActivityFeed 
        open={activityFeedOpen}
        onClose={() => setActivityFeedOpen(false)}
        activities={activities}
      />
    </Box>
  );
}
