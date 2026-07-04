import React from 'react';
import { createRoot } from 'react-dom/client';
import Settings from './Settings';
import '../panel/styles/panel.css';

const root = createRoot(document.getElementById('root')!);
root.render(<Settings />);
