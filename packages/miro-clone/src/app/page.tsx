'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, IconButton, TextField, Box, Drawer, List, ListItem, ListItemText, Button, Typography, Divider, Fab } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import RestoreIcon from '@mui/icons-material/Restore';
import TimelineIcon from '@mui/icons-material/Timeline';

interface StickyNote {
  id: string;
  content: string;
  x: number;
  y: number;
  color: string;
}

interface Connection {
  id: string;
  fromNoteId: string;
  toNoteId: string;
  label?: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

interface Snapshot {
  id: string;
  timestamp: number;
  notes: StickyNote[];
  connections: Connection[];
}

const COLORS = ['#FFF59D', '#FFCCBC', '#B2DFDB', '#E1BEE7', '#C5CAE9', '#FFAB91'];

export default function StickyNotesBoard() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [editCount, setEditCount] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [tempLine, setTempLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const EDITS_PER_SNAPSHOT = 5;

  // Load notes, connections, and snapshots from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('stickyNotes');
    if (saved) {
      setNotes(JSON.parse(saved));
    }
    const savedConnections = localStorage.getItem('stickyConnections');
    if (savedConnections) {
      setConnections(JSON.parse(savedConnections));
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

  // Save connections to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('stickyConnections', JSON.stringify(connections));
  }, [connections]);

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
      notes: JSON.parse(JSON.stringify(notes)), // Deep copy
      connections: JSON.parse(JSON.stringify(connections)) // Deep copy
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
    if (e.target === canvasRef.current && !connectMode) {
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
    
    if (connectMode) {
      if (!connectFrom) {
        // Start connection from this note
        setConnectFrom(noteId);
        const note = notes.find(n => n.id === noteId);
        if (note) {
          setTempLine({
            x1: note.x + 100,
            y1: note.y + 75,
            x2: e.clientX,
            y2: e.clientY
          });
        }
      } else if (connectFrom !== noteId) {
        // Complete connection to this note
        const fromNote = notes.find(n => n.id === connectFrom);
        const toNote = notes.find(n => n.id === noteId);
        if (fromNote && toNote) {
          const newConnection: Connection = {
            id: Date.now().toString(),
            fromNoteId: connectFrom,
            toNoteId: noteId,
            fromX: fromNote.x + 100,
            fromY: fromNote.y + 75,
            toX: toNote.x + 100,
            toY: toNote.y + 75
          };
          setConnections([...connections, newConnection]);
          trackEdit();
        }
        setConnectFrom(null);
        setTempLine(null);
        setConnectMode(false);
      }
      return;
    }
    
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
    if (tempLine && connectFrom) {
      setTempLine({
        ...tempLine,
        x2: e.clientX,
        y2: e.clientY
      });
    }
    
    if (dragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      setNotes(notes.map(note =>
        note.id === dragging
          ? { ...note, x: newX, y: newY }
          : note
      ));
      
      // Update connections attached to this note
      setConnections(connections.map(conn => {
        if (conn.fromNoteId === dragging) {
          return { ...conn, fromX: newX + 100, fromY: newY + 75 };
        }
        if (conn.toNoteId === dragging) {
          return { ...conn, toX: newX + 100, toY: newY + 75 };
        }
        return conn;
      }));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(note => note.id !== id));
    // Also delete connections attached to this note
    setConnections(connections.filter(conn => 
      conn.fromNoteId !== id && conn.toNoteId !== id
    ));
    trackEdit();
  };

  const deleteConnection = (id: string) => {
    setConnections(connections.filter(conn => conn.id !== id));
    trackEdit();
  };

  const updateConnectionLabel = (id: string, label: string) => {
    setConnections(connections.map(conn =>
      conn.id === id ? { ...conn, label } : conn
    ));
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
    setConnections(JSON.parse(JSON.stringify(snapshot.connections || [])));
    setHistoryOpen(false);
    setEditCount(0);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <>
      {/* Connect Mode Button */}
      <Fab
        color={connectMode ? 'primary' : 'default'}
        onClick={() => {
          setConnectMode(!connectMode);
          setConnectFrom(null);
          setTempLine(null);
        }}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1000
        }}
      >
        <TimelineIcon />
      </Fab>

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

      {/* Connect Mode Indicator */}
      {connectMode && (
        <Box
          sx={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1976d2',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 1,
            boxShadow: 2,
            zIndex: 1000,
            fontSize: '14px'
          }}
        >
          {connectFrom ? 'Click another note to connect' : 'Click a note to start connection'}
        </Box>
      )}

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
          cursor: connectMode ? 'crosshair' : 'default'
        }}
      >
        {/* SVG for connections */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          {/* Render existing connections */}
          {connections.map(conn => {
            const midX = (conn.fromX + conn.toX) / 2;
            const midY = (conn.fromY + conn.toY) / 2;
            
            return (
              <g key={conn.id}>
                <defs>
                  <marker
                    id={`arrowhead-${conn.id}`}
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3, 0 6" fill="#333" />
                  </marker>
                </defs>
                <line
                  x1={conn.fromX}
                  y1={conn.fromY}
                  x2={conn.toX}
                  y2={conn.toY}
                  stroke="#333"
                  strokeWidth="2"
                  markerEnd={`url(#arrowhead-${conn.id})`}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Delete this connection?')) {
                      deleteConnection(conn.id);
                    }
                  }}
                />
                {/* Label background and text */}
                {(conn.label || editingConnectionId === conn.id) && (
                  <foreignObject
                    x={midX - 50}
                    y={midY - 15}
                    width="100"
                    height="30"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Box
                      sx={{
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: 1,
                        padding: '2px 6px',
                        fontSize: '12px',
                        textAlign: 'center'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingConnectionId(conn.id);
                      }}
                    >
                      {editingConnectionId === conn.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={conn.label || ''}
                          onChange={(e) => updateConnectionLabel(conn.id, e.target.value)}
                          onBlur={() => setEditingConnectionId(null)}
                          style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            fontSize: '12px',
                            textAlign: 'center',
                            backgroundColor: 'transparent'
                          }}
                        />
                      ) : (
                        conn.label || 'Click to label'
                      )}
                    </Box>
                  </foreignObject>
                )}
              </g>
            );
          })}
          
          {/* Render temporary line while connecting */}
          {tempLine && (
            <line
              x1={tempLine.x1}
              y1={tempLine.y1}
              x2={tempLine.x2}
              y2={tempLine.y2}
              stroke="#1976d2"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          )}
        </svg>
      {notes.map(note => (
        <Card
          key={note.id}
          id={`note-${note.id}`}
          onMouseDown={(e) => handleMouseDown(e, note.id)}
          onDoubleClick={() => !connectMode && setEditingId(note.id)}
          sx={{
            position: 'absolute',
            left: note.x,
            top: note.y,
            width: 200,
            minHeight: 150,
            backgroundColor: note.color,
            cursor: connectMode ? 'pointer' : (dragging === note.id ? 'grabbing' : 'grab'),
            boxShadow: connectFrom === note.id ? 6 : 3,
            border: connectFrom === note.id ? '3px solid #1976d2' : 'none',
            zIndex: 10,
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


























