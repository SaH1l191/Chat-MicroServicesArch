import { useEffect, useRef, useCallback } from 'react';

interface MessageWorkerMessage {
    type: 'PROCESS_MESSAGE' | 'ERROR' | 'QUEUE_SIZE';
    payload?: any;
    error?: string;
    size?: number;
}

interface QueuedMessage {
    chatId: string;
    text?: string;
    image?: File;
    timestamp: number;
}

/**
 * Hook to manage message worker for queuing and processing messages
 * Simplifies message handling by offloading work to a Web Worker
 */
export const useMessageWorker = (
    onProcessMessage: (message: QueuedMessage) => void | Promise<void>,
    onError?: (error: string) => void
) => {
    const workerRef = useRef<Worker | null>(null);
    const isInitializedRef = useRef(false);

    useEffect(() => {
        // Initialize worker
        if (typeof window !== 'undefined' && !isInitializedRef.current) {
            try {
                const worker = new Worker('/messageWorker.js');
                workerRef.current = worker;
                isInitializedRef.current = true;

                worker.onmessage = (e: MessageEvent<MessageWorkerMessage>) => {
                    const { type, payload, error, size } = e.data;

                    switch (type) {
                        case 'PROCESS_MESSAGE':
                            if (payload) {
                                onProcessMessage(payload);
                            }
                            break;

                        case 'ERROR':
                            if (error && onError) {
                                onError(error);
                            }
                            break;

                        case 'QUEUE_SIZE':
                            // Can be used for debugging or UI indicators
                            break;

                        default:
                            console.warn('[useMessageWorker] Unknown message type:', type);
                    }
                };

                worker.onerror = (error) => {
                    console.error('[Message Worker] Error:', error);
                    if (onError) {
                        onError(error.message);
                    }
                };
            } catch (error) {
                console.error('[useMessageWorker] Failed to initialize worker:', error);
                // Fallback: continue without worker
            }
        }

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
                isInitializedRef.current = false;
            }
        };
    }, [onProcessMessage, onError]);

    const queueMessage = useCallback((message: Omit<QueuedMessage, 'timestamp'>) => {
        if (workerRef.current) {
            workerRef.current.postMessage({
                type: 'QUEUE_MESSAGE',
                payload: {
                    ...message,
                    timestamp: Date.now()
                }
            });
        } else {
            // Fallback: process immediately if worker not available
            onProcessMessage({
                ...message,
                timestamp: Date.now()
            });
        }
    }, [onProcessMessage]);

    const clearQueue = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.postMessage({
                type: 'CLEAR_QUEUE'
            });
        }
    }, []);

    const getQueueSize = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.postMessage({
                type: 'GET_QUEUE_SIZE'
            });
        }
        return 0;
    }, []);

    return {
        queueMessage,
        clearQueue,
        getQueueSize,
        isWorkerAvailable: workerRef.current !== null
    };
};

