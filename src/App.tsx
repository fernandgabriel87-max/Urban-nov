import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { GoogleGenAI } from '@google/genai';
import { Upload, Image as ImageIcon, Sparkles, Loader2, RefreshCw, Download, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type FileData = {
  url: string | null;
  base64: string;
  mimeType: string;
  name: string;
};

export default function App() {
  const [originalFile, setOriginalFile] = useState<FileData | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'autodesk' | null>(null);
  const [prompt, setPrompt] = useState('Remove the background and place the product on a clean, well-lit white surface.');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const isImage = file.type.startsWith('image/');
      const isAutodesk = file.name.match(/\.(dwg|dxf|rvt|ifc|log|txt|nwc|nwd)$/i) || file.type.includes('autodesk');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const [prefix, base64] = result.split(',');
        const mimeType = prefix.split(':')[1].split(';')[0];
        
        setOriginalFile({ url: isImage ? result : null, base64, mimeType, name: file.name });
        setEditedImage(null);
        setAnalysisResult(null);
        setError(null);
        
        if (isImage) {
          setFileType('image');
          setPrompt('Remove the background and place the product on a clean, well-lit white surface.');
        } else {
          setFileType('autodesk');
          setPrompt('Analyze this Autodesk file for errors, inconsistencies, or potential issues. List them clearly.');
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/octet-stream': ['.dwg', '.dxf', '.rvt', '.ifc', '.nwc', '.nwd'],
      'text/plain': ['.log', '.txt']
    },
    maxFiles: 1,
    multiple: false,
  } as any);

  const handleProcess = async () => {
    if (!originalFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      if (fileType === 'image') {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              {
                inlineData: {
                  data: originalFile.base64,
                  mimeType: originalFile.mimeType,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        });

        let foundImage = false;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            const base64EncodeString = part.inlineData.data;
            const imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${base64EncodeString}`;
            setEditedImage(imageUrl);
            foundImage = true;
            break;
          }
        }

        if (!foundImage) {
          throw new Error('No image was returned by the model.');
        }
      } else {
        // Autodesk File Analysis
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              {
                inlineData: {
                  data: originalFile.base64,
                  mimeType: originalFile.mimeType,
                },
              },
              {
                text: `You are an expert in Autodesk software (AutoCAD, Revit, Navisworks). 
                Analyze the following file content (or metadata if binary) for errors, inconsistencies, or potential issues.
                File Name: ${originalFile.name}
                User Instruction: ${prompt}
                Provide a detailed report in Markdown format.`,
              },
            ],
          },
        });

        const text = response.text;
        if (text) {
          setAnalysisResult(text);
        } else {
          throw new Error('No analysis result was returned by the model.');
        }
      }
    } catch (err: any) {
      console.error('Error processing file:', err);
      setError(err.message || 'Failed to process file. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!editedImage) return;
    const a = document.createElement('a');
    a.href = editedImage;
    a.download = `edited-${originalFile?.name || 'photo'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Product & Autodesk Studio</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
              <h2 className="text-lg font-medium mb-4">1. Upload File</h2>
              {!originalFile ? (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-8 h-8 mx-auto text-zinc-400 mb-3" />
                  <p className="text-sm text-zinc-600 font-medium">
                    Drag & drop an image or Autodesk file here
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">JPG, PNG, DWG, RVT, IFC, LOG...</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-zinc-200 group">
                  {fileType === 'image' ? (
                    <img src={originalFile.url!} alt="Original" className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 bg-zinc-100 flex flex-col items-center justify-center p-4">
                      <FileText className="w-12 h-12 text-indigo-600 mb-2" />
                      <p className="text-sm font-medium text-zinc-700 truncate max-w-full">{originalFile.name}</p>
                      <p className="text-xs text-zinc-400 mt-1 uppercase">{originalFile.mimeType.split('/')[1] || 'AUTODESK'}</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => {
                        setOriginalFile(null);
                        setEditedImage(null);
                        setAnalysisResult(null);
                        setFileType(null);
                      }}
                      className="bg-white text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-zinc-100 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Replace File
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
              <h2 className="text-lg font-medium mb-4">2. Instructions</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="prompt" className="block text-sm font-medium text-zinc-700 mb-1">
                    What should we do?
                  </label>
                  <textarea
                    id="prompt"
                    rows={4}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={fileType === 'image' ? "e.g., Remove the background..." : "e.g., Find errors in this Revit file..."}
                  />
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {fileType === 'image' ? [
                    "Remove background",
                    "Place on a marble countertop",
                    "Add dramatic studio lighting",
                    "Clean up dust and scratches"
                  ].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setPrompt(preset)}
                      className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-1.5 rounded-full transition-colors"
                    >
                      {preset}
                    </button>
                  )) : [
                    "Find CAD errors",
                    "Check Revit inconsistencies",
                    "Analyze LOG for crashes",
                    "Validate IFC structure"
                  ].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setPrompt(preset)}
                      className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full transition-colors border border-indigo-100"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleProcess}
                  disabled={!originalFile || isProcessing || !prompt.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:text-zinc-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-200"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      {fileType === 'image' ? 'Generate Edit' : 'Analyze File'}
                    </>
                  )}
                </button>

                {error && (
                  <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview Area */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 h-full min-h-[600px] flex flex-col overflow-hidden relative">
              <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <h2 className="font-medium text-zinc-700 flex items-center gap-2">
                  {fileType === 'image' ? <ImageIcon className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {fileType === 'image' ? 'Result' : 'Analysis Report'}
                </h2>
                {editedImage && (
                  <button
                    onClick={handleDownload}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                )}
              </div>
              
              <div className="flex-1 p-6 flex flex-col items-center justify-center bg-zinc-100/50 relative overflow-y-auto">
                <AnimatePresence mode="wait">
                  {isProcessing ? (
                    <motion.div
                      key="processing"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center text-zinc-500"
                    >
                      <div className="relative w-16 h-16 mb-4">
                        <div className="absolute inset-0 border-4 border-zinc-200 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                      </div>
                      <p className="font-medium">AI is working its magic...</p>
                      <p className="text-sm mt-1">This usually takes 10-20 seconds</p>
                    </motion.div>
                  ) : editedImage ? (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      <img
                        src={editedImage}
                        alt="Edited product"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                      />
                    </motion.div>
                  ) : analysisResult ? (
                    <motion.div
                      key="analysis"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full h-full bg-white p-8 rounded-xl shadow-sm border border-zinc-200 overflow-y-auto"
                    >
                      <div className="markdown-body prose prose-indigo max-w-none">
                        <Markdown>{analysisResult}</Markdown>
                      </div>
                    </motion.div>
                  ) : originalFile ? (
                    <motion.div
                      key="original"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="w-full h-full flex items-center justify-center opacity-50 grayscale"
                    >
                      {fileType === 'image' ? (
                        <img
                          src={originalFile.url!}
                          alt="Original product"
                          className="max-w-full max-h-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="text-center">
                          <FileText className="w-24 h-24 mx-auto mb-4 text-zinc-300" />
                          <p className="text-zinc-500 font-medium">{originalFile.name}</p>
                          <p className="text-sm text-zinc-400">Ready for analysis</p>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center text-zinc-400"
                    >
                      <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Upload a photo or Autodesk file to get started.</p>
                      <p className="text-sm mt-2">DWG, RVT, IFC, LOG and images are supported.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
