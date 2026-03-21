@echo off
cd /d "%~dp0dist" || exit /b 1
npm publish --access public
