
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
  History
} from 'lucide-react';
import { processOrderData } from './services/geminiService';
import { ProcessingState, OrderBlock, HistoryItem } from './types';
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
  
  // Edit Modal State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<OrderBlock | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history on mount
  React.useEffect(() => {
    const savedHistory = localStorage.getItem('order_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
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
    return `NAME: ${block.name}\nCONTACT: ${block.contact}\nCOD BILL: ${block.codBill}\nADDRESS: ${block.address}`;
  };

  const getAllFormattedText = () => {
    if (!state.result) return '';
    return state.result.map(formatForCopy).join('\n\n');
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
    setEditingIndex(null);
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

  const startEditing = (index: number) => {
    if (state.result) {
      setEditingIndex(index);
      setEditForm({ ...state.result[index] });
    }
  };

  const saveEdit = () => {
    if (state.result && editForm !== null && editingIndex !== null) {
      const newResult = [...state.result];
      newResult[editingIndex] = editForm;
      setState(prev => ({ ...prev, result: newResult }));
      setEditingIndex(null);
      setEditForm(null);
    }
  };

  const exportPDF = () => {
    if (!state.result) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text('Order Delivery Labels', 14, yPos);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, yPos + 8);
    doc.text(`Total Orders: ${state.result.length}`, 14, yPos + 13);
    
    yPos += 25;

    state.result.forEach((order, index) => {
      // Check if we need a new page
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      // Draw box
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.rect(14, yPos, pageWidth - 28, 45);

      // Label Content
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // Slate-600
      doc.text(`Order #${index + 1}`, 18, yPos + 8);

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

      yPos += 55;
    });

    doc.save(`delivery_orders_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1"></div>
          <div className="text-center flex-1">
            <div className="mx-auto h-20 w-20 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg rotate-3 hover:rotate-0 transition-transform cursor-default">
              <FileText className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Order Formatter <span className="text-indigo-600">Pro</span>
            </h1>
            <p className="mt-3 text-lg text-slate-600 font-medium">
              AI-powered delivery labels with Edit & PDF export.
            </p>
          </div>
          <div className="flex-1 flex justify-end pt-4">
            <button 
              onClick={() => setShowHistory(true)}
              className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"
            >
              <History className="h-5 w-5" />
              <span className="hidden sm:inline">History</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white shadow-2xl rounded-3xl overflow-hidden border border-slate-200 relative">
          {!state.result ? (
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
                  <button 
                    onClick={goBack}
                    className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all mr-2"
                    title="Back to Input"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Output Labels</h3>
                    <p className="text-sm text-slate-500 font-medium">{state.result.length} orders analyzed</p>
                  </div>
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
                </div>
                
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                  <button
                    onClick={exportPDF}
                    className="flex-1 lg:flex-none flex items-center justify-center px-4 py-2.5 bg-slate-800 text-white rounded-xl font-black text-sm hover:bg-slate-900 transition-all shadow-md active:scale-95"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </button>
                  <button
                    onClick={copyAll}
                    className="flex-1 lg:flex-none flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                  >
                    {copiedAll ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    Copy
                  </button>
                  <button
                    onClick={reset}
                    className="flex-1 lg:flex-none flex items-center justify-center px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-50 transition-all active:scale-95"
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    New
                  </button>
                </div>
              </div>

              {viewMode === 'visual' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                  {state.result.map((order, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-xl transition-all group relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 flex gap-2">
                        <button 
                          onClick={() => startEditing(idx)}
                          className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
                          title="Edit Order"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => copySingle(order, idx)}
                          className={`p-2 rounded-lg transition-all ${copiedIndex === idx ? 'bg-green-100 text-green-600' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                        >
                          {copiedIndex === idx ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-start">
                          <div className="bg-blue-50 p-2.5 rounded-xl mr-4 group-hover:bg-blue-100 transition-colors">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Name</p>
                            <p className="text-lg font-black text-slate-900 truncate">{order.name}</p>
                          </div>
                        </div>

                        <div className="flex items-start">
                          <div className="bg-green-50 p-2.5 rounded-xl mr-4 group-hover:bg-green-100 transition-colors">
                            <Phone className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Contact</p>
                            <p className="text-base font-bold text-slate-800">{order.contact}</p>
                          </div>
                        </div>

                        <div className="flex items-start">
                          <div className="bg-amber-50 p-2.5 rounded-xl mr-4 group-hover:bg-amber-100 transition-colors">
                            <Banknote className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">COD Bill</p>
                            <p className="text-2xl font-black text-indigo-600">{order.codBill}</p>
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
                      </div>
                    </div>
                  ))}
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
        {editingIndex !== null && editForm && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-modal overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center">
                  <div className="bg-amber-100 p-2 rounded-lg mr-3">
                    <Edit2 className="h-5 w-5 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Edit Order Details</h3>
                </div>
                <button onClick={() => setEditingIndex(null)} className="p-2 text-slate-400 hover:text-slate-600">
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
                  onClick={() => setEditingIndex(null)}
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
