@echo off
set BACKUP_DIR=D:\Backups\mpc
set TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo Backing up MPC database...
pg_dump -U postgres -d mpc -F c -f "%BACKUP_DIR%\mpc_%TIMESTAMP%.dump"

echo Backup complete: %BACKUP_DIR%\mpc_%TIMESTAMP%.dump

:: Keep only last 30 backups
cd /d %BACKUP_DIR%
for /f "skip=30 delims=" %%F in ('dir /b /o-d *.dump') do del "%%F"
