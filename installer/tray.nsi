!include "MUI2.nsh"
Unicode true

!ifndef VERSION
  !define VERSION "1.0.7"
!endif
!ifndef VERSION4
  !define VERSION4 "1.0.7.0"
!endif
!ifndef SRCDIR
  !define SRCDIR "..\release-artifacts-tray\app"
!endif
!ifndef OUTFILE
  !define OUTFILE "..\release-artifacts-tray\EZWIN-HUB-Tray-Setup-${VERSION}.exe"
!endif
!ifndef ICONFILE
  !define ICONFILE "..\release-artifacts-tray\app\ezwin.ico"
!endif

!define APPNAME "EZWIN HUB Tray"
!define APPEXE "EZWIN HUB Tray.exe"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\EZWINHUBTray"

Name "${APPNAME} ${VERSION}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\EZWIN HUB Tray"
InstallDirRegKey HKCU "Software\EZWIN\HUB Tray" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ManifestDPIAware true
XPStyle on
CRCCheck on

VIProductVersion "${VERSION4}"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "FileDescription" "${APPNAME} kurulumu"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "EZWIN"
VIAddVersionKey "LegalCopyright" "© 2026 EZWIN"

!define MUI_ABORTWARNING
!define MUI_ICON "${ICONFILE}"
!define MUI_UNICON "${ICONFILE}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APPEXE}"
!define MUI_FINISHPAGE_RUN_TEXT "EZWIN HUB Tray'i şimdi aç"
!define MUI_FINISHPAGE_TEXT "EZWIN HUB Tray tepside çalışır ve arka plan kontrollerini sürdürür.$\r$\n$\r$\nWindows ile başlatma varsayılan olarak açıldı. Tepsi menüsünden değiştirebilirsin."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Turkish"

BrandingText "EZWIN · ezwinstudio"

Section "Kurulum" SEC_MAIN
  SetShellVarContext current
  nsExec::ExecToLog 'taskkill /F /IM "${APPEXE}"'
  Pop $0

  SetOutPath "$INSTDIR"
  File /r "${SRCDIR}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall ${APPNAME}.exe"

  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${APPEXE}" "" "$INSTDIR\${APPEXE}" 0
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${APPEXE}" "" "$INSTDIR\${APPEXE}" 0
  CreateShortCut "$SMPROGRAMS\${APPNAME}\Kaldır.lnk" "$INSTDIR\Uninstall ${APPNAME}.exe"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "EZWIN HUB Tray" '"$INSTDIR\${APPEXE}" --background'
  WriteRegStr HKCU "Software\EZWIN\HUB Tray" "InstallDir" "$INSTDIR"

  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "EZWIN"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${APPEXE}"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Uninstall ${APPNAME}.exe"'
  WriteRegStr HKCU "${UNINSTKEY}" "QuietUninstallString" '"$INSTDIR\Uninstall ${APPNAME}.exe" /S'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::ExecToLog 'taskkill /F /IM "${APPEXE}"'
  Pop $0

  Delete "$DESKTOP\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\Kaldır.lnk"
  RMDir "$SMPROGRAMS\${APPNAME}"

  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "EZWIN HUB Tray"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegValue HKCU "Software\EZWIN\HUB Tray" "InstallDir"

  SetOutPath "$TEMP"
  RMDir /r "$INSTDIR"
SectionEnd
