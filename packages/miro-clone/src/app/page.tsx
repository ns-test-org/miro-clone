'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, Box, Drawer, Button, ButtonGroup, Tooltip } from '@mui/material';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import DeleteIcon from '@mui/icons-material/Delete';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';

type ObjectType = 'sticky' | 'text' | 'arrow';

interface BaseObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
}

interface StickyNote extends BaseObject {
  type: 'sticky';
  content: string;
  color: 'yellow' | 'green' | 'pink' | 'blue';
  width: number;
  height: number;
}

interface TextObject extends BaseObject {
  type: 'text';
  content: string;
  width: number;
  height: number;
}

interface ArrowObject extends BaseObject {
  type: 'arrow';
  sourceId: string | null;
  targetId: string | null;
  sourceAnchor: 'top' | 'right' | 'bottom' | 'left' | null;
  targetAnchor: 'top' | 'right' | 'bottom' | 'left' | null;
  endX: number;
  endY: number;
}

type CanvasObject = StickyNote | TextObject | ArrowObject;

interface HistoryState {
  objects: CanvasObject[];
}

const COLOR_PRESETS = {
  yellow: '#FFF59D',
  green: '#C8E6C9',
  pink: '#F8BBD0',
  blue: '#BBDEFB'
};

const DRAWER_WIDTH = 80;

