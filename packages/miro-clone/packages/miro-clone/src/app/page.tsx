'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, TextField, IconButton, Box } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';

interface StickyNote {
  id: string;
  content: string;
  x: number;
  y: number;
  color: string;
}

const COLORS = ['#FFF740', '#FF6B9D', '#C1E1FF', '#B4F8C8', '#FFA07A'];

export default function MiroClone() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [draggedNote, setDraggedNote] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('miro-notes');
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
    }
  }, []);

  // Save notes to localStorage whenever they change
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem('miro-notes', JSON.stringify(notes));
    }
  }, [notes]);

  const createNote = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === canvasRef.current) {
      const newNote: StickyNote = {
        id: Date.now().toString(),
        content: 'New note',
        x: e.clientX - 100,
        y: e.clientY - 75,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
      setNotes([...notes, newNote]);
      setEditingNote(newNote.id);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, noteId: string) => {
    if ((e.target as HTMLElement).closest('.note-content')) return;
    
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setDraggedNote(noteId);
      setDragOffset({
        x: e.clientX - note.x,
        y: e.clientY - note.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNote) {
      setNotes(notes.map(note =>
        note.id === draggedNote
          ? { ...note, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }
          : note
      ));
    }
  };

  const handleMouseUp = () => {
    setDraggedNote(null);
  };

  const updateNoteContent = (id: string, content: string) => {
    setNotes(notes.map(note =>
      note.id === id ? { ...note, content } : note
    ));
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(note => note.id !== id));
    localStorage.setItem('miro-notes', JSON.stringify(notes.filter(note => note.id !== id)));
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'crosshair',
      }}
    >
      {/* Instructions */}
      <Box
        sx={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          fontSize: '18px',
          fontWeight: 500,
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
          zIndex: 1000,
        }}
      >
        Click anywhere to create a sticky note
      </Box>

      {notes.map((note) => (
        <Card
          key={note.id}
          onMouseDown={(e) => handleMouseDown(e, note.id)}
          sx={{
            position: 'absolute',
            left: note.x,
            top: note.y,
            width: 200,
            minHeight: 150,
            backgroundColor: note.color,
            cursor: draggedNote === note.id ? 'grabbing' : 'grab',
            boxShadow: draggedNote === note.id ? '0 8px 16px rgba(0,0,0,0.3)' : '0 4px 8px rgba(0,0,0,0.2)',
            transition: draggedNote === note.id ? 'none' : 'box-shadow 0.2s',
            '&:hover': {
              boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
            },
          }}
        >
          <CardContent sx={{ padding: '12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {editingNote === note.id ? (
              <TextField
                className="note-content"
                autoFocus
                multiline
                fullWidth
                value={note.content}
                onChange={(e) => updateNoteContent(note.id, e.target.value)}
                variant="standard"
                InputProps={{
                  disableUnderline: true,
                  style: { fontSize: '14px' },
                }}
                sx={{
                  flex: 1,
                  '& .MuiInputBase-root': {
                    height: '100%',
                    alignItems: 'flex-start',
                  },
                }}
              />
            ) : (
              <Box
                className="note-content"
                onClick={() => setEditingNote(note.id)}
                sx={{
                  flex: 1,
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  cursor: 'text',
                  padding: '4px 0',
                }}
              >
                {note.content}
              </Box>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 1 }}>
              {editingNote === note.id ? (
                <IconButton
                  size="small"
                  onClick={() => setEditingNote(null)}
                  sx={{ padding: '4px' }}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
              ) : (
                <IconButton
                  size="small"
                  onClick={() => setEditingNote(note.id)}
                  sx={{ padding: '4px' }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              <IconButton
                size="small"
                onClick={() => deleteNote(note.id)}
                sx={{ padding: '4px' }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

