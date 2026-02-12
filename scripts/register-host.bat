@echo off
setlocal

set HOST_NAME=com.github.copilot.browser
set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%..
set HOST_PATH=%PROJECT_DIR%\src\host\host.js

set EXTENSION_ID=%1
if "%EXTENSION_ID%"=="" (
    echo Usage: register-host.bat ^<chrome-extension-id^>
    echo.
    echo To find your extension ID:
    echo   1. Go to chrome://extensions
    echo   2. Enable Developer Mode
    echo   3. Load the extension and copy its ID
    exit /b 1
)

:: Chrome
set CHROME_DIR=%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts
if not exist "%CHROME_DIR%" mkdir "%CHROME_DIR%"

echo {> "%CHROME_DIR%\%HOST_NAME%.json"
echo   "name": "%HOST_NAME%",>> "%CHROME_DIR%\%HOST_NAME%.json"
echo   "description": "GitHub Copilot Browser Extension Native Messaging Host",>> "%CHROME_DIR%\%HOST_NAME%.json"
echo   "path": "node %HOST_PATH:\=\\%",>> "%CHROME_DIR%\%HOST_NAME%.json"
echo   "type": "stdio",>> "%CHROME_DIR%\%HOST_NAME%.json"
echo   "allowed_origins": [>> "%CHROME_DIR%\%HOST_NAME%.json"
echo     "chrome-extension://%EXTENSION_ID%/">> "%CHROME_DIR%\%HOST_NAME%.json"
echo   ]>> "%CHROME_DIR%\%HOST_NAME%.json"
echo }>> "%CHROME_DIR%\%HOST_NAME%.json"

:: Add registry entry for Chrome
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%CHROME_DIR%\%HOST_NAME%.json" /f >nul

echo Registered for Chrome.

:: Edge
set EDGE_DIR=%LOCALAPPDATA%\Microsoft\Edge\User Data\NativeMessagingHosts
if not exist "%EDGE_DIR%" mkdir "%EDGE_DIR%"

copy "%CHROME_DIR%\%HOST_NAME%.json" "%EDGE_DIR%\%HOST_NAME%.json" >nul

reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%EDGE_DIR%\%HOST_NAME%.json" /f >nul

echo Registered for Edge.
echo.
echo Done! Make sure Node.js is installed and restart your browser.