export default function StickyNotesBoard() {
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<ObjectType | null>(null);
  const [selectedColor, setSelectedColor] = useState<'yellow' | 'green' | 'pink' | 'blue'>('yellow');
  const [arrowSource, setArrowSource] = useState<string | null>(null);
  const [hoveredNote, setHoveredNote] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);

  // Load objects from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('miroCloneObjects');
    if (saved) {
      const loadedObjects = JSON.parse(saved);
      setObjects(loadedObjects);
      setHistory([{ objects: loadedObjects }]);
      setHistoryIndex(0);
    } else {
      setHistory([{ objects: [] }]);
      setHistoryIndex(0);
    }
  }, []);

  // Save objects to localStorage whenever they change
  useEffect(() => {
    if (objects.length >= 0 && historyIndex >= 0) {
      localStorage.setItem('miroCloneObjects', JSON.stringify(objects));
    }
  }, [objects, historyIndex]);

  const saveToHistory = useCallback((newObjects: CanvasObject[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ objects: newObjects });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setObjects(newObjects);
  }, [history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setObjects(history[historyIndex - 1].objects);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setObjects(history[historyIndex + 1].objects);
    }
  };

  const getAnchorPoint = (obj: StickyNote | TextObject, anchor: 'top' | 'right' | 'bottom' | 'left') => {
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    
    switch (anchor) {
      case 'top': return { x: centerX, y: obj.y };
      case 'right': return { x: obj.x + obj.width, y: centerY };
      case 'bottom': return { x: centerX, y: obj.y + obj.height };
      case 'left': return { x: obj.x, y: centerY };
    }
  };

  const findNearestAnchor = (x: number, y: number, noteId: string): 'top' | 'right' | 'bottom' | 'left' => {
    const note = objects.find(o => o.id === noteId);
    if (!note || (note.type !== 'sticky' && note.type !== 'text')) return 'top';
    
    const anchors: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left'];
    let minDist = Infinity;
    let nearest: 'top' | 'right' | 'bottom' | 'left' = 'top';
    
    anchors.forEach(anchor => {
      const point = getAnchorPoint(note as StickyNote | TextObject, anchor);
      const dist = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearest = anchor;
      }
    });
    
    return nearest;
  };

  const handleNoteClick = (e: React.MouseEvent, noteId: string) => {
    if (selectedTool === 'arrow') {
      e.stopPropagation();
      
      if (!arrowSource) {
        // First click - set source
        setArrowSource(noteId);
      } else if (arrowSource !== noteId) {
        // Second click - create arrow
        const sourceNote = objects.find(o => o.id === arrowSource);
        const targetNote = objects.find(o => o.id === noteId);
        
        if (sourceNote && targetNote && 
            (sourceNote.type === 'sticky' || sourceNote.type === 'text') &&
            (targetNote.type === 'sticky' || targetNote.type === 'text')) {
          
          const sourceAnchor = findNearestAnchor(targetNote.x, targetNote.y, arrowSource);
          const targetAnchor = findNearestAnchor(sourceNote.x, sourceNote.y, noteId);
          
          const sourcePoint = getAnchorPoint(sourceNote as StickyNote | TextObject, sourceAnchor);
          const targetPoint = getAnchorPoint(targetNote as StickyNote | TextObject, targetAnchor);
          
          const newArrow: ArrowObject = {
            id: Date.now().toString(),
            type: 'arrow',
            x: sourcePoint.x,
            y: sourcePoint.y,
            endX: targetPoint.x,
            endY: targetPoint.y,
            sourceId: arrowSource,
            targetId: noteId,
            sourceAnchor,
            targetAnchor
          };
          
          saveToHistory([...objects, newArrow]);
        }
        
        setArrowSource(null);
        setSelectedTool(null);
      }
    }
  };

  const createObject = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current || !selectedTool) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let newObject: CanvasObject;

    if (selectedTool === 'sticky') {
      newObject = {
        id: Date.now().toString(),
        type: 'sticky',
        content: 'Double-click to edit',
        x,
        y,
        color: selectedColor,
        width: 200,
        height: 150
      } as StickyNote;
      saveToHistory([...objects, newObject]);
      setSelectedTool(null);
    } else if (selectedTool === 'text') {
      newObject = {
        id: Date.now().toString(),
        type: 'text',
        content: 'Double-click to edit',
        x,
        y,
        width: 200,
        height: 40
      } as TextObject;
      saveToHistory([...objects, newObject]);
      setSelectedTool(null);
    }
    // Arrow creation handled by clicking notes
  };

  const handleMouseDown = (e: React.MouseEvent, objectId: string, action: 'drag' | 'resize' = 'drag') => {
    if (editingId === objectId) return;
    e.stopPropagation();
    
    if (action === 'resize') {
      setResizing(objectId);
      return;
    }

    setDragging(objectId);
    const obj = objects.find(o => o.id === objectId);
    if (obj) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left - obj.x,
          y: e.clientY - rect.top - obj.y
        });
      }
    }
  };

  const updateArrowPositions = (updatedObjects: CanvasObject[]) => {
    return updatedObjects.map(obj => {
      if (obj.type === 'arrow') {
        const arrow = obj as ArrowObject;
        if (arrow.sourceId && arrow.targetId && arrow.sourceAnchor && arrow.targetAnchor) {
          const sourceNote = updatedObjects.find(o => o.id === arrow.sourceId);
          const targetNote = updatedObjects.find(o => o.id === arrow.targetId);
          
          if (sourceNote && targetNote && 
              (sourceNote.type === 'sticky' || sourceNote.type === 'text') &&
              (targetNote.type === 'sticky' || targetNote.type === 'text')) {
            const sourcePoint = getAnchorPoint(sourceNote as StickyNote | TextObject, arrow.sourceAnchor);
            const targetPoint = getAnchorPoint(targetNote as StickyNote | TextObject, arrow.targetAnchor);
            
            return {
              ...arrow,
              x: sourcePoint.x,
              y: sourcePoint.y,
              endX: targetPoint.x,
              endY: targetPoint.y
            };
          }
        }
      }
      return obj;
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (dragging) {
      const newObjects = objects.map(obj =>
        obj.id === dragging
          ? { ...obj, x: mouseX - dragOffset.x, y: mouseY - dragOffset.y }
          : obj
      );
      setObjects(updateArrowPositions(newObjects));
    } else if (resizing) {
      const newObjects = objects.map(obj => {
        if (obj.id === resizing && (obj.type === 'sticky' || obj.type === 'text')) {
          const newWidth = Math.max(100, mouseX - obj.x);
          const newHeight = Math.max(50, mouseY - obj.y);
          return { ...obj, width: newWidth, height: newHeight };
        }
        return obj;
      });
      setObjects(updateArrowPositions(newObjects));
    }
  };

  const handleMouseUp = () => {
    if (dragging || resizing) {
      saveToHistory(objects);
    }
    setDragging(null);
    setResizing(null);
  };

  const deleteObject = (id: string) => {
    saveToHistory(objects.filter(obj => obj.id !== id));
  };

  const updateContent = (id: string, content: string) => {
    const newObjects = objects.map(obj =>
      obj.id === id && (obj.type === 'sticky' || obj.type === 'text')
        ? { ...obj, content }
        : obj
    );
    setObjects(newObjects);
  };

  const commitEdit = () => {
    if (editingId) {
      saveToHistory(objects);
      setEditingId(null);
    }
  };

  // Click outside to commit edit
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingId && editRef.current && !editRef.current.contains(e.target as Node)) {
        commitEdit();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingId, objects]);

  // Auto-resize text height
  const calculateTextHeight = (content: string, width: number) => {
    const lineHeight = 20;
    const charsPerLine = Math.floor(width / 8);
    const lines = content.split('\n').reduce((acc, line) => {
      return acc + Math.ceil(line.length / charsPerLine) || 1;
    }, 0);
    return Math.max(50, lines * lineHeight + 40);
  };

  return (
    <Box sx={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Left Toolbar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            backgroundColor: '#2c2c2c',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 2,
            gap: 2
          }
        }}
      >
        <Tooltip title="Undo" placement="right">
          <span>
            <Button
              onClick={undo}
              disabled={historyIndex <= 0}
              sx={{ color: 'white', minWidth: 60 }}
            >
              <UndoIcon />
            </Button>
          </span>
        </Tooltip>
        
        <Tooltip title="Redo" placement="right">
          <span>
            <Button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              sx={{ color: 'white', minWidth: 60 }}
            >
              <RedoIcon />
            </Button>
          </span>
        </Tooltip>

        <Box sx={{ borderTop: '1px solid #444', width: '80%', my: 1 }} />

        <Tooltip title="Sticky Note" placement="right">
          <Button
            onClick={() => setSelectedTool('sticky')}
            sx={{
              color: 'white',
              minWidth: 60,
              backgroundColor: selectedTool === 'sticky' ? '#444' : 'transparent'
            }}
          >
            <StickyNote2Icon />
          </Button>
        </Tooltip>

        {selectedTool === 'sticky' && (
          <ButtonGroup orientation="vertical" size="small">
            {(Object.keys(COLOR_PRESETS) as Array<keyof typeof COLOR_PRESETS>).map(color => (
              <Button
                key={color}
                onClick={() => setSelectedColor(color)}
                sx={{
                  backgroundColor: COLOR_PRESETS[color],
                  minWidth: 50,
                  height: 30,
                  border: selectedColor === color ? '2px solid white' : '1px solid #ccc',
                  '&:hover': {
                    backgroundColor: COLOR_PRESETS[color],
                    opacity: 0.8
                  }
                }}
              />
            ))}
          </ButtonGroup>
        )}

        <Tooltip title="Text" placement="right">
          <Button
            onClick={() => setSelectedTool('text')}
            sx={{
              color: 'white',
              minWidth: 60,
              backgroundColor: selectedTool === 'text' ? '#444' : 'transparent'
            }}
          >
            <TextFieldsIcon />
          </Button>
        </Tooltip>

        <Tooltip title="Arrow" placement="right">
          <Button
            onClick={() => setSelectedTool('arrow')}
            sx={{
              color: 'white',
              minWidth: 60,
              backgroundColor: selectedTool === 'arrow' ? '#444' : 'transparent'
            }}
          >
            <TrendingFlatIcon />
          </Button>
        </Tooltip>
      </Drawer>

      {/* Canvas */}
      <Box
        ref={canvasRef}
        onClick={createObject}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        sx={{
          flex: 1,
          backgroundColor: '#f5f5f5',
          position: 'relative',
          overflow: 'auto',
          cursor: selectedTool ? 'crosshair' : 'default'
        }}
      >
        {objects.map(obj => {
          if (obj.type === 'sticky') {
            const sticky = obj as StickyNote;
            const autoHeight = calculateTextHeight(sticky.content, sticky.width);
            const displayHeight = Math.max(sticky.height, autoHeight);

            return (
              <Card
                key={sticky.id}
                onClick={(e) => handleNoteClick(e, sticky.id)}
                onMouseDown={(e) => {
                  if (selectedTool !== 'arrow') {
                    handleMouseDown(e, sticky.id, 'drag');
                  }
                }}
                onMouseEnter={() => setHoveredNote(sticky.id)}
                onMouseLeave={() => setHoveredNote(null)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingId(sticky.id);
                }}
                sx={{
                  position: 'absolute',
                  left: sticky.x,
                  top: sticky.y,
                  width: sticky.width,
                  height: displayHeight,
                  backgroundColor: COLOR_PRESETS[sticky.color],
                  cursor: selectedTool === 'arrow' ? 'pointer' : (dragging === sticky.id ? 'grabbing' : 'grab'),
                  boxShadow: 3,
                  borderRadius: 2,
                  border: arrowSource === sticky.id ? '3px solid #1976d2' : 
                          (hoveredNote === sticky.id && selectedTool === 'arrow' ? '2px dashed #1976d2' : 'none'),
                  '&:hover': {
                    boxShadow: 6
                  }
                }}
              >
                <CardContent sx={{ height: '100%', position: 'relative', padding: 2 }}>
                  <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteObject(sticky.id);
                      }}
                      sx={{ minWidth: 30, padding: 0.5 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </Button>
                  </Box>
                  {editingId === sticky.id ? (
                    <Box
                      ref={editRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => updateContent(sticky.id, e.currentTarget.textContent || '')}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') commitEdit();
                      }}
                      sx={{
                        fontSize: '14px',
                        outline: 'none',
                        minHeight: 100,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        paddingTop: 4,
                        color: '#000'
                      }}
                    >
                      {sticky.content}
                    </Box>
                  ) : (
                    <Box sx={{ fontSize: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingTop: 4, color: '#000' }}>
                      {sticky.content}
                    </Box>
                  )}
                  {/* Resize handle */}
                  <Box
                    onMouseDown={(e) => handleMouseDown(e, sticky.id, 'resize')}
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 20,
                      height: 20,
                      cursor: 'nwse-resize',
                      '&::after': {
                        content: '"⇘"',
                        position: 'absolute',
                        bottom: 2,
                        right: 2,
                        fontSize: 12,
                        color: '#666'
                      }
                    }}
                  />
                  
                  {/* Anchor points - visible when arrow tool is active */}
                  {selectedTool === 'arrow' && (
                    <>
                      {(['top', 'right', 'bottom', 'left'] as const).map(anchor => {
                        const point = getAnchorPoint(sticky, anchor);
                        return (
                          <Box
                            key={anchor}
                            sx={{
                              position: 'absolute',
                              left: point.x - sticky.x - 6,
                              top: point.y - sticky.y - 6,
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: '#1976d2',
                              border: '2px solid white',
                              pointerEvents: 'none',
                              zIndex: 100
                            }}
                          />
                        );
                      })}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          } else if (obj.type === 'text') {
            const text = obj as TextObject;
            const autoHeight = calculateTextHeight(text.content, text.width);
            const displayHeight = Math.max(text.height, autoHeight);

            return (
              <Box
                key={text.id}
                onClick={(e) => handleNoteClick(e, text.id)}
                onMouseDown={(e) => {
                  if (selectedTool !== 'arrow') {
                    handleMouseDown(e, text.id, 'drag');
                  }
                }}
                onMouseEnter={() => setHoveredNote(text.id)}
                onMouseLeave={() => setHoveredNote(null)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingId(text.id);
                }}
                sx={{
                  position: 'absolute',
                  left: text.x,
                  top: text.y,
                  width: text.width,
                  height: displayHeight,
                  cursor: selectedTool === 'arrow' ? 'pointer' : (dragging === text.id ? 'grabbing' : 'grab'),
                  padding: 1,
                  border: arrowSource === text.id ? '3px solid #1976d2' : 
                          (editingId === text.id ? '2px solid #1976d2' : 
                          (hoveredNote === text.id && selectedTool === 'arrow' ? '2px dashed #1976d2' : '2px solid transparent')),
                  '&:hover': {
                    border: editingId === text.id ? '2px solid #1976d2' : '2px solid #ccc'
                  }
                }}
              >
                <Box sx={{ position: 'absolute', top: -30, right: 0, zIndex: 10 }}>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteObject(text.id);
                    }}
                    sx={{ minWidth: 30, padding: 0.5 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </Button>
                </Box>
                {editingId === text.id ? (
                  <Box
                    ref={editRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => updateContent(text.id, e.currentTarget.textContent || '')}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') commitEdit();
                    }}
                    sx={{
                      fontSize: '16px',
                      outline: 'none',
                      minHeight: 30,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: '#000'
                    }}
                  >
                    {text.content}
                  </Box>
                ) : (
                  <Box sx={{ fontSize: '16px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#000' }}>
                    {text.content}
                  </Box>
                )}
                {/* Resize handle */}
                <Box
                  onMouseDown={(e) => handleMouseDown(e, text.id, 'resize')}
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 20,
                    height: 20,
                    cursor: 'nwse-resize',
                    '&::after': {
                      content: '"⇘"',
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      fontSize: 12,
                      color: '#666'
                    }
                  }}
                />
                
                {/* Anchor points - visible when arrow tool is active */}
                {selectedTool === 'arrow' && (
                  <>
                    {(['top', 'right', 'bottom', 'left'] as const).map(anchor => {
                      const point = getAnchorPoint(text, anchor);
                      return (
                        <Box
                          key={anchor}
                          sx={{
                            position: 'absolute',
                            left: point.x - text.x - 6,
                            top: point.y - text.y - 6,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: '#1976d2',
                            border: '2px solid white',
                            pointerEvents: 'none',
                            zIndex: 100
                          }}
                        />
                      );
                    })}
                  </>
                )}
              </Box>
            );
          } else if (obj.type === 'arrow') {
            const arrow = obj as ArrowObject;
            
            // Calculate bezier curve control points based on anchor positions
            const dx = arrow.endX - arrow.x;
            const dy = arrow.endY - arrow.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Offset control points based on source and target anchor directions
            let cp1x = arrow.x;
            let cp1y = arrow.y;
            let cp2x = arrow.endX;
            let cp2y = arrow.endY;
            
            const offset = Math.min(distance * 0.4, 100); // Dynamic offset based on distance
            
            if (arrow.sourceAnchor === 'right') {
              cp1x += offset;
            } else if (arrow.sourceAnchor === 'left') {
              cp1x -= offset;
            } else if (arrow.sourceAnchor === 'top') {
              cp1y -= offset;
            } else if (arrow.sourceAnchor === 'bottom') {
              cp1y += offset;
            }
            
            if (arrow.targetAnchor === 'right') {
              cp2x += offset;
            } else if (arrow.targetAnchor === 'left') {
              cp2x -= offset;
            } else if (arrow.targetAnchor === 'top') {
              cp2y -= offset;
            } else if (arrow.targetAnchor === 'bottom') {
              cp2y += offset;
            }
            
            const pathData = `M ${arrow.x} ${arrow.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${arrow.endX} ${arrow.endY}`;
            
            return (
              <svg
                key={arrow.id}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none'
                }}
              >
                <defs>
                  <marker
                    id={`arrowhead-${arrow.id}`}
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3, 0 6" fill="#333" />
                  </marker>
                </defs>
                <path
                  d={pathData}
                  stroke="#333"
                  strokeWidth="2"
                  fill="none"
                  markerEnd={`url(#arrowhead-${arrow.id})`}
                />
              </svg>
            );
          }
          return null;
        })}
      </Box>
    </Box>
  );
}











