; Inno Setup script for the Siriso PDF desktop app (CEF launcher + bundled runtime + backend).
; Built by build-installer.ps1, which passes AppImage, AppVersion and OutputDir.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef AppImage
  #error AppImage (the jpackage app image directory) must be defined
#endif
#ifndef OutputDir
  #define OutputDir "."
#endif

#define AppName "Siriso PDF"
#define AppExeName "Siriso PDF.exe"

[Setup]
; Fixed for the product's lifetime: upgrades and the uninstaller find earlier installs by it.
AppId={{6DCD0B29-FDB7-4D68-B74D-CD34BEC6944B}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=Siriso Lab
AppPublisherURL=https://sirisolab.com
AppSupportURL=https://sirisolab.com
VersionInfoVersion={#AppVersion}
VersionInfoProductName={#AppName}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
; Per-user install by default, so no administrator prompt; the dialog still offers all users.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#OutputDir}
OutputBaseFilename=Siriso-PDF-Setup-{#AppVersion}
SetupIconFile=siriso.ico
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName}
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
WizardStyle=modern
CloseApplications=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#AppImage}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

; User data (%LOCALAPPDATA%\SirisoPDF-CEF) is kept on uninstall so a reinstall keeps documents and settings.
