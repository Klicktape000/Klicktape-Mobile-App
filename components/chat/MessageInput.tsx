import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReplyPreview from './ReplyPreview';

import { Message } from '../../types/shared';

interface MessageInputProps {
  onSendMessage: (content: string, replyToMessageId?: string) => void;
  onTypingStatusChange: (isTyping: boolean) => void;
  replyToMessage?: Message;
  onCancelReply: () => void;
  currentUserId: string;
  placeholder?: string;
  disabled?: boolean;
  isConnected?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTypingStatusChange,
  replyToMessage,
  onCancelReply,
  currentUserId,
  placeholder = "Type a message...",
  disabled = false,
  isConnected = true,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), replyToMessage?.id);
      setMessage('');
      handleTypingStop();
      
      // Cancel reply after sending
      if (replyToMessage) {
        onCancelReply();
      }
    }
  };

  const handleTypingStart = () => {
    if (!isTyping) {
      setIsTyping(true);
      onTypingStatusChange(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStop();
    }, 2000) as any; // Stop typing indicator after 2 seconds of inactivity
  };

  const handleTypingStop = () => {
    if (isTyping) {
      setIsTyping(false);
      onTypingStatusChange(false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleTextChange = (text: string) => {
    setMessage(text);
    
    if (text.trim()) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const inputContainerStyle = {
    ...styles.inputContainer,
    backgroundColor: colors.backgroundSecondary,
    borderColor: (colors as any).border || colors.textSecondary,
  };

  const inputStyle = {
    ...styles.textInput,
    color: colors.text,
    fontFamily: 'Rubik-Regular',
  };

  const effectivePlaceholder = isConnected
    ? placeholder
    : `${placeholder} (offline mode)`;

  const sendButtonStyle = {
    ...styles.sendButton,
    backgroundColor: message.trim() ? '#25D366' : colors.backgroundSecondary,
  };

  return (
    <View style={styles.container}>
      {/* Reply Preview */}
      {replyToMessage && (
        <ReplyPreview
          replyToMessage={replyToMessage}
          currentUserId={currentUserId}
          onCancel={onCancelReply}
        />
      )}

      {/* Input Row */}
      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={inputContainerStyle}>
          <TextInput
            style={inputStyle}
            value={message}
            onChangeText={handleTextChange}
            placeholder={effectivePlaceholder}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={1000}
            editable={!disabled}
            blurOnSubmit={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            enablesReturnKeyAutomatically={true}
            autoFocus={false}
          />
        </View>

        <TouchableOpacity
          style={sendButtonStyle}
          onPress={handleSend}
          disabled={!message.trim() || disabled}
          activeOpacity={0.7}
        >
          <Ionicons
            name="send"
            size={22}
            color={message.trim() ? "white" : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    // paddingBottom is now set dynamically using safe area insets
  },
  inputContainer: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    minHeight: 44,
    maxHeight: 100,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'center',
    maxHeight: 80,
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

MessageInput.displayName = 'MessageInput';

export default MessageInput;
