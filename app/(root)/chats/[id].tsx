import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/src/context/ThemeContext';
import ChatScreenContent from '@/components/chat/ChatScreenContent';

export default function ChatScreen() {
  return <ChatScreenContentWrapper />;
}

// Main chat screen component
function ChatScreenContentWrapper() {
  const { isDarkMode } = useTheme();

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <ChatScreenContent />
    </>
  );
}
