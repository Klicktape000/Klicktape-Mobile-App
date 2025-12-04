@echo off
echo 🔧 Fixing Metro Cache Issues...

echo.
echo 1. Clearing Metro cache...
npx react-native start --reset-cache --port 8081 > nul 2>&1
timeout /t 2 > nul

echo.
echo 2. Clearing Expo cache...
npx expo start --clear --port 8081 > nul 2>&1
timeout /t 2 > nul

echo.
echo 3. Clearing node_modules cache...
if exist node_modules\metro-cache rmdir /s /q node_modules\metro-cache
if exist node_modules\.cache rmdir /s /q node_modules\.cache

echo.
echo 4. Clearing temp files...
if exist %TEMP%\metro-* del /q %TEMP%\metro-*
if exist %TEMP%\react-native-* del /q %TEMP%\react-native-*

echo.
echo 5. Clearing Expo temp...
if exist %USERPROFILE%\.expo\metro-cache rmdir /s /q %USERPROFILE%\.expo\metro-cache

echo.
echo ✅ Cache cleared! Now starting Expo with clean cache...
echo.

npx expo start --clear
