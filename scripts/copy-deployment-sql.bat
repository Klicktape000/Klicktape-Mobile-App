@echo off
echo 📋 Copying production deployment SQL to clipboard...
echo.

REM Copy the deployment SQL file to clipboard
type "scripts\production-deployment.sql" | clip

echo ✅ Deployment SQL copied to clipboard!
echo.
echo 📋 Next steps:
echo 1. The Supabase SQL Editor should be open in your browser
echo 2. Create a new query in the SQL Editor
echo 3. Paste the SQL (Ctrl+V) into the editor
echo 4. Click "Run" to execute the deployment
echo 5. Verify the results
echo.
echo 🔗 If the browser didn't open, go to:
echo    https://app.supabase.com/project/wpxkjqfcoudcddluiiab/sql
echo.
pause
