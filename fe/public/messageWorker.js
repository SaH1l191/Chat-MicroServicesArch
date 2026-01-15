/**
 * Frontend Message Worker
 * Handles message queuing and processing off the main thread
 * Simplifies message handling and prevents UI blocking
 */

let messageQueue = [];
let isProcessing = false;

// Process messages from queue
async function processQueue() {
    if (isProcessing || messageQueue.length === 0) {
        return;
    }

    isProcessing = true;
    const message = messageQueue.shift();

    try {
        // Notify main thread to handle the message
        self.postMessage({
            type: 'PROCESS_MESSAGE',
            payload: message
        });
    } catch (error) {
        console.error('[Message Worker] Error processing message:', error);
        self.postMessage({
            type: 'ERROR',
            error: error.message
        });
    } finally {
        isProcessing = false;
        // Process next message if any
        if (messageQueue.length > 0) {
            setTimeout(processQueue, 0);
        }
    }
}

// Handle messages from main thread
self.onmessage = function(e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'QUEUE_MESSAGE':
            // Add message to queue
            messageQueue.push(payload);
            processQueue();
            break;

        case 'CLEAR_QUEUE':
            messageQueue = [];
            break;

        case 'GET_QUEUE_SIZE':
            self.postMessage({
                type: 'QUEUE_SIZE',
                size: messageQueue.length
            });
            break;

        default:
            console.warn('[Message Worker] Unknown message type:', type);
    }
};

