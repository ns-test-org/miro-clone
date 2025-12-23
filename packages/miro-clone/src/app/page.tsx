'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, IconButton, TextField, Box } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

interface StickyNote {
  id: string;
  content: string;
  x: number;
  y: number;
  color: string;
}

const COLORS = ['#FFF59D', '#FFCCBC', '#B2DFDB', '#E1BEE7', '#C5CAE9', '#FFAB91'];

export default function StickyNotesBoard() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load notes from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('stickyNotes');
    if (saved) {
      setNotes(JSON.parse(saved));
    }
  }, []);

  // Save notes to localStorage whenever they change
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem('stickyNotes', JSON.stringify(notes));
    }
  }, [notes]);

  const createNote = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === canvasRef.current) {
      const newNote: StickyNote = {
        id: Date.now().toString(),
        content: 'Double click to edit',
        x: e.clientX - 100,
        y: e.clientY - 75,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      };
      setNotes([...notes, newNote]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, noteId: string) => {
    if (editingId === noteId) return;
    setDragging(noteId);
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setDragOffset({
        x: e.clientX - note.x,
        y: e.clientY - note.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setNotes(notes.map(note =>
        note.id === dragging
          ? { ...note, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }
          : note
      ));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(note => note.id !== id));
  };

  const updateContent = (id: string, content: string) => {
    setNotes(notes.map(note =>
      note.id === id ? { ...note, content } : note
    ));
  };

  return (
    <Box
      ref={canvasRef}
      onClick={createNote}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      sx={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'crosshair'
      }}
    >
      {notes.map(note => (
        <Card
          key={note.id}
          onMouseDown={(e) => handleMouseDown(e, note.id)}
          onDoubleClick={() => setEditingId(note.id)}
          sx={{
            position: 'absolute',
            left: note.x,
            top: note.y,
            width: 200,
            minHeight: 150,
            backgroundColor: note.color,
            cursor: dragging === note.id ? 'grabbing' : 'grab',
            boxShadow: 3,
            '&:hover': {
              boxShadow: 6
            }
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote(note.id);
                }}
                sx={{ padding: 0.5 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            {editingId === note.id ? (
              <TextField
                autoFocus
                multiline
                fullWidth
                value={note.content}
                onChange={(e) => updateContent(note.id, e.target.value)}
                onBlur={() => setEditingId(null)}
                variant="standard"
                InputProps={{ disableUnderline: true }}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: '14px',
                    padding: 0
                  }
                }}
              />
            ) : (
              <Box sx={{ fontSize: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {note.content}
              </Box>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

