'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, IconButton, TextField, Box, Drawer, List, ListItem, ListItemText, Button, Typography, Divider } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import RestoreIcon from '@mui/icons-material/Restore';

interface StickyNote {
  id: string;
  content: string;
  x: number;
  y: number;
  color: string;
}

interface Snapshot {
  id: string;
  timestamp: number;
  notes: StickyNote[];
}

const COLORS = ['#FFF59D', '#FFCCBC', '#B2DFDB', '#E1BEE7', '#C5CAE9', '#FFAB91'];

export default function StickyNotesBoard() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [editCount, setEditCount] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const EDITS_PER_SNAPSHOT = 5;

  // Load notes and snapshots from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('stickyNotes');
    if (saved) {
      setNotes(JSON.parse(saved));
    }
    const savedSnapshots = localStorage.getItem('stickyNotesSnapshots');
    if (savedSnapshots) {
      setSnapshots(JSON.parse(savedSnapshots));
    }
  }, []);

  // Save notes to localStorage whenever they change
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem('stickyNotes', JSON.stringify(notes));
    }
  }, [notes]);

  // Save snapshots to localStorage whenever they change
  useEffect(() => {
    if (snapshots.length > 0) {
      localStorage.setItem('stickyNotesSnapshots', JSON.stringify(snapshots));
    }
  }, [snapshots]);

  // Create snapshot every N edits
  const createSnapshot = () => {
    const newSnapshot: Snapshot = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      notes: JSON.parse(JSON.stringify(notes)) // Deep copy
    };
    setSnapshots([newSnapshot, ...snapshots]);
  };

  // Track edits and create snapshots
  const trackEdit = () => {
    const newCount = editCount + 1;
    setEditCount(newCount);
    if (newCount >= EDITS_PER_SNAPSHOT) {
      createSnapshot();
      setEditCount(0);
    }
  };

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
      trackEdit();
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
    trackEdit();
  };

  const updateContent = (id: string, content: string) => {
    setNotes(notes.map(note =>
      note.id === id ? { ...note, content } : note
    ));
    trackEdit();
  };

  // Parse content for [[Note]] references
  const parseReferences = (content: string) => {
    const regex = /\[\[([^\]]+)\]\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
      }
      // Add the reference
      parts.push({ type: 'reference', content: match[1] });
      lastIndex = regex.lastIndex;
    }
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.slice(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content }];
  };

  // Find note by content match (first line or full content)
  const findNoteByReference = (reference: string) => {
    return notes.find(note => {
      const firstLine = note.content.split('\n')[0].trim();
      return firstLine.toLowerCase() === reference.toLowerCase() ||
             note.content.toLowerCase().trim() === reference.toLowerCase();
    });
  };

  // Scroll to and highlight a note
  const scrollToNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note && canvasRef.current) {
      // Briefly highlight the note
      const element = document.getElementById(`note-${noteId}`);
      if (element) {
        element.style.transition = 'transform 0.3s ease';
        element.style.transform = 'scale(1.1)';
        setTimeout(() => {
          element.style.transform = 'scale(1)';
        }, 300);
      }
    }
  };

  const restoreSnapshot = (snapshot: Snapshot) => {
    setNotes(JSON.parse(JSON.stringify(snapshot.notes)));
    setHistoryOpen(false);
    setEditCount(0);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <>
      {/* History Button */}
      <IconButton
        onClick={() => setHistoryOpen(true)}
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          backgroundColor: 'white',
          boxShadow: 2,
          zIndex: 1000,
          '&:hover': {
            backgroundColor: '#f5f5f5'
          }
        }}
      >
        <HistoryIcon />
      </IconButton>

      {/* Edit Counter */}
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          left: 16,
          backgroundColor: 'white',
          padding: '8px 16px',
          borderRadius: 1,
          boxShadow: 2,
          zIndex: 1000,
          fontSize: '14px'
        }}
      >
        Edits until snapshot: {EDITS_PER_SNAPSHOT - editCount}
      </Box>

      {/* History Drawer */}
      <Drawer
        anchor="right"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      >
        <Box sx={{ width: 350, padding: 2 }}>
          <Typography variant="h6" gutterBottom>
            Version History
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Snapshots are saved every {EDITS_PER_SNAPSHOT} edits
          </Typography>
          <Divider sx={{ my: 2 }} />
          {snapshots.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No snapshots yet. Make {EDITS_PER_SNAPSHOT} edits to create your first snapshot.
            </Typography>
          ) : (
            <List>
              {snapshots.map((snapshot, index) => (
                <ListItem
                  key={snapshot.id}
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: '#f5f5f5'
                    }
                  }}
                >
                  <ListItemText
                    primary={`Snapshot ${snapshots.length - index}`}
                    secondary={formatTimestamp(snapshot.timestamp)}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {snapshot.notes.length} note{snapshot.notes.length !== 1 ? 's' : ''}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RestoreIcon />}
                    onClick={() => restoreSnapshot(snapshot)}
                    fullWidth
                  >
                    Restore
                  </Button>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Drawer>

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
          id={`note-${note.id}`}
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
              <Box 
                sx={{ 
                  fontSize: '14px', 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  userSelect: 'none'
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {parseReferences(note.content).map((part, index) => {
                  if (part.type === 'reference') {
                    const referencedNote = findNoteByReference(part.content);
                    return (
                      <Box
                        key={index}
                        component="span"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (referencedNote) {
                            scrollToNote(referencedNote.id);
                          }
                        }}
                        sx={{
                          color: referencedNote ? '#1976d2' : '#999',
                          textDecoration: referencedNote ? 'underline' : 'none',
                          cursor: referencedNote ? 'pointer' : 'default',
                          fontWeight: 500,
                          padding: '2px 4px',
                          borderRadius: '3px',
                          backgroundColor: referencedNote ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                          '&:hover': referencedNote ? {
                            color: '#1565c0',
                            backgroundColor: 'rgba(25, 118, 210, 0.15)'
                          } : {}
                        }}
                      >
                        [[{part.content}]]
                      </Box>
                    );
                  }
                  return <span key={index}>{part.content}</span>;
                })}
              </Box>
            )}
          </CardContent>
        </Card>
      ))}
      </Box>
    </>
  );
}












