@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 目标dist目录，自行确认路径无误
set "DIST_PATH=E:\Desktop\html\myrzg\vue-myrzg\dist"

:: 检查目录是否存在
if not exist "%DIST_PATH%" (
    echo 错误：目录不存在 "%DIST_PATH%"
    pause
    exit /b 1
)

echo ==============================================
echo 目录：%DIST_PATH%
echo 仅保留指定文件夹与文件，其余全部删除
echo ==============================================
echo.

:: 定义需要保留的文件夹列表（空格分隔）
set "KEEP_DIRS=assets fonts ui"
:: 定义需要保留的文件列表（空格分隔）
set "KEEP_FILES=_redirects index.html"

:: 遍历dist下所有一级子文件夹，不在保留列表则删除
echo [1/2] 清理多余文件夹...
for /d %%d in ("%DIST_PATH%\*") do (
    set "DIR_NAME=%%~nd"
    set "IS_KEEP=0"
    for %%k in (%KEEP_DIRS%) do (
        if "!DIR_NAME!"=="%%k" set "IS_KEEP=1"
    )
    if !IS_KEEP! equ 0 (
        echo 删除文件夹：%%d
        rmdir /s /q "%%d"
    )
)

:: 遍历dist下所有一级文件，不在保留列表则删除
echo [2/2] 清理多余文件...
for %%f in ("%DIST_PATH%\*.*") do (
    set "FILE_NAME=%%~nxf"
    set "IS_KEEP=0"
    for %%k in (%KEEP_FILES%) do (
        if "!FILE_NAME!"=="%%k" set "IS_KEEP=1"
    )
    if !IS_KEEP! equ 0 (
        echo 删除文件：%%f
        del /f /q "%%f"
    )
)

echo.
echo ==============================================
echo 清理完成！
echo ==============================================
pause
