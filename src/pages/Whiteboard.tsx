import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Pencil,
  Eraser,
  Square,
  Circle,
  Trash2,
  Download,
  Save,
  Plus,
  Undo,
  Redo,
  Palette,
  MousePointer,
  Minus,
  MoreVertical,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { usePageAnimation } from '@/hooks/use-page-animation';
import { useAIContext } from '@/contexts/AIContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/layout/AppLayout';

interface WhiteboardData {
  id: string;
  title: string;
  canvas_data: any;
  created_at: string;
  updated_at: string;
}

const COLORS = [
  '#000000', '#374151', '#6B7280', '#EF4444', '#F97316', 
  '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'
];

const Whiteboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setAiContext } = useAIContext();
  const { shouldAnimate } = usePageAnimation('Whiteboard');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'select' | 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line'>('pen');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [whiteboards, setWhiteboards] = useState<WhiteboardData[]>([]);
  const [currentWhiteboard, setCurrentWhiteboard] = useState<WhiteboardData | null>(null);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const lastPosRef = useRef<{ x: number; y: number; imageData?: ImageData }>({ x: 0, y: 0 });

  useEffect(() => {
    fetchWhiteboards();
  }, [user]);

  useEffect(() => {
    setAiContext({
      currentPage: 'whiteboard',
      location: currentWhiteboard ? `Editing whiteboard: ${currentWhiteboard.title}` : 'Whiteboard',
      activeAnalytics: null,
      activeDocument: null,
      activePaper: null
    });
  }, [currentWhiteboard, setAiContext]);

  useEffect(() => {
    if (currentWhiteboard && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx && currentWhiteboard.canvas_data?.imageData) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = currentWhiteboard.canvas_data.imageData;
      }
    }
  }, [currentWhiteboard]);

  useEffect(() => {
    const initCanvas = () => {
      if (canvasRef.current && containerRef.current) {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          saveToHistory();
        }
      }
    };

    initCanvas();
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, []);

  const fetchWhiteboards = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('whiteboards')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (data) {
      setWhiteboards(data);
      if (data.length > 0 && !currentWhiteboard) {
        setCurrentWhiteboard(data[0]);
      }
    }
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const newIndex = historyIndex - 1;
      ctx.putImageData(history[newIndex], 0, 0);
      setHistoryIndex(newIndex);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const newIndex = historyIndex + 1;
      ctx.putImageData(history[newIndex], 0, 0);
      setHistoryIndex(newIndex);
    }
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCanvasCoordinates(e);
    lastPosRef.current = coords;
    setIsDrawing(true);

    if (tool === 'pen' || tool === 'eraser') {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    } else if (tool === 'line' || tool === 'rectangle' || tool === 'circle') {
      // Save current canvas state before drawing shapes
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        lastPosRef.current = { ...coords, imageData };
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const coords = getCanvasCoordinates(e);

    if (tool === 'pen') {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else if (tool === 'eraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = brushSize * 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else if (tool === 'line') {
      // Restore canvas and draw preview line
      if (lastPosRef.current.imageData) {
        ctx.putImageData(lastPosRef.current.imageData, 0, 0);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else if (tool === 'rectangle') {
      // Restore canvas and draw preview rectangle
      if (lastPosRef.current.imageData) {
        ctx.putImageData(lastPosRef.current.imageData, 0, 0);
      }
      const width = coords.x - lastPosRef.current.x;
      const height = coords.y - lastPosRef.current.y;
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.strokeRect(lastPosRef.current.x, lastPosRef.current.y, width, height);
    } else if (tool === 'circle') {
      // Restore canvas and draw preview circle
      if (lastPosRef.current.imageData) {
        ctx.putImageData(lastPosRef.current.imageData, 0, 0);
      }
      const radius = Math.sqrt(
        Math.pow(coords.x - lastPosRef.current.x, 2) +
        Math.pow(coords.y - lastPosRef.current.y, 2)
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      ctx.arc(lastPosRef.current.x, lastPosRef.current.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      // Clean up imageData from lastPosRef
      if ('imageData' in lastPosRef.current) {
        delete (lastPosRef.current as any).imageData;
      }
      saveToHistory();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const saveWhiteboard = async () => {
    if (!user || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL('image/png');

    try {
      if (currentWhiteboard) {
        const { error } = await supabase
          .from('whiteboards')
          .update({
            canvas_data: { imageData },
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentWhiteboard.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('whiteboards')
          .insert({
            user_id: user.id,
            title: 'Untitled Whiteboard',
            canvas_data: { imageData },
          })
          .select()
          .single();

        if (error) throw error;
        setCurrentWhiteboard(data);
      }

      toast({
        title: 'Saved!',
        description: 'Your whiteboard has been saved.',
      });

      fetchWhiteboards();
    } catch (error) {
      console.error('Error saving whiteboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to save whiteboard',
        variant: 'destructive',
      });
    }
  };

  const createNewWhiteboard = async () => {
    if (!user || !newTitle.trim()) return;

    try {
      const { data, error } = await supabase
        .from('whiteboards')
        .insert({
          user_id: user.id,
          title: newTitle,
          canvas_data: {},
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentWhiteboard(data);
      setNewTitle('');
      setIsNewDialogOpen(false);
      clearCanvas();
      fetchWhiteboards();

      toast({
        title: 'Created!',
        description: 'New whiteboard created.',
      });
    } catch (error) {
      console.error('Error creating whiteboard:', error);
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${currentWhiteboard?.title || 'whiteboard'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const tools = [
    { id: 'select', icon: MousePointer, label: 'Select' },
    { id: 'pen', icon: Pencil, label: 'Pen' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
  ];

  return (
    <AppLayout noPadding>
      <div className="flex flex-col gap-3 w-full h-full min-h-0 p-4 sm:p-6 lg:p-8 pb-4 lg:pb-4">
        {/* Desktop Toolbar */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          className="hidden md:flex items-center justify-between gap-4 p-4 bg-card rounded-xl mb-4 shadow-soft overflow-x-auto"
        >
          <div className="flex items-center gap-2">
            {/* Whiteboard Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-[150px] justify-between">
                  {currentWhiteboard?.title || 'Select Whiteboard'}
                  <MoreVertical className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[200px]">
                {whiteboards.map((wb) => (
                  <DropdownMenuItem
                    key={wb.id}
                    onClick={() => setCurrentWhiteboard(wb)}
                  >
                    {wb.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Whiteboard</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Whiteboard name..."
                  />
                  <Button onClick={createNewWhiteboard} className="w-full">
                    Create
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tools */}
          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg overflow-x-auto">
            {tools.map((t) => (
              <Button
                key={t.id}
                variant={tool === t.id ? 'default' : 'ghost'}
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={() => setTool(t.id as any)}
                title={t.label}
              >
                <t.icon className="w-4 h-4" />
              </Button>
            ))}
          </div>

          {/* Color & Size */}
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative flex-shrink-0">
                  <Palette className="w-4 h-4" />
                  <div
                    className="absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-background"
                    style={{ backgroundColor: color }}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="grid grid-cols-5 gap-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${
                        color === c ? 'ring-2 ring-primary ring-offset-2' : ''
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Size:</span>
              <Slider
                value={[brushSize]}
                onValueChange={([v]) => setBrushSize(v)}
                min={1}
                max={20}
                step={1}
                className="w-24"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={undo} disabled={historyIndex <= 0}>
              <Undo className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={redo} disabled={historyIndex >= history.length - 1}>
              <Redo className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={clearCanvas}>
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={downloadCanvas}>
              <Download className="w-4 h-4" />
            </Button>
            <Button onClick={saveWhiteboard}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </motion.div>

        {/* Mobile Top Bar - Vertical Layout */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden grid grid-cols-2 gap-2 w-full"
        >
          {/* Whiteboard Selector and New */}
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 justify-between text-xs px-2 h-9 truncate">
                  <span className="truncate text-[11px] sm:text-xs">{currentWhiteboard?.title?.slice(0, 12) || 'Select'}</span>
                  <MoreVertical className="w-3 h-3 ml-1 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {whiteboards.map((wb) => (
                  <DropdownMenuItem key={wb.id} onClick={() => setCurrentWhiteboard(wb)}>
                    {wb.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline" className="h-9 w-9 flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Whiteboard</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Whiteboard name..."
                  />
                  <Button onClick={createNewWhiteboard} className="w-full">
                    Create
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Save Button */}
          <Button onClick={saveWhiteboard} className="h-9 w-full col-span-2 sm:col-span-1">
            <Save className="w-4 h-4 mr-1" />
            <span className="text-xs sm:text-sm">Save</span>
          </Button>
        </motion.div>

        {/* Canvas - Full height with responsive sizing */}
        <motion.div
          ref={containerRef}
          initial={shouldAnimate ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 min-h-0 w-full bg-card rounded-xl shadow-soft overflow-hidden touch-none"
          style={{
            minHeight: '400px',
            // Responsive height: mobile uses 100dvh - 280px, tablet/desktop uses flex
            height: 'auto',
            flex: '1 1 auto',
          }}
        >
          <canvas
            ref={canvasRef}
            className="cursor-crosshair w-full h-full"
            style={{ display: 'block', touchAction: 'none' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onTouchCancel={stopDrawing}
          />
        </motion.div>

        {/* Mobile Bottom Toolbar - Vertical Grid Layout */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden grid grid-cols-4 gap-2 w-full bg-card border-t border-border p-3 pb-20 rounded-t-xl shadow-soft"
        >
          {/* Tools - Primary 4 */}
          {tools.slice(0, 4).map((t) => (
            <Button
              key={t.id}
              variant={tool === t.id ? 'default' : 'outline'}
              size="icon"
              className="h-10 w-full"
              onClick={() => setTool(t.id as any)}
              title={t.label}
            >
              <t.icon className="w-4 h-4" />
            </Button>
          ))}

          {/* Color Picker */}
          <div className="col-span-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-full relative">
                  <Palette className="w-4 h-4" />
                  <div
                    className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-background"
                    style={{ backgroundColor: color }}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" side="top">
                <div className="grid grid-cols-5 gap-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${
                        color === c ? 'ring-2 ring-primary ring-offset-1' : ''
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Undo */}
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-full"
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </Button>

          {/* Redo */}
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-full"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </Button>

          {/* Clear */}
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-full"
            onClick={clearCanvas}
            title="Clear"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          {/* Download */}
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-full"
            onClick={downloadCanvas}
            title="Download"
          >
            <Download className="w-4 h-4" />
          </Button>

          {/* More Tools - Show remaining tools */}
          <div className="col-span-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-full">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {tools.slice(4).map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => setTool(t.id as any)}>
                    {t.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default Whiteboard;
