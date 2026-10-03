import { io } from 'socket.io-client';

// No URL = same origin; Vite proxies /socket.io to the game server
export const socket = io({ transports: ['websocket'] });