!ifndef BUILD_UNINSTALLER
  Var OrbitaOldAutoStart
!endif

!macro customInit
  ReadRegStr $OrbitaOldAutoStart HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Orbita"

  ExecWait '"$SYSDIR\taskkill.exe" /F /IM Orbita.exe'
  Sleep 600

  ; C#/WebView2 kurulumu varsa sessizce kaldır; veri klasörleri korunur.
  IfFileExists "$LOCALAPPDATA\Programs\Orbita\resources\app.asar" orbita_install_ready
  IfFileExists "$LOCALAPPDATA\Programs\Orbita\Uninstall Orbita.exe" 0 orbita_install_ready
    DetailPrint "Eski Orbita masaüstü kurulumu kaldırılıyor..."
    ExecWait '"$LOCALAPPDATA\Programs\Orbita\Uninstall Orbita.exe" /S'
    Sleep 1200

  orbita_install_ready:
!macroend

!macro customInstall
  ; Otomatik başlatma açıksa yeni Electron yoluyla korunur.
  StrCmp $OrbitaOldAutoStart "" orbita_autostart_done
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Orbita" '"$INSTDIR\Orbita.exe" --background'
  orbita_autostart_done:
!macroend

!macro customUnInstall
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Orbita"
  StrCmp $0 '"$INSTDIR\Orbita.exe" --background' 0 orbita_uninstall_done
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Orbita"
  orbita_uninstall_done:
!macroend
