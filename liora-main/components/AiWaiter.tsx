import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { Spinner } from './Spinner';
import { useDining } from '../src/context/DiningContext';
import { ChatMessage, MessageAuthor } from '../types';
import { uid } from '../utils/uid';
import {
  requestAssistance,
  getSessionData,
  chatWithAiWaiter,
  OrderItem
} from '../services/aiWaiterService';
import { BillSplitter } from './BillSplitter';
import jsQR from 'jsqr';

// Extend window type for jsQR
declare global {
  interface Window {
    jsQR?: typeof jsQR;
  }
}

export const AiWaiter = () => {
    const { session, endSession, connectTableViaQR, addAssistanceRequest, updateOrders, updateAssistanceRequests } = useDining();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSplitter, setShowSplitter] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [qrError, setQrError] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Initial greeting when checking in
    useEffect(() => {
        if (session.isActive && messages.length === 0) {
            setMessages([{
                id: uid(),
                author: MessageAuthor.LIORA,
                text: `Welcome to ${session.restaurantName}! I've connected to Table ${session.tableNumber}. \n\nThe **Chef's Special** today is the Truffle Risotto. Would you like to see the wine list or start with some sparkling water?`
            }]);
        } else if (!session.isActive) {
            setMessages([]);
        }
    }, [session.isActive, session.restaurantName, session.tableNumber]);

    useEffect(() => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    // QR Scanner initialization — auto-starts scanning once camera is ready
    useEffect(() => {
        if (!showQRScanner) return;

        let mounted = true;

        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                if (!mounted) return;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    streamRef.current = stream;
                }
                // Auto-start scanning — poll every 300ms until video has data
                scanIntervalRef.current = setInterval(() => {
                    if (videoRef.current?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
                        scanQRCode();
                    }
                }, 300);
            } catch (error) {
                setQrError('Unable to access camera. Please check permissions.');
                console.error('Camera access error:', error);
            }
        };

        initCamera();

        return () => {
            mounted = false;
            if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current);
                scanIntervalRef.current = null;
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [showQRScanner]);

     // Scan QR code from video
    const scanQRCode = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        try {
            const context = canvasRef.current.getContext('2d');
            if (!context) return;

            context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
            const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);

            // Use jsQR to detect QR codes
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
                await handleQRDetected(code.data);
            }
        } catch (error) {
            console.error('QR scan error:', error);
        }
    };

    const handleQRDetected = async (qrData: string) => {
        // Stop scanning immediately to prevent duplicate calls
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }

        try {
            // Parse QR data format: "tableNumber:restaurantName"
            // The generator encodes spaces as underscores, so decode them back
            const parts = qrData.split(':');
            const tableNumber = parts[0] || prompt('Enter table number:');
            const rawName = parts[1] || session.restaurantName || prompt('Enter restaurant name:');
            const restaurantName = rawName ? rawName.replace(/_/g, ' ') : rawName;

            if (!tableNumber || !restaurantName) {
                setQrError('Invalid QR code data. Please try again.');
                return;
            }

            await connectTableViaQR(tableNumber, restaurantName);
            setShowQRScanner(false);
            setQrError('');

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        } catch (error) {
            // On failure, resume scanning so the user can try again
            scanIntervalRef.current = setInterval(() => {
                if (videoRef.current?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
                    scanQRCode();
                }
            }, 300);
            setQrError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Manual table input (fallback for QR)
    const handleManualConnect = async () => {
        const tableNumber = prompt('Enter table number:');
        const restaurantName = prompt('Enter restaurant name:');

        if (tableNumber && restaurantName) {
            try {
                await connectTableViaQR(tableNumber, restaurantName);
                setShowQRScanner(false);
                setQrError('');
            } catch (error) {
                setQrError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    };

    const handleSendMessage = async (textOverride?: string) => {
        const text = (textOverride || input).trim();
        if (!text || isLoading) return;

        const newUserMessage: ChatMessage = { id: uid(), author: MessageAuthor.USER, text };
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const history = messages.map(m => ({
                role: m.author === MessageAuthor.USER ? 'user' : 'assistant' as 'user' | 'assistant',
                content: m.text
            }));

            const response = await chatWithAiWaiter(
                text,
                history,
                { restaurantName: session.restaurantName, tableNumber: String(session.tableNumber) }
            );

            const authorMap: Record<string, MessageAuthor> = {
                'LIORA': MessageAuthor.LIORA,
                'liora': MessageAuthor.LIORA,
                'SYSTEM': MessageAuthor.SYSTEM,
                'system': MessageAuthor.SYSTEM,
            };

            setMessages(prev => [...prev, {
                id: response.id || uid(),
                author: authorMap[response.author] || MessageAuthor.LIORA,
                text: response.text
            }]);
        } catch (e) {
            setMessages(prev => [...prev, { id: uid(), author: MessageAuthor.SYSTEM, text: "I'm having trouble connecting to the kitchen. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Mode 1: Disconnected / Scanner Mode ---
    if (!session.isActive) {
        return (
            <>
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-8 animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 bg-white rounded-3xl border border-cream-200 shadow-inner flex items-center justify-center text-stone-800">
                            <Icon name="qr_code" className="w-12 h-12" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-brand-400 rounded-full border-4 border-cream-200 flex items-center justify-center shadow-md">
                            <Icon name="plus" className="w-4 h-4 text-white" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-3xl font-lora font-bold text-stone-800 mb-3">Connect to Table</h2>
                        <p className="text-stone-400 max-w-sm mx-auto leading-relaxed">
                            Scan the QR code at any Liora Partner restaurant to unlock instant service, digital ordering, and table-side assistance.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setShowQRScanner(true);
                            setQrError('');
                        }}
                        className="group flex items-center gap-3 px-8 py-4 bg-brand-400 text-white rounded-2xl font-bold shadow-lg hover:bg-cream-200 transition-all transform active:scale-95"
                    >
                        <Icon name="scan" className="w-6 h-6 group-hover:animate-pulse" />
                        Open Camera Scanner
                    </button>
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Secure Liora Direct Connection</p>
                </div>

                {/* QR Scanner Modal */}
                {showQRScanner && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6">
                        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-md w-full">
                            {/* Header */}
                            <div className="bg-brand-400 text-white p-6 flex justify-between items-center">
                                <h3 className="font-lora text-xl font-bold">Scan QR Code</h3>
                                <button
                                    onClick={() => {
                                        setShowQRScanner(false);
                                        if (streamRef.current) {
                                            streamRef.current.getTracks().forEach(track => track.stop());
                                        }
                                    }}
                                    className="text-white hover:opacity-80"
                                >
                                    <Icon name="close" size={24} />
                                </button>
                            </div>

                            {/* Camera Feed */}
                            <div className="relative bg-black p-6">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full rounded-2xl"
                                    style={{ aspectRatio: '1' }}
                                />
                                <canvas
                                    ref={canvasRef}
                                    className="hidden"
                                    width={300}
                                    height={300}
                                />

                                {/* QR Frame Overlay */}
                                <div className="absolute inset-0 p-6 flex items-center justify-center pointer-events-none">
                                    <div className="w-64 h-64 border-4 border-brand-400 rounded-2xl"></div>
                                </div>
                            </div>

                            {/* Error Message */}
                            {qrError && (
                                <div className="bg-red-50 p-4 text-red-600 text-sm font-medium">
                                    {qrError}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="p-6 space-y-3 border-t border-cream-200">
                                <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-medium py-2">
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    Scanning automatically — point camera at QR code
                                </div>
                                <button
                                    onClick={handleManualConnect}
                                    className="w-full py-3 bg-cream-100 text-stone-800 rounded-xl font-bold border border-cream-200 hover:bg-cream-200 transition-all"
                                >
                                    Manual Entry
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // --- Mode 2: Live Service Mode ---
    return (
        <div className="h-full flex flex-col bg-white overflow-hidden animate-page-slide relative">
            {/* Bill Splitter Modal Overlay */}
            {showSplitter && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <BillSplitter onClose={() => setShowSplitter(false)} />
                </div>
            )}

            {/* Active Session Header */}
            <div className="p-4 border-b border-cream-200 bg-white flex justify-between items-center shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-10 h-10 bg-brand-400 rounded-xl flex items-center justify-center text-white shadow-md">
                            <Icon name="utensils" className="w-5 h-5" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                    </div>
                    <div>
                        <h2 className="font-lora font-bold text-lg text-stone-800 leading-tight">{session.restaurantName}</h2>
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold tracking-widest text-brand-400 uppercase">Table {session.tableNumber}</span>
                             <span className="w-1 h-1 bg-cream-200/60 rounded-full" />
                             <span className="text-[10px] font-bold tracking-widest text-green-600 uppercase">Live</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowSplitter(true)}
                        className="p-2.5 bg-cream-50 text-stone-800 rounded-xl hover:bg-cream-200/60 transition-all shadow-sm flex items-center gap-2 text-xs font-bold border border-cream-200"
                    >
                        <Icon name="pie_chart" size={16} /> <span className="hidden sm:inline">Split Bill</span>
                    </button>
                    <button 
                        onClick={() => {
                            if (window.confirm("Ready to leave the table? This will end your active session.")) endSession();
                        }}
                        className="p-2.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Leave Table"
                    >
                        <Icon name="x" size={20} />
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-6 scrollbar-hide bg-white">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.author === MessageAuthor.USER ? 'justify-end' : 'justify-start'}`}>
                        {msg.author !== MessageAuthor.USER && (
                             <div className="w-8 h-8 rounded-full bg-brand-400 flex-shrink-0 flex items-center justify-center text-white font-bold text-[10px] shadow-sm mt-1">AI</div>
                        )}
                        <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm leading-relaxed ${
                            msg.author === MessageAuthor.USER 
                                ? 'bg-brand-400 text-white rounded-br-none font-medium' 
                                : 'bg-white text-stone-800 border border-cream-200/60 rounded-bl-none'
                        }`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-brand-400 flex-shrink-0" />
                        <div className="bg-white p-4 rounded-2xl border border-cream-200/60 shadow-sm flex items-center gap-2">
                            <Spinner />
                            <span className="text-xs text-stone-400 font-medium">Checking with the kitchen...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions Bar - Scrollable Left to Right */}
            <div className="px-4 py-3 flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide border-t border-cream-200 bg-white overscroll-x-contain touch-pan-x">
                {["Call Waiter", "Order Drinks", "Request Bill", "Dietary Question", "See Specials", "Get Manager"].map(action => (
                    <button 
                        key={action}
                        onClick={() => handleSendMessage(action)}
                        className="px-5 py-2.5 rounded-full bg-cream-50 border border-cream-200 text-[11px] font-bold text-stone-400 whitespace-nowrap hover:bg-brand-400 hover:text-white hover:border-brand-400 transition-all flex-shrink-0 shadow-sm active:scale-95"
                    >
                        {action}
                    </button>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-2 max-w-3xl mx-auto">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={`Order or ask ${session.restaurantName}...`}
                        className="flex-1 p-3 bg-cream-100/80 border border-cream-200 rounded-xl outline-none text-stone-800 text-sm focus:ring-2 focus:ring-brand-400/30 transition-all"
                        disabled={isLoading}
                    />
                    <button 
                        onClick={() => handleSendMessage()}
                        disabled={!input.trim() || isLoading}
                        className="p-3 bg-brand-400 text-white rounded-xl shadow-md hover:bg-cream-200 disabled:opacity-50 disabled:bg-cream-200/60 transition-all flex-shrink-0"
                    >
                        <Icon name="send" className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};