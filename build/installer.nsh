; Keep electron-builder's broad app-data deletion disabled: it also targets the
; source-development profile. Only these installed-app-owned directories belong
; to this uninstaller. Completed media lives in user-selected download folders.
!macro customUnInstall
  ; Both automatic updates and running a newer installer invoke the previous
  ; uninstaller with --updated. Never remove profiles or partials in that case.
  ${ifNot} ${isUpdated}
    SetShellVarContext current
    RMDir /r "$APPDATA\Season Shelf\installed"
    RMDir /r "$LOCALAPPDATA\season-shelf-updater"
    ; Remove the parent only when empty; never recurse into sibling profiles.
    RMDir "$APPDATA\Season Shelf"
    ${if} $installMode == "all"
      SetShellVarContext all
    ${endif}
  ${endif}
!macroend
