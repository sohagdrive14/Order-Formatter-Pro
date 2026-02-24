
import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Copy, 
  Check, 
  RefreshCcw, 
  AlertCircle, 
  Clipboard, 
  Image as ImageIcon,
  User,
  Phone,
  Banknote,
  MapPin,
  LayoutGrid,
  Type as TypeIcon,
  Edit2,
  Download,
  X,
  Save,
  Clock,
  ArrowLeft,
  Trash2,
  History,
  Truck,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  BarChart3,
  Filter,
  ExternalLink,
  ChevronRight,
  MessageSquare,
  Calendar
} from 'lucide-react';
import { processOrderData } from './services/geminiService';
import { ProcessingState, OrderBlock, HistoryItem, OrderStatus } from './types';
import { jsPDF } from 'jspdf';

const App: React.FC = () => {
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    error: null,
    result: null,
  });
  const [inputText, setInputText] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'text'>('visual');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [role, setRole] = useState<'admin' | 'agent'>('agent');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Edit Modal State
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<OrderBlock | null>(null);

  // Cancel Modal State
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [customCancelReason, setCustomCancelReason] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history and role on mount
  React.useEffect(() => {
    const savedHistory = localStorage.getItem('order_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'admin') {
      setRole('admin');
    } else {
      setRole('agent');
    }
  }, []);

  // Save history when it changes
  React.useEffect(() => {
    localStorage.setItem('order_history', JSON.stringify(history));
  }, [history]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
        setInputText('');
        handleProcess(reader.result as string, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcess = async (data: string, mimeType?: string) => {
    setState({ isProcessing: true, error: null, result: null });
    try {
      let result;
      if (mimeType) {
        const base64Data = data.split(',')[1];
        result = await processOrderData({ data: base64Data, mimeType });
      } else {
        if (!data.trim()) throw new Error("Please enter some text to process.");
        result = await processOrderData(data);
      }
      setState({ isProcessing: false, error: null, result });
      
      // Save to history
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        orders: result,
        sourceType: mimeType ? 'image' : 'text'
      };
      setHistory(prev => [newHistoryItem, ...prev].slice(0, 50)); // Keep last 50
    } catch (err: any) {
      setState({ isProcessing: false, error: err.message, result: null });
    }
  };

  const formatForCopy = (block: OrderBlock) => {
    return `ID: ${block.order_id}\nNAME: ${block.name}\nCONTACT: ${block.contact}\nCOD BILL: ${block.codBill}\nADDRESS: ${block.address}\nSTATUS: ${block.status}`;
  };

  const getAllFormattedText = () => {
    if (!state.result) return '';
    return state.result.map(formatForCopy).join('\n\n');
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus, reason?: string) => {
    const updateInList = (list: OrderBlock[]) => {
      return list.map(order => {
        if (order.order_id === orderId) {
          const updated = { ...order, status };
          if (status === OrderStatus.DELIVERED) {
            updated.delivery_time = new Date().toISOString();
            updated.delivery_agent = "Agent Rahim";
          }
          if (status === OrderStatus.CANCELLED && reason) {
            updated.cancel_reason = reason;
          }
          return updated;
        }
        return order;
      });
    };

    // Update current batch if active
    if (state.result) {
      const newResult = updateInList(state.result);
      setState(prev => ({ ...prev, result: newResult }));
    }
    
    // Update history
    setHistory(prev => prev.map(item => ({
      ...item,
      orders: updateInList(item.orders)
    })));
  };

  const handleCancelSubmit = () => {
    if (cancellingOrderId !== null) {
      const finalReason = cancelReason === 'Other' ? customCancelReason : cancelReason;
      updateOrderStatus(cancellingOrderId, OrderStatus.CANCELLED, finalReason);
      setCancellingOrderId(null);
      setCancelReason('');
      setCustomCancelReason('');
    }
  };

  const dailyOrders = React.useMemo(() => {
    return history
      .filter(item => new Date(item.timestamp).toISOString().split('T')[0] === selectedDate)
      .flatMap(item => item.orders);
  }, [history, selectedDate]);

  const getAnalytics = () => {
    const source = role === 'admin' && state.result ? state.result : dailyOrders;
    if (!source || source.length === 0) return null;
    
    const total = source.length;
    const delivered = source.filter(o => o.status === OrderStatus.DELIVERED).length;
    const cancelled = source.filter(o => o.status === OrderStatus.CANCELLED).length;
    const pending = source.filter(o => o.status === OrderStatus.PENDING).length;
    const outForDelivery = source.filter(o => o.status === OrderStatus.OUT_FOR_DELIVERY).length;

    const cancelReasons: Record<string, number> = {};
    source.forEach(o => {
      if (o.status === OrderStatus.CANCELLED && o.cancel_reason) {
        cancelReasons[o.cancel_reason] = (cancelReasons[o.cancel_reason] || 0) + 1;
      }
    });

    return {
      total,
      delivered,
      cancelled,
      pending,
      outForDelivery,
      successRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      cancelReasons
    };
  };

  const currentOrders = role === 'admin' && state.result ? state.result : dailyOrders;

  const filteredOrders = currentOrders.filter(o => 
    statusFilter === 'All' ? true : o.status === statusFilter
  );

  const exportPDF = (type: 'labels' | 'report' = 'labels') => {
    const source = type === 'report' ? dailyOrders : (state.result || dailyOrders);
    if (!source || source.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    if (type === 'report') {
      const analytics = getAnalytics();
      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229);
      doc.text('Daily Delivery Report', 14, yPos);
      
      yPos += 15;
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.text(`Date: ${selectedDate}`, 14, yPos);
      doc.text(`Total Orders: ${analytics?.total}`, 14, yPos + 7);
      doc.text(`Success Rate: ${analytics?.successRate}%`, 14, yPos + 14);
      
      yPos += 30;
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('Summary Statistics', 14, yPos);
      
      yPos += 10;
      doc.setFontSize(10);
      const stats = [
        ['Status', 'Count'],
        ['Delivered', analytics?.delivered.toString() || '0'],
        ['Cancelled', analytics?.cancelled.toString() || '0'],
        ['Pending', analytics?.pending.toString() || '0'],
        ['Out for Delivery', analytics?.outForDelivery.toString() || '0']
      ];
      
      stats.forEach((row, i) => {
        doc.text(row[0], 14, yPos + (i * 7));
        doc.text(row[1], 60, yPos + (i * 7));
      });

      yPos += 50;
      doc.setFontSize(14);
      doc.text('Cancellation Analysis', 14, yPos);
      yPos += 10;
      doc.setFontSize(10);
      Object.entries(analytics?.cancelReasons || {}).forEach(([reason, count], i) => {
        doc.text(`${reason}: ${count}`, 14, yPos + (i * 7));
      });

      doc.save(`daily_report_${selectedDate}.pdf`);
      return;
    }

    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text('Order Delivery Labels', 14, yPos);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, yPos + 8);
    doc.text(`Total Orders: ${source.length}`, 14, yPos + 13);
    
    yPos += 25;

    source.forEach((order, index) => {
      // Check if we need a new page
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      // Draw box
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.rect(14, yPos, pageWidth - 28, 50);

      // Label Content
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // Slate-600
      doc.text(`Order ID: ${order.order_id}`, 18, yPos + 8);
      doc.text(`Status: ${order.status}`, pageWidth - 60, yPos + 8);

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.setFont("helvetica", "bold");
      doc.text(`NAME: ${order.name}`, 18, yPos + 16);
      doc.text(`CONTACT: ${order.contact}`, 18, yPos + 24);
      doc.text(`COD BILL: ${order.codBill}`, 18, yPos + 32);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85); // Slate-700
      const splitAddress = doc.splitTextToSize(`ADDRESS: ${order.address}`, pageWidth - 40);
      doc.text(splitAddress, 18, yPos + 40);

      yPos += 60;
    });

    doc.save(`delivery_orders_${new Date().getTime()}.pdf`);
  };

  const copySingle = (block: OrderBlock, index: number) => {
    navigator.clipboard.writeText(formatForCopy(block));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = () => {
    const allText = getAllFormattedText();
    if (allText) {
      navigator.clipboard.writeText(allText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const reset = () => {
    setState({ isProcessing: false, error: null, result: null });
    setInputText('');
    setPreviewUrl(null);
    setEditingOrderId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const goBack = () => {
    setState(prev => ({ ...prev, result: null }));
  };

  const loadFromHistory = (item: HistoryItem) => {
    setState({
      isProcessing: false,
      error: null,
      result: item.orders
    });
    setShowHistory(false);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const startEditing = (order: OrderBlock) => {
    setEditingOrderId(order.order_id);
    setEditForm({ ...order });
  };

  const saveEdit = () => {
    if (editForm !== null && editingOrderId !== null) {
      const updateInList = (list: OrderBlock[]) => {
        return list.map(order => order.order_id === editingOrderId ? editForm : order);
      };

      if (state.result) {
        setState(prev => ({ ...prev, result: updateInList(prev.result!) }));
      }
      
      setHistory(prev => prev.map(item => ({
        ...item,
        orders: updateInList(item.orders)
      })));

      setEditingOrderId(null);
      setEditForm(null);
    }
  };

  const analytics = getAnalytics();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1">
            <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit">
              <button 
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('role', 'admin');
                  window.history.pushState({}, '', url);
                  setRole('admin');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${role === 'admin' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <ShieldCheck className="h-4 w-4" />
                Admin
              </button>
              <button 
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('role', 'agent');
                  window.history.pushState({}, '', url);
                  setRole('agent');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${role === 'agent' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <Truck className="h-4 w-4" />
                Agent
              </button>
            </div>
          </div>
          <div className="text-center flex-1">
            <div className="mx-auto h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg rotate-3 hover:rotate-0 transition-transform cursor-default">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Order Formatter <span className="text-indigo-600">Pro</span>
            </h1>
          </div>
          <div className="flex-1 flex justify-end gap-3">
            {role === 'admin' && (
              <button 
                onClick={() => setShowHistory(true)}
                className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"
              >
                <History className="h-5 w-5" />
                <span className="hidden sm:inline">History</span>
              </button>
            )}
          </div>
        </div>

        {/* Role Switcher Mobile Removed */}

        {/* Admin Analytics Bar */}
        {state.result || dailyOrders.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Success Rate</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-black text-indigo-600">{analytics?.successRate}%</p>
                <div className="h-2 w-full bg-slate-100 rounded-full mb-2 overflow-hidden">
                  <div className="h-full bg-indigo-600" style={{ width: `${analytics?.successRate}%` }}></div>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Delivered</p>
              <p className="text-2xl font-black text-green-600">{analytics?.delivered}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Cancelled</p>
              <p className="text-2xl font-black text-red-600">{analytics?.cancelled}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total</p>
              <p className="text-2xl font-black text-slate-900">{analytics?.total}</p>
            </div>
          </div>
        ) : null}

        {/* Main Content Area */}
        <div className="bg-white shadow-2xl rounded-3xl overflow-hidden border border-slate-200 relative">
          {role === 'admin' && !state.result ? (
            <div className="p-8 space-y-8">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Image Upload Box */}
                <div className="flex-1 group">
                  <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">
                    Upload Table Screenshot
                  </label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="relative cursor-pointer border-3 border-dashed border-slate-200 rounded-2xl p-12 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center text-center bg-slate-50"
                  >
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                    <div className="bg-white p-5 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                      <ImageIcon className="h-10 w-10 text-indigo-500" />
                    </div>
                    <span className="text-slate-900 font-bold text-lg">Select Image</span>
                    <span className="text-slate-400 text-sm mt-1">PNG, JPG, Screenshot</span>
                  </div>
                </div>

                <div className="hidden md:flex items-center text-slate-300 font-black uppercase text-xs">
                  OR
                </div>

                {/* Text Area Input */}
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">
                    Paste Raw Text
                  </label>
                  <textarea
                    className="w-full h-[220px] p-5 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all resize-none text-sm font-mono bg-slate-50 text-slate-800"
                    placeholder="Paste order table contents here..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <button
                    disabled={state.isProcessing || !inputText.trim()}
                    onClick={() => handleProcess(inputText)}
                    className="mt-4 w-full flex items-center justify-center px-6 py-4 border border-transparent text-base font-black rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
                  >
                    {state.isProcessing ? (
                      <RefreshCcw className="animate-spin h-5 w-5 mr-2" />
                    ) : (
                      <Clipboard className="h-5 w-5 mr-2" />
                    )}
                    Process Orders
                  </button>
                </div>
              </div>

              {previewUrl && (
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center space-x-4">
                    <img src={previewUrl} alt="Preview" className="h-14 w-14 object-cover rounded-xl border-2 border-white shadow-sm" />
                    <span className="text-sm text-indigo-900 font-bold">Image ready for analysis</span>
                  </div>
                  <button onClick={reset} className="p-2 text-indigo-400 hover:text-red-500 transition-colors">
                    <RefreshCcw className="h-5 w-5" />
                  </button>
                </div>
              )}

              {state.error && (
                <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                  <p className="text-sm text-red-700 font-bold">{state.error}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 space-y-6 bg-slate-50/50">
              {/* Toolbar */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md p-4 -m-4 mb-4 rounded-xl z-20 border border-slate-200 gap-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                  {role === 'admin' && (
                    <button 
                      onClick={goBack}
                      className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all mr-2"
                      title="Back to Input"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  )}
                  <div>
                    <h3 className="text-xl font-black text-slate-900">
                      {role === 'admin' ? (state.result ? 'Current Batch' : 'Daily View') : 'Delivery Dashboard'}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">{filteredOrders.length} orders shown</p>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                    <Calendar className="h-3.5 w-3.5 ml-2 text-slate-400" />
                    <input 
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent border-none text-xs font-black text-slate-600 focus:ring-0 outline-none cursor-pointer"
                    />
                  </div>

                  {role === 'admin' && state.result && (
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => setViewMode('visual')}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode === 'visual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                        Visual
                      </button>
                      <button
                        onClick={() => setViewMode('text')}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode === 'text' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <TypeIcon className="h-3.5 w-3.5 mr-1.5" />
                        Text
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                    <Filter className="h-3.5 w-3.5 ml-2 text-slate-400" />
                    <select 
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="bg-transparent border-none text-xs font-black text-slate-600 focus:ring-0 outline-none cursor-pointer pr-8"
                    >
                      <option value="All">All Status</option>
                      {Object.values(OrderStatus).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                  {role === 'admin' && (
                    <>
                      <button
                        onClick={() => exportPDF('report')}
                        className="flex-1 lg:flex-none flex items-center justify-center px-4 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-black text-sm hover:bg-indigo-100 transition-all active:scale-95"
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Report
                      </button>
                      <button
                        onClick={() => exportPDF('labels')}
                        className="flex-1 lg:flex-none flex items-center justify-center px-4 py-2.5 bg-slate-800 text-white rounded-xl font-black text-sm hover:bg-slate-900 transition-all shadow-md active:scale-95"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Labels
                      </button>
                      <button
                        onClick={copyAll}
                        className="flex-1 lg:flex-none flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                      >
                        {copiedAll ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                        Copy
                      </button>
                    </>
                  )}
                  {role === 'admin' && (
                    <button
                      onClick={reset}
                      className="flex-1 lg:flex-none flex items-center justify-center px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-50 transition-all active:scale-95"
                    >
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      New
                    </button>
                  )}
                </div>
              </div>

              {viewMode === 'visual' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                  {filteredOrders.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <Calendar className="h-16 w-16 opacity-20" />
                      <p className="font-bold">No orders found for this date</p>
                    </div>
                  ) : filteredOrders.map((order) => {
                    const isDelivered = order.status === OrderStatus.DELIVERED;
                    const isCancelled = order.status === OrderStatus.CANCELLED;
                    
                    // Check for repeated customer in the current list
                    const isRepeated = currentOrders.filter(o => o.address === order.address || o.contact === order.contact).length > 1;
                    
                    return (
                      <div key={order.order_id} className={`bg-white rounded-2xl p-6 shadow-sm border transition-all group relative overflow-hidden ${isDelivered ? 'border-green-200 bg-green-50/10' : isCancelled ? 'border-red-200 bg-red-50/10' : 'border-slate-200 hover:shadow-xl'}`}>
                        {/* Status Badge */}
                        <div className="absolute top-0 left-0 flex flex-col">
                          <div className={`px-4 py-1.5 rounded-br-2xl text-[10px] font-black uppercase tracking-widest text-white ${
                            order.status === OrderStatus.DELIVERED ? 'bg-green-500' :
                            order.status === OrderStatus.CANCELLED ? 'bg-red-500' :
                            order.status === OrderStatus.OUT_FOR_DELIVERY ? 'bg-blue-500' :
                            'bg-slate-400'
                          }`}>
                            {order.status}
                          </div>
                          {isRepeated && (
                            <div className="px-4 py-1 bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest rounded-br-xl w-fit">
                              Repeated Customer
                            </div>
                          )}
                        </div>

                        <div className="absolute top-0 right-0 p-4 flex gap-2">
                          {role === 'admin' && !isDelivered && (
                            <button 
                              onClick={() => startEditing(order)}
                              className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
                              title="Edit Order"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => copySingle(order, 0)} // index not used anymore for copy logic
                            className={`p-2 rounded-lg transition-all ${copiedIndex === 0 ? 'bg-green-100 text-green-600' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                          >
                            {copiedIndex === 0 ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>

                        <div className="space-y-4 mt-4">
                          <div className="flex items-start">
                            <div className="bg-blue-50 p-2.5 rounded-xl mr-4 group-hover:bg-blue-100 transition-colors">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Customer / ID: {order.order_id}</p>
                              <p className="text-lg font-black text-slate-900 truncate">{order.name}</p>
                            </div>
                          </div>

                          <div className="flex items-start">
                            <div className="bg-green-50 p-2.5 rounded-xl mr-4 group-hover:bg-green-100 transition-colors">
                              <Phone className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="flex-1 flex justify-between items-center">
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Contact</p>
                                <p className="text-base font-bold text-slate-800">{order.contact}</p>
                              </div>
                              <a 
                                href={`tel:${order.contact}`}
                                className="p-2 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition-all"
                              >
                                <Phone className="h-4 w-4" />
                              </a>
                            </div>
                          </div>

                          <div className="flex items-start">
                            <div className="bg-amber-50 p-2.5 rounded-xl mr-4 group-hover:bg-amber-100 transition-colors">
                              <Banknote className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">COD Bill</p>
                              <p className="text-2xl font-black text-indigo-600">৳{order.codBill}</p>
                            </div>
                          </div>

                          <div className="flex items-start pt-2 border-t border-slate-50">
                            <div className="bg-rose-50 p-2.5 rounded-xl mr-4 group-hover:bg-rose-100 transition-colors">
                              <MapPin className="h-5 w-5 text-rose-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Address</p>
                              <p className="text-sm font-medium text-slate-700 leading-relaxed break-words">{order.address}</p>
                            </div>
                          </div>

                          {isCancelled && order.cancel_reason && (
                            <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3">
                              <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Reason</p>
                                <p className="text-xs font-bold text-red-700">{order.cancel_reason}</p>
                              </div>
                            </div>
                          )}

                          {isDelivered && (
                            <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-start gap-3">
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">Delivered By {order.delivery_agent}</p>
                                <p className="text-xs font-bold text-green-700">{new Date(order.delivery_time!).toLocaleString()}</p>
                              </div>
                            </div>
                          )}

                          {/* Agent Actions - Visible to both for testing/admin control */}
                          {!isDelivered && !isCancelled && (
                            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                              <button 
                                onClick={() => updateOrderStatus(order.order_id, OrderStatus.OUT_FOR_DELIVERY)}
                                className={`col-span-2 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${order.status === OrderStatus.OUT_FOR_DELIVERY ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'}`}
                              >
                                <Truck className="h-4 w-4" />
                                {order.status === OrderStatus.OUT_FOR_DELIVERY ? 'Out for Delivery' : 'Mark Out for Delivery'}
                              </button>
                              <button 
                                onClick={() => updateOrderStatus(order.order_id, OrderStatus.DELIVERED)}
                                className="py-3 bg-green-600 text-white rounded-xl font-black text-sm hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-100"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Delivered
                              </button>
                              <button 
                                onClick={() => setCancellingOrderId(order.order_id)}
                                className="py-3 bg-white border-2 border-red-100 text-red-500 rounded-xl font-black text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                              >
                                <XCircle className="h-4 w-4" />
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-slate-900 p-6">
                    <pre className="text-green-400 font-mono text-sm leading-loose whitespace-pre-wrap select-all">
                      {getAllFormattedText()}
                    </pre>
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 font-bold uppercase tracking-widest">
                    <span>Standard Text Blocks</span>
                    <span>Ready for Copy/Paste</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingOrderId !== null && editForm && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-modal overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center">
                  <div className="bg-amber-100 p-2 rounded-lg mr-3">
                    <Edit2 className="h-5 w-5 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Edit Order Details</h3>
                </div>
                <button onClick={() => setEditingOrderId(null)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-5">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Customer Name</label>
                  <input 
                    type="text" 
                    value={editForm.name} 
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Phone / Contact</label>
                  <input 
                    type="text" 
                    value={editForm.contact} 
                    onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">COD Amount</label>
                  <input 
                    type="text" 
                    value={editForm.codBill} 
                    onChange={(e) => setEditForm({ ...editForm, codBill: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Delivery Address</label>
                  <textarea 
                    value={editForm.address} 
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium resize-none"
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => setEditingOrderId(null)}
                  className="flex-1 px-6 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-black transition-all hover:bg-white"
                >
                  Discard
                </button>
                <button 
                  onClick={saveEdit}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center justify-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Reason Modal */}
        {cancellingOrderId !== null && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-modal overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-red-50">
                <div className="flex items-center">
                  <div className="bg-red-100 p-2 rounded-lg mr-3">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Cancel Order</h3>
                </div>
                <button onClick={() => setCancellingOrderId(null)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <p className="text-slate-600 font-medium">Please select a reason for cancelling this delivery:</p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    'Customer not available',
                    'Phone unreachable',
                    'Address incorrect',
                    'Refused delivery',
                    'Other'
                  ].map(reason => (
                    <button
                      key={reason}
                      onClick={() => setCancelReason(reason)}
                      className={`w-full p-4 rounded-2xl border-2 text-left font-bold transition-all flex items-center justify-between ${cancelReason === reason ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-100 hover:border-slate-200 text-slate-600'}`}
                    >
                      {reason}
                      {cancelReason === reason && <CheckCircle2 className="h-5 w-5 text-red-500" />}
                    </button>
                  ))}
                </div>

                {cancelReason === 'Other' && (
                  <textarea
                    placeholder="Enter custom reason..."
                    value={customCancelReason}
                    onChange={(e) => setCustomCancelReason(e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-red-100 focus:border-red-500 outline-none transition-all font-medium resize-none"
                    rows={3}
                  />
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => setCancellingOrderId(null)}
                  className="flex-1 px-6 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-black transition-all hover:bg-white"
                >
                  Back
                </button>
                <button 
                  disabled={!cancelReason || (cancelReason === 'Other' && !customCancelReason)}
                  onClick={handleCancelSubmit}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-black transition-all hover:bg-red-700 shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {state.isProcessing && (
          <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-[60] flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 border-8 border-indigo-100 rounded-3xl rotate-45"></div>
              <div className="absolute inset-0 border-8 border-indigo-600 rounded-3xl border-t-transparent animate-spin rotate-45"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText className="h-10 w-10 text-indigo-600 animate-bounce" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">Processing Orders</p>
            <p className="mt-2 text-slate-500 font-medium">Gemini AI is reading your data...</p>
          </div>
        )}

        {/* History Sidebar */}
        {showHistory && (
          <div className="fixed inset-0 z-[70] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center">
                  <div className="bg-indigo-100 p-2 rounded-lg mr-3">
                    <History className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Order History</h3>
                </div>
                <button onClick={() => setShowHistory(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                    <Clock className="h-16 w-16 opacity-20" />
                    <p className="font-bold">No history yet</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {item.sourceType === 'image' ? (
                            <ImageIcon className="h-4 w-4 text-indigo-500" />
                          ) : (
                            <TypeIcon className="h-4 w-4 text-slate-500" />
                          )}
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            {new Date(item.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <button 
                          onClick={(e) => deleteHistoryItem(item.id, e)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-black text-slate-700">
                          {item.orders.length} {item.orders.length === 1 ? 'Order' : 'Orders'}
                        </p>
                        <div className="flex -space-x-2">
                          {item.orders.slice(0, 3).map((order, i) => (
                            <div key={i} className="h-6 w-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[8px] font-black text-indigo-600 shadow-sm">
                              {order.name.charAt(0)}
                            </div>
                          ))}
                          {item.orders.length > 3 && (
                            <div className="h-6 w-6 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[8px] font-black text-slate-500">
                              +{item.orders.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => {
                    if (confirm('Clear all history?')) {
                      setHistory([]);
                    }
                  }}
                  disabled={history.length === 0}
                  className="w-full px-6 py-3 border-2 border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 rounded-xl font-black transition-all disabled:opacity-50 disabled:hover:text-slate-400 disabled:hover:border-slate-200 disabled:hover:bg-transparent"
                >
                  Clear All History
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-slate-400 font-medium text-sm">
          <p>Professional Order Label Generator • Gemini 2.5 Flash</p>
        </div>
      </div>
    </div>
  );
};

export default App;
