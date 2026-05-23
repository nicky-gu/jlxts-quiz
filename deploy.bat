@echo off
echo ==========================================
echo   信息系统监理师刷题系统 - 部署到 GitHub Pages
echo ==========================================
echo.

:: Check if git is installed
where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [!] 未检测到 git，请先安装: https://git-scm.com/download/win
    echo     安装后重启终端，重新运行此脚本
    echo.
    echo [备选方案] 也可以手动操作:
    echo   1. 打开 https://github.com/new 创建新仓库
    echo   2. 上传 quiz-site 文件夹内所有文件
    echo   3. Settings ^> Pages ^> Source: main branch
    echo.
    pause
    exit /b 1
)

echo 请输入你的 GitHub 用户名:
set /p GITHUB_USER=

echo 请输入仓库名 (默认: jlxts-quiz):
set /p REPO_NAME=
if "%REPO_NAME%"=="" set REPO_NAME=jlxts-quiz

echo.
echo [*] 初始化 git 仓库...
git init
git add -A
git commit -m "信息系统监理师刷题系统"

echo [*] 创建 GitHub 仓库...
gh repo create %REPO_NAME% --public --source=. --push
if %ERRORLEVEL% neq 0 (
    echo.
    echo [!] gh CLI 未登录，请手动操作:
    echo   1. 在 GitHub 上创建仓库: https://github.com/new
    echo      仓库名: %REPO_NAME%
    echo      勾选: Add a README
    echo.
    echo   2. 然后运行:
    echo      git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git
    echo      git branch -M main
    echo      git push -u origin main
    echo.
    echo   3. 打开 https://github.com/%GITHUB_USER%/%REPO_NAME%/settings/pages
    echo      Source: Deploy from a branch
    echo      Branch: main / (root)
    echo      Save
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   部署完成!
echo   网站地址: https://%GITHUB_USER%.github.io/%REPO_NAME%/
echo   (可能需要等1-2分钟生效)
echo ==========================================
pause
