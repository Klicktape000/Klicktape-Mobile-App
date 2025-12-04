# Notification Sounds

This directory contains custom notification sounds for the KlickTape app.

## Sound Files

Place your custom notification sound files in this directory with the following naming convention:

- `notification_like.wav` - Sound for like notifications
- `notification_comment.wav` - Sound for comment notifications  
- `notification_follow.wav` - Sound for follow notifications
- `notification_message.wav` - Sound for message notifications
- `notification_mention.wav` - Sound for mention notifications
- `notification_default.wav` - Default notification sound

## Requirements

- **Format**: WAV or MP3 (WAV recommended for better compatibility)
- **Duration**: 1-3 seconds maximum
- **Sample Rate**: 44.1 kHz or 48 kHz
- **Bit Depth**: 16-bit or 24-bit
- **File Size**: Keep under 100KB for optimal performance

## Platform Considerations

### iOS
- Sounds must be in the app bundle
- Supported formats: WAV, AIFF, CAF
- Maximum duration: 30 seconds (longer sounds will be truncated)

### Android
- Sounds can be in assets or raw resources
- Supported formats: WAV, MP3, OGG
- No strict duration limit but keep short for better UX

## Usage

The notification system will automatically use these custom sounds when available, falling back to the system default sound if custom sounds are not found.

To add custom sounds:

1. Place sound files in this directory
2. Update the `NotificationPlatformConfig` if needed
3. Test on both iOS and Android devices

## Current Status

🔄 **Custom sounds not yet implemented** - Currently using system default sounds.

To implement custom sounds:
1. Add sound files to this directory
2. Update app.config.js to include sound assets
3. Modify notification service to reference custom sounds
4. Test on physical devices (sounds don't work in simulators)
