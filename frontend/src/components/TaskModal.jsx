import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { Link2, Send } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import toast from 'react-hot-toast';

export default function TaskModal({ open, onClose, task, projectId, onUpdated }) {
  const [editData, setEditData] = useState({ status: '', due_date: '' });
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && task) {
      setEditData({ status: task.status, due_date: task.due_date ? task.due_date.split('T')[0] : '' });
      fetchComments();
    }
  }, [open, task]);

  const fetchComments = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/collaboration/tasks/${task.id}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(res.data);
    } catch (err) {
      console.error('Failed to fetch comments', err);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/tasks/${task.id}`, editData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Task updated successfully');
      onUpdated();
      onClose();
    } catch (err) {
      console.error('Update failed', err);
      toast.error('Failed to update task');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/collaboration/tasks/${task.id}/comments`, {
        content: newComment,
        projectId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setComments([...comments, res.data]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment', err);
      toast.error('Failed to post comment');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/projects/${projectId}?taskId=${task.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Task link copied to clipboard!');
  };

  if (!task) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '8px', p: 1 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pr: 2 }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#2f4367' }}>Update Task</DialogTitle>
        <IconButton onClick={copyLink} sx={{ color: '#70809d' }} title="Copy Task Link">
          <Link2 size={20} />
        </IconButton>
      </Box>
      <DialogContent>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontWeight: 700, color: '#2f4367', mb: 2 }}>{task.title}</Typography>
          <TextField select fullWidth label="Status" value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })} sx={{ mb: 3 }}>
            <MenuItem value="To Do">To Do</MenuItem>
            <MenuItem value="In Progress">In Progress</MenuItem>
            <MenuItem value="Done">Done</MenuItem>
          </TextField>
          <TextField fullWidth type="date" label="Due Date" slotProps={{ inputLabel: { shrink: true } }} value={editData.due_date} onChange={(e) => setEditData({ ...editData, due_date: e.target.value })} />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Comments Section */}
        <Typography sx={{ fontWeight: 900, color: '#2f4367', mb: 2, fontSize: '0.9rem' }}>Activity & Comments</Typography>
        
        <Box sx={{ maxHeight: 200, overflowY: 'auto', mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {comments.map(comment => (
            <Box key={comment.id} sx={{ display: 'flex', gap: 1.5 }}>
              <Avatar src={comment.avatar} sx={{ width: 32, height: 32, bgcolor: '#e8edf5', color: '#70809d', fontSize: '0.8rem', fontWeight: 900 }}>
                {comment.username?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 800, color: '#2f4367', fontSize: '0.85rem' }}>{comment.username}</Typography>
                  <Typography sx={{ color: '#a0abc0', fontSize: '0.75rem', fontWeight: 600 }}>
                    {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
                <Typography sx={{ color: '#4a5568', fontSize: '0.85rem' }}>
                  {comment.content.split(/(@[a-zA-Z0-9_]+)/).map((part, i) => 
                    part.startsWith('@') ? <span key={i} style={{ color: '#fb5b3f', fontWeight: 800 }}>{part}</span> : part
                  )}
                </Typography>
              </Box>
            </Box>
          ))}
          {comments.length === 0 && <Typography sx={{ color: '#a0abc0', fontSize: '0.85rem', textAlign: 'center', my: 2 }}>No comments yet.</Typography>}
        </Box>

        <Box component="form" onSubmit={handleAddComment} sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Write a comment... use @ to mention someone"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={loading}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
          />
          <IconButton type="submit" color="primary" disabled={loading || !newComment.trim()} sx={{ bgcolor: '#fff2e3' }}>
            <Send size={18} />
          </IconButton>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save Changes</Button>
      </DialogActions>
    </Dialog>
  );
}
